import React from 'react';
import { Laptop, Cpu, HardDrive, Zap, Layers, ShieldCheck, Check } from 'lucide-react';
import { HardwareSpecs } from '../types';

interface HardwareCardProps {
  hardware: HardwareSpecs;
  lang: 'zh' | 'en';
}

export const HardwareCard: React.FC<HardwareCardProps> = ({ hardware, lang }) => {
  const isZh = lang === 'zh';
  const totalRam = hardware.memory.totalGb;
  const safeRam = +(totalRam * 0.78).toFixed(1);

  // Machine AI capability verdict
  let tierTitle = isZh ? '8B 黄金尺寸与轻量 14B 理想平台' : 'Ideal for 8B & Lightweight 14B Models';
  let tierDesc = isZh 
    ? '当前设备配备 Apple Silicon 统一内存架构与高带宽总线，推荐运行 7B/8B (Q4/Q5) 及部分 14B 模型，日常对话与代码辅助体验极佳。'
    : 'Equipped with Apple Silicon Unified Memory and high bandwidth. Excellent for 7B/8B and select 14B models with zero GPU transfer lag.';

  if (totalRam >= 32 && totalRam < 64) {
    tierTitle = isZh ? '14B~32B 主力模型强劲工作站' : 'Workstation for 14B~32B Models';
    tierDesc = isZh 
      ? '拥有充足显存/统一内存，可流畅无损运行 14B-32B 级别中大型开源模型。'
      : 'Ample memory for smoothly running 14B to 32B tier models with generous context.';
  } else if (totalRam >= 64) {
    tierTitle = isZh ? '旗舰级大模型与 70B 深度推理怪兽' : 'Flagship 70B Heavyweight Rig';
    tierDesc = isZh 
      ? '足以运行 70B 旗舰级模型及 DeepSeek-R1 蒸馏大尺寸模型。'
      : 'Capable of running flagship 70B models and large reasoning distillations.';
  } else if (totalRam < 16) {
    tierTitle = isZh ? '0.5B~3B 端侧极速轻量设备' : 'Compact Setup for 0.5B~3B Models';
    tierDesc = isZh 
      ? '内存有限，强烈推荐运行 0.5B 到 3B 级别的轻量模型（如 Qwen2.5-3B、Llama-3.2-3B）。'
      : 'Limited memory. Strongly recommended to focus on compact 0.5B to 3B models.';
  }

  return (
    <div className="glass-panel rounded-2xl p-5 md:p-6 shadow-2xl relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">
                  {isZh ? '本机硬件规格' : 'Detected Hardware'}
                </h2>
                <span className="flex items-center text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  {isZh ? '真实探测已就绪' : 'Hardware Verified'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {hardware.osName} · {hardware.arch} · {hardware.cpu.isAppleSilicon ? 'Apple Silicon' : 'x86_64'}
              </p>
            </div>
          </div>

          {/* Quick specs pill */}
          <div className="flex flex-wrap gap-2 text-xs">
            {hardware.backends.map((backend) => (
              <span
                key={backend}
                className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-200 flex items-center gap-1 font-mono text-[11px]"
              >
                <Zap className="w-3 h-3 text-cyan-400" />
                {backend}
              </span>
            ))}
          </div>
        </div>

        {/* Hardware 4-Grid Specs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 my-5">
          {/* CPU */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/70 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-medium">{isZh ? '处理器 (CPU)' : 'Processor'}</span>
              <Cpu className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-sm font-bold text-white truncate" title={hardware.cpu.model}>
              {hardware.cpu.model}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {hardware.cpu.cores} {isZh ? '个计算核心' : 'Cores'}
            </div>
          </div>

          {/* RAM / Unified Memory */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/70 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-medium">
                {hardware.memory.isUnified ? (isZh ? '统一内存 (RAM)' : 'Unified Memory') : (isZh ? '系统内存' : 'RAM')}
              </span>
              <HardDrive className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-sm font-bold text-white">
              {totalRam} GB
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {hardware.memory.isUnified 
                ? (isZh ? 'CPU/GPU 零拷贝共享' : 'Zero-copy CPU/GPU') 
                : (isZh ? '标准系统内存' : 'DDR Memory')}
            </div>
          </div>

          {/* GPU */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/70 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-medium">{isZh ? '图形显卡 (GPU)' : 'Graphics'}</span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-sm font-bold text-white truncate" title={hardware.gpu.model}>
              {hardware.gpu.model}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {hardware.gpu.metalSupport || 'Metal'}
            </div>
          </div>

          {/* AI Memory Budget */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/70 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-medium">{isZh ? '安全 AI 显存预算' : 'AI Safe Budget'}</span>
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-sm font-bold text-emerald-400">
              ~{safeRam} GB
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {isZh ? '留存操作系统保障流畅' : 'Avoid OS paging'}
            </div>
          </div>
        </div>

        {/* Evaluation Banner */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900/40 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-2.5">
            <span className="mt-0.5 p-1 rounded-md bg-blue-500/20 text-blue-300">
              <Check className="w-3.5 h-3.5" />
            </span>
            <div>
              <div className="text-xs font-semibold text-blue-200">
                {tierTitle}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 max-w-2xl">
                {tierDesc}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] text-slate-400 block">{isZh ? '内存健康度评估' : 'RAM Headroom'}</span>
            <span className="text-xs font-mono font-bold text-cyan-300">
              {safeRam} GB / {totalRam} GB
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
