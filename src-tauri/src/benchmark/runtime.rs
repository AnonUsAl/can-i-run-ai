//! Local runtime ecosystem: Ollama, LM Studio, llama.cpp server.
//!
//! Each runtime is probed over HTTP on its default port; none of the
//! probes require authentication and all targets are loopback only.
//! LM Studio and llama.cpp speak the OpenAI Chat Completions dialect,
//! so they share one streaming benchmark implementation.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RuntimeKind {
    Ollama,
    LmStudio,
    LlamaCpp,
}

impl RuntimeKind {
    pub fn id(&self) -> &'static str {
        match self {
            RuntimeKind::Ollama => "ollama",
            RuntimeKind::LmStudio => "lmstudio",
            RuntimeKind::LlamaCpp => "llamaCpp",
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            RuntimeKind::Ollama => "Ollama",
            RuntimeKind::LmStudio => "LM Studio",
            RuntimeKind::LlamaCpp => "llama.cpp",
        }
    }

    pub fn base_url(&self) -> &'static str {
        match self {
            RuntimeKind::Ollama => "http://localhost:11434",
            RuntimeKind::LmStudio => "http://localhost:1234",
            RuntimeKind::LlamaCpp => "http://localhost:8080",
        }
    }

    /// Offline hint shown in the UI, per runtime.
    pub fn offline_hint(&self) -> &'static str {
        match self {
            RuntimeKind::Ollama => "ollama serve",
            RuntimeKind::LmStudio => "LM Studio → Developer → Start Server (port 1234)",
            RuntimeKind::LlamaCpp => "llama-server --port 8080 -m <model>",
        }
    }

    pub fn from_id(id: &str) -> Option<RuntimeKind> {
        match id {
            "ollama" => Some(RuntimeKind::Ollama),
            "lmstudio" => Some(RuntimeKind::LmStudio),
            "llamaCpp" => Some(RuntimeKind::LlamaCpp),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeModel {
    /// Identifier to send back to the runtime (Ollama name / OpenAI model id).
    pub id: String,
    /// Human-friendly label.
    pub display: String,
    pub quant: Option<String>,
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
    pub kind: RuntimeKind,
    pub label: &'static str,
    pub online: bool,
    pub base_url: String,
    pub models: Vec<RuntimeModel>,
    /// Short error / offline hint for the UI.
    pub detail: Option<String>,
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())
}

// --- Ollama ---

async fn probe_ollama() -> RuntimeStatus {
    let kind = RuntimeKind::Ollama;
    let client = match client() {
        Err(e) => return offline(kind, Some(e)),
        Ok(c) => c,
    };

    let res = match client
        .get(format!("{}/api/tags", kind.base_url()))
        .send()
        .await
    {
        Err(e) => return offline(kind, Some(e.to_string())),
        Ok(res) => res,
    };
    if !res.status().is_success() {
        return offline(kind, Some(format!("HTTP {}", res.status())));
    }

    let json = match res.json::<serde_json::Value>().await {
        Err(e) => return offline(kind, Some(e.to_string())),
        Ok(json) => json,
    };

    let models = json["models"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| {
                    let id = m["name"].as_str()?.to_string();
                    Some(RuntimeModel {
                        display: id.clone(),
                        id,
                        quant: m["details"]["quantization_level"]
                            .as_str()
                            .map(str::to_string),
                        size_bytes: m["size"].as_u64(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    RuntimeStatus {
        kind,
        label: kind.label(),
        online: true,
        base_url: kind.base_url().to_string(),
        models,
        detail: None,
    }
}

// --- LM Studio ---

/// LM Studio exposes a v0 REST API with quantization and load state;
/// older builds only serve the OpenAI-compatible /v1/models.
async fn probe_lmstudio() -> RuntimeStatus {
    let kind = RuntimeKind::LmStudio;
    let client = match client() {
        Ok(c) => c,
        Err(e) => return offline(kind, Some(e)),
    };

    // v0 first: rich metadata (quantization, state).
    if let Ok(res) = client
        .get(format!("{}/api/v0/models", kind.base_url()))
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                let models: Vec<RuntimeModel> = json["data"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|m| {
                                let id = m["id"].as_str()?.to_string();
                                Some(RuntimeModel {
                                    display: id.clone(),
                                    id,
                                    quant: m["quantization"].as_str().map(str::to_string),
                                    size_bytes: None,
                                })
                            })
                            .collect()
                    })
                    .unwrap_or_default();
                return RuntimeStatus {
                    kind,
                    label: kind.label(),
                    online: true,
                    base_url: kind.base_url().to_string(),
                    models,
                    detail: None,
                };
            }
        }
    }

    // Fallback: plain OpenAI model list.
    if let Ok(res) = client
        .get(format!("{}/v1/models", kind.base_url()))
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                let models = openai_model_list(&json);
                return RuntimeStatus {
                    kind,
                    label: kind.label(),
                    online: true,
                    base_url: kind.base_url().to_string(),
                    models,
                    detail: None,
                };
            }
        }
    }

    offline(kind, Some(kind.offline_hint().to_string()))
}

// --- llama.cpp ---

async fn probe_llama_cpp() -> RuntimeStatus {
    let kind = RuntimeKind::LlamaCpp;
    let client = match client() {
        Ok(c) => c,
        Err(e) => return offline(kind, Some(e)),
    };

    if let Ok(res) = client
        .get(format!("{}/health", kind.base_url()))
        .send()
        .await
    {
        if res.status().is_success() {
            let models = match client
                .get(format!("{}/v1/models", kind.base_url()))
                .send()
                .await
            {
                Ok(r) => r
                    .json::<serde_json::Value>()
                    .await
                    .map(|j| openai_model_list(&j))
                    .unwrap_or_default(),
                Err(_) => Vec::new(),
            };
            return RuntimeStatus {
                kind,
                label: kind.label(),
                online: true,
                base_url: kind.base_url().to_string(),
                models,
                detail: None,
            };
        }
    }
    offline(kind, Some(kind.offline_hint().to_string()))
}

fn openai_model_list(json: &serde_json::Value) -> Vec<RuntimeModel> {
    json["data"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| {
                    let id = m["id"].as_str()?.to_string();
                    Some(RuntimeModel {
                        display: id.clone(),
                        id,
                        quant: None,
                        size_bytes: None,
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

fn offline(kind: RuntimeKind, detail: Option<String>) -> RuntimeStatus {
    RuntimeStatus {
        kind,
        label: kind.label(),
        online: false,
        base_url: kind.base_url().to_string(),
        models: Vec::new(),
        detail,
    }
}

/// Probe every supported runtime. Offline runtimes are reported, not
/// skipped, so the UI can show how to start each one.
pub async fn detect_runtimes() -> Vec<RuntimeStatus> {
    let (ollama, lmstudio, llama_cpp) =
        tokio::join!(probe_ollama(), probe_lmstudio(), probe_llama_cpp());
    vec![ollama, lmstudio, llama_cpp]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runtime_ids_round_trip() {
        for kind in [
            RuntimeKind::Ollama,
            RuntimeKind::LmStudio,
            RuntimeKind::LlamaCpp,
        ] {
            assert_eq!(RuntimeKind::from_id(kind.id()), Some(kind));
        }
        assert_eq!(RuntimeKind::from_id("nope"), None);
    }

    #[test]
    fn openai_model_list_parses() {
        let json = serde_json::json!({
            "data": [{"id": "qwen2.5-7b-instruct"}, {"id": "llama-3.1-8b"}]
        });
        let models = openai_model_list(&json);
        assert_eq!(models.len(), 2);
        assert_eq!(models[0].id, "qwen2.5-7b-instruct");
    }
}
