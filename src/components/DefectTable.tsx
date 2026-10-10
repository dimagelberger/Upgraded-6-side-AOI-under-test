import React, { useState, useMemo } from 'react';
import { DefectRecord } from '../types';
import { getBaseCategory, getDefectName } from '../utils/parser';
import { getUnifiedCamera } from '../utils/rejectNormalization';

interface Props {
  defects: DefectRecord[];
  totalProcessed: number;
}

export function DefectTable({ defects, totalProcessed }: Props) {
  const [sortConfig, setSortConfig] = useState<{key: keyof DefectRecord | 'calculatedNgRate' | 'defectContribution', dir: 'asc' | 'desc'} | null>(null);

  const sortedDefects = useMemo(() => {
    // Group duplicates by Unified Camera and Unified Defect Category (POLC is unified to 1 entry)
    const map = new Map<string, DefectRecord & { calculatedNgRate: number, defectContribution: number }>();
    
    // Sort chronologically so the latest files process last
    const parseDateOnce = (d?: string): number => {
        if (!d || d === '-') return 0;
        if (d.includes('/')) {
            const parts = d.split(/[\s/:]+/);
            if (parts.length >= 3) {
                const dt = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T${parts[3] || '00'}:${parts[4] || '00'}`).getTime();
                return isNaN(dt) ? 0 : dt;
            }
        }
        const dt = new Date(d).getTime();
        return isNaN(dt) ? 0 : dt;
    };

    const defectsWithTime = defects.map(d => ({
        defect: d,
        time: parseDateOnce(d.sessionStartTime)
    }));

    defectsWithTime.sort((a, b) => a.time - b.time);
    const timeSortedDefects = defectsWithTime.map(item => item.defect);

    timeSortedDefects.forEach(d => {
       const isCombined = d.baseCategory && d.baseCategory === d.testItem;
       const cam = (d.camera || 'CAMERA - TOP').trim().toUpperCase();
       const itemName = isCombined ? d.baseCategory : (d.testItem || getDefectName(d.camera, d.no, d.testItem));
       const key = `${cam}::${itemName}`;
       const dNgRate = totalProcessed > 0 ? (d.ngQty / totalProcessed) * 100 : 0;
       
       if (!map.has(key)) {
           map.set(key, { ...d, camera: cam, testItem: itemName, calculatedNgRate: dNgRate, defectContribution: 0 });
       } else {
           const existing = map.get(key)!;
           existing.ngQty += d.ngQty; // Aggregate quantity
           existing.testItem = itemName; // use normalized category name
           existing.calculatedNgRate = totalProcessed > 0 ? (existing.ngQty / totalProcessed) * 100 : 0;
       }
    });

    const filtered = Array.from(map.values()).filter(d => d.ngQty > 0);
    const totalDefectsQty = filtered.reduce((sum, d) => sum + d.ngQty, 0);
    
    filtered.forEach(d => {
        d.defectContribution = totalDefectsQty > 0 ? (d.ngQty / totalDefectsQty) * 100 : 0;
    });
    
    if (sortConfig !== null) {
      return filtered.sort((a, b) => {
        let aVal: any = a[sortConfig.key as keyof (DefectRecord & { calculatedNgRate: number, defectContribution: number })];
        let bVal: any = b[sortConfig.key as keyof (DefectRecord & { calculatedNgRate: number, defectContribution: number })];

        if (typeof aVal === 'string' && aVal.endsWith('%')) {
            aVal = parseFloat(aVal.replace('%', ''));
            bVal = typeof bVal === 'string' ? parseFloat(bVal.replace('%', '')) : bVal;
        }

        if (aVal < bVal) return sortConfig.dir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.dir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    // Default sort: global top defects by quantity descending
    return filtered.sort((a, b) => b.ngQty - a.ngQty);
  }, [defects, totalProcessed, sortConfig]);

  if (defects.length === 0) return (
    <div className="text-center p-8 text-zinc-500 border border-zinc-800 rounded bg-zinc-900/50 uppercase tracking-widest text-xs font-mono">
      NO DEFECTS IN VIRTUAL MEMORY
    </div>
  );

  if (sortedDefects.length === 0) return (
    <div className="text-center p-8 text-emerald-500 border border-[#10b981]/30 rounded bg-emerald-950/20 uppercase tracking-widest text-xs font-mono">
      ALL PROCESSED LOGS HAVE 0 DEFECTS DETECTED
    </div>
  );

  const handleSort = (key: keyof DefectRecord | 'calculatedNgRate' | 'defectContribution') => {
      let dir: 'asc' | 'desc' = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.dir === 'asc') dir = 'desc';
      setSortConfig({ key, dir });
  };

  const getSortIcon = (key: string) => {
      if (!sortConfig || sortConfig.key !== key) return ' ↕';
      return sortConfig.dir === 'asc' ? ' ↑' : ' ↓';
  };

  const renderBinBadge = (binStr?: string) => {
    const b = (binStr || '').toUpperCase().trim();
    if (b.includes('NG1')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-sky-950/70 border border-sky-800/50 text-sky-300 text-[11px] font-mono font-bold">
          NG1
        </span>
      );
    }
    if (b.includes('NG2')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-950/70 border border-amber-800/50 text-amber-300 text-[11px] font-mono font-bold">
          NG2
        </span>
      );
    }
    if (b.includes('NG3')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-950/70 border border-rose-800/50 text-rose-300 text-[11px] font-mono font-bold">
          NG3
        </span>
      );
    }
    if (b.includes('RST') || b.includes('RETEST')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-950/70 border border-purple-800/50 text-purple-300 text-[11px] font-mono font-bold">
          RST
        </span>
      );
    }
    return <span className="text-zinc-500 font-mono text-xs">{binStr || '-'}</span>;
  };

  return (
    <div className="overflow-x-auto h-full overflow-y-auto custom-scrollbar custom-scrollbar-horizontal">
      <table className="w-full text-center text-xs md:text-sm font-sans text-zinc-300 relative border-collapse">
        <thead className="text-[10px] md:text-xs uppercase bg-zinc-900 border-b border-zinc-800 text-zinc-400 sticky top-0 z-10 box-border tracking-wider">
          <tr>
            <th className="px-2 py-2.5 whitespace-nowrap text-left cursor-pointer hover:bg-zinc-800 w-[95px]" onClick={() => handleSort('camera')}>Camera{getSortIcon('camera')}</th>
            <th className="px-3 py-2.5 whitespace-nowrap text-left cursor-pointer hover:bg-zinc-805" onClick={() => handleSort('testItem')}>Defect Category{getSortIcon('testItem')}</th>
            <th className="px-3 py-2.5 whitespace-nowrap cursor-pointer hover:bg-[#183c6c] text-zinc-200" onClick={() => handleSort('ngQty')}>NG Qty{getSortIcon('ngQty')}</th>
            <th className="px-3 py-2.5 whitespace-nowrap cursor-pointer hover:bg-[#183c6c] text-[#fbbf24] leading-tight flex-col justify-center items-center" onClick={() => handleSort('defectContribution')}>
              <div>Defect Contribution</div>
              <div className="text-[9px] font-normal lowercase">(% of total defects)</div>{getSortIcon('defectContribution')}
            </th>
            <th className="px-3 py-2.5 whitespace-nowrap cursor-pointer hover:bg-[#183c6c] text-zinc-200 leading-tight" onClick={() => handleSort('calculatedNgRate')}>
              <div>Absolute NG Rate</div>
              <div className="text-[9px] font-normal lowercase">(% of total parts)</div>{getSortIcon('calculatedNgRate')}
            </th>
            <th className="px-3 py-2.5 whitespace-nowrap">Bin</th>
          </tr>
        </thead>
        <tbody>
          {sortedDefects.map((d, idx) => (
            <tr key={idx} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
              <td className="px-2 py-2 whitespace-nowrap text-left w-[95px]">
                <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] md:text-xs font-semibold">
                  {d.camera.replace(/^CAMERA\s*-\s*/gi, '').replace(/\bBOT\b/gi, 'BOTTOM').toUpperCase()}
                </span>
              </td>
              <td className="px-3 py-2 text-left truncate max-w-[220px] text-zinc-200 font-medium" title={d.testItem}>
                {d.testItem}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-rose-400 font-semibold font-mono">{d.ngQty.toLocaleString()}</td>
              <td className="px-3 py-2 whitespace-nowrap text-[#fbbf24] font-medium tracking-wide font-mono" title={`${d.ngQty} / total defects`}>
                {d.defectContribution > 0 ? d.defectContribution.toFixed(2) + '%' : '0.00%'}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-amber-500 font-medium font-mono" title={`${d.ngQty} / ${totalProcessed} total parts`}>
                {d.calculatedNgRate > 0 ? d.calculatedNgRate.toFixed(3) + '%' : '0.000%'}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{renderBinBadge(d.ngBox)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
