import React from 'react';
import { Cpu, Sparkles } from 'lucide-react';
import { HardwareSpecs } from '../types';

interface HeaderProps {
  hardware: HardwareSpecs | null;
  ollamaOnline: boolean;
  installedCount: number;
  onOpenShareModal: () => void;
  lang: 'zh' | 'en';
  setLang: (lang: 'zh' | 'en') => void;
}

export const Header: React.FC<HeaderProps> = ({
  ollamaOnline,
  installedCount,
  onOpenShareModal,
  lang,
  setLang,
}) => {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1px] shadow-lg shadow-blue-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
              <Cpu className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                Can I Run AI<span className="text-blue-500">?</span>
              </h1>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                MVP v0.1
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              {lang === 'zh' ? '本地 AI 硬件兼容性与性能基准评估' : 'Local AI Hardware Compatibility & Benchmark'}
            </p>
          </div>
        </div>

        {/* Status Indicators & Actions */}
        <div className="flex items-center space-x-3">
          {/* Ollama Status Badge */}
          <div className="hidden md:flex items-center space-x-2 px-3 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
            {ollamaOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-slate-300 font-medium">Ollama:</span>
                <span className="text-emerald-400 font-mono">
                  {lang === 'zh' ? `已就绪 (${installedCount}个模型)` : `Ready (${installedCount} models)`}
                </span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="text-slate-400">Ollama:</span>
                <span className="text-amber-400/90">
                  {lang === 'zh' ? '未启动 (仅理论评估)' : 'Offline (Theoretical)'}
                </span>
              </>
            )}
          </div>

          {/* Share Score Button */}
          <button
            onClick={onOpenShareModal}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{lang === 'zh' ? '生成跑分卡片' : 'Share Card'}</span>
          </button>

          {/* Language Switch */}
          <button
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 transition cursor-pointer"
            title="切换语言 / Switch Language"
          >
            {lang === 'zh' ? 'EN' : '中文'}
          </button>

          {/* GitHub Link */}
          <a
            href="https://github.com/AnonUsAl/can-i-run-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="GitHub Repository"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
};
