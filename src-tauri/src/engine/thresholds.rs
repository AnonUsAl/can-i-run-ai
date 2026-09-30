//! Centralized tunables for the compatibility engine.
//! All ratios are relative to total system RAM unless noted.
//! See docs/technical-route.md §4.3.

// --- Unified memory (Apple Silicon) ---
/// macOS wired-limit heuristic: leave ~22% for OS + active UI.
pub const UNIFIED_SAFE_RATIO: f64 = 0.78;
pub const UNIFIED_RUNNABLE_RATIO: f64 = 1.15;
pub const UNIFIED_NOT_RECOMMENDED_RATIO: f64 = 1.45;

// --- No VRAM info (unknown / software rendering) ---
pub const NO_VRAM_SAFE_RATIO: f64 = 0.75;
pub const NO_VRAM_RUNNABLE_RATIO: f64 = 0.95;
pub const NO_VRAM_NOT_RECOMMENDED_RATIO: f64 = 1.45;

// --- Discrete GPU with known VRAM ---
/// Portion of free system RAM usable via layer offload to the CPU.
pub const OFFLOAD_EFFICIENCY: f64 = 0.6;
/// Extra headroom above (VRAM + offload) before a model drops to 🟡.
pub const DISCRETE_RUNNABLE_EXTRA_RATIO: f64 = 0.15;
/// Extra headroom above the runnable limit before 🔴 becomes ⚫.
pub const DISCRETE_NOT_RECOMMENDED_EXTRA_RATIO: f64 = 0.5;

pub struct MemoryBudget {
    /// 🟢 threshold: everything must fit comfortably.
    pub safe_gb: f64,
    /// 🟡 threshold: runnable with memory pressure.
    pub runnable_gb: f64,
    /// 🔴 threshold: beyond this relies on swap → ⚫.
    pub not_recommended_gb: f64,
}

pub fn budget(total_ram_gb: f64, free_ram_gb: f64, vram_gb: f64, unified: bool) -> MemoryBudget {
    if unified {
        return MemoryBudget {
            safe_gb: total_ram_gb * UNIFIED_SAFE_RATIO,
            runnable_gb: total_ram_gb * UNIFIED_RUNNABLE_RATIO,
            not_recommended_gb: total_ram_gb * UNIFIED_NOT_RECOMMENDED_RATIO,
        };
    }
    if vram_gb > 0.0 {
        // Weights staying in VRAM decode at full speed; the overflow
        // lands in system RAM at reduced speed (still workable).
        let offload_gb = OFFLOAD_EFFICIENCY * (total_ram_gb - free_ram_gb).max(0.0);
        let base = vram_gb + offload_gb;
        return MemoryBudget {
            safe_gb: base,
            runnable_gb: base + total_ram_gb * DISCRETE_RUNNABLE_EXTRA_RATIO,
            not_recommended_gb: base + total_ram_gb * DISCRETE_NOT_RECOMMENDED_EXTRA_RATIO,
        };
    }
    MemoryBudget {
        safe_gb: total_ram_gb * NO_VRAM_SAFE_RATIO,
        runnable_gb: total_ram_gb * NO_VRAM_RUNNABLE_RATIO,
        not_recommended_gb: total_ram_gb * NO_VRAM_NOT_RECOMMENDED_RATIO,
    }
}

/// Coarse effective memory bandwidth (GB/s) used for the decode-speed
/// estimate. Decoding is bandwidth-bound: tok/s ≈ η × BW / weights_GB.
/// These are placeholder constants — M2 replaces this with
/// `database/hardware/bandwidth.json` (docs/technical-route.md D6).
pub fn effective_bandwidth(hw: &crate::hardware::HardwareInfo) -> f64 {
    // Table lookup first: GPU model, then CPU model (Apple reports
    // the SoC as both; unknown discrete chips fall back below).
    if let Some(bw) = crate::hardware::bandwidth::lookup(&[&hw.gpu.model, &hw.cpu.model]) {
        return bw;
    }
    // Conservative fallbacks for chips missing from the table.
    if hw.gpu.vram_gb >= 4.0 {
        300.0
    } else {
        60.0
    }
}
