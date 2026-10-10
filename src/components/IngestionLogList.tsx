import React from 'react';
import { IngestionLog } from '../types';
import { Database, CheckCircle, AlertTriangle } from 'lucide-react';

interface LogListProps {
  logs: IngestionLog[];
}

export function IngestionLogList({ logs }: LogListProps) {
  if (logs.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded h-full min-h-[500px] flex flex-col">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2 shadow-sm z-10 shrink-0">
        <Database className="w-5 h-5 text-zinc-400" />
        <h3 className="text-base font-medium text-zinc-200 uppercase tracking-wider">Ingestion Log</h3>
      </div>
      <div className="px-5 py-2 bg-[#0a0a0c] font-mono text-sm overflow-y-auto flex-1 h-full">
        {logs.map((log, i) => {
          let yieldColor = 'text-zinc-500';
          if (log.yieldRate) {
              const yNum = parseFloat(log.yieldRate);
              if (yNum >= 85) yieldColor = 'text-emerald-500';
              else if (yNum >= 50) yieldColor = 'text-amber-500';
              else yieldColor = 'text-rose-500';
          }
           
          return (
          <div key={i} className="flex items-center justify-between py-2.5 border-b border-zinc-900/50 last:border-0 hover:bg-zinc-900 transition-colors">
            <div className="flex flex-col gap-1 w-2/3">
              <span className="text-zinc-600 text-xs">[{log.timestamp}]</span>
              <span className="text-zinc-300 truncate" title={log.filename}>{log.filename}</span>
            </div>
            <div className="flex flex-col items-end gap-1 w-1/3">
              {log.status === 'SUCCESS' ? (
                <span className="flex items-center gap-1.5 text-emerald-500 font-bold">
                  <CheckCircle className="w-3.5 h-3.5" /> OK
                </span>
              ) : log.status === 'WARNING' ? (
                 <span className="flex items-center gap-1.5 text-amber-500 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" /> SKIP
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-rose-500 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" /> ERR
                </span>
              )}
              {log.yieldRate ? (
                  <span className={`${yieldColor} font-semibold text-right`}>{log.yieldRate}</span>
              ) : (
                  <span className="text-zinc-500 text-xs text-right whitespace-nowrap">{log.message}</span>
              )}
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}

