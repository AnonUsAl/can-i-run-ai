use std::process::Command;

use super::{cpu::CpuInfo, memory::MemoryInfo, no_window, round1, GpuInfo, HardwareInfo, GB};

fn sysctl(key: &'static str) -> Option<String> {
    let mut cmd = Command::new("sysctl");
    cmd.args(["-n", key]);
    no_window(&mut cmd);
    let out = cmd.output().ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

pub fn detect_macos_hardware() -> HardwareInfo {
    let cpu_brand = sysctl("machdep.cpu.brand_string").unwrap_or_else(|| "Unknown CPU".to_string());

    let cores = sysctl("hw.ncpu")
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(1);

    let memsize = sysctl("hw.memsize")
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(0);

    // sysinfo is only used here for free memory; totals come from hw.memsize.
    let free_bytes = sysinfo::System::new_all().free_memory();

    let is_apple =
        std::env::consts::ARCH == "aarch64" || cpu_brand.to_lowercase().contains("apple");

    HardwareInfo {
        platform: "macos".to_string(),
        arch: std::env::consts::ARCH.to_string(),
        os_name: "macOS".to_string(),
        os_version: sysinfo::System::os_version().unwrap_or_else(|| "unknown".to_string()),
        cpu: CpuInfo {
            model: cpu_brand.clone(),
            cores,
            arch: std::env::consts::ARCH.to_string(),
            is_apple_silicon: is_apple,
        },
        memory: MemoryInfo {
            total_bytes: memsize,
            total_gb: round1(memsize as f64 / GB),
            free_bytes,
            free_gb: round1(free_bytes as f64 / GB),
            is_unified: is_apple,
        },
        gpu: GpuInfo {
            model: if is_apple {
                format!("{} GPU", cpu_brand)
            } else {
                "macOS GPU".to_string()
            },
            is_unified_memory: is_apple,
            vram_gb: if is_apple {
                round1(memsize as f64 / GB)
            } else {
                0.0
            },
            metal_support: "Metal".to_string(),
            vendor: "apple".to_string(),
            driver_version: None,
        },
        backends: vec!["Apple Metal".to_string(), "CPU inference".to_string()],
    }
}
