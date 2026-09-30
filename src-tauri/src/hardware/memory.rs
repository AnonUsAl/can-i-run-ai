use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryInfo {
    pub total_bytes: u64,
    pub total_gb: f64,
    pub free_bytes: u64,
    pub free_gb: f64,
    pub is_unified: bool,
}
