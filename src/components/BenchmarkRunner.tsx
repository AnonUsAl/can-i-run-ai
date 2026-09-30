import React from 'react';
import { 
  Zap, 
  Play, 
  RefreshCw, 
  Gauge, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { BenchmarkMetrics, RuntimeKind, RuntimeStatus } from '../types';

interface BenchmarkRunnerProps {
  runtimes: RuntimeStatus[];
  selectedRuntime: RuntimeKind;
  setSelectedRuntime: (r: RuntimeKind) => void;
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  onRunBenchmark: (runtime: RuntimeKind, model: string) => void;
  benchmarking: boolean;
  benchmarkingModel: string | null;
  latestBenchmark: BenchmarkMetrics | null;
  onRefresh: () => void;
  lang: 'zh' | 'en';
}

export const BenchmarkRunner: React.FC<BenchmarkRunnerProps> = ({
  runtimes,
  selectedRuntime,
  setSelectedRuntime,
  selectedModel,
  setSelectedModel,
  onRunBenchmark,
  benchmarking,
  benchmarkingModel,
  latestBenchmark,
  onRefresh,
  lang,
}) => {
  const isZh = lang === 'zh';
  const current = runtimes.find((r) => r.kind === selectedRuntime);
  const onlineRuntimes = runtimes.filter((r) => r.online);
  const runtimeLabel = (id: RuntimeKind) => runtimes.find((r) => r.kind === id)?.label ?? id;

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
                  ? '能实测就绝不靠猜 — 对本机任意在线运行时执行预热 + 3 次流式测量取中位数' 
                  : 'Measure, don’t guess — warm-up + median of 3 streaming runs on any online runtime'}
              </p>
            </div>
          </div>

          <button
            onClick={onRefresh}
            disabled={benchmarking}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-300 transition cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${benchmarking ? 'animate-spin' : ''}`} />
            <span>{isZh ? '刷新状态' : 'Refresh'}</span>
          </button>
        </div>

        {/* Runtime selector */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {runtimes.map((r) => {
            const isSelected = r.kind === selectedRuntime;
            return (
              <button
                key={r.kind}
                onClick={() => setSelectedRuntime(r.kind)}
                disabled={benchmarking}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 text-white border-slate-600 shadow-inner'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${r.online ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                <span>{r.label}</span>
                {r.online && (
                  <span className="text-[10px] font-mono text-slate-500">
                    {r.models.length} {isZh ? '个模型' : 'models'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {current?.online ? (
          <div className="mt-5 space-y-5">
            {/* Model Select & Run Button */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-400 block mb-1.5">
                  {isZh ? `选择测试模型（${current.label}）:` : `Select Model (${current.label}):`}
                </label>
                {current.models.length > 0 ? (
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={benchmarking}
                    className="w-full sm:max-w-md px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono text-white focus:outline-none focus:border-cyan-500 transition"
                  >
                    {current.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display}
                        {m.quant ? ` · ${m.quant}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-amber-400">
                    {isZh 
                      ? `${current.label} 在线，但没有发现可用模型。`
                      : `${current.label} is online but reports no models.`}
                  </p>
                )}
              </div>

              <button
                onClick={() => onRunBenchmark(selectedRuntime, selectedModel)}
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
            {benchmarking && benchmarkingModel && (
              <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-center animate-pulse">
                <div className="flex items-center justify-center space-x-2 text-cyan-300 font-medium text-sm">
                  <Gauge className="w-5 h-5 animate-spin-slow" />
                  <span>
                    {isZh
                      ? `正在通过 ${runtimeLabel(selectedRuntime)} 测试 ${benchmarkingModel}（预热 + 3 次测量）...`
                      : `Testing ${benchmarkingModel} via ${runtimeLabel(selectedRuntime)} (warm-up + 3 runs)...`}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {isZh ? '首次运行会先加载模型（预热不计入成绩），预计耗时 10~60 秒' : 'The warm-up run absorbs model loading; expect 10~60s'}
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
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                      {runtimeLabel(latestBenchmark.runtime)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(latestBenchmark.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-[10px] text-cyan-400/90 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20 font-medium">
                      {isZh
                        ? `中位数 · ${latestBenchmark.runsCompleted} 次实测`
                        : `Median · ${latestBenchmark.runsCompleted} runs`}
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
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {latestBenchmark.generationMinTokPerSec} ~ {latestBenchmark.generationMaxTokPerSec} tok/s
                    </div>
                  </div>

                  {/* Prompt Processing tok/s */}
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1">
                      {isZh ? 'Prompt 预处理速度' : 'Prompt Processing'}
                    </span>
                    <div className="text-xl font-bold font-mono text-blue-400">
                      {latestBenchmark.promptEvalTokPerSec > 0
                        ? latestBenchmark.promptEvalTokPerSec
                        : '—'} <span className="text-xs text-slate-400 font-normal">tok/s</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {latestBenchmark.promptEvalTokPerSec > 0
                        ? isZh ? '由运行时计时' : 'server-timed'
                        : isZh ? '该运行时未提供' : 'not exposed'}
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
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {latestBenchmark.ttftMinSec} ~ {latestBenchmark.ttftMaxSec} s
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
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {latestBenchmark.totalTokens} tokens
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
          /* Offline Guidance */
          <div className="mt-5 p-5 rounded-xl bg-slate-900/40 border border-slate-800">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-white">
                  {onlineRuntimes.length === 0
                    ? (isZh ? '未检测到任何在线运行时' : 'No local runtime detected')
                    : (isZh ? `${current?.label} 未启动` : `${current?.label} is not running`)}
                </h4>
                <ul className="space-y-1.5 text-xs">
                  {runtimes.map((r) => (
                    <li key={r.kind} className="flex items-center space-x-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${r.online ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                      <span className="text-slate-300 w-20 shrink-0">{r.label}</span>
                      <code className="px-2 py-0.5 rounded-md bg-black font-mono text-[11px] text-cyan-300 border border-slate-800">
                        {r.detail || r.baseUrl}
                      </code>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-400">
                  {isZh ? '启动后点击「刷新状态」。理论兼容性测算不受影响，始终可用。' : 'Start one, then hit Refresh. Theoretical compatibility keeps working regardless.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
