import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SessionSummary } from '../types';
import { Search } from 'lucide-react';
import { parseDateTime } from '../utils/dateUtils';

interface Props {
  sessions: SessionSummary[];
  duplicateLots?: Set<string>;
}

export const calcTotalTimeValue = (startStr: string, endStr: string) => {
    if (!startStr || !endStr || startStr === '-' || endStr === '-') return -1;
    const t1 = parseDateTime(startStr);
    const t2 = parseDateTime(endStr);
    if (t1 !== -1 && t2 !== -1) {
        const diffMs = t2 - t1;
        return Math.max(0, Math.round(diffMs / 60000));
    }
    return -1;
};

export const calcTotalTimeStr = (startStr: string, endStr: string) => {
    const val = calcTotalTimeValue(startStr, endStr);
    return val >= 0 ? val + ' min' : '-';
};

export function SessionTable({ sessions, duplicateLots }: Props) {
  const [sortConfig, setSortConfig] = useState<{key: keyof SessionSummary | 'date' | 'sumNg', dir: 'asc' | 'desc'} | null>({ key: 'date', dir: 'desc' });
  const [searchLot, setSearchLot] = useState('');
  
  const trRefs = useRef<{ [key: string]: HTMLTableRowElement | null }>({});

  const sortedSessions = useMemo(() => {
     let sortableData = [...sessions];
     if (sortConfig !== null) {
       sortableData.sort((a, b) => {
         let aVal: any;
         let bVal: any;
         
         if (sortConfig.key === 'date') {
             aVal = parseDateTime(a.startTime);
             bVal = parseDateTime(b.startTime);
         } else if (sortConfig.key === 'sumNg') {
             aVal = a.ng1Qty + a.ng2Qty + a.ng3Qty;
             bVal = b.ng1Qty + b.ng2Qty + b.ng3Qty;
         } else {
             aVal = a[sortConfig.key as keyof SessionSummary];
             bVal = b[sortConfig.key as keyof SessionSummary];
         }
         
         // Clean percentage strings for numerical comparison
         if (typeof aVal === 'string' && aVal.endsWith('%')) {
             aVal = parseFloat(aVal.replace('%', ''));
             bVal = parseFloat(bVal.replace('%', ''));
         }
         
         if (aVal < bVal) return sortConfig.dir === 'asc' ? -1 : 1;
         if (aVal > bVal) return sortConfig.dir === 'asc' ? 1 : -1;
         return 0;
       });
     }
     return sortableData;
  }, [sessions, sortConfig]);

  // Filter sessions in real-time based on the search input just like in Defect Matrix
  const filteredSessions = useMemo(() => {
     if (!searchLot) return sortedSessions;
     return sortedSessions.filter(s => s.lotNumber.toLowerCase().includes(searchLot.toLowerCase()));
  }, [sortedSessions, searchLot]);

  if (sessions.length === 0) return null;

  const handleSort = (key: keyof SessionSummary | 'date' | 'sumNg') => {
      let dir: 'asc' | 'desc' = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.dir === 'asc') dir = 'desc';
      setSortConfig({ key, dir });
  };

  const getSortIcon = (key: string) => {
      if (!sortConfig || sortConfig.key !== key) return ' ↕';
      return sortConfig.dir === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="mb-4 relative shrink-0">
        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" />
        <input 
          type="text"
          value={searchLot}
          onChange={(e) => setSearchLot(e.target.value)}
          placeholder="Filter by Lot Number..."
          className="w-full max-w-sm pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded outline-none focus:border-zinc-500 text-sm font-mono text-zinc-300"
        />
      </div>
      <div className="overflow-x-auto border border-zinc-800 rounded bg-zinc-950/50 flex-1 min-h-0 overflow-y-auto w-full custom-scrollbar custom-scrollbar-horizontal">
        <table className="w-full font-sans text-zinc-300 relative text-[10px] md:text-xs text-center border-collapse">
          <thead className="uppercase bg-[#183c6c] text-zinc-100 border-b border-zinc-700 sticky top-0 z-10 text-[9px] md:text-[11px] tracking-wider">
            <tr>
              <th className="p-1.5 md:p-2 text-left cursor-pointer hover:bg-[#1f4a85] min-w-[210px] w-[210px]" onClick={() => handleSort('lotNumber')}>Lot{getSortIcon('lotNumber')}</th>
              <th className="p-1.5 md:p-2 cursor-pointer hover:bg-[#1f4a85] min-w-[100px] max-w-[100px] w-[100px]" onClick={() => handleSort('date')}>Date{getSortIcon('date')}</th>
              <th className="p-1.5 md:p-2 text-left cursor-pointer hover:bg-[#1f4a85] min-w-[130px] max-w-[130px] w-[130px]" onClick={() => handleSort('model')}>Model{getSortIcon('model')}</th>
              <th className="p-1.5 md:p-2 text-left cursor-pointer hover:bg-[#1f4a85] min-w-[100px] max-w-[100px] w-[100px]" onClick={() => handleSort('barcodeNumber')}>Barcode{getSortIcon('barcodeNumber')}</th>
              <th className="p-1.5 md:p-2 cursor-pointer hover:bg-[#1f4a85] min-w-[100px] max-w-[100px] w-[100px]" onClick={() => handleSort('total')}>Total{getSortIcon('total')}</th>
              <th className="p-1.5 md:p-2 cursor-pointer hover:bg-[#1f4a85] min-w-[100px] max-w-[100px] w-[100px]" onClick={() => handleSort('okQty')}>OK{getSortIcon('okQty')}</th>
              <th className="p-1.5 md:p-2 cursor-pointer hover:bg-[#1f4a85] text-zinc-100 font-semibold min-w-[100px] max-w-[100px] w-[100px]" onClick={() => handleSort('sumNg')}>NG{getSortIcon('sumNg')}</th>
              <th className="p-1.5 md:p-2 cursor-pointer hover:bg-[#1f4a85] min-w-[100px] max-w-[100px] w-[100px]" onClick={() => handleSort('ng1Qty')}>NG1{getSortIcon('ng1Qty')}</th>
              <th className="p-1.5 md:p-2 cursor-pointer hover:bg-[#1f4a85] min-w-[100px] max-w-[100px] w-[100px]" onClick={() => handleSort('ng2Qty')}>NG2{getSortIcon('ng2Qty')}</th>
              <th className="p-1.5 md:p-2 cursor-pointer hover:bg-[#1f4a85] min-w-[100px] max-w-[100px] w-[100px]" onClick={() => handleSort('ng3Qty')}>NG3{getSortIcon('ng3Qty')}</th>
              <th className="p-1.5 md:p-2 cursor-pointer hover:bg-[#1f4a85] min-w-[100px] max-w-[100px] w-[100px]" onClick={() => handleSort('retestQty')}>Retest{getSortIcon('retestQty')}</th>
              <th className="p-1.5 md:p-2 cursor-pointer hover:bg-[#1f4a85] min-w-[100px] max-w-[100px] w-[100px]" onClick={() => handleSort('yieldRate')}>Yield{getSortIcon('yieldRate')}</th>
              <th className="p-1.5 md:p-2 cursor-pointer hover:bg-[#1f4a85] min-w-[100px] max-w-[100px] w-[100px]" onClick={() => handleSort('ngRate')}>NG %{getSortIcon('ngRate')}</th>
              <th className="p-1.5 md:p-2 cursor-pointer hover:bg-[#1f4a85] min-w-[100px] max-w-[100px] w-[100px]" onClick={() => handleSort('rstRate')}>RST %{getSortIcon('rstRate')}</th>
              <th className="p-1.5 md:p-2 cursor-pointer hover:bg-[#1f4a85] min-w-[100px] max-w-[100px] w-[100px]" onClick={() => handleSort('startTime')}>Time{getSortIcon('startTime')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredSessions.map((s, idx) => {
               const yieldNum = parseFloat(s.yieldRate);
               const isLowYield = yieldNum < 50;
               const isMidYield = yieldNum >= 50 && yieldNum < 86;
               
               let yieldColorClass = 'text-emerald-500';
               if (isLowYield) yieldColorClass = 'text-red-400';
               if (isMidYield) yieldColorClass = 'text-amber-400';

               const isDuplicateLot = duplicateLots?.has(s.lotNumber) || false;
               const isRepeated = s.lotNumber.includes('-'); // Rough repeated check
               const isHighlighted = searchLot && s.lotNumber.toLowerCase().includes(searchLot.toLowerCase());
               
               let displayDate = '-';
               if (s.startTime && s.startTime !== '-') {
                   const part = s.startTime.split(' ')[0];
                   const dParts = part.split(/[-/]/);
                   if (dParts.length === 3) {
                       displayDate = `${dParts[2].padStart(2, '0')}-${dParts[1].padStart(2, '0')}-${dParts[0].slice(-2)}`;
                   } else {
                       displayDate = part;
                   }
               }
               
               // Formatter for rates
               const formatRate = (r: string) => {
                  if (r === '-') return r;
                  // Remove '%' if it exists, parse to float
                  const cleanR = r.replace('%', '').trim();
                  const num = parseFloat(cleanR);
                  if (isNaN(num)) return r;
                  return num.toFixed(2) + '%';
               }

               return (
                <tr 
                  key={idx} 
                  ref={el => trRefs.current[s.lotNumber] = el}
                  className={`border-b border-zinc-850 hover:bg-zinc-800/40 text-[10px] md:text-[11px] ${
                    isHighlighted 
                      ? 'bg-indigo-950/30 ring-1 ring-inset ring-indigo-500/40' 
                      : isDuplicateLot 
                      ? 'bg-amber-955/20 border-l-2 border-l-amber-500/80 hover:bg-amber-950/25' 
                      : isLowYield 
                      ? 'bg-red-950/15' 
                      : isMidYield 
                      ? 'bg-amber-955/8' 
                      : ''
                  }`}
                >
                  <td className="p-1.5 md:p-2 text-left whitespace-nowrap min-w-[210px] w-[210px]" title={s.lotNumber}>
                     <div className="flex items-center gap-1.5 flex-nowrap">
                       {isDuplicateLot ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" title="Multi-Run Duplicate Lot (Reconciled)"></div>
                        ) : isRepeated && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" title="Repeated Lot Suffix"></div>}
                       <span className={`${
                          isDuplicateLot 
                            ? 'text-amber-400 font-bold font-mono' 
                            : isRepeated 
                            ? 'text-indigo-300 font-bold' 
                            : 'text-zinc-100 font-semibold'
                        }`}>{s.lotNumber}</span>
                        {s.multiPassLabel && (
                          <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-indigo-950/90 text-indigo-200 border border-indigo-500/70 shrink-0 shadow-sm whitespace-nowrap">
                            {s.multiPassLabel}
                          </span>
                        )}
                     </div>
                  </td>
                  <td className="p-1.5 md:p-2 text-zinc-350 whitespace-nowrap font-mono min-w-[100px] max-w-[100px] w-[100px]" title={displayDate}>{displayDate}</td>
                  <td className="p-1.5 md:p-2 text-left text-zinc-450 font-medium whitespace-nowrap font-mono min-w-[130px] max-w-[130px] w-[130px]" title={s.model}>{s.model}</td>
                  <td className="p-1.5 md:p-2 text-left text-zinc-450 font-medium whitespace-nowrap font-mono min-w-[100px] max-w-[100px] w-[100px]" title={s.barcodeNumber}>{s.barcodeNumber}</td>
                  <td className="p-1.5 md:p-2 whitespace-nowrap font-mono min-w-[100px] max-w-[100px] w-[100px]" title={s.total.toLocaleString()}>{s.total}</td>
                  <td className="p-1.5 md:p-2 text-emerald-400 font-semibold whitespace-nowrap font-mono min-w-[100px] max-w-[100px] w-[100px]" title={s.okQty.toLocaleString()}>{s.okQty}</td>
                  <td className="p-1.5 md:p-2 text-red-400 font-semibold whitespace-nowrap font-mono text-[10px] md:text-xs min-w-[100px] max-w-[100px] w-[100px]" title={(s.ng1Qty + s.ng2Qty + s.ng3Qty).toLocaleString()}>{s.ng1Qty + s.ng2Qty + s.ng3Qty}</td>
                  <td className="p-1.5 md:p-2 text-zinc-350 whitespace-nowrap font-mono min-w-[100px] max-w-[100px] w-[100px]">{s.ng1Qty}</td>
                  <td className="p-1.5 md:p-2 text-zinc-350 whitespace-nowrap font-mono min-w-[100px] max-w-[100px] w-[100px]">{s.ng2Qty}</td>
                  <td className="p-1.5 md:p-2 text-zinc-350 whitespace-nowrap font-mono min-w-[100px] max-w-[100px] w-[100px]">{s.ng3Qty}</td>
                  <td className="p-1.5 md:p-2 text-indigo-350 font-mono min-w-[100px] max-w-[100px] w-[100px]">{s.retestQty}</td>
                  <td className={`p-1.5 md:p-2 font-bold whitespace-nowrap font-mono min-w-[100px] max-w-[100px] w-[100px] ${yieldColorClass}`}>
                     {formatRate(s.yieldRate)}
                  </td>
                  <td className="p-1.5 md:p-2 text-zinc-400 whitespace-nowrap font-mono min-w-[100px] max-w-[100px] w-[100px]">{formatRate(s.ngRate)}</td>
                  <td className="p-1.5 md:p-2 text-zinc-400 whitespace-nowrap font-mono min-w-[100px] max-w-[100px] w-[100px]">{formatRate(s.rstRate)}</td>
                  <td className="p-1.5 md:p-2 text-zinc-400 font-semibold whitespace-nowrap font-mono min-w-[100px] max-w-[100px] w-[100px]">{s.startTime.split(' ')[1] || s.startTime}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
