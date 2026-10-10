import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Layers, ListFilter, Globe } from 'lucide-react';
import { DefectRecord, SessionSummary } from '../types';
import { getDefectName, getBaseCategory } from '../utils/parser';
import { getUnifiedCamera } from '../utils/rejectNormalization';

interface Props {
  defects: DefectRecord[];
  rawDefects?: DefectRecord[];
  universalDefects?: DefectRecord[];
  sessions: SessionSummary[];
  highlightedLot?: string;
  onClearHighlight?: () => void;
}

const CAMERA_ORDER_UNIVERSAL = [
  'GLOBAL / WHOLE-BODY',
  'CAMERA - TOP',
  'CAMERA - BOTTOM',
  'CAMERA - SIDES (LEFT / RIGHT)',
  'CAMERA - ENDS (FRONT / BACK)'
];

const CAMERA_ORDER_CATEGORY = [
  'CAMERA - TOP', 'CAMERA - BOTTOM', 'CAMERA - LEFT', 'CAMERA - RIGHT',
  'CAMERA - FRONT', 'CAMERA - BACK'
];

const CAMERA_ORDER_PARAM = [
  'CAMERA - TOP', 'CAMERA - BOTTOM', 'CAMERA - LEFT', 'CAMERA - RIGHT',
  'CAMERA - FRONT', 'CAMERA - BACK', 'CAMERA - TOP 2', 'CAMERA - BOTTOM 2'
];

function formatRow3(filename: string, lot: string): string {
  if (!filename) return '-';
  let clean = filename.replace(/\.csv$/i, '').trim();
  
  const lotClean = lot.trim();
  if (lotClean && clean.toLowerCase().startsWith(lotClean.toLowerCase())) {
     clean = clean.substring(lotClean.length).replace(/^[_-]+/, '').trim();
  }

  const wslMatch = clean.match(/^wsl-[a-z0-9-]+[_-]+/i);
  if (wslMatch) {
     clean = clean.substring(wslMatch[0].length).trim();
  } else if (clean.toLowerCase().startsWith('wsl-')) {
     const nextUnderscore = clean.indexOf('_');
     if (nextUnderscore !== -1) {
         clean = clean.substring(nextUnderscore + 1).trim();
     }
  }

  let token = clean.split(/\s+/).filter(Boolean)[0];
  if (!token) return '-';
  
  token = token.split('-')[0];
  return token || '-';
}

export function DefectMatrix({ defects, rawDefects, universalDefects, sessions, highlightedLot, onClearHighlight }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchDefect, setSearchDefect] = useState('');
  const [searchLotData, setSearchLotData] = useState('');
  const [page, setPage] = useState(0);
  const [isParetoMode, setIsParetoMode] = useState(false);
  // Default to Universal View as requested
  const [viewMode, setViewMode] = useState<'UNIVERSAL' | 'CATEGORY' | 'PARAMETER'>('UNIVERSAL');
  const [pageSize, setPageSize] = useState(15);
  
  useEffect(() => {
     setPage(0);
  }, [sessions, searchDefect, searchLotData, highlightedLot, isParetoMode, viewMode]);

  useEffect(() => {
    if (containerRef.current) {
        const targetId = highlightedLot || (searchLotData ? sessions.find(s => s.lotNumber.toLowerCase().includes(searchLotData.toLowerCase()))?.lotNumber : '');
        if (targetId) {
            const targetLotIds = Array.from(new Set(sessions.map(s => s.lotNumber)));
            let filteredIds = targetLotIds;
            if (highlightedLot) {
                filteredIds = targetLotIds.filter(id => id === highlightedLot);
            } else if (searchLotData) {
                filteredIds = targetLotIds.filter(id => id.toLowerCase().includes(searchLotData.toLowerCase()));
            }
            const lotIndex = filteredIds.indexOf(targetId);
            if (lotIndex !== -1) {
                const targetPage = Math.floor(lotIndex / pageSize);
                if (targetPage !== page) setPage(targetPage);
            }

            setTimeout(() => {
                if (!containerRef.current) return;
                const targetEl = document.getElementById(`lot-col-${targetId}`);
                if (targetEl) {
                    const targetLeft = targetEl.offsetLeft;
                    const targetScrollLeft = targetLeft - 430;
                    containerRef.current.scrollTo({
                        left: Math.max(0, targetScrollLeft),
                        behavior: 'smooth'
                    });
                }
            }, 100);
        } else {
            containerRef.current.scrollTo({ left: 0, behavior: 'instant' });
        }
    }
  }, [highlightedLot, searchLotData, sessions, page, pageSize]);

  // Fast mapping of sessions to target IDs for instant lookups
  const sessionMap = useMemo(() => {
     const m = new Map<string, SessionSummary>();
     sessions.forEach(s => {
         if (s.lotNumber) m.set(s.lotNumber, s);
     });
     return m;
  }, [sessions]);

  // Overall filtered lotIds
  const lotIds = useMemo(() => {
    let targetLotIds = Array.from(new Set(sessions.map(s => s.lotNumber)));
    if (highlightedLot) {
        targetLotIds = targetLotIds.filter(id => id === highlightedLot);
    } else if (searchLotData) {
        targetLotIds = targetLotIds.filter(id => id.toLowerCase().includes(searchLotData.toLowerCase()));
    }
    return targetLotIds;
  }, [sessions, highlightedLot, searchLotData]);

  const totalPages = Math.ceil(lotIds.length / pageSize);
  const visibleLotIds = useMemo(() => {
    return lotIds.slice(page * pageSize, (page + 1) * pageSize);
  }, [lotIds, page, pageSize]);

  const activeSourceDefects = useMemo(() => {
    if (viewMode === 'UNIVERSAL') return universalDefects || defects;
    if (viewMode === 'CATEGORY') return defects;
    return rawDefects || defects;
  }, [viewMode, universalDefects, defects, rawDefects]);

  const matrixData = useMemo(() => {
    if (lotIds.length === 0) return [];

    const lotSet = new Set(lotIds);
    const visibleLotSet = new Set(visibleLotIds);

    const parameterTotalMap: Record<string, number> = {};
    const parameterVisibleMap: Record<string, Record<string, number>> = {};
    const cameraMap: Record<string, Record<string, { no: number, name: string, bin: string }>> = {};

    // Sort chronologically so the latest files process last
    const timeSortedDefects = [...activeSourceDefects].sort((a, b) => {
        const parseDate = (d?: string) => {
            if (!d || d === '-') return 0;
            if (d.includes('/')) {
                const parts = d.split(/[\s/:]+/);
                if (parts.length >= 3) {
                    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T${parts[3] || '00'}:${parts[4] || '00'}`).getTime();
                }
            }
            return new Date(d).getTime();
        };
        return parseDate(a.sessionStartTime) - parseDate(b.sessionStartTime);
    });

    timeSortedDefects.forEach(d => {
       if (!lotSet.has(d.lotNumber)) return;

       let cam: string;
       let normItem: string;
       let qtyVal: number;

       if (viewMode === 'UNIVERSAL') {
          cam = (d.camera || 'GLOBAL / WHOLE-BODY').trim().toUpperCase();
          normItem = d.baseCategory || d.testItem;
          // For the universal filter: don't show "Coating Brightness" and "Angle"
          const itemLower = normItem.toLowerCase();
          if (itemLower.includes('angle') || itemLower.includes('coating brightness')) {
             return;
          }
          qtyVal = d.normalizedNgQty ?? d.ngQty;
       } else if (viewMode === 'CATEGORY') {
          cam = getUnifiedCamera(d.camera);
          normItem = d.baseCategory || getBaseCategory(d.testItem, d.camera);
          qtyVal = d.normalizedNgQty ?? d.ngQty;
       } else {
          cam = (d.camera || 'CAMERA - TOP').trim().toUpperCase();
          normItem = getDefectName(d.camera, d.no, d.testItem);
          qtyVal = d.rawNgQty ?? d.ngQty;
       }

       const key = `${cam}::${normItem}`;

       if (!cameraMap[cam]) {
           cameraMap[cam] = {};
       }
       if (!cameraMap[cam][normItem]) {
           cameraMap[cam][normItem] = { no: d.no, name: normItem, bin: d.ngBox || '-' };
       } else {
           if (d.ngBox && d.ngBox !== '-') {
               cameraMap[cam][normItem].bin = d.ngBox;
           }
           cameraMap[cam][normItem].no = Math.min(cameraMap[cam][normItem].no, d.no);
       }

       parameterTotalMap[key] = (parameterTotalMap[key] || 0) + qtyVal;

       if (visibleLotSet.has(d.lotNumber)) {
           if (!parameterVisibleMap[key]) {
               parameterVisibleMap[key] = {};
           }
           parameterVisibleMap[key][d.lotNumber] = (parameterVisibleMap[key][d.lotNumber] || 0) + qtyVal;
       }
    });

    const mData: { camera: string, params: { no: number, name: string, bin: string, total: number, lots: Record<string, number> }[] }[] = [];

    let orderList = CAMERA_ORDER_UNIVERSAL;
    if (viewMode === 'CATEGORY') orderList = CAMERA_ORDER_CATEGORY;
    else if (viewMode === 'PARAMETER') orderList = CAMERA_ORDER_PARAM;

    const sortedCameras = Object.keys(cameraMap).sort((a, b) => {
       const aIdx = orderList.indexOf(a);
       const bIdx = orderList.indexOf(b);
       const aPos = aIdx === -1 ? 999 : aIdx;
       const bPos = bIdx === -1 ? 999 : bIdx;
       return aPos - bPos;
    });

    sortedCameras.forEach(camera => {
        const paramsList = Object.values(cameraMap[camera]);
        const filteredParams = paramsList.filter(param => {
            if (!searchDefect) return true;
            return param.name.toLowerCase().includes(searchDefect.toLowerCase()) || 
                   param.no.toString() === searchDefect;
        });

        if (filteredParams.length > 0) {
            const sortedMappedParams = filteredParams.map(param => {
                const key = `${camera.trim().toUpperCase()}::${param.name}`;
                const total = parameterTotalMap[key] || 0;
                const visibleLots = parameterVisibleMap[key] || {};

                return {
                    no: param.no,
                    name: param.name,
                    bin: param.bin || '-',
                    total,
                    lots: visibleLots
                };
            });

            if (isParetoMode) {
                sortedMappedParams.sort((a, b) => b.total - a.total);
            } else {
                sortedMappedParams.sort((a, b) => a.no - b.no);
            }

            let limit = sortedMappedParams.length;
            if (isParetoMode) {
               if (camera === 'GLOBAL / WHOLE-BODY') limit = 6;
               else if (camera === 'CAMERA - TOP' || camera.includes('TOP')) limit = 8;
               else if (camera === 'CAMERA - BOTTOM' || camera.includes('BOTTOM')) limit = 8;
               else limit = 4;
            }

            mData.push({
                camera,
                params: sortedMappedParams.slice(0, limit)
            });
        }
    });

    return mData;
  }, [activeSourceDefects, lotIds, visibleLotIds, searchDefect, isParetoMode, viewMode]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="mb-4 shrink-0 flex flex-wrap items-center gap-3 md:gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" />
          <input 
            type="text"
            value={searchDefect}
            onChange={(e) => setSearchDefect(e.target.value)}
            placeholder={viewMode === 'PARAMETER' ? "Filter parameters by name..." : "Filter categories by name..."}
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded outline-none focus:border-zinc-500 text-sm font-mono text-zinc-300"
          />
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" />
          <input 
            type="text"
            value={searchLotData}
            onChange={(e) => setSearchLotData(e.target.value)}
            placeholder="Search by Lot Number..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded outline-none focus:border-zinc-500 text-sm font-mono text-zinc-300"
            disabled={!!highlightedLot}
            title={highlightedLot ? "Clear selection to search manually" : ""}
          />
        </div>
        
        <button
          onClick={() => setIsParetoMode(!isParetoMode)}
          className={`px-3.5 py-2 border rounded font-semibold text-xs md:text-sm transition-colors whitespace-nowrap ${isParetoMode ? 'bg-[#183c6c] border-[#29548f] text-white shadow-inner' : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`}
        >
          {isParetoMode ? "Pareto Sort : ON" : "Pareto Sort : OFF"}
        </button>

        {/* 3-Way View Mode Selector */}
        <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-950 p-0.5 text-xs font-semibold shrink-0 shadow-sm">
          <button
            onClick={() => setViewMode('UNIVERSAL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${viewMode === 'UNIVERSAL' ? 'bg-[#183c6c] text-white shadow font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
            title="Universal View: Merges whole-body features (Length, Width, Angle, Burs, Open Laser Cut) and symmetrical camera pairs (Left+Right, Front+Back)"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>Universal View</span>
          </button>
          <button
            onClick={() => setViewMode('CATEGORY')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${viewMode === 'CATEGORY' ? 'bg-[#183c6c] text-white shadow font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
            title="Combined by Station: Combines sub-parameters (Area, X, Y) and redundancy channels per inspection camera"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Combined (Station)</span>
          </button>
          <button
            onClick={() => setViewMode('PARAMETER')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${viewMode === 'PARAMETER' ? 'bg-[#183c6c] text-white shadow font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
            title="Raw Parameters: Shows all individual CSV trigger lines completely uncombined (POLC Area, X, Y separated)"
          >
            <ListFilter className="w-3.5 h-3.5 text-amber-400" />
            <span>Raw Parameters</span>
          </button>
        </div>

        {highlightedLot && (
          <button 
            type="button"
            onClick={onClearHighlight}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/40 border border-red-900/40 hover:bg-red-900/30 text-rose-300 rounded text-xs transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear Filter: Lot {highlightedLot}
          </button>
        )}
        
        {lotIds.length > 0 && (
          <div className="flex items-center gap-2 ml-auto shadow-sm border border-zinc-800 rounded bg-zinc-900/80 p-1">
             <span className="text-zinc-400 text-xs pl-2">Lots per page:</span>
             <select 
                value={pageSize} 
                onChange={(e) => {
                   setPageSize(Number(e.target.value));
                   setPage(0);
                }}
                className="bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700 hover:border-zinc-500 focus:border-zinc-650 focus:bg-zinc-950 focus:text-zinc-100 focus:outline-none text-xs rounded px-2 py-0.5 cursor-pointer transition-colors font-sans font-medium"
             >
                <option value={10} className="bg-zinc-900 border-none text-zinc-100">10</option>
                <option value={15} className="bg-zinc-900 border-none text-zinc-100">15</option>
                <option value={20} className="bg-zinc-900 border-none text-zinc-100">20</option>
                <option value={30} className="bg-zinc-900 border-none text-zinc-100">30</option>
                <option value={50} className="bg-zinc-900 border-none text-zinc-100">50</option>
             </select>
             
             {totalPages > 1 && (
               <>
                 <div className="w-[1px] h-4 bg-zinc-800 mx-1" />
                 <button 
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-2.5 py-1 text-xs bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white rounded disabled:opacity-30 disabled:hover:bg-zinc-800/80 disabled:cursor-not-allowed transition-colors"
                 >
                   Prev
                 </button>
                 <span className="text-zinc-300 text-xs font-semibold px-1 whitespace-nowrap">
                   Page {page + 1} / {totalPages}
                 </span>
                 <button 
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page === totalPages - 1}
                    className="px-2.5 py-1 text-xs bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white rounded disabled:opacity-30 disabled:hover:bg-zinc-800/80 disabled:cursor-not-allowed transition-colors"
                 >
                   Next
                 </button>
               </>
             )}
             <div className="w-[1px] h-4 bg-zinc-800 mx-1" />
             <span className="text-emerald-500/80 text-xs font-mono tracking-widest px-2">{lotIds.length} LOTS TOTAL</span>
          </div>
        )}
      </div>

      {lotIds.length === 0 ? (
        <div className="text-center p-12 text-zinc-500 border border-zinc-800 rounded bg-zinc-900/50 uppercase tracking-widest text-xs font-mono">
          No matching lots found. Please adjust your criteria.
        </div>
      ) : (
        <div ref={containerRef} className="overflow-x-auto border border-zinc-800 rounded bg-zinc-950/50 flex-1 min-h-0 overflow-y-auto w-full scroll-smooth custom-scrollbar custom-scrollbar-horizontal">
          <table className="w-full text-[10.5px] md:text-xs font-sans text-zinc-300 relative border-collapse text-center" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead className="bg-[#183c6c] text-zinc-100 sticky top-0 z-20 box-border text-[10px] md:text-[11px]">
              <tr>
                <th className="px-3 py-2 font-semibold text-left sticky left-0 z-30 bg-[#183c6c] border-b border-r border-[#2d588d] min-w-[220px] max-w-[220px] w-[220px] text-[10px] md:text-[11px] uppercase tracking-wider">
                  {viewMode === 'UNIVERSAL' ? 'UNIVERSAL DEFECT CATEGORY' : (viewMode === 'CATEGORY' ? 'STATION DEFECT CATEGORY' : 'DETAILED DEFECT PARAMETERS')}
                </th>
                <th className="px-1.5 py-2 font-semibold whitespace-nowrap sticky left-[220px] z-30 bg-[#183c6c] border-b border-r border-[#2d588d] min-w-[50px] max-w-[50px] w-[50px] text-[10px] md:text-[11px]" title="Bin: NG1, NG2, NG3, RST">
                  Bin
                </th>
                <th className="px-1.5 py-2 text-center font-semibold border-r border-b border-[#2d588d] whitespace-normal break-words sticky left-[270px] z-30 bg-[#183c6c] min-w-[80px] max-w-[80px] w-[80px] leading-tight text-[10px] md:text-[11px]">
                  Total<br/>Failure
                </th>
                {visibleLotIds.map(id => {
                    const sessObj = sessionMap.get(id);
                    const rawFilename = sessObj?.filename || '';
                    const formattedRow3 = formatRow3(rawFilename, id);
                    const modelName = sessObj?.model || '';
                    return (
                      <th id={`lot-col-${id}`} key={id} className={`px-3 py-2 text-center whitespace-nowrap border-b border-r border-[#2d588d] ${highlightedLot === id ? 'bg-[#29548f]' : 'bg-[#183c6c]'} min-w-[120px] max-w-[150px] leading-snug`}>
                          <div className="font-bold text-zinc-100 truncate text-[10.5px] md:text-xs" title={`Lot: ${id}`}>{id}</div>
                          <div className="text-zinc-200 uppercase font-semibold tracking-wide truncate mt-0.5 text-[9px] md:text-[10px]" title={`Model: ${modelName}`}>{modelName}</div>
                          {sessObj?.multiPassLabel && (
                             <div className="mt-0.5">
                               <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-indigo-950/90 text-indigo-200 border border-indigo-500/60 inline-block shadow-sm">
                                 {sessObj.multiPassLabel}
                               </span>
                             </div>
                          )}
                          <div className="text-zinc-200 mt-1 font-bold whitespace-normal break-words leading-tight text-[9px] md:text-[10px]" title={formattedRow3}>{formattedRow3}</div>
                      </th>
                    );
                })}
              </tr>
            </thead>
            <tbody>
               {matrixData.map((camGroup, camIdx) => (
                <React.Fragment key={camIdx}>
                  <tr className="bg-[#1e2a3b] hover:bg-[#1e2a3b]">
                    <td className="px-3 py-1 text-[10px] md:text-[11px] font-bold text-slate-300 uppercase sticky left-0 z-10 bg-[#1e2a3b] border-y border-r border-[#2d588d] min-w-[220px] max-w-[220px] w-[220px] truncate">
                      {camGroup.camera}
                    </td>
                    <td className="sticky left-[220px] z-10 bg-[#1e2a3b] border-y border-r border-[#2d588d] min-w-[50px] max-w-[50px] w-[50px]"></td>
                    <td className="sticky left-[270px] z-10 bg-[#1e2a3b] border-y border-r border-[#2d588d] min-w-[80px] max-w-[80px] w-[80px]"></td>
                    <td colSpan={visibleLotIds.length} className="bg-[#1e2a3b] border-y border-[#2d588d]"></td>
                  </tr>
                  {camGroup.params.map((param, pIdx) => (
                    <tr key={pIdx} className="hover:bg-zinc-800/50 text-[10.5px] md:text-xs">
                      <td className="px-3 py-1.5 whitespace-nowrap text-left text-zinc-250 sticky left-0 z-10 bg-[#0a0a0c] border-b border-r border-zinc-850 min-w-[220px] max-w-[220px] w-[220px] truncate" title={param.name}>
                        {param.name}
                      </td>
                      <td className="px-1.5 py-1.5 whitespace-nowrap text-center sticky left-[220px] z-10 bg-[#0c0c0e] border-b border-r border-zinc-850 min-w-[50px] max-w-[50px] w-[50px] truncate font-mono text-[11px]" title={`Bin: ${param.bin}`}>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          param.bin.includes('NG1') ? 'bg-sky-950/70 text-sky-400 border border-sky-800/50' :
                          param.bin.includes('NG2') ? 'bg-amber-950/70 text-amber-400 border border-amber-800/50' :
                          param.bin.includes('NG3') ? 'bg-rose-950/70 text-rose-400 border border-rose-800/50' :
                          param.bin.includes('RST') ? 'bg-purple-950/70 text-purple-400 border border-purple-800/50' :
                          'text-zinc-500'
                        }`}>
                          {param.bin}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-center font-semibold text-zinc-150 sticky left-[270px] z-10 bg-[#0d0d10] border-b border-r border-zinc-850 min-w-[80px] max-w-[80px] w-[80px] font-mono">
                         {param.total > 0 ? param.total.toLocaleString() : '-'}
                      </td>
                      {visibleLotIds.map(id => (
                        <td key={id} className={`px-3 py-1.5 text-center border-b border-r border-zinc-850 font-mono ${highlightedLot === id ? 'bg-indigo-950/30' : ''} ${(param.lots[id] || 0) > 0 ? 'text-rose-450 font-bold' : 'text-zinc-650'}`}>
                          {(param.lots[id] || 0) > 0 ? (param.lots[id] || 0).toLocaleString() : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
               ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
