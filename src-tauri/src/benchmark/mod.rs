pub mod runner;
pub mod runtime;

use serde::{Deserialize, Serialize};

/// Benchmark outcome shared by all runtimes. Field names mirror
/// `BenchmarkMetrics` in the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BenchmarkResult {
    pub model: String,
    /// Runtime id: "ollama" | "lmstudio" | "llamaCpp".
    pub runtime: String,
    pub ttft_sec: f64,
    pub prompt_eval_tok_per_sec: f64,
    pub generation_tok_per_sec: f64,
    pub total_tokens: u64,
    pub total_duration_sec: f64,
    pub sample_output: String,
    /// Epoch milliseconds, matches `new Date(ts)` on the frontend.
    pub timestamp: u64,
    /// Medians are computed over this many measured runs (warm-up excluded).
    pub runs_completed: u32,
    /// Min/max across measured runs — variance the UI can surface.
    pub ttft_min_sec: f64,
    pub ttft_max_sec: f64,
    pub generation_min_tok_per_sec: f64,
    pub generation_max_tok_per_sec: f64,
}
