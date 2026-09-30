//! Golden-file tests for the compatibility engine.
//!
//! The committed fixture doubles as the serialization contract with
//! the frontend: any change to report fields or formulas shows up as
//! a diff here. Regenerate intentionally with:
//!
//! ```text
//! UPDATE_GOLDEN=1 cargo test -p can-i-run-ai --test golden
//! ```

use can_i_run_ai::engine;
use can_i_run_ai::hardware::cpu::CpuInfo;
use can_i_run_ai::hardware::gpu::GpuInfo;
use can_i_run_ai::hardware::memory::MemoryInfo;
use can_i_run_ai::hardware::HardwareInfo;
use can_i_run_ai::models::ModelSpec;
use serde::Serialize;

fn machine_mac_mini_8gb() -> HardwareInfo {
    HardwareInfo {
        platform: "macos".into(),
        arch: "aarch64".into(),
        os_name: "macOS".into(),
        os_version: "15.0".into(),
        cpu: CpuInfo {
            model: "Apple M1".into(),
            cores: 8,
            arch: "aarch64".into(),
            is_apple_silicon: true,
        },
        memory: MemoryInfo {
            total_bytes: 8 * 1024 * 1024 * 1024,
            total_gb: 8.0,
            free_bytes: 3 * 1024 * 1024 * 1024,
            free_gb: 3.0,
            is_unified: true,
        },
        gpu: GpuInfo {
            model: "Apple M1 GPU".into(),
            is_unified_memory: true,
            vram_gb: 8.0,
            metal_support: "Metal".into(),
            vendor: "apple".into(),
            driver_version: None,
        },
        backends: vec!["Apple Metal".into(), "CPU inference".into()],
    }
}

fn machine_m1_pro_16gb() -> HardwareInfo {
    HardwareInfo {
        platform: "macos".into(),
        arch: "aarch64".into(),
        os_name: "macOS".into(),
        os_version: "15.0".into(),
        cpu: CpuInfo {
            model: "Apple M1 Pro".into(),
            cores: 10,
            arch: "aarch64".into(),
            is_apple_silicon: true,
        },
        memory: MemoryInfo {
            total_bytes: 16 * 1024 * 1024 * 1024,
            total_gb: 16.0,
            free_bytes: 8 * 1024 * 1024 * 1024,
            free_gb: 8.0,
            is_unified: true,
        },
        gpu: GpuInfo {
            model: "Apple M1 Pro GPU".into(),
            is_unified_memory: true,
            vram_gb: 16.0,
            metal_support: "Metal".into(),
            vendor: "apple".into(),
            driver_version: None,
        },
        backends: vec!["Apple Metal".into(), "CPU inference".into()],
    }
}

fn machine_rtx_4070_32gb() -> HardwareInfo {
    HardwareInfo {
        platform: "windows".into(),
        arch: "x86_64".into(),
        os_name: "Windows".into(),
        os_version: "11".into(),
        cpu: CpuInfo {
            model: "Intel Core i7-13700K".into(),
            cores: 16,
            arch: "x86_64".into(),
            is_apple_silicon: false,
        },
        memory: MemoryInfo {
            total_bytes: 32 * 1024 * 1024 * 1024,
            total_gb: 32.0,
            free_bytes: 16 * 1024 * 1024 * 1024,
            free_gb: 16.0,
            is_unified: false,
        },
        gpu: GpuInfo {
            model: "NVIDIA GeForce RTX 4070".into(),
            is_unified_memory: false,
            vram_gb: 12.0,
            metal_support: "CUDA".into(),
            vendor: "nvidia".into(),
            driver_version: Some("566.36".into()),
        },
        backends: vec!["NVIDIA CUDA".into(), "CPU inference".into()],
    }
}

#[allow(clippy::too_many_arguments)]
fn model(
    id: &str,
    family: &str,
    params: f64,
    layers: usize,
    heads: usize,
    kv_heads: Option<usize>,
    head_dim: usize,
    max_context: usize,
) -> ModelSpec {
    ModelSpec {
        id: id.into(),
        name: id.into(),
        family: family.into(),
        parameter_count_billion: params,
        layers,
        heads,
        kv_heads,
        head_dim,
        max_context_length: max_context,
        supported_quantizations: vec!["Q4_K_M".into(), "Q8_0".into()],
        default_quantization: "Q4_K_M".into(),
        ollama_name: Some(format!("ollama:{id}")),
        description: String::new(),
        recommended_use: String::new(),
    }
}

#[derive(Serialize)]
struct GoldenCase {
    machine: &'static str,
    context_length: usize,
    evaluations: Vec<engine::ModelEvaluation>,
}

fn golden_cases() -> Vec<GoldenCase> {
    let models = vec![
        model("qwen-2.5-0.5b", "Qwen", 0.5, 24, 14, Some(2), 64, 32768),
        model("qwen-3-8b", "Qwen", 8.2, 32, 32, Some(8), 128, 40960),
        model("qwen-2.5-32b", "Qwen", 32.5, 64, 40, Some(8), 128, 32768),
    ];
    let machines: Vec<(&'static str, HardwareInfo)> = vec![
        ("mac-mini-8gb-m1", machine_mac_mini_8gb()),
        ("m1-pro-16gb", machine_m1_pro_16gb()),
        ("rtx-4070-32gb", machine_rtx_4070_32gb()),
    ];
    machines
        .into_iter()
        .map(|(machine, hw)| GoldenCase {
            machine,
            context_length: 8192,
            evaluations: engine::evaluate_all(&models, &hw, 8192),
        })
        .collect()
}

#[test]
fn golden_reports_match_fixture() {
    let cases = golden_cases();
    let actual = serde_json::to_string_pretty(&cases).expect("serialize golden cases");

    let fixture =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/golden_reports.json");

    if std::env::var("UPDATE_GOLDEN").is_ok() {
        std::fs::create_dir_all(fixture.parent().unwrap()).unwrap();
        std::fs::write(&fixture, &actual).expect("write golden fixture");
        eprintln!("golden fixture updated: {}", fixture.display());
        return;
    }

    let expected = std::fs::read_to_string(&fixture).unwrap_or_else(|e| {
        panic!(
            "golden fixture missing ({}): {e}. Run with UPDATE_GOLDEN=1 to create it.",
            fixture.display()
        )
    });
    // Normalize CRLF: git may check the fixture out with Windows line
    // endings while the engine serializes with LF.
    let expected = expected.replace("\r\n", "\n");
    assert_eq!(
        actual, expected,
        "engine output drifted from the golden fixture — if this change is \
         intentional, regenerate with UPDATE_GOLDEN=1 and review the diff"
    );
}

#[test]
fn tier_boundaries_behave_monotonically() {
    let hw = machine_m1_pro_16gb();
    let small = model("tiny", "Qwen", 0.5, 24, 14, Some(2), 64, 32768);
    let huge = model("huge", "Qwen", 72.7, 80, 64, Some(8), 128, 32768);

    let r_small = engine::evaluate(&small, &hw, 8192, "Q4_K_M");
    let r_huge = engine::evaluate(&huge, &hw, 8192, "Q4_K_M");

    assert_eq!(r_small.status, engine::Status::Recommended);
    assert_eq!(r_small.bottleneck, "none");
    assert_eq!(r_huge.status, engine::Status::Incompatible);

    // Larger context must never improve the tier.
    let short_ctx = engine::evaluate(&small, &hw, 2048, "Q4_K_M");
    let long_ctx = engine::evaluate(&small, &hw, 32768, "Q4_K_M");
    assert!(short_ctx.total_required_memory_gb <= long_ctx.total_required_memory_gb);
}
