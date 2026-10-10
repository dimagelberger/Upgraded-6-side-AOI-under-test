import React, { useMemo } from 'react';
import { SessionSummary } from '../types';
import { Activity, Gauge, Target, TrendingUp, AlertCircle } from 'lucide-react';
import { calcTotalTimeValue } from './SessionTable';

interface Props {
  sessions: SessionSummary[];
}

export function OeeAnalytics({ sessions }: Props) {
  const stats = useMemo(() => {
    let totalProcessed = 0;
    let totalOk = 0;
    let totalTimeMins = 0;
    
    // Average speed calculation based on parsable speeds
    let validSpeedSum = 0;
    let validSpeedCount = 0;

    sessions.forEach(s => {
      totalProcessed += s.total;
      totalOk += s.okQty;
      
      const timeMs = calcTotalTimeValue(s.startTime, s.endTime);
      if (timeMs > 0) {
        totalTimeMins += timeMs;
      }

      const speedVal = parseFloat(s.speed.replace(/[^0-9.]/g, ''));
      if (!isNaN(speedVal) && speedVal > 0) {
        validSpeedSum += speedVal;
        validSpeedCount += 1;
      }
    });

    const quality = totalProcessed > 0 ? (totalOk / totalProcessed) * 100 : 0;
    const avgSpeed = validSpeedCount > 0 ? (validSpeedSum / validSpeedCount) : 0;
    
    // Calculate theoretical max pieces if running at avgSpeed constantly
    const theoreticalMax = totalTimeMins * avgSpeed;
    
    // Performance = Actual pieces / Theoretical pieces (based on avg operating speed)
    // Here we use Average Speed as reference ideal, so Performance tends to balance out.
    // If not possible, just use standard speed metric.
    const performance = theoreticalMax > 0 ? (totalProcessed / theoreticalMax) * 100 : 0;

    // We don't have Planned Time, let's assume availability is 100% of operating time for standard OEE display
    // but put a clear disclaimer.
    const standardAvailability = 100;
    
    const approxOEE = (quality / 100) * (performance / 100) * (standardAvailability / 100) * 100;

    return {
      quality,
      performance: Math.min(performance, 100), // Cap at 100% just in case of weird data
      availability: standardAvailability,
      oee: Math.min(approxOEE, 100),
      avgSpeed,
      totalTimeMins
    };
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center border border-zinc-800 rounded bg-zinc-950/50">
         <p className="text-zinc-500">No session data available for OEE Analytics.</p>
      </div>
    );
  }

  const formatPct = (val: number) => val.toFixed(2) + '%';

  return (
    <div className="flex-1 min-h-0 flex flex-col pt-2 animate-in fade-in duration-300 overflow-y-auto custom-scrollbar">
       
       <div className="flex items-start gap-4 p-4 mb-6bg-blue-950/20 border border-blue-900/50 rounded-lg">
          <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-200">
             <p className="font-semibold text-blue-300 mb-1">OEE Analytics Details</p>
             <p>This is an approximation based on the available log data.</p>
             <ul className="list-disc pl-5 mt-2 space-y-1 text-blue-200/80">
                <li><strong>Quality:</strong> Extracted directly from OK Qty / Total Qty (Yield).</li>
                <li><strong>Performance:</strong> Estimated using Total Produced vs (Avg Operating Speed × Operating Time).</li>
                <li><strong>Availability:</strong> Assumed 100% during active operating windows as 'Planned Downtime' is not available in logs.</li>
             </ul>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 shrink-0">
          
          {/* Main OEE */}
          <div className="bg-[#0b0e14] border border-zinc-800 rounded-lg p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
             <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded">
                   <Activity className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-widest">Est. OEE</h3>
             </div>
             <p className="text-4xl font-bold text-zinc-100 mb-2 relative z-10">{formatPct(stats.oee)}</p>
             <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-4 relative z-10">
                 <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${stats.oee}%` }}></div>
             </div>
          </div>

          {/* Quality */}
          <div className="bg-[#0b0e14] border border-zinc-800 rounded-lg p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
             <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded">
                   <Target className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-widest">Quality</h3>
             </div>
             <p className="text-4xl font-bold text-zinc-100 mb-2 relative z-10">{formatPct(stats.quality)}</p>
             <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-4 relative z-10">
                 <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${stats.quality}%` }}></div>
             </div>
          </div>

          {/* Performance */}
          <div className="bg-[#0b0e14] border border-zinc-800 rounded-lg p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
             <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded">
                   <Gauge className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-widest">Performance</h3>
             </div>
             <p className="text-4xl font-bold text-zinc-100 mb-2 relative z-10">{formatPct(stats.performance)}</p>
             <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-4 relative z-10">
                 <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${stats.performance}%` }}></div>
             </div>
          </div>

          {/* Metrics / Speeds */}
          <div className="bg-[#0b0e14] border border-zinc-800 rounded-lg p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
             <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="p-2 bg-sky-500/20 text-sky-400 rounded">
                   <TrendingUp className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-widest">Avg Speed</h3>
             </div>
             <p className="text-4xl font-bold text-zinc-100 mb-2 relative z-10">{stats.avgSpeed.toFixed(0)} <span className="text-lg text-zinc-500">pcs/min</span></p>
             <div className="text-sm text-zinc-500 mt-4 relative z-10">
                 Operating Time: {stats.totalTimeMins.toLocaleString()} mins
             </div>
          </div>

       </div>

       <div className="flex-1 bg-[#0b0e14] border border-zinc-800 rounded-lg p-6">
          <h3 className="text-lg font-bold text-zinc-200 mb-4 uppercase tracking-wider">Session OEE Breakdown</h3>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-zinc-350 text-xs whitespace-nowrap">
              <thead className="text-[10px] md:text-xs text-zinc-500 uppercase bg-zinc-900/50">
                <tr>
                  <th className="px-3 py-2 font-medium">Lot / Date</th>
                  <th className="px-3 py-2 font-medium">Quality</th>
                  <th className="px-3 py-2 font-medium">Speed</th>
                  <th className="px-3 py-2 font-medium">Duration</th>
                  <th className="px-3 py-2 font-medium">Est. Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-[11px] md:text-xs">
                 {sessions.slice(0, 100).map((s, idx) => {
                    const qlt = s.total > 0 ? (s.okQty / s.total) * 100 : 0;
                    const spd = parseFloat(s.speed.replace(/[^0-9.]/g, '')) || 0;
                    const mins = calcTotalTimeValue(s.startTime, s.endTime);
                    const tmins = mins > 0 ? mins : 0;
                    // Performance against avg speed
                    const perf = (tmins * stats.avgSpeed) > 0 ? (s.total / (tmins * stats.avgSpeed)) * 100 : 0;
                    
                    return (
                      <tr key={idx} className="hover:bg-zinc-800/20">
                        <td className="px-3 py-1.5">
                           <div className="font-semibold text-zinc-350">{s.lotNumber}</div>
                           <div className="text-[10px] text-zinc-500 font-mono">{s.startTime.split(' ')[0]}</div>
                        </td>
                        <td className="px-3 py-1.5">
                           <div className="flex items-center gap-2">
                             <div className="w-10 bg-zinc-805 h-1 rounded-full overflow-hidden">
                               <div className="bg-emerald-500 h-full" style={{ width: `${qlt}%` }}></div>
                             </div>
                             <span className="text-emerald-450 font-mono">{qlt.toFixed(1)}%</span>
                           </div>
                        </td>
                        <td className="px-3 py-1.5 text-sky-450 font-mono">{spd > 0 ? spd : '-'} pcs/min</td>
                        <td className="px-3 py-1.5 text-zinc-450 font-mono">{tmins > 0 ? tmins + ' min' : '-'}</td>
                        <td className="px-3 py-1.5">
                           <div className="flex items-center gap-2">
                             <div className="w-10 bg-zinc-805 h-1 rounded-full overflow-hidden">
                               <div className="bg-amber-500 h-full" style={{ width: `${Math.min(perf, 100)}%` }}></div>
                             </div>
                             <span className="text-amber-450 font-mono">{tmins > 0 ? perf.toFixed(1) + '%' : '-'}</span>
                           </div>
                        </td>
                      </tr>
                    );
                 })}
              </tbody>
            </table>
            {sessions.length > 100 && (
                <div className="p-4 text-center text-zinc-500 text-sm">
                   Showing latest 100 runs.
                </div>
            )}
          </div>
       </div>
    </div>
  );
}
