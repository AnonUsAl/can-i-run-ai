import React from 'react';
import { 
  Zap, 
  Play, 
  RefreshCw, 
  Gauge, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { BenchmarkMetrics, OllamaModelDetail } from '../types';

interface BenchmarkRunnerProps {
  ollamaOnline: boolean;
  installedModels: OllamaModelDetail[];
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  onRunBenchmark: (modelName: string) => Promise<void>;
  benchmarking: boolean;
  latestBenchmark: BenchmarkMetrics | null;
  onRefreshOllama: () => void;
  lang: 'zh' | 'en';
}

export const BenchmarkRunner: React.FC<BenchmarkRunnerProps> = ({
  ollamaOnline,
  installedModels,
  selectedModel,
  setSelectedModel,
  onRunBenchmark,
  benchmarking,
  latestBenchmark,
  onRefreshOllama,
  lang,
}) => {
  const isZh = lang === 'zh';

  return (
    <div className="glass-panel rounded-2xl p-5 md:p-6 shadow-xl border border-slate-800/80 relative overflow-hidden">
      {/* Glow accent */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">
                  {isZh ? '本地实机基准测试 (Local Benchmark)' : 'Local Live Benchmark'}
                </h3>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {isZh ? '真实跑分' : 'Live Engine'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isZh 
                  ? '能实测就绝不靠猜 — 调用本机实际运行的推理引擎测算真实生成吞吐' 
                  : 'Measure, don’t guess — invoke actual local runtime to test real tok/s'}
              </p>
            </div>
          </div>

          <button
            onClick={onRefreshOllama}
            disabled={benchmarking}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-300 transition cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${benchmarking ? 'animate-spin' : ''}`} />
            <span>{isZh ? '刷新状态' : 'Refresh'}</span>
          </button>
        </div>

        {/* Ollama Active View */}
        {ollamaOnline ? (
          <div className="mt-5 space-y-5">
            {/* Model Select & Run Button */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-400 block mb-1.5">
                  {isZh ? '选择测试模型 (当前本机已下载):' : 'Select Installed Model:'}
                </label>
                {installedModels.length > 0 ? (
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={benchmarking}
                    className="w-full sm:max-w-md px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono text-white focus:outline-none focus:border-cyan-500 transition"
                  >
                    {installedModels.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name} ({m.details.parameter_size || ''} {m.details.quantization_level || ''})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-amber-400">
                    {isZh ? 'Ollama 已就绪，但尚未下载任何模型。可打开终端运行 ollama run qwen2.5:7b 下载。' : 'Ollama is online but has no downloaded models yet.'}
                  </p>
                )}
              </div>

              <button
                onClick={() => onRunBenchmark(selectedModel)}
                disabled={benchmarking || !selectedModel}
                className={`px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-lg active:scale-95 ${
                  benchmarking
                    ? 'bg-cyan-900/50 text-cyan-300 cursor-not-allowed border border-cyan-700/50'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/20'
                }`}
              >
                {benchmarking ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{isZh ? '正在执行基准测试...' : 'Benchmarking...'}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>{isZh ? '开始跑分测试' : 'Run Benchmark'}</span>
                  </>
                )}
              </button>
            </div>

            {/* In-Progress Testing Banner */}
            {benchmarking && (
              <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-center animate-pulse">
                <div className="flex items-center justify-center space-x-2 text-cyan-300 font-medium text-sm">
                  <Gauge className="w-5 h-5 animate-spin-slow" />
                  <span>{isZh ? `正在向 ${selectedModel} 发送标准评估提示词并测量 TTFT 与生成速度...` : `Testing ${selectedModel}...`}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {isZh ? '提示：首次运行将先进行显存权重预热，预计耗时 3~10 秒' : 'Warm-up phase in progress, please wait...'}
                </p>
              </div>
            )}

            {/* Benchmark Results */}
            {latestBenchmark && (
              <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 shadow-inner space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white font-mono">
                      {latestBenchmark.model}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(latestBenchmark.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                    {isZh ? '测试完成' : 'Completed'}
                  </span>
                </div>

                {/* 4 Score Gauges */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Generation tok/s */}
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1">
                      {isZh ? '生成速度 (Generation)' : 'Generation Speed'}
                    </span>
                    <div className="text-xl font-bold font-mono text-cyan-400">
                      {latestBenchmark.generationTokPerSec} <span className="text-xs text-slate-400 font-normal">tok/s</span>
                    </div>
                  </div>

                  {/* Prompt Processing tok/s */}
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1">
                      {isZh ? 'Prompt 预处理速度' : 'Prompt Processing'}
                    </span>
                    <div className="text-xl font-bold font-mono text-blue-400">
                      {latestBenchmark.promptEvalTokPerSec} <span className="text-xs text-slate-400 font-normal">tok/s</span>
                    </div>
                  </div>

                  {/* TTFT */}
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1">
                      {isZh ? '首字延迟 (TTFT)' : 'Time to First Token'}
                    </span>
                    <div className="text-xl font-bold font-mono text-emerald-400">
                      {latestBenchmark.ttftSec} <span className="text-xs text-slate-400 font-normal">s</span>
                    </div>
                  </div>

                  {/* Total tokens */}
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1">
                      {isZh ? '总生成耗时' : 'Total Generation'}
                    </span>
                    <div className="text-xl font-bold font-mono text-slate-200">
                      {latestBenchmark.totalDurationSec} <span className="text-xs text-slate-400 font-normal">s</span>
                    </div>
                  </div>
                </div>

                {/* Sample Output */}
                {latestBenchmark.sampleOutput && (
                  <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800/80 text-xs">
                    <div className="text-[11px] text-slate-500 font-medium mb-1">
                      {isZh ? '生成测试样本输出片段:' : 'Sample Generation Output:'}
                    </div>
                    <p className="text-slate-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                      {latestBenchmark.sampleOutput}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Ollama Offline Guidance */
          <div className="mt-5 p-5 rounded-xl bg-slate-900/40 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-white">
                  {isZh ? '未检测到正在运行的 Ollama' : 'Ollama is not running locally'}
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xl">
                  {isZh 
                    ? '已为您提供精准的理论数学兼容性测算。若想进行真实实机跑分，请在终端启动 Ollama：'
                    : 'Theoretical compatibility calculations are active. To run live hardware benchmarks, start Ollama:'}
                </p>
                <div className="mt-2 inline-block px-3 py-1 rounded-md bg-black font-mono text-xs text-cyan-300 border border-slate-800">
                  ollama serve
                </div>
              </div>
            </div>

            <a
              href="https://ollama.com/download"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition shrink-0"
            >
              {isZh ? '下载 Ollama 客户端' : 'Download Ollama'}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
