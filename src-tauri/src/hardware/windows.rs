use super::{detect_sysinfo_base, GpuInfo, HardwareInfo};

// --- NVIDIA: NVML (feature-gated) ---

/// NVML gives name, accurate VRAM and driver version. Init fails
/// gracefully on machines without the NVIDIA driver.
#[cfg(feature = "nvml")]
fn probe_nvidia() -> Option<GpuInfo> {
    use nvml_wrapper::Nvml;

    let nvml = Nvml::init().ok()?;
    let device = nvml.device_by_index(0).ok()?;
    let name = device.name().ok()?;
    if name.is_empty() {
        return None;
    }
    let total_bytes = device.memory_info().ok()?.total;
    let driver_version = nvml.sys_driver_version().ok().filter(|v| !v.is_empty());

    Some(GpuInfo {
        model: name,
        is_unified_memory: false,
        vram_gb: super::round1(total_bytes as f64 / super::GB),
        metal_support: "CUDA".to_string(),
        vendor: "nvidia".to_string(),
        driver_version,
    })
}

#[cfg(not(feature = "nvml"))]
fn probe_nvidia() -> Option<GpuInfo> {
    None
}

// --- All vendors: DXGI adapter descriptors ---

#[cfg(target_os = "windows")]
mod dxgi {
    use windows::Win32::Graphics::Dxgi::{CreateDXGIFactory1, IDXGIFactory1};

    pub struct Adapter {
        pub name: String,
        pub dedicated_video_memory_bytes: usize,
        pub vendor: String,
        pub is_integrated: bool,
    }

    fn vendor_from_id(vendor_id: u32) -> &'static str {
        match vendor_id {
            0x10DE => "nvidia",
            0x1002 => "amd",
            0x8086 => "intel",
            _ => "unknown",
        }
    }

    /// Largest dedicated-memory adapter, skipping software/basic
    /// render drivers (0 or negligible dedicated memory). Vendor ids
    /// per the PCI ID repository.
    pub fn primary_adapter() -> Option<Adapter> {
        let factory: IDXGIFactory1 = unsafe { CreateDXGIFactory1().ok()? };

        let mut best: Option<(usize, Adapter)> = None;
        for index in 0..8u32 {
            let Ok(adapter) = (unsafe { factory.EnumAdapters1(index) }) else {
                break;
            };
            let Ok(desc) = (unsafe { adapter.GetDesc1() }) else {
                continue;
            };

            let name = String::from_utf16_lossy(&desc.Description)
                .trim_end_matches('\0')
                .trim()
                .to_string();
            if name.is_empty() {
                continue;
            }
            if desc.DedicatedVideoMemory < 256 * 1024 * 1024 {
                continue; // software render driver (Microsoft Basic / WARP)
            }

            let vendor = vendor_from_id(desc.VendorId);
            let candidate = (
                desc.DedicatedVideoMemory,
                Adapter {
                    name,
                    dedicated_video_memory_bytes: desc.DedicatedVideoMemory,
                    vendor: vendor.to_string(),
                    // Intel parts are integrated in practice; dedicated
                    // Intel Arc GPUs are rare and refined via NVML above.
                    is_integrated: vendor == "intel",
                },
            );
            if best.as_ref().is_none_or(|(b, _)| candidate.0 > *b) {
                best = Some(candidate);
            }
        }
        best.map(|(_, adapter)| adapter)
    }
}

#[cfg(target_os = "windows")]
fn probe_dxgi() -> Option<GpuInfo> {
    let adapter = dxgi::primary_adapter()?;
    let metal_support = match adapter.vendor.as_str() {
        "nvidia" => "CUDA",
        "amd" | "intel" => "DirectX 12",
        _ => "Unknown",
    };
    Some(GpuInfo {
        model: adapter.name,
        is_unified_memory: adapter.is_integrated,
        vram_gb: super::round1(adapter.dedicated_video_memory_bytes as f64 / super::GB),
        metal_support: metal_support.to_string(),
        vendor: adapter.vendor,
        driver_version: query_video_controller_driver(),
    })
}

#[cfg(not(target_os = "windows"))]
fn probe_dxgi() -> Option<GpuInfo> {
    None
}

/// Driver version via the CIM/WMI class Win32_VideoController
/// (fallback when NVML is unavailable). `AdapterRAM` from this class
/// is intentionally never used as VRAM — it is a 32-bit value that
/// wraps above 4 GB (docs/technical-route.md §7.2).
fn query_video_controller_driver() -> Option<String> {
    let out = super::run_powershell_cim()?;
    let driver = out.split('|').nth(1)?.trim().to_string();
    if driver.is_empty() {
        None
    } else {
        Some(driver)
    }
}

fn detect_gpu() -> GpuInfo {
    probe_nvidia()
        .or_else(probe_dxgi)
        .unwrap_or_else(|| GpuInfo {
            model: "Unknown GPU".to_string(),
            is_unified_memory: false,
            vram_gb: 0.0,
            metal_support: "Unknown".to_string(),
            vendor: "unknown".to_string(),
            driver_version: None,
        })
}

pub fn detect_windows_hardware() -> HardwareInfo {
    let (cpu, memory, os_name, os_version) = detect_sysinfo_base("Windows");
    let gpu = detect_gpu();

    let mut backends = Vec::new();
    if gpu.vendor == "nvidia" {
        backends.push("NVIDIA CUDA".to_string());
    }
    backends.push("CPU inference".to_string());

    HardwareInfo {
        platform: "windows".to_string(),
        arch: std::env::consts::ARCH.to_string(),
        os_name,
        os_version,
        cpu,
        memory,
        gpu,
        backends,
    }
}
