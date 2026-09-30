import { invoke } from '@tauri-apps/api/core';
import { BenchmarkMetrics, HardwareSpecs, HistoryEntry, ModelEvaluation, RuntimeKind, RuntimeStatus } from '../types';

/**
 * Thin wrappers over the Tauri IPC commands (src-tauri/src/main.rs).
 * All errors propagate to the caller so the UI can show explicit
 * loading / failure states instead of silently faking data.
 */
export async function fetchHardwareSpecs(): Promise<HardwareSpecs> {
  return invoke<HardwareSpecs>('get_hardware_info');
}

/**
 * Compatibility reports for every model at every supported
 * quantization, computed by the Rust engine on this machine.
 * Re-invoke whenever the context length changes.
 */
export async function evaluateModels(contextLength: number): Promise<ModelEvaluation[]> {
  return invoke<ModelEvaluation[]>('evaluate_models', { contextLength });
}

/** Probe Ollama, LM Studio and llama.cpp. Offline runtimes are included. */
export async function fetchRuntimes(): Promise<RuntimeStatus[]> {
  return invoke<RuntimeStatus[]>('list_runtimes');
}

/** Warm-up + median-of-3 streaming benchmark on the chosen runtime. */
export async function runRuntimeBenchmark(runtime: RuntimeKind, model: string): Promise<BenchmarkMetrics> {
  return invoke<BenchmarkMetrics>('run_runtime_benchmark', { runtime, model });
}

/** Local SQLite history (app data dir) — newest first. */
export async function fetchHistory(limit = 100): Promise<HistoryEntry[]> {
  return invoke<HistoryEntry[]>('get_history', { limit });
}

export async function deleteHistoryEntry(id: number): Promise<void> {
  return invoke('delete_history_entry', { id });
}

export async function clearHistory(): Promise<void> {
  return invoke('clear_history');
}
