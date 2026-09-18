use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMemoryBreakdown {
    pub total_gb: f64,
    pub weights_gb: f64,
    pub kv_cache_gb: f64,
    pub overhead_gb: f64,
    pub status: String,
}

pub fn calculate_memory(params_b: f64, bits_per_weight: f64, context_len: usize, total_ram_gb: f64) -> ModelMemoryBreakdown {
    let weights_gb = (params_b * 1e9 * bits_per_weight / 8.0) / (1024.0 * 1024.0 * 1024.0);
    let kv_cache_gb = (context_len as f64 * 2.0 * 32.0 * 8.0 * 128.0 * 2.0) / (1024.0 * 1024.0 * 1024.0);
    let overhead_gb = 0.5 + params_b * 0.02;
    let total_gb = weights_gb + kv_cache_gb + overhead_gb;

    let status = if total_gb <= total_ram_gb * 0.78 {
        "Recommended".to_string()
    } else if total_gb <= total_ram_gb * 1.15 {
        "Runnable".to_string()
    } else if total_gb <= total_ram_gb * 1.45 {
        "Not Recommended".to_string()
    } else {
        "Incompatible".to_string()
    };

    ModelMemoryBreakdown {
        total_gb: (total_gb * 10.0).round() / 10.0,
        weights_gb: (weights_gb * 10.0).round() / 10.0,
        kv_cache_gb: (kv_cache_gb * 10.0).round() / 10.0,
        overhead_gb: (overhead_gb * 10.0).round() / 10.0,
        status,
    }
}
