use std::time::{Instant, SystemTime, UNIX_EPOCH};

use super::runtime::RuntimeKind;
use super::BenchmarkResult;

const WARMUP_MAX_TOKENS: u32 = 16;
const MEASURED_RUNS: usize = 3;
const MAX_TOKENS: u32 = 128;
const PROMPT: &str = "Explain in three concise bullet points why local AI inference is beneficial for privacy, speed, and offline access.";

#[derive(Debug, Clone)]
struct RunMetrics {
    ttft_sec: f64,
    prompt_eval_tok_per_sec: f64,
    generation_tok_per_sec: f64,
    total_tokens: u64,
    total_duration_sec: f64,
    sample_output: String,
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())
}

/// Benchmark a model on a specific runtime: one warm-up run to absorb
/// the cold model load, then `MEASURED_RUNS` measured streaming runs;
/// medians are reported and variance exposed via min/max
/// (docs/technical-route.md D4).
pub async fn run_benchmark(
    runtime: RuntimeKind,
    model_name: &str,
) -> Result<BenchmarkResult, String> {
    let client = client()?;

    match runtime {
        RuntimeKind::Ollama => {
            ollama_stream_once(&client, model_name, WARMUP_MAX_TOKENS).await?;
            let mut runs = Vec::with_capacity(MEASURED_RUNS);
            for i in 0..MEASURED_RUNS {
                runs.push(
                    ollama_stream_once(&client, model_name, MAX_TOKENS)
                        .await
                        .map_err(|e| {
                            format!("Measurement run {}/{} failed: {e}", i + 1, MEASURED_RUNS)
                        })?,
                );
            }
            Ok(assemble(runtime, model_name, runs))
        }
        RuntimeKind::LmStudio | RuntimeKind::LlamaCpp => {
            openai_stream_once(&client, runtime.base_url(), model_name, WARMUP_MAX_TOKENS).await?;
            let mut runs = Vec::with_capacity(MEASURED_RUNS);
            for i in 0..MEASURED_RUNS {
                runs.push(
                    openai_stream_once(&client, runtime.base_url(), model_name, MAX_TOKENS)
                        .await
                        .map_err(|e| {
                            format!("Measurement run {}/{} failed: {e}", i + 1, MEASURED_RUNS)
                        })?,
                );
            }
            Ok(assemble(runtime, model_name, runs))
        }
    }
}

// --- Ollama: NDJSON stream with server-side timings ---

async fn ollama_stream_once(
    client: &reqwest::Client,
    model_name: &str,
    num_predict: u32,
) -> Result<RunMetrics, String> {
    let start = Instant::now();
    let mut res = client
        .post("http://localhost:11434/api/generate")
        .json(&serde_json::json!({
            "model": model_name,
            "prompt": PROMPT,
            "stream": true,
            "options": {
                "num_predict": num_predict,
                "temperature": 0.0,
                "seed": 42
            }
        }))
        .send()
        .await
        .map_err(|e| format!("Could not reach Ollama ({e}). Is `ollama serve` running?"))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Ollama returned HTTP {status}: {body}"));
    }

    let mut ttft_sec: f64 = 0.0;
    let mut sample_output = String::new();
    let mut final_frame: Option<serde_json::Value> = None;
    let mut buf = String::new();

    while let Some(chunk) = res.chunk().await.map_err(|e| e.to_string())? {
        if ttft_sec == 0.0 {
            ttft_sec = start.elapsed().as_secs_f64();
        }
        buf.push_str(&String::from_utf8_lossy(&chunk));

        // Ollama streams newline-delimited JSON; a chunk boundary can
        // split a line, so only complete lines are consumed here.
        while let Some(pos) = buf.find('\n') {
            let line: String = buf.drain(..=pos).collect();
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(tok) = v["response"].as_str() {
                    sample_output.push_str(tok);
                }
                if v["done"].as_bool() == Some(true) {
                    final_frame = Some(v);
                }
            }
        }
    }

    if let Some(rest) = buf.lines().last() {
        let rest = rest.trim();
        if !rest.is_empty() {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(rest) {
                if let Some(tok) = v["response"].as_str() {
                    sample_output.push_str(tok);
                }
                if v["done"].as_bool() == Some(true) {
                    final_frame = Some(v);
                }
            }
        }
    }

    if ttft_sec == 0.0 {
        return Err("Ollama closed the stream without generating any tokens.".to_string());
    }
    let final_frame = final_frame
        .ok_or_else(|| "Ollama stream ended without a summary frame (done=true).".to_string())?;

    let eval_count = final_frame["eval_count"].as_u64().unwrap_or(0);
    let eval_duration = final_frame["eval_duration"].as_f64().unwrap_or(0.0) / 1e9;
    let prompt_count = final_frame["prompt_eval_count"].as_u64().unwrap_or(0);
    let prompt_duration = final_frame["prompt_eval_duration"].as_f64().unwrap_or(0.0) / 1e9;

    Ok(RunMetrics {
        ttft_sec,
        prompt_eval_tok_per_sec: if prompt_duration > 0.0 {
            prompt_count as f64 / prompt_duration
        } else {
            0.0
        },
        generation_tok_per_sec: if eval_duration > 0.0 {
            eval_count as f64 / eval_duration
        } else {
            0.0
        },
        total_tokens: eval_count,
        total_duration_sec: start.elapsed().as_secs_f64(),
        sample_output,
    })
}

// --- LM Studio / llama.cpp: OpenAI Chat Completions over SSE ---

/// One SSE event extracted from the wire: either a JSON payload or
/// the `[DONE]` sentinel. Returns (payload, is_done).
pub(crate) fn parse_sse_line(line: &str) -> Option<(Option<&str>, bool)> {
    let payload = line.strip_prefix("data:")?.trim();
    if payload == "[DONE]" {
        return Some((None, true));
    }
    if payload.is_empty() {
        return None;
    }
    Some((Some(payload), false))
}

#[derive(Debug, PartialEq)]
pub(crate) struct Delta {
    text: String,
    /// Present on the final frame when the server reports usage.
    prompt_tokens: Option<u64>,
    completion_tokens: Option<u64>,
}

/// Extract delta text / usage from one SSE payload. Visible for
/// tests; tolerant of both chat (`choices[].delta.content`) and
/// legacy completion (`choices[].text`) dialects.
pub(crate) fn parse_openai_delta(payload: &str) -> Option<Delta> {
    let v: serde_json::Value = serde_json::from_str(payload).ok()?;
    let mut text = String::new();
    if let Some(choice) = v["choices"].get(0) {
        if let Some(tok) = choice["delta"]["content"].as_str() {
            text.push_str(tok);
        } else if let Some(tok) = choice["text"].as_str() {
            text.push_str(tok);
        }
    }
    Some(Delta {
        text,
        prompt_tokens: v["usage"]["prompt_tokens"].as_u64(),
        completion_tokens: v["usage"]["completion_tokens"].as_u64(),
    })
}

async fn openai_stream_once(
    client: &reqwest::Client,
    base_url: &str,
    model_name: &str,
    max_tokens: u32,
) -> Result<RunMetrics, String> {
    let start = Instant::now();
    let mut res = client
        .post(format!("{base_url}/v1/chat/completions"))
        .json(&serde_json::json!({
            "model": model_name,
            "messages": [{"role": "user", "content": PROMPT}],
            "stream": true,
            "max_tokens": max_tokens,
            "temperature": 0.0,
            "seed": 42
        }))
        .send()
        .await
        .map_err(|e| format!("Could not reach {base_url} ({e}). Is the server running?"))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Runtime returned HTTP {status}: {body}"));
    }

    let mut ttft_sec: f64 = 0.0;
    let mut last_token_at: f64 = 0.0;
    let mut chunk_count: u64 = 0;
    let mut usage_tokens: Option<u64> = None;
    let mut sample_output = String::new();
    let mut prompt_tokens: Option<u64> = None;
    let mut buf = String::new();
    let mut done = false;

    while !done {
        let Some(chunk) = res.chunk().await.map_err(|e| e.to_string())? else {
            break;
        };
        buf.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(pos) = buf.find('\n') {
            let line: String = buf.drain(..=pos).collect();
            let Some((payload, is_done)) = parse_sse_line(line.trim()) else {
                continue;
            };
            if is_done {
                done = true;
                continue;
            }
            let Some(payload) = payload else { continue };

            if let Some(delta) = parse_openai_delta(payload) {
                if delta.prompt_tokens.is_some() {
                    prompt_tokens = delta.prompt_tokens;
                }
                if delta.completion_tokens.is_some() {
                    usage_tokens = delta.completion_tokens;
                }
                if !delta.text.is_empty() {
                    if ttft_sec == 0.0 {
                        ttft_sec = start.elapsed().as_secs_f64();
                    }
                    chunk_count += 1;
                    last_token_at = start.elapsed().as_secs_f64();
                    sample_output.push_str(&delta.text);
                }
            }
        }
    }

    if ttft_sec == 0.0 {
        return Err(format!(
            "{base_url} closed the stream without generating any tokens."
        ));
    }

    // Prefer server-reported usage when present (final SSE frame);
    // otherwise count content chunks client-side. Either way this is
    // wall-clock decode speed, not server eval timing — the OpenAI
    // dialect exposes no prompt-eval duration, so that metric is
    // approximated as prompt_tokens / TTFT and stays exact only on
    // Ollama.
    let token_count = usage_tokens.unwrap_or(chunk_count);
    let generation_window = (last_token_at - ttft_sec).max(0.001);
    let generation_tok_per_sec = (token_count as f64 / generation_window).min(100_000.0);
    let prompt_eval_tok_per_sec = match prompt_tokens {
        Some(pt) if pt > 0 => pt as f64 / ttft_sec,
        _ => 0.0,
    };

    Ok(RunMetrics {
        ttft_sec,
        prompt_eval_tok_per_sec,
        generation_tok_per_sec,
        total_tokens: token_count,
        total_duration_sec: start.elapsed().as_secs_f64(),
        sample_output,
    })
}

// --- Aggregation ---

fn median(values: &mut [f64]) -> f64 {
    values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    if values.is_empty() {
        return 0.0;
    }
    let mid = values.len() / 2;
    if values.len().is_multiple_of(2) {
        (values[mid - 1] + values[mid]) / 2.0
    } else {
        values[mid]
    }
}

fn round1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

fn assemble(runtime: RuntimeKind, model_name: &str, runs: Vec<RunMetrics>) -> BenchmarkResult {
    let mut ttfts: Vec<f64> = runs.iter().map(|r| r.ttft_sec).collect();
    let mut prefills: Vec<f64> = runs.iter().map(|r| r.prompt_eval_tok_per_sec).collect();
    let mut gens: Vec<f64> = runs.iter().map(|r| r.generation_tok_per_sec).collect();
    let mut durations: Vec<f64> = runs.iter().map(|r| r.total_duration_sec).collect();

    let generation_median = median(&mut gens);

    // Representative run = the one closest to the median generation
    // speed; its sample text and token count are shown in the UI.
    let median_run = runs
        .iter()
        .min_by(|a, b| {
            (a.generation_tok_per_sec - generation_median)
                .abs()
                .partial_cmp(&(b.generation_tok_per_sec - generation_median).abs())
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .cloned()
        .expect("at least one measured run");

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    BenchmarkResult {
        model: model_name.to_string(),
        runtime: runtime.id().to_string(),
        ttft_sec: round2(median(&mut ttfts)),
        prompt_eval_tok_per_sec: round1(median(&mut prefills)),
        generation_tok_per_sec: round1(generation_median),
        total_tokens: median_run.total_tokens,
        total_duration_sec: round2(median(&mut durations)),
        sample_output: median_run.sample_output,
        timestamp,
        runs_completed: runs.len() as u32,
        ttft_min_sec: round2(
            runs.iter()
                .map(|r| r.ttft_sec)
                .fold(f64::INFINITY, f64::min),
        ),
        ttft_max_sec: round2(runs.iter().map(|r| r.ttft_sec).fold(0.0, f64::max)),
        generation_min_tok_per_sec: round1(
            runs.iter()
                .map(|r| r.generation_tok_per_sec)
                .fold(f64::INFINITY, f64::min),
        ),
        generation_max_tok_per_sec: round1(
            runs.iter()
                .map(|r| r.generation_tok_per_sec)
                .fold(0.0, f64::max),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sse_lines_parse() {
        assert_eq!(
            parse_sse_line("data: {\"x\":1}"),
            Some((Some("{\"x\":1}"), false))
        );
        assert_eq!(parse_sse_line("data: [DONE]"), Some((None, true)));
        assert_eq!(parse_sse_line("data: "), None);
        assert_eq!(parse_sse_line(": keep-alive"), None);
        assert_eq!(parse_sse_line("event: ping"), None);
    }

    #[test]
    fn openai_deltas_parse() {
        let chat = r#"{"choices":[{"delta":{"content":"Hello"}}]}"#;
        let d = parse_openai_delta(chat).unwrap();
        assert_eq!(d.text, "Hello");
        assert_eq!(d.completion_tokens, None);

        let usage =
            r#"{"choices":[{"delta":{}}],"usage":{"prompt_tokens":12,"completion_tokens":64}}"#;
        let d = parse_openai_delta(usage).unwrap();
        assert_eq!(d.prompt_tokens, Some(12));
        assert_eq!(d.completion_tokens, Some(64));

        let legacy = r#"{"choices":[{"text":"Hi"}]}"#;
        assert_eq!(parse_openai_delta(legacy).unwrap().text, "Hi");
    }
}
