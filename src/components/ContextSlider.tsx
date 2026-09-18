import React from 'react';
import { Sliders, AlertTriangle } from 'lucide-react';

interface ContextSliderProps {
  contextLength: number;
  setContextLength: (val: number) => void;
  lang: 'zh' | 'en';
}

const PRESET_CONTEXTS = [
  { label: '2K', value: 2048, desc: '超短问答 / 极低消耗' },
  { label: '4K', value: 4096, desc: '普通日常对话' },
  { label: '8K', value: 8192, desc: '黄金平衡 (推荐)' },
  { label: '16K', value: 16384, desc: '长文处理 / 代码编写' },
  { label: '32K', value: 32768, desc: '长篇分析 / 论文研读' },
  { label: '64K', value: 65536, desc: '超长文档 / 深度记忆' },
  { label: '128K', value: 131072, desc: '全书检索 (极高内存)' },
];

export const ContextSlider: React.FC<ContextSliderProps> = ({
  contextLength,
  setContextLength,
  lang,
}) => {
  const isZh = lang === 'zh';

  return (
    <div className="glass-panel rounded-2xl p-5 shadow-lg border border-slate-800/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-800/80">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              {isZh ? '上下文窗口长度 (Context Length)' : 'Context Window Length'}
            </h3>
            <p className="text-[11px] text-slate-400">
              {isZh ? 'KV Cache 随上下文长度线性剧增，直接影响所需显存大小' : 'KV Cache expands with context size, directly increasing memory need'}
            </p>
          </div>
        </div>

        {/* Current Value Display */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <span className="text-xs text-slate-400">{isZh ? '当前设置:' : 'Selected:'}</span>
          <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono font-bold text-xs border border-indigo-500/30">
            {contextLength >= 1024 ? `${Math.round(contextLength / 1024)}K Tokens` : `${contextLength} Tokens`}
          </span>
        </div>
      </div>

      {/* Preset Pills */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-3">
        {PRESET_CONTEXTS.map((preset) => {
          const isSelected = contextLength === preset.value;
          return (
            <button
              key={preset.value}
              onClick={() => setContextLength(preset.value)}
              className={`px-2 py-2 rounded-xl text-center transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-gradient-to-b from-indigo-600 to-blue-600 text-white font-bold border-indigo-400 shadow-lg shadow-indigo-500/20 scale-[1.02]'
                  : 'bg-slate-900/60 hover:bg-slate-800/70 text-slate-300 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-mono font-bold">{preset.label}</div>
              <div className="text-[9px] text-slate-400 mt-0.5 truncate hidden sm:block">
                {isZh ? preset.desc.split('/')[0] : `${preset.value / 1024}k`}
              </div>
            </button>
          );
        })}
      </div>

      {/* Dynamic Context Warning if high */}
      {contextLength >= 65536 && (
        <div className="mt-2 text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {isZh 
              ? '注意：超长上下文 (64K/128K) 会为 KV Cache 额外增加数 GB 显存开销。若非必要处理超长篇文本，建议调至 8K/16K 以获更高推理速度。'
              : 'Warning: 64K/128K context window significantly increases KV cache memory. For general chats, 8K/16K is much faster.'}
          </span>
        </div>
      )}
    </div>
  );
};
