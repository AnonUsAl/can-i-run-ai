import React, { useState, useEffect, useMemo } from 'react';
import { 
  DEFAULT_HARDWARE, 
  fetchHardwareSpecs, 
  fetchOllamaModels, 
  runOllamaBenchmark 
} from './lib/api';
import { MODELS_DATABASE } from './data/models';
import { BenchmarkMetrics, HardwareSpecs, OllamaModelDetail } from './types';
import { Header } from './components/Header';
import { HardwareCard } from './components/HardwareCard';
import { ContextSlider } from './components/ContextSlider';
import { BenchmarkRunner } from './components/BenchmarkRunner';
import { ModelExplorer } from './components/ModelExplorer';
import { ShareCardModal } from './components/ShareCardModal';
import { Sparkles, Compass } from 'lucide-react';

export const App: React.FC = () => {
  const [hardware, setHardware] = useState<HardwareSpecs>(DEFAULT_HARDWARE);
  const [contextLength, setContextLength] = useState<number>(8192);
  const [ollamaOnline, setOllamaOnline] = useState<boolean>(false);
  const [installedModels, setInstalledModels] = useState<OllamaModelDetail[]>([]);
  const [selectedBenchmarkModel, setSelectedBenchmarkModel] = useState<string>('');
  const [benchmarking, setBenchmarking] = useState<boolean>(false);
  const [benchmarkingModel, setBenchmarkingModel] = useState<string | null>(null);
  const [latestBenchmark, setLatestBenchmark] = useState<BenchmarkMetrics | null>(null);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [lang, setLang] = useState<'zh' | 'en'>('zh');

  const isZh = lang === 'zh';

  // Load hardware & ollama status
  const loadHardwareAndOllama = async () => {
    try {
      const hw = await fetchHardwareSpecs();
      setHardware(hw);
    } catch (_) {}

    try {
      const ollama = await fetchOllamaModels();
      setOllamaOnline(ollama.isRunning);
      setInstalledModels(ollama.models);
      if (ollama.models.length > 0 && !selectedBenchmarkModel) {
        setSelectedBenchmarkModel(ollama.models[0].name);
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadHardwareAndOllama();
  }, []);

  // Installed model names set for quick lookup
  const installedOllamaNames = useMemo(() => {
    return new Set(installedModels.map((m) => m.name));
  }, [installedModels]);

  // Run benchmark handler
  const handleRunBenchmark = async (modelName: string) => {
    setBenchmarking(true);
    setBenchmarkingModel(modelName);
    try {
      const result = await runOllamaBenchmark(modelName);
      setLatestBenchmark(result);
    } catch (err: any) {
      alert(err.message || '跑分测试遇到问题');
    } finally {
      setBenchmarking(false);
      setBenchmarkingModel(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Top Navigation */}
      <Header
        hardware={hardware}
        ollamaOnline={ollamaOnline}
        installedCount={installedModels.length}
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
              ? '摆脱盲猜。基于你的物理内存、GPU 显存、KV Cache 开销计算真实兼容性，并联动本地 Ollama 进行真实每秒 Token 速度测算。' 
              : 'No more guessing. Analyze physical memory, KV Cache overhead, and run live tokens/second benchmarks.'}
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
            ollamaOnline={ollamaOnline}
            installedModels={installedModels}
            selectedModel={selectedBenchmarkModel}
            setSelectedModel={setSelectedBenchmarkModel}
            onRunBenchmark={handleRunBenchmark}
            benchmarking={benchmarking}
            latestBenchmark={latestBenchmark}
            onRefreshOllama={loadHardwareAndOllama}
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
                {isZh 
                  ? '已为你实时测算不同尺寸与量化格式在当前机器上的适配等级与预估生成速度' 
                  : 'Real-time memory calculations and speed estimates on your machine'}
              </p>
            </div>
          </div>

          <ModelExplorer
            models={MODELS_DATABASE}
            hardware={hardware}
            contextLength={contextLength}
            installedOllamaModels={installedOllamaNames}
            onRunBenchmark={handleRunBenchmark}
            benchmarkingModel={benchmarkingModel}
            lang={lang}
          />
        </section>
      </main>

      {/* Share Score Modal */}
      <ShareCardModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        hardware={hardware}
        latestBenchmark={latestBenchmark}
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
