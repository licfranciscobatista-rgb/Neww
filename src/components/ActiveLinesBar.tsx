import React from 'react';
import { EngineRecommendation, EngineType } from '../types/chess';

interface ActiveLinesBarProps {
  recommendations: Record<EngineType, EngineRecommendation | null>;
  activeArrowFilter: Record<EngineType, boolean>;
  onToggleEngineFilter: (engine: EngineType) => void;
  isRivalTurn?: boolean;
  rivalColorLabel?: string;
  indicatorStyle?: 'dot' | 'arrow';
  onToggleIndicatorStyle?: () => void;
}

const ENGINE_CONFIG: Record<
  EngineType,
  { label: string; text: string; stroke: string; badgeBg: string; badgeBorder: string }
> = {
  stockfish: {
    label: 'SF',
    text: 'Stockfish',
    stroke: '#3b82f6',
    badgeBg: 'rgba(59, 130, 246, 0.25)',
    badgeBorder: '#3b82f6',
  },
  garbo: {
    label: 'GB',
    text: 'Garbo',
    stroke: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.25)',
    badgeBorder: '#10b981',
  },
  maia: {
    label: 'MA',
    text: 'Maia',
    stroke: '#a855f7',
    badgeBg: 'rgba(168, 85, 247, 0.25)',
    badgeBorder: '#a855f7',
  },
  personal: {
    label: 'PE',
    text: 'Personal',
    stroke: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.25)',
    badgeBorder: '#f59e0b',
  },
  chessjs: {
    label: 'CJS',
    text: 'Chess.js (Sin flecha)',
    stroke: '#fb7185',
    badgeBg: 'rgba(251, 113, 133, 0.25)',
    badgeBorder: '#fb7185',
  },
};

export const ActiveLinesBar: React.FC<ActiveLinesBarProps> = ({
  recommendations,
  activeArrowFilter,
  onToggleEngineFilter,
  isRivalTurn,
  rivalColorLabel = 'Rival',
  indicatorStyle = 'dot',
  onToggleIndicatorStyle,
}) => {
  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs shadow-md">
      <div className="flex items-center justify-between w-full flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-300">
            Líneas en tablero:
          </span>

          {onToggleIndicatorStyle && (
            <button
              type="button"
              onClick={onToggleIndicatorStyle}
              title={
                indicatorStyle === 'dot'
                  ? 'Modo Punto activo: Mínimo impacto gráfico, ideal para partidas con reloj. Toca para cambiar a flecha.'
                  : 'Modo Flecha activo: Flechas completas en tablero. Toca para cambiar a punto sin lag.'
              }
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                indicatorStyle === 'dot'
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                  : 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full inline-block ${
                  indicatorStyle === 'dot' ? 'bg-emerald-400' : 'bg-indigo-400'
                }`}
              />
              <span>{indicatorStyle === 'dot' ? 'Modo Punto (Rápido)' : 'Modo Flechas'}</span>
            </button>
          )}

          {isRivalTurn ? (
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Tu turno ({rivalColorLabel})
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              (toca para encender/apagar motores)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(['stockfish', 'maia', 'personal'] as EngineType[]).map((eng) => {
            const conf = ENGINE_CONFIG[eng];
            const isActive = activeArrowFilter[eng];
            const hasMove = !!recommendations[eng]?.move;
            return (
              <button
                key={eng}
                type="button"
                onClick={() => onToggleEngineFilter(eng)}
                title={`Alternar flecha de ${conf.text}`}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                  isActive
                    ? 'shadow-sm'
                    : 'opacity-40 grayscale border-slate-700 bg-slate-800/60 text-slate-400'
                }`}
                style={{
                  backgroundColor: isActive ? conf.badgeBg : undefined,
                  borderColor: isActive ? conf.badgeBorder : undefined,
                  color: isActive ? '#ffffff' : undefined,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: conf.stroke }}
                />
                <span>{conf.label}</span>
                <span className="hidden sm:inline text-[10px] font-medium opacity-90">
                  {conf.text}
                </span>
                {hasMove && (
                  <span className="text-[10px] opacity-90 font-mono bg-black/30 px-1 py-0.2 rounded">
                    {recommendations[eng]?.san}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
