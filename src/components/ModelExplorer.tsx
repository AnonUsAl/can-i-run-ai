import React, { useState, useMemo } from 'react';
import { Search, Layers } from 'lucide-react';
import { AIModelDefinition, CompatibilityReport, HardwareSpecs, QuantizationType } from '../types';
import { calculateCompatibility } from '../lib/compatibility';
import { ModelCard } from './ModelCard';

interface ModelExplorerProps {
  models: AIModelDefinition[];
  hardware: HardwareSpecs;
  contextLength: number;
  installedOllamaModels: Set<string>;
  onRunBenchmark: (modelName: string) => void;
  benchmarkingModel: string | null;
  lang: 'zh' | 'en';
}

export const ModelExplorer: React.FC<ModelExplorerProps> = ({
  models,
  hardware,
  contextLength,
  installedOllamaModels,
  onRunBenchmark,
  benchmarkingModel,
  lang,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [modelQuantMap, setModelQuantMap] = useState<Record<string, QuantizationType>>({});

  const isZh = lang === 'zh';

  // Compute reports for all models
  const modelReports = useMemo(() => {
    const map = new Map<string, CompatibilityReport>();
    models.forEach((m) => {
      const quant = modelQuantMap[m.id] || m.defaultQuantization;
      const report = calculateCompatibility(m, quant, contextLength, hardware);
      map.set(m.id, report);
    });
    return map;
  }, [models, modelQuantMap, contextLength, hardware]);

  // Model families
  const families = ['ALL', 'Qwen', 'DeepSeek', 'Llama', 'Gemma', 'Mistral', 'Phi'];

  // Counts by status
  const counts = useMemo(() => {
    let recommended = 0;
    let runnable = 0;
    let notRecommended = 0;
    let incompatible = 0;

    modelReports.forEach((rep) => {
      if (rep.status === 'recommended') recommended++;
      else if (rep.status === 'runnable') runnable++;
      else if (rep.status === 'not-recommended') notRecommended++;
      else if (rep.status === 'incompatible') incompatible++;
    });

    return {
      all: models.length,
      recommended,
      runnable,
      notRecommended,
      incompatible,
    };
  }, [models, modelReports]);

  // Filtered models
  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const report = modelReports.get(m.id);
      if (!report) return false;

      // Family match
      if (selectedFamily !== 'ALL' && m.family !== selectedFamily) return false;

      // Status match
      if (selectedStatus !== 'ALL' && report.status !== selectedStatus) return false;

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = m.name.toLowerCase().includes(q);
        const matchesFamily = m.family.toLowerCase().includes(q);
        const matchesDesc = m.description.toLowerCase().includes(q);
        const matchesSize = `${m.parameterCountBillion}b`.includes(q);
        if (!matchesName && !matchesFamily && !matchesDesc && !matchesSize) {
          return false;
        }
      }

      return true;
    });
  }, [models, modelReports, selectedFamily, selectedStatus, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="glass-panel rounded-2xl p-4 shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Box */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={isZh ? "搜索模型名称、尺寸（如 8B）、系列（Qwen, DeepSeek, Llama）..." : "Search by name, size (e.g. 8B), or family..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
          />
        </div>

        {/* Family Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
          {families.map((fam) => {
            const isSelected = selectedFamily === fam;
            return (
              <button
                key={fam}
                onClick={() => setSelectedFamily(fam)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer border ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {fam === 'ALL' ? (isZh ? '全部厂商' : 'All Families') : fam}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-slate-800/80 text-xs">
        <button
          onClick={() => setSelectedStatus('ALL')}
          className={`px-3.5 py-1.5 rounded-xl font-medium transition cursor-pointer flex items-center space-x-1.5 ${
            selectedStatus === 'ALL'
              ? 'bg-slate-800 text-white shadow-inner border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>{isZh ? '全部' : 'All'}</span>
          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-slate-900 text-slate-400">
            {counts.all}
          </span>
        </button>

        <button
          onClick={() => setSelectedStatus('recommended')}
          className={`px-3.5 py-1.5 rounded-xl font-medium transition cursor-pointer flex items-center space-x-1.5 ${
            selectedStatus === 'recommended'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
              : 'text-emerald-400/80 hover:text-emerald-300'
          }`}
        >
          <span>🟢 {isZh ? '推荐运行' : 'Recommended'}</span>
          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-950/80 text-emerald-400">
            {counts.recommended}
          </span>
        </button>

        <button
          onClick={() => setSelectedStatus('runnable')}
          className={`px-3.5 py-1.5 rounded-xl font-medium transition cursor-pointer flex items-center space-x-1.5 ${
            selectedStatus === 'runnable'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-amber-400/80 hover:text-amber-300'
          }`}
        >
          <span>🟡 {isZh ? '可运行' : 'Runnable'}</span>
          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-amber-950/80 text-amber-400">
            {counts.runnable}
          </span>
        </button>

        <button
          onClick={() => setSelectedStatus('not-recommended')}
          className={`px-3.5 py-1.5 rounded-xl font-medium transition cursor-pointer flex items-center space-x-1.5 ${
            selectedStatus === 'not-recommended'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
              : 'text-rose-400/80 hover:text-rose-300'
          }`}
        >
          <span>🔴 {isZh ? '不推荐' : 'Not Recommended'}</span>
          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-rose-950/80 text-rose-400">
            {counts.notRecommended}
          </span>
        </button>

        <button
          onClick={() => setSelectedStatus('incompatible')}
          className={`px-3.5 py-1.5 rounded-xl font-medium transition cursor-pointer flex items-center space-x-1.5 ${
            selectedStatus === 'incompatible'
              ? 'bg-slate-700/50 text-slate-300 border border-slate-600'
              : 'text-slate-500 hover:text-slate-400'
          }`}
        >
          <span>⚫ {isZh ? '不兼容' : 'Incompatible'}</span>
          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-slate-900 text-slate-500">
            {counts.incompatible}
          </span>
        </button>
      </div>

      {/* Grid of Models */}
      {filteredModels.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModels.map((model) => {
            const currentQuant = modelQuantMap[model.id] || model.defaultQuantization;
            const report = modelReports.get(model.id)!;
            const isInstalled = Boolean(model.ollamaName && installedOllamaModels.has(model.ollamaName));

            return (
              <ModelCard
                key={model.id}
                model={model}
                report={report}
                selectedQuant={currentQuant}
                onSelectQuant={(q) => {
                  setModelQuantMap((prev) => ({ ...prev, [model.id]: q }));
                }}
                isInstalledInOllama={isInstalled}
                onRunBenchmark={onRunBenchmark}
                isBenchmarking={benchmarkingModel === model.ollamaName}
                lang={lang}
              />
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center glass-panel rounded-2xl border border-slate-800">
          <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-base font-semibold text-slate-300">
            {isZh ? '未找到符合条件的模型' : 'No matching models found'}
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            {isZh ? '请尝试调整搜索关键词或重置筛选条件' : 'Try searching with different terms or reset filters'}
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedFamily('ALL');
              setSelectedStatus('ALL');
            }}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
          >
            {isZh ? '清空全部筛选' : 'Clear Filters'}
          </button>
        </div>
      )}
    </div>
  );
};
