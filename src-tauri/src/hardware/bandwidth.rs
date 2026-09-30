use serde::Deserialize;

/// Effective memory bandwidth (GB/s) for the decode-speed estimate,
/// loaded from `database/hardware/bandwidth.json` — the
/// community-editable data file (docs/technical-route.md D6).
pub const BANDWIDTH_JSON: &str = include_str!("../../../database/hardware/bandwidth.json");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BandwidthDatabase {
    pub chips: Vec<BandwidthEntry>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BandwidthEntry {
    /// Case-insensitive substring matched against the (uppercased)
    /// GPU or CPU model name. JSON key: "match".
    #[serde(rename = "match")]
    pub match_rule: String,
    pub bandwidth_gbs: f64,
}

static BANDWIDTH: std::sync::OnceLock<BandwidthDatabase> = std::sync::OnceLock::new();

fn db() -> &'static BandwidthDatabase {
    BANDWIDTH.get_or_init(|| {
        serde_json::from_str(BANDWIDTH_JSON).expect("bundled bandwidth.json must parse")
    })
}

/// Look up effective bandwidth for a chip. `names` are tried in
/// order (typically [gpu model, cpu model]); matching is
/// case-insensitive substring, first entry in file order wins.
pub fn lookup(names: &[&str]) -> Option<f64> {
    let db = db();
    for name in names {
        let name = name.to_uppercase();
        if name.is_empty() {
            continue;
        }
        for chip in &db.chips {
            if name.contains(&chip.match_rule.to_uppercase()) {
                return Some(chip.bandwidth_gbs);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_nvidia_chips_resolve() {
        assert_eq!(lookup(&["NVIDIA GeForce RTX 4070"]), Some(504.0));
        assert_eq!(lookup(&["NVIDIA GeForce RTX 4070 Ti"]), Some(504.0));
        assert_eq!(lookup(&["NVIDIA GeForce RTX 3090"]), Some(936.0));
    }

    #[test]
    fn specific_rules_beat_family_rules() {
        // "M1 PRO" must win over the bare "M1" entry.
        assert_eq!(lookup(&["Apple M1 Pro"]), Some(200.0));
        assert_eq!(lookup(&["Apple M1"]), Some(68.0));
        // "RTX 4070 TI" must win over "RTX 4070".
        assert_eq!(lookup(&["RTX 4070 TI SUPER"]), Some(504.0));
    }

    #[test]
    fn unknown_chips_return_none() {
        assert_eq!(lookup(&["Totally Unknown GX-9000"]), None);
        assert_eq!(lookup(&[""]), None);
    }

    #[test]
    fn cpu_name_fallback_is_used() {
        // On macOS the GPU name mirrors the CPU brand; both are tried.
        assert_eq!(lookup(&["unknown-gpu", "Apple M2 Max"]), Some(400.0));
    }
}
