use serde::{Deserialize, Serialize};

/// Bundled copy of `database/models/models.json` — the single source
/// of truth for model metadata (see docs/technical-route.md D3).
pub const MODELS_JSON: &str = include_str!("../../database/models/models.json");

pub const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelDatabase {
    pub schema: u32,
    pub models: Vec<ModelSpec>,
}

/// Field names intentionally mirror `AIModelDefinition` in
/// `src/types/index.ts`; serde camelCase keeps the IPC payload
/// compatible without a code generator.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelSpec {
    pub id: String,
    pub name: String,
    pub family: String,
    pub parameter_count_billion: f64,
    pub layers: usize,
    pub heads: usize,
    /// Grouped-query attention heads; `None` falls back to heads/4
    /// (minimum 1), matching the historical frontend heuristic.
    #[serde(default)]
    pub kv_heads: Option<usize>,
    pub head_dim: usize,
    pub max_context_length: usize,
    pub supported_quantizations: Vec<String>,
    pub default_quantization: String,
    #[serde(default)]
    pub ollama_name: Option<String>,
    pub description: String,
    pub recommended_use: String,
}

impl ModelSpec {
    pub fn kv_heads(&self) -> usize {
        self.kv_heads.unwrap_or_else(|| (self.heads / 4).max(1))
    }

    pub fn quant_bits(&self, quant: &str) -> Option<f64> {
        quant_bits(quant)
    }
}

/// Bits per weight by GGUF quantization format (empirical averages).
pub fn quant_bits(quant: &str) -> Option<f64> {
    match quant {
        "Q2_K" => Some(2.6),
        "Q3_K_M" => Some(3.4),
        "Q4_K_M" => Some(4.5),
        "Q5_K_M" => Some(5.5),
        "Q6_K" => Some(6.6),
        "Q8_0" => Some(8.5),
        "FP16" => Some(16.0),
        _ => None,
    }
}

/// Parse and validate the bundled database.
pub fn load() -> Result<ModelDatabase, String> {
    let db: ModelDatabase =
        serde_json::from_str(MODELS_JSON).map_err(|e| format!("Invalid model database: {e}"))?;
    if db.schema != SCHEMA_VERSION {
        return Err(format!(
            "Unsupported model database schema {} (expected {SCHEMA_VERSION})",
            db.schema
        ));
    }
    validate(&db)?;
    Ok(db)
}

fn validate(db: &ModelDatabase) -> Result<(), String> {
    let mut seen = std::collections::HashSet::new();
    for m in &db.models {
        if !seen.insert(&m.id) {
            return Err(format!("Duplicate model id: {}", m.id));
        }
        if m.supported_quantizations.is_empty() {
            return Err(format!("{}: no quantizations listed", m.id));
        }
        if !m
            .supported_quantizations
            .iter()
            .all(|q| quant_bits(q).is_some())
        {
            return Err(format!("{}: unknown quantization format", m.id));
        }
        if !m.supported_quantizations.contains(&m.default_quantization) {
            return Err(format!("{}: default quant not in supported list", m.id));
        }
        if m.kv_heads > Some(m.heads) {
            return Err(format!("{}: kvHeads exceeds heads", m.id));
        }
        if m.layers == 0 || m.heads == 0 || m.head_dim == 0 || m.max_context_length == 0 {
            return Err(format!("{}: zero architecture field", m.id));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundled_database_parses_and_validates() {
        let db = load().expect("bundled database must parse");
        assert!(db.models.len() >= 20, "expected a populated database");
    }

    #[test]
    fn ids_are_unique() {
        let db = load().unwrap();
        let ids: std::collections::HashSet<&str> =
            db.models.iter().map(|m| m.id.as_str()).collect();
        assert_eq!(ids.len(), db.models.len());
    }

    #[test]
    fn kv_heads_fallback_matches_frontend_heuristic() {
        let mut m = load().unwrap().models.remove(0);
        m.kv_heads = None;
        assert_eq!(m.kv_heads(), (m.heads / 4).max(1));
    }
}
