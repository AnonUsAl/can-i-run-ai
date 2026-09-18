pub mod cpu;
pub mod memory;
pub mod gpu;
pub mod macos;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareInfo {
    pub os: String,
    pub arch: String,
    pub cpu: cpu::CpuInfo,
    pub memory: memory::MemoryInfo,
    pub gpu: gpu::GpuInfo,
    pub backends: Vec<String>,
}

pub fn detect_hardware() -> HardwareInfo {
    #[cfg(target_os = "macos")]
    return macos::detect_macos_hardware();

    #[cfg(not(target_os = "macos"))]
    HardwareInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        cpu: cpu::CpuInfo {
            model: "Generic CPU".to_string(),
            cores: 8,
            is_apple_silicon: false,
        },
        memory: memory::MemoryInfo {
            total_bytes: 16 * 1024 * 1024 * 1024,
            total_gb: 16.0,
            is_unified: false,
        },
        gpu: gpu::GpuInfo {
            model: "Generic GPU".to_string(),
            vram_gb: 0.0,
            metal_support: "None".to_string(),
        },
        backends: vec!["CPU inference".to_string()],
    }
}
