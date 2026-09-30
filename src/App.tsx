import React, { useState, useEffect, useMemo } from 'react';
import { 
  clearHistory,
  deleteHistoryEntry,
  evaluateModels,
  fetchHardwareSpecs, 
  fetchHistory,
  fetchRuntimes, 
  runRuntimeBenchmark 
} from './lib/api';
import { BenchmarkMetrics, HardwareSpecs, HistoryEntry, ModelEvaluation, RuntimeKind } from './types';
import { Header } from './components/Header';
import { HardwareCard } from './components/HardwareCard';
import { ContextSlider } from './components/ContextSlider';
import { BenchmarkRunner } from './components/BenchmarkRunner';
import { HistoryPanel } from './components/HistoryPanel';
import { ModelExplorer } from './components/ModelExplorer';
import { ShareCardModal } from './components/ShareCardModal';
import { Sparkles, Compass } from 'lucide-react';

export const App: React.FC = () => {
  const [hardware, setHardware] = useState<HardwareSpecs | null>(null);
  const [hardwareError, setHardwareError] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<ModelEvaluation[]>([]);
  const [evaluationsError, setEvaluationsError] = useState<string | null>(null);
  const [contextLength, setContextLength] = useState<number>(8192);
  const [runtimes, setRuntimes] = useState<import('./types').RuntimeStatus[]>([]);
  const [selectedRuntime, setSelectedRuntime] = useState<RuntimeKind>('ollama');
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});
  const [benchmarking, setBenchmarking] = useState<boolean>(false);
  const [benchmarkingModel, setBenchmarkingModel] = useState<string | null>(null);
  const [latestBenchmark, setLatestBenchmark] = useState<BenchmarkMetrics | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(true);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [lang, setLang] = useState<'zh' | 'en'>('zh');

  const isZh = lang === 'zh';

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      setHistory(await fetchHistory());
    } catch (_) {
      // History is optional; the panel shows an empty state on failure.
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load hardware & runtime status
  const loadSystemInfo = async () => {
    try {
      const hw = await fetchHardwareSpecs();
      setHardware(hw);
      setHardwareError(null);
    } catch (err: any) {
      setHardwareError(err?.toString() || 'Hardware detection failed');
    }

    try {
      const rt = await fetchRuntimes();
      setRuntimes(rt);
      // Default to the first online runtime; remember per-runtime model picks.
      setSelectedRuntime((prev) => {
        const prevStatus = rt.find((r) => r.kind === prev);
        if (prevStatus?.online) return prev;
        return (rt.find((r) => r.online)?.kind ?? prev) as RuntimeKind;
      });
      setSelectedModels((prev) => {
        const next = { ...prev };
        for (const r of rt) {
          if (r.models.length > 0 && !next[r.kind]) {
            next[r.kind] = r.models[0].id;
          }
        }
        return next;
      });
    } catch (_) {}
  };

  useEffect(() => {
    loadSystemInfo();
    loadHistory();
  }, []);

  // Compatibility reports come from the Rust engine and depend on
  // hardware (fetched once) plus the context slider (re-run on change).
  useEffect(() => {
    let cancelled = false;
    evaluateModels(contextLength)
      .then((evals) => {
        if (!cancelled) {
          setEvaluations(evals);
          setEvaluationsError(null);
        }
      })
      .catch((err: any) => {
        if (!cancelled) setEvaluationsError(err?.toString() || '兼容性计算失败');
      });
    return () => {
      cancelled = true;
    };
  }, [contextLength, hardware]);

  // Installed Ollama model names for the "installed" badges in the explorer
  const installedOllamaNames = useMemo(() => {
    const ollama = runtimes.find((r) => r.kind === 'ollama');
    return new Set((ollama?.models ?? []).map((m) => m.id));
  }, [runtimes]);

  // Run benchmark handler (used by the benchmark panel and model cards)
  const handleRunBenchmark = async (runtime: RuntimeKind, modelName: string) => {
    setBenchmarking(true);
    setBenchmarkingModel(modelName);
    try {
      const result = await runRuntimeBenchmark(runtime, modelName);
      setLatestBenchmark(result);
      loadHistory(); // the run is persisted by the backend; refresh the panel
    } catch (err: any) {
      alert(err.message || '跑分测试遇到问题');
    } finally {
      setBenchmarking(false);
      setBenchmarkingModel(null);
    }
  };

  const handleDeleteHistory = async (id: number) => {
    try {
      await deleteHistoryEntry(id);
      setHistory((prev) => prev.filter((e) => e.id !== id));
    } catch (_) {}
  };

  const handleClearHistory = async () => {
    try {
      await clearHistory();
      setHistory([]);
    } catch (_) {}
  };

  // Hardware gate: no fake fallback — show an explicit state until
  // the backend reports real hardware (retry button on failure).
  if (!hardware) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header
          hardware={null}
          onlineRuntimeCount={0}
          totalRuntimeCount={3}
          onOpenShareModal={() => {}}
          lang={lang}
          setLang={setLang}
        />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="glass-panel rounded-2xl p-8 max-w-md w-full text-center">
            {hardwareError ? (
              <>
                <h2 className="text-base font-bold text-white mb-2">
                  {isZh ? '硬件检测失败' : 'Hardware detection failed'}
                </h2>
                <p className="text-xs text-slate-400 font-mono break-words mb-4">
                  {hardwareError}
                </p>
                <button
                  onClick={loadSystemInfo}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-semibold text-white transition cursor-pointer"
                >
                  {isZh ? '重试检测' : 'Retry detection'}
                </button>
              </>
            ) : (
              <>
                <div className="w-8 h-8 mx-auto mb-3 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin"></div>
                <h2 className="text-base font-bold text-white">
                  {isZh ? '正在检测本机硬件…' : 'Detecting your hardware…'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {isZh ? '所有检测均在本地完成，不会上传任何数据' : 'All detection runs locally. Nothing is uploaded.'}
                </p>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Top Navigation */}
      <Header
        hardware={hardware}
        onlineRuntimeCount={runtimes.filter((r) => r.online).length}
        totalRuntimeCount={runtimes.length}
        onOpenShareModal={() => setShowShareModal(true)}
        lang={lang}
        setLang={setLang}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Hero Section */}
        <section className="text-center py-6 md:py-8 relative">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-4 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isZh ? '本地 AI 性能评估与真实测算引擎' : 'Local AI Hardware Evaluator & Benchmark'}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight">
            {isZh ? (
              <>
                测测你的电脑 <span className="text-gradient">究竟能跑什么 AI 模型</span>
              </>
            ) : (
              <>
                Find out what AI models <span className="text-gradient">your PC can actually run</span>
              </>
            )}
          </h2>

          <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto mt-3">
            {isZh 
              ? '摆脱盲猜。基于物理内存、GPU 显存、KV Cache 开销计算真实兼容性，并联动本机 Ollama / LM Studio / llama.cpp 进行真实速度实测。' 
              : 'No more guessing. Real compatibility from RAM, VRAM and KV Cache — live benchmarks via Ollama, LM Studio or llama.cpp.'}
          </p>
        </section>

        {/* Section 1: Detected Hardware */}
        <section>
          <HardwareCard hardware={hardware} lang={lang} />
        </section>

        {/* Section 2: Context Window Controller */}
        <section>
          <ContextSlider
            contextLength={contextLength}
            setContextLength={setContextLength}
            lang={lang}
          />
        </section>

        {/* Section 3: Live Benchmark Runner */}
        <section>
          <BenchmarkRunner
            runtimes={runtimes}
            selectedRuntime={selectedRuntime}
            setSelectedRuntime={setSelectedRuntime}
            selectedModel={selectedModels[selectedRuntime] ?? ''}
            setSelectedModel={(m) => setSelectedModels((prev) => ({ ...prev, [selectedRuntime]: m }))}
            onRunBenchmark={handleRunBenchmark}
            benchmarking={benchmarking}
            benchmarkingModel={benchmarkingModel}
            latestBenchmark={latestBenchmark}
            onRefresh={loadSystemInfo}
            lang={lang}
          />
        </section>

        {/* Section 3.5: Local Benchmark History */}
        <section>
          <HistoryPanel
            entries={history}
            loading={historyLoading}
            onDelete={handleDeleteHistory}
            onClear={handleClearHistory}
            lang={lang}
          />
        </section>

        {/* Section 4: Model Compatibility Explorer */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-blue-400" />
                <span>{isZh ? '主流开源模型兼容性评估库' : 'Model Compatibility Explorer'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {evaluationsError
                  ? (isZh ? `计算失败：${evaluationsError}` : `Engine error: ${evaluationsError}`)
                  : (isZh 
                    ? '已为你实时测算不同尺寸与量化格式在当前机器上的适配等级与预估生成速度（由本地 Rust 引擎计算）' 
                    : 'Real-time memory and speed estimates computed by the local Rust engine')}
              </p>
            </div>
          </div>

          {evaluationsError ? null : (
            <ModelExplorer
              models={evaluations}
              installedOllamaModels={installedOllamaNames}
              onRunBenchmark={(modelName) => handleRunBenchmark('ollama', modelName)}
              benchmarkingModel={benchmarkingModel}
              lang={lang}
            />
          )}
        </section>
      </main>

      {/* Share Score Modal */}
      <ShareCardModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        hardware={hardware}
        latestBenchmark={latestBenchmark}
        history={history}
        lang={lang}
      />

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-900 bg-slate-950/60 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <div className="flex items-center justify-center space-x-4">
            <span className="font-semibold text-slate-400">Can I Run AI?</span>
            <span>·</span>
            <a href="https://github.com/AnonUsAl/can-i-run-ai" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition">
              GitHub
            </a>
            <span>·</span>
            <span>No Guessing. Measure It.</span>
          </div>
          <p className="text-[11px] text-slate-600">
            {isZh 
              ? '本地优先设计 · 硬件数据仅在本地读取计算 · 绝不上传任何个人文件与隐私' 
              : 'Local-first architecture · Hardware data remains strictly on your machine'}
          </p>
        </div>
      </footer>
    </div>
  );
};
