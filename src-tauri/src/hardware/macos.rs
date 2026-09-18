use std::process::Command;
use super::{HardwareInfo, cpu::CpuInfo, memory::MemoryInfo, gpu::GpuInfo};

pub fn detect_macos_hardware() -> HardwareInfo {
    let cpu_brand = Command::new("sysctl")
        .args(["-n", "machdep.cpu.brand_string"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "Apple Silicon".to_string());

    let memsize = Command::new("sysctl")
        .args(["-n", "hw.memsize"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<u64>().unwrap_or(17179869184))
        .unwrap_or(17179869184);

    let cores = Command::new("sysctl")
        .args(["-n", "hw.ncpu"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<usize>().unwrap_or(8))
        .unwrap_or(8);

    let total_gb = (memsize as f64) / (1024.0 * 1024.0 * 1024.0);
    let is_apple = cpu_brand.to_lowercase().contains("apple") || std::env::consts::ARCH == "aarch64";

    HardwareInfo {
        os: "macOS".to_string(),
        arch: std::env::consts::ARCH.to_string(),
        cpu: CpuInfo {
            model: cpu_brand.clone(),
            cores,
            is_apple_silicon: is_apple,
        },
        memory: MemoryInfo {
            total_bytes: memsize,
            total_gb: (total_gb * 10.0).round() / 10.0,
            is_unified: is_apple,
        },
        gpu: GpuInfo {
            model: if is_apple { format!("{} GPU", cpu_brand) } else { "macOS GPU".to_string() },
            vram_gb: if is_apple { total_gb } else { 0.0 },
            metal_support: "Metal 4".to_string(),
        },
        backends: vec!["Apple Metal".to_string(), "CPU inference".to_string()],
    }
}
