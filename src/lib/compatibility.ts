import { AIModelDefinition, CompatibilityReport, CompatibilityStatus, HardwareSpecs, QuantizationType } from '../types';
import { QUANTIZATION_BITS } from '../data/models';

/**
 * Calculate detailed memory requirements and compatibility evaluation for an AI model on specific hardware.
 */
export function calculateCompatibility(
  model: AIModelDefinition,
  quant: QuantizationType,
  contextLength: number,
  hardware: HardwareSpecs
): CompatibilityReport {
  const bitsPerWeight = QUANTIZATION_BITS[quant] || 4.5;
  const paramsB = model.parameterCountBillion;

  // 1. Model Weights Memory (GB)
  const weightsMemoryGb = (paramsB * 1e9 * bitsPerWeight / 8) / (1024 ** 3);

  // 2. KV Cache Memory (GB)
  // KV Cache = 2 (K and V) * n_layers * n_kv_heads * head_dim * context_length * 2 bytes (fp16)
  const kvHeads = model.kvHeads ?? Math.max(1, Math.floor(model.heads / 4));
  const kvBytesPerToken = 2 * model.layers * kvHeads * model.headDim * 2;
  const kvCacheMemoryGb = (kvBytesPerToken * contextLength) / (1024 ** 3);

  // 3. Runtime & Framework Overhead (GB)
  // Base driver overhead (Metal/CUDA graph, runtime libraries, tokenizer)
  const overheadMemoryGb = 0.45 + (paramsB * 0.02);

  // 4. Temporary Activation Buffers & Scratchpad (GB)
  const buffersMemoryGb = Math.min(1.5, Math.max(0.2, (model.heads * model.headDim * contextLength * 4) / (1024 ** 3)));

  // Total required memory
  const totalRequiredMemoryGb = +(weightsMemoryGb + kvCacheMemoryGb + overheadMemoryGb + buffersMemoryGb).toFixed(2);

  // Evaluate against hardware
  const isAppleSilicon = hardware.cpu.isAppleSilicon || hardware.memory.isUnified;
  const totalSystemRamGb = hardware.memory.totalGb || 16;
  
  // Usable memory limit for AI models (macOS reserves ~20-25% for OS and active UI)
  const safeUsableLimitGb = isAppleSilicon ? totalSystemRamGb * 0.78 : (hardware.gpu.vramGb > 0 ? hardware.gpu.vramGb : totalSystemRamGb * 0.75);
  const maxRunnableLimitGb = isAppleSilicon ? totalSystemRamGb * 1.15 : totalSystemRamGb * 0.95;
  const notRecommendedLimitGb = totalSystemRamGb * 1.45;

  let status: CompatibilityStatus = 'recommended';
  let statusLabel = '🟢 推荐 (Recommended)';
  let headline = '可以流畅运行';
  let advice = '该模型所需显存与运行开销完全在安全范围内，将获得满速体验。';

  if (totalRequiredMemoryGb <= safeUsableLimitGb) {
    status = 'recommended';
    statusLabel = '🟢 推荐 (Recommended)';
    headline = '完美适配，极佳体验';
    advice = '显存与内存充足，模型可完全载入 GPU/统一内存，无性能瓶颈。';
  } else if (totalRequiredMemoryGb <= maxRunnableLimitGb) {
    status = 'runnable';
    statusLabel = '🟡 可运行 (Runnable)';
    headline = '能够运行，需注意内存占用';
    if (contextLength > 16384) {
      advice = '在超长上下文下内存占用较高，建议将上下文调低至 8K/16K，或关闭后台占用内存的大型应用。';
    } else {
      advice = '略微接近系统内存上限，系统可能产生少量内存压缩，但可稳定推理。建议关闭其他耗内存软件。';
    }
  } else if (totalRequiredMemoryGb <= notRecommendedLimitGb) {
    status = 'not-recommended';
    statusLabel = '🔴 不推荐 (Not Recommended)';
    headline = '可能严重掉速或卡顿';
    advice = '显存不足，部分图层将被迫卸载到系统 Swap 交换区，速度可能暴跌至 1~3 tok/s。建议选择更高压缩量化版本（如 Q3_K_M）或更小尺寸模型。';
  } else {
    status = 'incompatible';
    statusLabel = '⚫ 不兼容 (Incompatible)';
    headline = '硬件资源不足以运行';
    advice = '所需内存严重超过当前机器物理内存总和，强行启动极易导致 OOM 崩溃或系统严重假死。';
  }

  // Memory usage percentage against safe limit
  const memoryUsagePercentage = Math.min(100, Math.round((totalRequiredMemoryGb / totalSystemRamGb) * 100));

  // Estimate speed based on hardware memory bandwidth:
  // For M1 Pro: ~150 GB/s effective memory bandwidth
  // tok/s ≈ Bandwidth / (Weights GB) * compute_efficiency
  let estBandwidthGbS = 60;
  if (isAppleSilicon) {
    const cpuUpper = hardware.cpu.model.toUpperCase();
    if (cpuUpper.includes('ULTRA')) estBandwidthGbS = 600;
    else if (cpuUpper.includes('MAX')) estBandwidthGbS = 300;
    else if (cpuUpper.includes('PRO')) estBandwidthGbS = 150; // M1/M2/M3 Pro
    else estBandwidthGbS = 80; // Base M1/M2/M3/M4
  }

  let estimatedTokensPerSecond = 0;
  if (status === 'recommended') {
    estimatedTokensPerSecond = Math.max(1, +((estBandwidthGbS / (weightsMemoryGb || 1)) * 0.52).toFixed(1));
  } else if (status === 'runnable') {
    estimatedTokensPerSecond = Math.max(0.8, +((estBandwidthGbS / (weightsMemoryGb || 1)) * 0.38).toFixed(1));
  } else if (status === 'not-recommended') {
    estimatedTokensPerSecond = Math.max(0.3, +((estBandwidthGbS / (weightsMemoryGb || 1)) * 0.08).toFixed(1));
  } else {
    estimatedTokensPerSecond = 0;
  }

  return {
    status,
    statusLabel,
    totalRequiredMemoryGb,
    weightsMemoryGb: +weightsMemoryGb.toFixed(2),
    kvCacheMemoryGb: +kvCacheMemoryGb.toFixed(2),
    overheadMemoryGb: +overheadMemoryGb.toFixed(2),
    buffersMemoryGb: +buffersMemoryGb.toFixed(2),
    usableMemoryGb: +safeUsableLimitGb.toFixed(1),
    memoryUsagePercentage,
    estimatedTokensPerSecond,
    headline,
    advice,
    canOffloadToGpu: isAppleSilicon || hardware.gpu.vramGb >= weightsMemoryGb,
  };
}
