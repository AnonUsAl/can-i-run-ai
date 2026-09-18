export interface CpuInfo {
  model: string;
  cores: number;
  arch: string;
  isAppleSilicon: boolean;
}

export interface MemoryInfo {
  totalBytes: number;
  totalGb: number;
  freeBytes: number;
  freeGb: number;
  isUnified: boolean;
}

export interface GpuInfo {
  model: string;
  isUnifiedMemory: boolean;
  metalSupport: string;
  vramGb: number;
}

export interface HardwareSpecs {
  platform: string;
  arch: string;
  osName: string;
  osVersion: string;
  cpu: CpuInfo;
  memory: MemoryInfo;
  gpu: GpuInfo;
  backends: string[];
}

export type QuantizationType = 'Q2_K' | 'Q3_K_M' | 'Q4_K_M' | 'Q5_K_M' | 'Q6_K' | 'Q8_0' | 'FP16';

export interface AIModelDefinition {
  id: string;
  name: string;
  family: 'Qwen' | 'Llama' | 'DeepSeek' | 'Gemma' | 'Mistral' | 'Phi';
  parameterCountBillion: number; // e.g., 8 for 8B
  defaultQuantization: QuantizationType;
  supportedQuantizations: QuantizationType[];
  maxContextLength: number; // e.g., 32768
  layers: number;
  heads: number;
  kvHeads?: number; // Grouped-Query Attention (GQA)
  headDim: number;
  description: string;
  recommendedUse: string;
  ollamaName?: string;
}

export type CompatibilityStatus = 'recommended' | 'runnable' | 'not-recommended' | 'incompatible';

export interface CompatibilityReport {
  status: CompatibilityStatus;
  statusLabel: string;
  totalRequiredMemoryGb: number;
  weightsMemoryGb: number;
  kvCacheMemoryGb: number;
  overheadMemoryGb: number;
  buffersMemoryGb: number;
  usableMemoryGb: number;
  memoryUsagePercentage: number;
  estimatedTokensPerSecond: number;
  headline: string;
  advice: string;
  canOffloadToGpu: boolean;
}

export interface OllamaModelDetail {
  name: string;
  model: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
    context_length?: number;
  };
}

export interface BenchmarkMetrics {
  model: string;
  ttftSec: number;
  promptEvalTokPerSec: number;
  generationTokPerSec: number;
  totalTokens: number;
  totalDurationSec: number;
  sampleOutput: string;
  timestamp: string;
}
