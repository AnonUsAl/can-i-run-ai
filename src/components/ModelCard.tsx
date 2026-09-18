import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Play, 
  ChevronDown, 
  ChevronUp, 
  Zap, 
  Layers
} from 'lucide-react';
import { AIModelDefinition, CompatibilityReport, QuantizationType } from '../types';

interface ModelCardProps {
  model: AIModelDefinition;
  report: CompatibilityReport;
  selectedQuant: QuantizationType;
  onSelectQuant: (q: QuantizationType) => void;
  isInstalledInOllama: boolean;
  onRunBenchmark?: (modelName: string) => void;
  isBenchmarking?: boolean;
  lang: 'zh' | 'en';
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  report,
  selectedQuant,
  onSelectQuant,
  isInstalledInOllama,
  onRunBenchmark,
  isBenchmarking = false,
  lang,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const isZh = lang === 'zh';

  // Status-based styling
  const statusStyles = {
    'recommended': {
      border: 'border-emerald-500/30 hover:border-emerald-500/50',
      badge: 'badge-glow-green',
      icon: CheckCircle2,
      progress: 'bg-emerald-500',
    },
    'runnable': {
      border: 'border-amber-500/30 hover:border-amber-500/50',
      badge: 'badge-glow-amber',
      icon: AlertTriangle,
      progress: 'bg-amber-500',
    },
    'not-recommended': {
      border: 'border-rose-500/30 hover:border-rose-500/50',
      badge: 'badge-glow-rose',
      icon: XCircle,
      progress: 'bg-rose-500',
    },
    'incompatible': {
      border: 'border-slate-800 hover:border-slate-700',
      badge: 'badge-glow-gray',
      icon: XCircle,
      progress: 'bg-slate-600',
    },
  }[report.status];

  const StatusIcon = statusStyles.icon;

  return (
    <div className={`glass-panel rounded-2xl p-4 md:p-5 transition-all duration-200 border ${statusStyles.border} relative flex flex-col justify-between`}>
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                {model.family}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold">
                {model.parameterCountBillion}B
              </span>
              {isInstalledInOllama && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  {isZh ? '本地已装' : 'Installed'}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white mt-1 group-hover:text-blue-400 transition">
              {model.name}
            </h3>
          </div>

          {/* Status Badge */}
          <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center space-x-1.5 shrink-0 ${statusStyles.badge}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            <span>{report.statusLabel.split(' ')[1] || report.statusLabel}</span>
          </div>
        </div>

        {/* Short Description */}
        <p className="text-xs text-slate-400 mb-3 line-clamp-2">
          {model.description}
        </p>

        {/* Quantization Pills */}
        <div className="flex items-center space-x-1.5 mb-4 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] text-slate-500 mr-1">{isZh ? '量化:' : 'Quant:'}</span>
          {model.supportedQuantizations.map((quant) => {
            const isSelected = selectedQuant === quant;
            return (
              <button
                key={quant}
                onClick={() => onSelectQuant(quant)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition cursor-pointer border ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {quant}
              </button>
            );
          })}
        </div>

        {/* Memory Bar */}
        <div className="mb-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              {isZh ? '预估内存占用' : 'Estimated Memory'}
            </span>
            <div className="font-mono font-bold text-white">
              <span className={report.status === 'recommended' ? 'text-emerald-400' : report.status === 'runnable' ? 'text-amber-400' : 'text-rose-400'}>
                {report.totalRequiredMemoryGb} GB
              </span>
              <span className="text-slate-500 text-[11px] font-normal"> / {report.usableMemoryGb} GB 预算</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${statusStyles.progress}`}
              style={{ width: `${Math.min(100, (report.totalRequiredMemoryGb / report.usableMemoryGb) * 100)}%` }}
            ></div>
          </div>

          {/* Speed estimate and advice */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60 text-[11px]">
            <div className="flex items-center space-x-1 text-slate-400">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isZh ? '预估速度:' : 'Speed:'}</span>
              <span className="font-mono font-bold text-cyan-300">
                {report.estimatedTokensPerSecond > 0 ? `~${report.estimatedTokensPerSecond} tok/s` : '无法满速'}
              </span>
            </div>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-slate-400 hover:text-slate-200 flex items-center space-x-0.5 transition cursor-pointer"
            >
              <span>{showDetails ? (isZh ? '收起' : 'Less') : (isZh ? '构成明细' : 'Details')}</span>
              {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Detailed Breakdown (Collapsible) */}
        {showDetails && (
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs mb-3 space-y-1.5 animate-fadeIn">
            <div className="text-[11px] font-semibold text-slate-300 pb-1 border-b border-slate-800">
              {isZh ? '内存构成简析' : 'Memory Breakdown'}
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>📦 模型权重 (Weights):</span>
              <span className="font-mono text-slate-200">{report.weightsMemoryGb} GB</span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>⚡ KV Cache (上下文):</span>
              <span className="font-mono text-slate-200">{report.kvCacheMemoryGb} GB</span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>⚙️ 运行时开销 (Overhead):</span>
              <span className="font-mono text-slate-200">{report.overheadMemoryGb} GB</span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>🛡️ 激活临时缓存 (Buffers):</span>
              <span className="font-mono text-slate-200">{report.buffersMemoryGb} GB</span>
            </div>
            <div className="pt-1.5 border-t border-slate-800 text-[11px] text-slate-400">
              <span className="text-slate-300 font-medium">{isZh ? '建议与诊断: ' : 'Advice: '}</span>
              {report.advice}
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <div className="text-[11px] text-slate-400 truncate max-w-[170px]" title={model.recommendedUse}>
          {model.recommendedUse}
        </div>

        {model.ollamaName && onRunBenchmark && (
          <button
            onClick={() => onRunBenchmark(model.ollamaName!)}
            disabled={isBenchmarking}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-95 ${
              isInstalledInOllama
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
            <span>
              {isBenchmarking 
                ? (isZh ? '测试中...' : 'Testing...') 
                : isInstalledInOllama 
                  ? (isZh ? '立即跑分' : 'Benchmark') 
                  : (isZh ? '启动测试' : 'Test')}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
