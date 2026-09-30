import React, { useMemo } from 'react';
import { History, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { HistoryEntry } from '../types';

interface HistoryPanelProps {
  entries: HistoryEntry[];
  loading: boolean;
  onDelete: (id: number) => void;
  onClear: () => void;
  lang: 'zh' | 'en';
}

interface Group {
  key: string;
  runtime: string;
  model: string;
  entries: HistoryEntry[];
}

const MAX_ROWS_PER_GROUP = 5;

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  entries,
  loading,
  onDelete,
  onClear,
  lang,
}) => {
  const isZh = lang === 'zh';

  // Group by runtime+model so each group can show progression
  // (latest vs previous on the same hardware fingerprint).
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const e of entries) {
      const key = `${e.runtime}::${e.model}`;
      if (!map.has(key)) map.set(key, { key, runtime: e.runtime, model: e.model, entries: [] });
      map.get(key)!.entries.push(e);
    }
    return [...map.values()];
  }, [entries]);

  const compare = (group: Group) => {
    const [latest, prev] = group.entries;
    if (!latest || !prev) return null;
    if (prev.generationTokPerSec <= 0) return null;
    const deltaPct = ((latest.generationTokPerSec - prev.generationTokPerSec) / prev.generationTokPerSec) * 100;
    if (Math.abs(deltaPct) < 1) return { pct: 0, sameHardware: latest.hardwareFingerprint === prev.hardwareFingerprint };
    return { pct: deltaPct, sameHardware: latest.hardwareFingerprint === prev.hardwareFingerprint };
  };

  return (
    <div className="glass-panel rounded-2xl p-5 md:p-6 shadow-xl border border-slate-800/80 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isZh ? '跑分历史 (Local History)' : 'Benchmark History'}
              </h3>
              <p className="text-xs text-slate-400">
                {isZh
                  ? '保存在本机应用数据目录（SQLite），可跨重启对比 — 不上传任何数据'
                  : 'Stored locally in app data (SQLite), survives restarts — nothing is uploaded'}
              </p>
            </div>
          </div>
          {entries.length > 0 && (
            <button
              onClick={onClear}
              className="px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-rose-900/40 border border-slate-700/80 hover:border-rose-700/60 text-xs text-slate-300 transition cursor-pointer"
            >
              {isZh ? '清空全部' : 'Clear all'}
            </button>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <p className="py-6 text-center text-xs text-slate-500">{isZh ? '加载中…' : 'Loading…'}</p>
        ) : groups.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">
            {isZh
              ? '还没有跑分记录 — 完成一次基准测试后自动保存在这里。'
              : 'No runs yet — completed benchmarks are saved here automatically.'}
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {groups.map((g) => {
              const cmp = compare(g);
              return (
                <div key={g.key} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  {/* Group header: model + latest-vs-previous delta */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-white font-mono">{g.model}</span>
                      <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                        {g.runtime}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {g.entries.length} {isZh ? '条' : 'runs'}
                      </span>
                    </div>
                    {cmp && (
                      <span
                        className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                          cmp.pct > 0
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                            : cmp.pct < 0
                              ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                              : 'text-slate-400 bg-slate-800 border-slate-700'
                        }`}
                        title={cmp.sameHardware ? undefined : (isZh ? '两次测试的硬件配置不同' : 'hardware differs between runs')}
                      >
                        {cmp.pct > 0 ? <TrendingUp className="w-3 h-3 inline mr-1" /> 
                          : cmp.pct < 0 ? <TrendingDown className="w-3 h-3 inline mr-1" /> 
                          : <Minus className="w-3 h-3 inline mr-1" />}
                        {cmp.pct === 0
                          ? (isZh ? '持平' : 'stable')
                          : `${cmp.pct > 0 ? '+' : ''}${cmp.pct.toFixed(1)}%`}
                        {!cmp.sameHardware && (isZh ? '（硬件不同）' : ' (diff HW)')}
                      </span>
                    )}
                  </div>

                  {/* Rows */}
                  <div className="space-y-1.5">
                    {g.entries.slice(0, MAX_ROWS_PER_GROUP).map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <span className="text-slate-400 font-mono text-[11px] shrink-0">
                            {new Date(e.createdAt).toLocaleString()}
                          </span>
                          <span className="font-mono text-cyan-400 shrink-0">
                            {e.generationTokPerSec} tok/s
                          </span>
                          <span className="font-mono text-slate-500 shrink-0">
                            TTFT {e.ttftSec}s
                          </span>
                          <span className="text-slate-600 truncate hidden sm:inline" title={e.hardwareSummary}>
                            {e.hardwareSummary}
                          </span>
                        </div>
                        <button
                          onClick={() => onDelete(e.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 transition cursor-pointer shrink-0"
                          title={isZh ? '删除该条记录' : 'Delete entry'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {g.entries.length > MAX_ROWS_PER_GROUP && (
                      <p className="text-[10px] text-slate-600 text-center">
                        {isZh ? `仅显示最近 ${MAX_ROWS_PER_GROUP} 条` : `showing latest ${MAX_ROWS_PER_GROUP}`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
