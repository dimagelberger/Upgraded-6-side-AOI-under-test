import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { SessionSummary } from '../types';
import { parseDateTime } from '../utils/dateUtils';

export function LotYieldChart({ sessions, onLotDoubleClick }: { sessions: SessionSummary[], onLotDoubleClick?: (lot: string) => void }) {
    if (sessions.length === 0) return (
      <div className="h-[520px] w-full bg-zinc-900 border border-zinc-800 rounded flex items-center justify-center text-zinc-500 font-mono text-sm uppercase">
        Awaiting Ingestion
      </div>
    );

    const { data, monthlyTicks } = useMemo(() => {
        // filter out invalid dates just in case
        const validSessions = sessions.filter(s => s.startTime && parseDateTime(s.startTime) !== -1);

        const sorted = [...validSessions].sort((a, b) => {
            return parseDateTime(a.startTime) - parseDateTime(b.startTime);
        });

        const ticks: string[] = [];
        let currentMonth = '';

        const chartData = sorted.map((s, index) => {
            const t = parseDateTime(s.startTime);
            const dateObj = new Date(t);
            const monthStr = dateObj.toLocaleDateString('default', { month: 'short', year: '2-digit' });
            
            const uid = `${s.lotNumber}_${index}`;
            
            if (monthStr !== currentMonth) {
                currentMonth = monthStr;
                ticks.push(uid);
            }

            return {
                uid,
                lot: s.lotNumber,
                yield: parseFloat(s.yieldRate),
                monthYear: monthStr,
                dateStr: dateObj.toLocaleDateString(),
                timestamp: dateObj.getTime()
            };
        });

        return { data: chartData, monthlyTicks: ticks };
    }, [sessions]);

    return (
        <div className="w-full bg-zinc-900 border border-zinc-800 rounded p-4 pb-0 flex flex-col justify-between" style={{ height: '520px' }}>
            <ResponsiveContainer width="100%" height="100%">
               <LineChart 
                 data={data} 
                 margin={{ top: 15, right: 35, bottom: 25, left: 20 }}
                 onClick={(state: any) => {
                     if (state && state.activePayload && state.activePayload.length > 0) {
                         const lot = state.activePayload[0].payload.lot;
                         if (lot && onLotDoubleClick) {
                             onLotDoubleClick(lot);
                         }
                     }
                 }}
                 style={{ cursor: 'default' }}
               >
                   <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                   <XAxis 
                     dataKey="uid"
                     ticks={monthlyTicks}
                     tickFormatter={(uidValue) => {
                         const point = data.find(d => d.uid === uidValue);
                         return point ? point.monthYear : '';
                     }}
                     stroke="#71717a" 
                     axisLine={{ stroke: '#27272a' }}
                     tickMargin={10}
                     style={{ fontSize: 11 }}
                   />
                   <YAxis 
                     domain={[0, 100]} 
                     ticks={[0, 20, 40, 60, 80, 100]} 
                     stroke="#71717a" 
                     fontSize={11} 
                     tickLine={false} 
                     axisLine={false} 
                     tickFormatter={(val) => `${val}%`}
                     label={{ value: 'Yield (%)', angle: -90, position: 'insideLeft', offset: -10, fill: '#71717a', fontSize: 13, fontWeight: 500 }}
                   />
                   <Tooltip 
                       contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px', fontSize: '13px' }}
                       itemStyle={{ color: '#e4e4e7', fontWeight: 600 }}
                       labelFormatter={(val, items) => {
                           if (items && items.length > 0) {
                               const lot = items[0].payload.lot;
                               const dateStr = items[0].payload.dateStr;
                               return `Lot: ${lot} (${dateStr})`;
                           }
                           return '';
                       }}
                   />
                   
                   <ReferenceLine y={85} stroke="#10b981" strokeDasharray="5 5" strokeWidth={1.5} label={{ position: 'insideRight', value: '85%', fill: '#10b981', fontSize: 11, fontWeight: 600, dy: -10 }} />
                   <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={1.5} label={{ position: 'insideRight', value: '50%', fill: '#f59e0b', fontSize: 11, fontWeight: 600, dy: -10 }} />

                   {monthlyTicks.map((tick, i) => (
                       <ReferenceLine 
                           key={i} 
                           x={tick} 
                           stroke="#52525b" 
                           strokeDasharray="4 4" 
                       />
                   ))}

                   <Line 
                     type="monotone" 
                     dataKey="yield" 
                     stroke="#4b5563" 
                     strokeWidth={2} 
                     dot={(props: any) => {
                          const { cx, cy, payload, index } = props;
                          const yValue = payload.yield;
                          let color = '#f43f5e';
                          if (yValue > 85) color = '#10b981';
                          else if (yValue > 50) color = '#f59e0b';
                          
                          return (
                             <circle 
                                key={index}
                                cx={cx} cy={cy} r={5} fill={color} stroke="none"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onLotDoubleClick && payload?.lot) {
                                      onLotDoubleClick(payload.lot);
                                  }
                                }}
                                style={{ cursor: 'default', pointerEvents: 'all' }}
                             />
                          );
                      }}
                      activeDot={(props: any) => {
                          const { cx, cy, payload, index } = props;
                          return (
                             <circle
                               key={index}
                               cx={cx} cy={cy} r={7} fill="#ffffff" stroke="#18181b" strokeWidth={2}
                               onClick={(e) => {
                                 e.stopPropagation();
                                 if (onLotDoubleClick && payload?.lot) {
                                     onLotDoubleClick(payload.lot);
                                 }
                               }}
                               style={{ cursor: 'default', pointerEvents: 'all' }}
                             />
                          );
                      }}
                     isAnimationActive={false}
                   />
               </LineChart>
           </ResponsiveContainer>
        </div>
    );
}
