pub mod thresholds;

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::hardware::HardwareInfo;
use crate::models::{quant_bits, ModelSpec};

const GIB: f64 = 1024.0 * 1024.0 * 1024.0;

fn round1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

/// Mirrors `CompatibilityReport` in `src/types/index.ts` plus the
/// new `bottleneck` explainability field. Keep both in sync — the
/// golden fixture test (engine/tests) guards against drift.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompatibilityReport {
    pub status: Status,
    pub status_label: String,
    pub total_required_memory_gb: f64,
    pub weights_memory_gb: f64,
    pub kv_cache_memory_gb: f64,
    pub overhead_memory_gb: f64,
    pub buffers_memory_gb: f64,
    pub usable_memory_gb: f64,
    pub memory_usage_percentage: u32,
    pub estimated_tokens_per_second: f64,
    pub headline: String,
    pub advice: String,
    pub can_offload_to_gpu: bool,
    /// vram | ram | context | none — what actually limits this model.
    pub bottleneck: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Status {
    Recommended,
    Runnable,
    NotRecommended,
    Incompatible,
}

impl Status {
    fn label(self) -> &'static str {
        match self {
            Status::Recommended => "🟢 推荐 (Recommended)",
            Status::Runnable => "🟡 可运行 (Runnable)",
            Status::NotRecommended => "🔴 不推荐 (Not Recommended)",
            Status::Incompatible => "⚫ 不兼容 (Incompatible)",
        }
    }
}

/// One model plus a report per supported quantization. The model
/// fields are flattened so the JSON payload keeps the model metadata
/// at the top level (matches `ModelEvaluation` in the frontend).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelEvaluation {
    #[serde(flatten)]
    pub model: ModelSpec,
    pub reports: BTreeMap<String, CompatibilityReport>,
}

/// Evaluate every model at every supported quantization against the
/// detected hardware. Pure computation (no I/O), so the frontend can
/// re-invoke freely on context-slider changes.
pub fn evaluate_all(
    models: &[ModelSpec],
    hw: &HardwareInfo,
    context_length: usize,
) -> Vec<ModelEvaluation> {
    models
        .iter()
        .map(|m| {
            let reports = m
                .supported_quantizations
                .iter()
                .map(|q| (q.clone(), evaluate(m, hw, context_length, q)))
                .collect();
            ModelEvaluation {
                model: m.clone(),
                reports,
            }
        })
        .collect()
}

pub fn evaluate(
    model: &ModelSpec,
    hw: &HardwareInfo,
    context_length: usize,
    quant: &str,
) -> CompatibilityReport {
    // The model cannot run more context than its architecture supports;
    // estimate at the model's ceiling and say so when clamped.
    let context_clamped = context_length > model.max_context_length;
    let context_length = context_length.min(model.max_context_length);

    // 1. Model weights (GGUF bpw averages; see models::quant_bits).
    let bits_per_weight = quant_bits(quant).unwrap_or(4.5);
    let params_b = model.parameter_count_billion;
    let weights_gb = (params_b * 1e9 * bits_per_weight / 8.0) / GIB;

    // 2. KV cache: 2 (K+V) × layers × kv_heads × head_dim × 2 bytes (fp16).
    let kv_heads = model.kv_heads();
    let kv_bytes_per_token =
        2.0 * model.layers as f64 * kv_heads as f64 * model.head_dim as f64 * 2.0;
    let kv_cache_gb = (kv_bytes_per_token * context_length as f64) / GIB;

    // 3. Runtime & driver overhead.
    let overhead_gb = 0.45 + params_b * 0.02;

    // 4. Activation scratch buffers.
    let buffers_gb = (model.heads as f64 * model.head_dim as f64 * context_length as f64 * 4.0
        / GIB)
        .clamp(0.2, 1.5);

    let total_gb = weights_gb + kv_cache_gb + overhead_gb + buffers_gb;

    let is_apple_silicon = hw.cpu.is_apple_silicon || hw.memory.is_unified;
    let total_ram_gb = if hw.memory.total_gb > 0.0 {
        hw.memory.total_gb
    } else {
        16.0
    };
    let budget = thresholds::budget(
        total_ram_gb,
        hw.memory.free_gb,
        hw.gpu.vram_gb,
        is_apple_silicon,
    );

    let status = if total_gb <= budget.safe_gb {
        Status::Recommended
    } else if total_gb <= budget.runnable_gb {
        Status::Runnable
    } else if total_gb <= budget.not_recommended_gb {
        Status::NotRecommended
    } else {
        Status::Incompatible
    };

    let memory_usage_percentage = if total_ram_gb > 0.0 {
        ((total_gb / total_ram_gb) * 100.0).round().min(100.0) as u32
    } else {
        0
    };

    let estimated_tokens_per_second =
        estimate_speed(status, thresholds::effective_bandwidth(hw), weights_gb);

    let bottleneck = if status == Status::Recommended {
        "none".to_string()
    } else if kv_cache_gb > weights_gb {
        "context".to_string()
    } else if !is_apple_silicon && hw.gpu.vram_gb > 0.0 && weights_gb > hw.gpu.vram_gb {
        "vram".to_string()
    } else {
        "ram".to_string()
    };

    let (headline, mut advice) = advice_for(status, context_length);
    if context_clamped {
        advice.push_str(&format!(
            " 该模型上下文上限为 {}，已按上限估算。",
            model.max_context_length
        ));
    }

    CompatibilityReport {
        status,
        status_label: status.label().to_string(),
        total_required_memory_gb: round2(total_gb),
        weights_memory_gb: round2(weights_gb),
        kv_cache_memory_gb: round2(kv_cache_gb),
        overhead_memory_gb: round2(overhead_gb),
        buffers_memory_gb: round2(buffers_gb),
        usable_memory_gb: round1(budget.safe_gb),
        memory_usage_percentage,
        estimated_tokens_per_second,
        headline,
        advice,
        can_offload_to_gpu: is_apple_silicon || hw.gpu.vram_gb >= weights_gb,
        bottleneck,
    }
}

/// Decode-speed estimate: tok/s ≈ η × BW_eff / weights_GB with an
/// experience-based efficiency factor per tier. Measured benchmarks
/// always override this estimate in the UI.
fn estimate_speed(status: Status, bandwidth_gb_s: f64, weights_gb: f64) -> f64 {
    let weights = weights_gb.max(0.1);
    let est = match status {
        Status::Recommended => ((bandwidth_gb_s / weights) * 0.52).max(1.0),
        Status::Runnable => ((bandwidth_gb_s / weights) * 0.38).max(0.8),
        Status::NotRecommended => ((bandwidth_gb_s / weights) * 0.08).max(0.3),
        Status::Incompatible => 0.0,
    };
    round1(est)
}

fn advice_for(status: Status, context_length: usize) -> (String, String) {
    match status {
        Status::Recommended => (
            "完美适配，极佳体验".to_string(),
            "显存与内存充足，模型可完全载入 GPU/统一内存，无性能瓶颈。".to_string(),
        ),
        Status::Runnable => {
            if context_length > 16384 {
                (
                    "能够运行，需注意内存占用".to_string(),
                    "在超长上下文下内存占用较高，建议将上下文调低至 8K/16K，或关闭后台占用内存的大型应用。".to_string(),
                )
            } else {
                (
                    "能够运行，需注意内存占用".to_string(),
                    "略微接近系统内存上限，系统可能产生少量内存压缩，但可稳定推理。建议关闭其他耗内存软件。".to_string(),
                )
            }
        }
        Status::NotRecommended => (
            "可能严重掉速或卡顿".to_string(),
            "显存不足，部分图层将被迫卸载到系统 Swap 交换区，速度可能暴跌至 1~3 tok/s。建议选择更高压缩量化版本（如 Q3_K_M）或更小尺寸模型。".to_string(),
        ),
        Status::Incompatible => (
            "硬件资源不足以运行".to_string(),
            "所需内存严重超过当前机器物理内存总和，强行启动极易导致 OOM 崩溃或系统严重假死。".to_string(),
        ),
    }
}
