import React from 'react';
import { Clock } from 'lucide-react';
import { ThinkingTimeEstimate } from '../types/chess';

interface ThinkingTimeBarProps {
  estimate: ThinkingTimeEstimate | null;
  clockRemaining?: number;
}

export const ThinkingTimeBar: React.FC<ThinkingTimeBarProps> = ({ estimate, clockRemaining }) => {
  if (!estimate) return null;

  const urgencyColors = {
    low: 'text-emerald-400 bg-emerald-950/60 border-emerald-600/40',
    medium: 'text-sky-400 bg-sky-950/60 border-sky-600/40',
    high: 'text-amber-400 bg-amber-950/60 border-amber-600/40',
    critical: 'text-rose-400 bg-rose-950/60 border-rose-600/40',
  };

  const urgencyLabels = {
    low: 'Decisión Fluida',
    medium: 'Tensión Media',
    high: 'Momento Clave',
    critical: 'Resolución Crítica',
  };

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md flex items-center justify-between flex-wrap gap-2 text-xs">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-slate-200 font-semibold">
              Tiempo para pensar:
            </span>
            <span className="font-mono text-sky-300 font-bold text-sm bg-sky-950 px-2 py-0.5 rounded border border-sky-600/40">
              ~{estimate.recommendedSeconds} s
            </span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                urgencyColors[estimate.urgency]
              }`}
            >
              {urgencyLabels[estimate.urgency]}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {estimate.reasoning}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Complejidad:</span>
          <div className="w-16 bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700">
            <div
              className={`h-full rounded-full transition-all ${
                estimate.complexityScore > 7
                  ? 'bg-rose-500'
                  : estimate.complexityScore > 4
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(100, estimate.complexityScore * 10)}%` }}
            />
          </div>
          <span className="font-mono text-slate-300 font-bold">
            {estimate.complexityScore}/10
          </span>
        </div>

        {clockRemaining !== undefined && clockRemaining > 0 && (
          <div className="hidden md:flex items-center gap-1 font-mono text-slate-300">
            <span className="text-slate-400">Reloj:</span>
            <span className="font-semibold">
              {Math.floor(clockRemaining / 60)}:
              {(clockRemaining % 60).toString().padStart(2, '0')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
