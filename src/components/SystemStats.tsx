import React from 'react';
import { SessionSummary } from '../types';
import { parseDateTime } from '../utils/dateUtils';

interface StatsProps {
  totalProcessed: number;
  totalOk: number;
  totalNg: number;
  overallYield: string;
  sessions?: SessionSummary[];
  selectedModels?: string[];
  onModelSelect?: (model: string) => void;
  selectedMonths?: string[];
  onMonthSelect?: (month: string) => void;
  baseSessions?: SessionSummary[];
  isFiltered?: boolean;
}

export function SystemStats({ 
  totalProcessed, 
  totalOk, 
  totalNg, 
  overallYield, 
  sessions = [], 
  selectedModels = [], 
  onModelSelect,
  selectedMonths = [],
  onMonthSelect,
  baseSessions = [],
  isFiltered = false
}: StatsProps) {
  const yieldNum = parseFloat(overallYield);
  let yieldColor = 'text-red-400';
  if (yieldNum >= 86) yieldColor = 'text-emerald-400';
  else if (yieldNum >= 50) yieldColor = 'text-amber-400';

  const models = Array.from(new Set(sessions.map(s => s.model))).filter(Boolean).sort();
  
  const modelStats = models.map(m => {
      const ms = sessions.filter(s => s.model === m);
      const total = ms.reduce((acc, s) => acc + s.total, 0);
      const ok = ms.reduce((acc, s) => acc + s.okQty, 0);
      const ng = ms.reduce((acc, s) => acc + (s.total - s.okQty), 0);
      const yld = total > 0 ? ((ok / total) * 100).toFixed(2) + '%' : '0.00%';
      return { model: m, total, ok, ng, yld, lotsCount: ms.length };
  });

  const monthStatsMap = new Map<string, {total: number, ok: number, ng: number, lotsCount: number}>();
  baseSessions.forEach(s => {
      const t = parseDateTime(s.startTime);
      if (t === -1) return;
      const date = new Date(t);
      const mStr = date.toLocaleDateString('default', { month: '2-digit', year: '2-digit' });
      const displayStr = date.toLocaleDateString('default', { month: 'short', year: '2-digit' });
      if (!monthStatsMap.has(mStr)) monthStatsMap.set(mStr, {total: 0, ok: 0, ng: 0, lotsCount: 0});
      const st = monthStatsMap.get(mStr)!;
      st.total += s.total;
      st.ok += s.okQty;
      st.ng += (s.total - s.okQty);
      st.lotsCount += 1;
  });

  const monthStats = Array.from(monthStatsMap.entries()).map(([m, st]) => {
      const yldNum = st.total > 0 ? (st.ok / st.total) * 100 : 0;
      const yld = yldNum.toFixed(2) + '%';
      return { monthKey: m, displayStr: m, total: st.total, ok: st.ok, ng: st.ng, yld, yldNum, lotsCount: st.lotsCount };
  }).sort((a, b) => {
      const [mA, yA] = a.monthKey.split('/');
      const [mB, yB] = b.monthKey.split('/');
      return (parseInt(yB) * 100 + parseInt(mB)) - (parseInt(yA) * 100 + parseInt(mA));
  });

  const handleModelClick = (mName: string) => {
    if (onModelSelect) {
      onModelSelect(mName);
    }
  };

  const handleMonthClick = (mKey: string) => {
    if (onMonthSelect) {
      onMonthSelect(mKey);
    }
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 font-semibold">
      
      {/* CARD 1: Total Processed */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 sm:p-5 flex flex-col relative h-[210px] sm:h-[300px] md:h-[410px]">
        <div className="shrink-0 mb-2 sm:mb-4 animate-in fade-in">
          <span className="text-zinc-400 uppercase tracking-wider text-[10px] sm:text-xs md:text-sm mb-1 font-bold block leading-tight">Total Processed {isFiltered && <span className="text-amber-500/80 text-[8px] sm:text-[10px] ml-0.5 font-normal block sm:inline">(Filtered)</span>}</span>
          <span className="text-xl sm:text-2xl md:text-4xl font-extrabold bg-gradient-to-br from-zinc-100 to-zinc-400 bg-clip-text text-transparent">{totalProcessed.toLocaleString()}</span>
        </div>
        {modelStats.length > 0 && (
          <div className="pt-2 sm:pt-3 border-t border-zinc-800 flex flex-col gap-0.5 text-[10px] sm:text-xs md:text-sm text-zinc-450 flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {[...modelStats].sort((a,b) => b.total - a.total || b.lotsCount - a.lotsCount).map(m => {
                 const isSelected = selectedModels.includes(m.model);
                 return (
                  <div 
                    key={m.model} 
                    onClick={() => handleModelClick(m.model)} 
                    className={`flex justify-between items-center px-1.5 sm:px-2 py-0.5 rounded transition-colors cursor-pointer select-none active:bg-zinc-800/90 hover:bg-zinc-800/50 ${isSelected ? 'bg-zinc-800 border border-zinc-700/60 font-bold text-zinc-200' : 'border border-transparent'}`}
                    title={`Click to filter by ${m.model}`}
                  >
                     <span className={`flex-1 min-w-0 pr-1 sm:pr-2 font-bold truncate text-[9px] sm:text-xs ${isSelected ? 'text-zinc-100' : 'text-zinc-400'}`}>{m.model}</span>
                     <span className="flex items-center gap-1 shrink-0 font-bold text-[9px] sm:text-xs">
                        <span className="text-[8px] sm:text-[10px] text-zinc-500 font-bold">({m.lotsCount})</span>
                        <span className="font-mono text-zinc-150 font-semibold">{m.total.toLocaleString()}</span>
                     </span>
                  </div>
                 )
              })}
          </div>
        )}
      </div>

      {/* CARD 2: Total Good Parts */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 sm:p-5 flex flex-col relative h-[210px] sm:h-[300px] md:h-[410px]">
        <div className="shrink-0 mb-2 sm:mb-4 animate-in fade-in">
          <span className="text-zinc-400 uppercase tracking-wider text-[10px] sm:text-xs md:text-sm mb-1 font-bold block leading-tight">Total Good Parts {isFiltered && <span className="text-amber-500/80 text-[8px] sm:text-[10px] ml-0.5 font-normal block sm:inline">(Filtered)</span>}</span>
          <span className="text-xl sm:text-2xl md:text-4xl font-extrabold text-emerald-400">{totalOk.toLocaleString()}</span>
        </div>
        {modelStats.length > 0 && (
          <div className="pt-2 sm:pt-3 border-t border-zinc-800 flex flex-col gap-0.5 text-[10px] sm:text-xs md:text-sm text-zinc-450 flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {[...modelStats].sort((a,b) => b.ok - a.ok || b.lotsCount - a.lotsCount).map(m => {
                 const isSelected = selectedModels.includes(m.model);
                 return (
                  <div 
                    key={m.model} 
                    onClick={() => handleModelClick(m.model)} 
                    className={`flex justify-between items-center px-1.5 sm:px-2 py-0.5 rounded transition-colors cursor-pointer select-none active:bg-zinc-800/90 hover:bg-zinc-800/50 ${isSelected ? 'bg-zinc-800 border border-zinc-700/60 font-bold text-zinc-200' : 'border border-transparent'}`}
                    title={`Click to filter by ${m.model}`}
                  >
                     <span className={`flex-1 min-w-0 pr-1 sm:pr-2 font-bold truncate text-[9px] sm:text-xs ${isSelected ? 'text-zinc-100' : 'text-zinc-400'}`}>{m.model}</span>
                     <span className="flex items-center gap-1 shrink-0 font-bold text-[9px] sm:text-xs">
                        <span className="text-[8px] sm:text-[10px] text-zinc-500 font-bold">({m.lotsCount})</span>
                        <span className="font-mono text-emerald-405 font-semibold">{m.ok.toLocaleString()}</span>
                     </span>
                  </div>
                 )
              })}
          </div>
        )}
      </div>

      {/* CARD 3: Total NG Parts */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 sm:p-5 flex flex-col relative h-[210px] sm:h-[300px] md:h-[410px]">
        <div className="shrink-0 mb-2 sm:mb-4 animate-in fade-in">
          <span className="text-red-405 uppercase tracking-wider text-[10px] sm:text-xs md:text-sm mb-1 font-bold block leading-tight">Total NG Parts {isFiltered && <span className="text-amber-500/80 text-[8px] sm:text-[10px] ml-0.5 font-normal block sm:inline">(Filtered)</span>}</span>
          <span className="text-xl sm:text-2xl md:text-4xl font-extrabold text-red-500">{totalNg.toLocaleString()}</span>
        </div>
        {modelStats.length > 0 && (
          <div className="pt-2 sm:pt-3 border-t border-zinc-800 flex flex-col gap-0.5 text-[10px] sm:text-xs md:text-sm text-zinc-450 flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {[...modelStats].sort((a,b) => b.ng - a.ng || b.lotsCount - a.lotsCount).map(m => {
                 const isSelected = selectedModels.includes(m.model);
                 return (
                  <div 
                    key={m.model} 
                    onClick={() => handleModelClick(m.model)} 
                    className={`flex justify-between items-center px-1.5 sm:px-2 py-0.5 rounded transition-colors cursor-pointer select-none active:bg-zinc-800/90 hover:bg-zinc-800/50 ${isSelected ? 'bg-zinc-800 border border-zinc-700/60 font-bold text-zinc-200' : 'border border-transparent'}`}
                    title={`Click to filter by ${m.model}`}
                  >
                     <span className={`flex-1 min-w-0 pr-1 sm:pr-2 font-bold truncate text-[9px] sm:text-xs ${isSelected ? 'text-zinc-100' : 'text-zinc-400'}`}>{m.model}</span>
                     <span className="flex items-center gap-1 shrink-0 font-bold text-[9px] sm:text-xs">
                        <span className="text-[8px] sm:text-[10px] text-zinc-500 font-bold">({m.lotsCount})</span>
                        <span className="font-mono text-red-405 font-semibold">{m.ng.toLocaleString()}</span>
                     </span>
                  </div>
                 )
              })}
          </div>
        )}
      </div>

      {/* CARD 4: Total Yield */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 sm:p-5 flex flex-col relative h-[210px] sm:h-[300px] md:h-[410px]">
        <div className="shrink-0 mb-2 sm:mb-4 animate-in fade-in">
          <span className="text-zinc-400 uppercase tracking-wider text-[10px] sm:text-xs md:text-sm mb-1 font-bold block leading-tight">Total Yield {isFiltered && <span className="text-amber-500/80 text-[8px] sm:text-[10px] ml-0.5 font-normal block sm:inline">(Filtered)</span>}</span>
          <span className={`text-xl sm:text-2xl md:text-4xl font-extrabold ${yieldColor}`}>{overallYield}</span>
        </div>
        {monthStats.length > 0 && (
          <div className="pt-2 sm:pt-3 border-t border-zinc-800 flex flex-col gap-0.5 text-[10px] sm:text-xs md:text-sm text-zinc-400 font-bold flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {monthStats.map(m => {
                 const mYld = m.yldNum;
                 let mColor = 'text-red-400/90';
                 if (mYld >= 86) mColor = 'text-emerald-400/90';
                 else if (mYld >= 50) mColor = 'text-amber-400/90';

                 const isSelected = selectedMonths.includes(m.monthKey);
                 return (
                  <div 
                    key={m.monthKey} 
                    onClick={() => handleMonthClick(m.monthKey)} 
                    className={`flex justify-between items-center px-1.5 sm:px-2 py-0.5 rounded transition-colors cursor-pointer select-none active:bg-zinc-800/90 hover:bg-zinc-800/50 ${isSelected ? 'bg-zinc-800 border border-zinc-700/60 font-bold text-zinc-200' : 'border border-transparent'}`}
                    title={`Click to filter by ${m.displayStr}`}
                  >
                     <span className={`flex-1 min-w-0 pr-1 sm:pr-2 uppercase font-bold truncate text-[9px] sm:text-xs ${isSelected ? 'text-zinc-100' : 'text-zinc-400'}`}>{m.displayStr}</span>
                     <span className="flex items-center gap-1 shrink-0 font-bold text-[9px] sm:text-xs">
                        <span className="text-[8px] sm:text-[10px] text-zinc-500 font-bold">({m.lotsCount})</span>
                        <span className={`font-mono text-right font-semibold ${isSelected ? 'text-zinc-100 font-bold' : mColor}`}>{m.yld}</span>
                     </span>
                  </div>
                 )
              })}
          </div>
        )}
      </div>

    </div>
  );
}
