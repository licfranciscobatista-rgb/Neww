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
    <div className="w-full bg-slate-900 border-2 border-sky-500/40 rounded-xl p-3 shadow-lg flex items-center justify-between flex-wrap gap-2 text-xs">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-300 shadow-inner">
          <Clock className="w-5 h-5 text-sky-400 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-100 font-bold text-xs">
              Tiempo recomendado:
            </span>
            <span className="font-mono text-sky-200 font-black text-base bg-sky-950/90 px-2.5 py-0.5 rounded-lg border-2 border-sky-400/60 shadow-sm">
              {estimate.recommendedSeconds} s
            </span>
            <span
              className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-sm ${
                urgencyColors[estimate.urgency]
              }`}
            >
              {urgencyLabels[estimate.urgency]}
            </span>
          </div>
          <p className="text-[12px] text-slate-300 font-medium mt-0.5">
            {estimate.reasoning}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-slate-300">
        <div className="flex items-center gap-1.5 bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
          <span className="text-slate-400 font-medium">Complejidad:</span>
          <div className="w-16 bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
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
          <span className="font-mono text-white font-bold">
            {estimate.complexityScore}/10
          </span>
        </div>

        {clockRemaining !== undefined && clockRemaining > 0 && (
          <div className="hidden md:flex items-center gap-1.5 font-mono text-slate-200 bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Reloj:</span>
            <span className="font-bold text-sky-300">
              {Math.floor(clockRemaining / 60)}:
              {(clockRemaining % 60).toString().padStart(2, '0')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
