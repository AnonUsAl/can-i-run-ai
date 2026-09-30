pub mod bandwidth;
pub mod cpu;
pub mod gpu;
pub mod memory;

#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub mod native;

use serde::{Deserialize, Serialize};

pub use cpu::CpuInfo;
pub use gpu::GpuInfo;
pub use memory::MemoryInfo;

pub(crate) const GB: f64 = 1024.0 * 1024.0 * 1024.0;

pub(crate) fn round1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareInfo {
    pub platform: String,
    pub arch: String,
    pub os_name: String,
    pub os_version: String,
    pub cpu: cpu::CpuInfo,
    pub memory: memory::MemoryInfo,
    pub gpu: gpu::GpuInfo,
    pub backends: Vec<String>,
}

pub fn detect_hardware() -> HardwareInfo {
    #[cfg(target_os = "macos")]
    {
        macos::detect_macos_hardware()
    }

    #[cfg(target_os = "windows")]
    {
        windows::detect_windows_hardware()
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        native::detect_native_hardware()
    }
}

/// Prevent child processes from flashing a console window on Windows.
#[cfg(windows)]
pub(crate) fn no_window(cmd: &mut std::process::Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

/// One-shot CIM query returning "Name|DriverVersion" of the first
/// display adapter. PowerShell is used instead of the `wmi` crate to
/// keep COM initialization out of the probe path.
#[cfg(target_os = "windows")]
pub(crate) fn run_powershell_cim() -> Option<String> {
    let mut cmd = std::process::Command::new("powershell");
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "(Get-CimInstance -ClassName Win32_VideoController | Select-Object -First 1) | ForEach-Object { \"$($_.Name)|$($_.DriverVersion)\" }",
    ]);
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

/// CPU / RAM / OS base detection via `sysinfo`, shared by the
/// non-macOS platforms. GPU detection stays platform-specific.
#[cfg(not(target_os = "macos"))]
pub(crate) fn detect_sysinfo_base(
    platform: &str,
) -> (cpu::CpuInfo, memory::MemoryInfo, String, String) {
    let sys = sysinfo::System::new_all();

    let model = sys
        .cpus()
        .first()
        .map(|c| c.brand().trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Unknown CPU".to_string());
    let cores = sys.cpus().len().max(1);

    let total_bytes = sys.total_memory();
    let free_bytes = sys.free_memory();

    let os_name = sysinfo::System::name().unwrap_or_else(|| platform.to_string());
    let os_version = sysinfo::System::os_version().unwrap_or_else(|| "unknown".to_string());

    let cpu = cpu::CpuInfo {
        model,
        cores,
        arch: std::env::consts::ARCH.to_string(),
        is_apple_silicon: false,
    };
    let memory = memory::MemoryInfo {
        total_bytes,
        total_gb: round1(total_bytes as f64 / GB),
        free_bytes,
        free_gb: round1(free_bytes as f64 / GB),
        is_unified: false,
    };

    (cpu, memory, os_name, os_version)
}
