use std::process::Command;

use super::{detect_sysinfo_base, GpuInfo, HardwareInfo};

/// Linux and other Unix-like systems: sysinfo covers CPU/RAM/OS,
/// lspci provides the first display adapter name when available.
fn query_lspci_gpu() -> Option<String> {
    let out = Command::new("lspci").output().ok()?;
    if !out.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&out.stdout);
    for line in stdout.lines() {
        let lower = line.to_lowercase();
        if lower.contains("vga compatible controller")
            || lower.contains("3d controller")
            || lower.contains("display controller")
        {
            if let Some(idx) = line.find(": ") {
                let after = &line[idx + 2..];
                if let Some(inner) = after.find(": ") {
                    return Some(after[inner + 2..].trim().to_string());
                }
                return Some(after.trim().to_string());
            }
        }
    }
    None
}

pub fn detect_native_hardware() -> HardwareInfo {
    let (cpu, memory, os_name, os_version) = detect_sysinfo_base("Linux");

    let (gpu, has_nvidia) = match query_lspci_gpu() {
        Some(name) => {
            let lower = name.to_lowercase();
            let is_nvidia = lower.contains("nvidia");
            let vendor = if is_nvidia {
                "nvidia"
            } else if lower.contains("amd") || lower.contains("radeon") || lower.contains("ati") {
                "amd"
            } else if lower.contains("intel") {
                "intel"
            } else {
                "unknown"
            };
            (
                GpuInfo {
                    model: name,
                    is_unified_memory: false,
                    vram_gb: 0.0,
                    metal_support: if is_nvidia {
                        "CUDA".to_string()
                    } else {
                        "Unknown".to_string()
                    },
                    vendor: vendor.to_string(),
                    driver_version: None,
                },
                is_nvidia,
            )
        }
        None => (
            GpuInfo {
                model: "Unknown GPU".to_string(),
                is_unified_memory: false,
                vram_gb: 0.0,
                metal_support: "Unknown".to_string(),
                vendor: "unknown".to_string(),
                driver_version: None,
            },
            false,
        ),
    };

    let mut backends = Vec::new();
    if has_nvidia {
        backends.push("NVIDIA CUDA".to_string());
    }
    backends.push("CPU inference".to_string());

    HardwareInfo {
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        os_name,
        os_version,
        cpu,
        memory,
        gpu,
        backends,
    }
}
