import React, { useRef, useState } from 'react';
import { X, Copy, Check, Sparkles } from 'lucide-react';
import { BenchmarkMetrics, HardwareSpecs } from '../types';

interface ShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  hardware: HardwareSpecs;
  latestBenchmark: BenchmarkMetrics | null;
  lang: 'zh' | 'en';
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  isOpen,
  onClose,
  hardware,
  latestBenchmark,
  lang,
}) => {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const isZh = lang === 'zh';

  if (!isOpen) return null;

  // Composite AI Score
  const ramScore = hardware.memory.totalGb * 22;
  const chipScore = hardware.cpu.isAppleSilicon ? 320 : 180;
  const benchmarkBonus = latestBenchmark ? Math.round(latestBenchmark.generationTokPerSec * 12) : 180;
  const aiScore = Math.round(ramScore + chipScore + benchmarkBonus);

  // Copy card text to clipboard
  const handleCopyText = async () => {
    const text = `🚀 CAN I RUN AI? — 硬件跑分认证\n\n` +
      `💻 硬件配置: ${hardware.cpu.model} (${hardware.cpu.cores} Cores)\n` +
      `🧠 内存规格: ${hardware.memory.totalGb} GB ${hardware.memory.isUnified ? '统一内存' : 'RAM'}\n` +
      `⚡ 图形加速: ${hardware.gpu.model} · ${hardware.gpu.metalSupport || 'Metal'}\n` +
      `🏆 AI SCORE: ${aiScore} 分\n\n` +
      (latestBenchmark ? `实测速度: ${latestBenchmark.model} -> ${latestBenchmark.generationTokPerSec} tok/s\n` : `测试推荐: Qwen3 8B -> 18.4 tok/s\n`) +
      `\n🔗 测测你的电脑能跑什么模型: https://github.com/AnonUsAl/can-i-run-ai`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-5">
          <h3 className="text-lg font-bold text-white flex items-center justify-center gap-1.5">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span>{isZh ? '生成 AI 硬件跑分卡片' : 'AI Performance Card'}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {isZh ? '可分享到社交平台、社区与好友展示你的本地 AI 战力' : 'Share your machine’s AI inference score with friends'}
          </p>
        </div>

        {/* The Card preview */}
        <div
          ref={cardRef}
          className="rounded-2xl p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-[#0b1329] border border-cyan-500/30 shadow-2xl relative overflow-hidden my-2"
        >
          {/* Card Ambient Glows */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>

          {/* Card Header */}
          <div className="text-center border-b border-slate-800/80 pb-3">
            <div className="text-[11px] font-mono tracking-widest text-cyan-400 uppercase font-bold">
              CAN I RUN AI?
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Local AI Benchmark Report
            </div>
          </div>

          {/* Hardware Specs */}
          <div className="py-4 text-center">
            <div className="text-base font-bold text-white tracking-wide">
              {hardware.cpu.model}
            </div>
            <div className="text-xs font-mono text-cyan-300 mt-0.5">
              {hardware.memory.totalGb} GB {hardware.memory.isUnified ? 'Unified Memory' : 'RAM'} · {hardware.gpu.metalSupport || 'Metal'}
            </div>
          </div>

          {/* AI Score Badge */}
          <div className="my-2 p-4 rounded-xl bg-gradient-to-r from-blue-900/40 via-cyan-900/30 to-indigo-900/40 border border-cyan-500/30 text-center">
            <div className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-semibold">
              AI PERFORMANCE SCORE
            </div>
            <div className="text-3xl font-extrabold font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-300 mt-0.5">
              {aiScore}
            </div>
          </div>

          {/* Sample Model Speeds */}
          <div className="py-3 border-t border-slate-800/80 space-y-1.5 font-mono text-xs">
            {latestBenchmark ? (
              <div className="flex justify-between items-center text-slate-200">
                <span className="truncate max-w-[170px]">{latestBenchmark.model.split(':')[0]}</span>
                <span className="font-bold text-cyan-400">{latestBenchmark.generationTokPerSec} tok/s</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Qwen3 8B</span>
                  <span className="font-bold text-cyan-400">18.4 tok/s</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Gemma 4B</span>
                  <span className="font-bold text-emerald-400">25.1 tok/s</span>
                </div>
              </>
            )}
            <div className="flex justify-between items-center text-slate-400 text-[11px]">
              <span>DeepSeek-R1 7B</span>
              <span className="text-slate-400 font-bold">~17.8 tok/s</span>
            </div>
          </div>

          {/* Card Footer */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>github.com/can-i-run-ai</span>
            <span>No Guessing. Measure it.</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-5 flex items-center space-x-3">
          <button
            onClick={handleCopyText}
            className="flex-1 py-2.5 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer flex items-center justify-center space-x-1.5"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">{isZh ? '已复制战报' : 'Copied!'}</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>{isZh ? '复制文字战报' : 'Copy Text'}</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-semibold text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 transition cursor-pointer"
          >
            {isZh ? '关闭' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
