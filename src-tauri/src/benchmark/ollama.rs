use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub model: String,
    pub ttft_sec: f64,
    pub prompt_eval_tok_per_sec: f64,
    pub generation_tok_per_sec: f64,
    pub total_duration_sec: f64,
    pub sample_output: String,
}

pub async fn check_ollama_status() -> bool {
    let client = reqwest::Client::new();
    client.get("http://localhost:11434/api/tags")
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}
