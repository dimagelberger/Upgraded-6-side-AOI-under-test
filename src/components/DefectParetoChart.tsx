import React, { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { DefectRecord } from '../types';
import { getBaseCategory, getDefectName } from '../utils/parser';
import { getUnifiedCamera } from '../utils/rejectNormalization';

interface Props {
  defects: DefectRecord[];
  totalProcessed: number;
}

const cleanCam = (cam: string) => {
  return cam.replace(/^CAMERA\s*-\s*/gi, '').replace(/\bBOT\b/gi, 'BOTTOM').toUpperCase();
};

export function DefectParetoChart({ defects }: Props) {
  const { chartData } = useMemo(() => {
    // Group duplicates by Unified Camera and Unified Defect Category (POLC is unified to 1 entry)
    const map = new Map<string, { name: string; qty: number; camera: string }>();
    
    // Sort chronologically so latest files process last
    const timeSortedDefects = [...defects].sort((a, b) => {
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
       const isCombined = d.baseCategory && d.baseCategory === d.testItem;
       const cam = (d.camera || 'CAMERA - TOP').trim().toUpperCase();
       const itemName = isCombined ? d.baseCategory : (d.testItem || getDefectName(d.camera, d.no, d.testItem));
       const key = `${cam}::${itemName}`;
       if (!map.has(key)) {
           map.set(key, { name: itemName, qty: 0, camera: cam });
       }
       const existing = map.get(key)!;
       existing.qty += d.ngQty; // Aggregate quantity across lots
    });

    const filtered = Array.from(map.values())
        .filter(d => d.qty > 0)
        .sort((a, b) => b.qty - a.qty);

    const totalQty = filtered.reduce((sum, d) => sum + d.qty, 0);
    
    let cumulative = 0;
    // Take top 12 for chart
    const topN = filtered.slice(0, 12).map(d => {
        cumulative += d.qty;
        const paretoPct = totalQty > 0 ? (cumulative / totalQty) * 100 : 0;
        return {
            ...d,
            pareto: parseFloat(paretoPct.toFixed(2))
        };
    });

    return { chartData: topN, totalDefectsQty: totalQty };
  }, [defects]);

  if (chartData.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center border border-zinc-800 rounded bg-[#0b0e14]">
         <p className="text-zinc-500 text-sm font-mono">No defect data to display</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900 border border-zinc-700 p-3 rounded shadow-xl font-sans">
          <p className="text-zinc-200 font-semibold mb-2 text-sm">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs font-mono">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-zinc-400 capitalize">{entry.name}:</span>
              <span className="text-zinc-100 font-bold">
                {entry.name === 'Cumulative %' ? `${entry.value}%` : entry.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomXAxisTick = ({ x, y, payload, index }: any) => {
    const item = chartData[index];
    if (!item) return null;

    const cameraLabel = cleanCam(item.camera);
    const words = item.name.split(' ');
    const n = words.length;
    let line1 = item.name;
    let line2 = '';

    if (n === 4) {
      line1 = words.slice(0, 2).join(' ');
      line2 = words.slice(2).join(' ');
    } else if (n === 5) {
      line1 = words.slice(0, 3).join(' ');
      line2 = words.slice(3).join(' ');
    } else if (n >= 6) {
      const half = Math.ceil(n / 2);
      line1 = words.slice(0, half).join(' ');
      line2 = words.slice(half).join(' ');
    }

    const tickY = y + 15;

    return (
      <g transform={`translate(${x + 25},${tickY + 15})`}>
        <text
          x={0}
          y={0}
          dy={10}
          textAnchor="end"
          fill="#e4e4e7"
          fontSize={11}
          transform="rotate(-45)"
        >
          <tspan x={0} dy="0" fontWeight="500">{line1}</tspan>
          {line2 && <tspan x={0} dy="14">{line2}</tspan>}
          <tspan x={0} dy="14" fill="#fbbf24" fontWeight="700" fontSize={10}>
            {cameraLabel}
          </tspan>
        </text>
      </g>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0b0e14]">
       <div className="p-3 border-b border-zinc-800 flex justify-center items-center bg-zinc-900/40">
           <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider text-center">Top Defects Pareto (Top 12)</h3>
       </div>
       <div className="flex-1 min-h-0 pt-4 pr-2 pb-2">
           <ResponsiveContainer width="100%" height="100%">
               <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 120, left: 10 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                 <XAxis 
                    dataKey="name" 
                    interval={0}
                    tick={<CustomXAxisTick />}
                 />
                 <YAxis 
                    yAxisId="left" 
                    orientation="left" 
                    stroke="#a1a1aa" 
                    tick={{ fill: '#a1a1aa', fontSize: 11 }}
                    domain={[0, (dataMax: number) => Math.ceil((dataMax * 1.15) / 500) * 500 || 10]}
                    tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k` : val}
                 />
                 <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    stroke="#a1a1aa" 
                    tick={{ fill: '#a1a1aa', fontSize: 11 }}
                    domain={[0, 100]}
                    tickFormatter={(val) => `${val}%`}
                 />
                 <Tooltip content={<CustomTooltip />} />
                 <Legend wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }} verticalAlign="top" />
                 <Bar 
                    yAxisId="left" 
                    dataKey="qty" 
                    name="Defect Qty" 
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                    barSize={30}
                 />
                 <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="pareto" 
                    name="Cumulative %" 
                    stroke="#10b981"
                    strokeWidth={1.5}
                    dot={{ r: 2, fill: '#10b981' }}
                    activeDot={{ r: 4 }}
                 />
               </ComposedChart>
           </ResponsiveContainer>
       </div>
    </div>
  );
}
