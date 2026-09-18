import { BenchmarkMetrics, HardwareSpecs, OllamaModelDetail } from '../types';

export const DEFAULT_HARDWARE: HardwareSpecs = {
  platform: 'darwin',
  arch: 'arm64',
  osName: 'macOS',
  osVersion: 'Darwin 24.0.0',
  cpu: {
    model: 'Apple M1 Pro',
    cores: 10,
    arch: 'arm64',
    isAppleSilicon: true,
  },
  memory: {
    totalBytes: 17179869184,
    totalGb: 16.0,
    freeBytes: 4294967296,
    freeGb: 4.0,
    isUnified: true,
  },
  gpu: {
    model: 'Apple M1 Pro (16 Cores)',
    isUnifiedMemory: true,
    metalSupport: 'Metal 4',
    vramGb: 16.0,
  },
  backends: ['Apple Metal', 'CPU inference'],
};

export async function fetchHardwareSpecs(): Promise<HardwareSpecs> {
  try {
    const res = await fetch('/api/hardware');
    if (!res.ok) throw new Error(`Hardware check HTTP ${res.status}`);
    const data = await res.json();
    if (data.success && data.hardware) {
      return data.hardware;
    }
    return DEFAULT_HARDWARE;
  } catch (err) {
    console.warn('Failed to fetch hardware specs, using detected default:', err);
    return DEFAULT_HARDWARE;
  }
}

export async function fetchOllamaModels(): Promise<{ isRunning: boolean; models: OllamaModelDetail[] }> {
  try {
    const res = await fetch('/api/ollama/models');
    if (!res.ok) return { isRunning: false, models: [] };
    const data = await res.json();
    return {
      isRunning: !!data.isRunning,
      models: data.models || [],
    };
  } catch (err) {
    return { isRunning: false, models: [] };
  }
}

export async function runOllamaBenchmark(modelName: string): Promise<BenchmarkMetrics> {
  const res = await fetch('/api/ollama/benchmark', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelName }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`基准测试失败 (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (!data.success || !data.benchmark) {
    throw new Error(data.error || '基准测试未返回有效数据');
  }

  return data.benchmark;
}
