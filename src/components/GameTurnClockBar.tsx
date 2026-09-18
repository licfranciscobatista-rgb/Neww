import React from 'react';
import { Chess } from 'chess.js';
import { Clock } from 'lucide-react';
import { ThinkingTimeEstimate } from '../types/chess';

interface GameTurnClockBarProps {
  chess: Chess;
  userColor: 'w' | 'b';
  gameMode: 'vs_ai' | 'manual_board' | 'pass_and_play';
  isGameOver: boolean;
  whiteTimeSeconds: number;
  blackTimeSeconds: number;
  thinkingTimeEstimate?: ThinkingTimeEstimate | null;
}

export const GameTurnClockBar: React.FC<GameTurnClockBarProps> = ({
  chess,
  userColor,
  gameMode,
  isGameOver,
  whiteTimeSeconds,
  blackTimeSeconds,
  thinkingTimeEstimate,
}) => {
  const currentTurn = chess.turn();
  const isWhiteTurn = currentTurn === 'w';
  const isUserTurn = currentTurn === userColor;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const board = chess.board();
  let whiteMaterial = 0;
  let blackMaterial = 0;
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && values[p.type]) {
        if (p.color === 'w') whiteMaterial += values[p.type];
        else blackMaterial += values[p.type];
      }
    }
  }
  const matDiff = whiteMaterial - blackMaterial;

  const urgencyStyles = {
    low: { badge: 'text-emerald-400 bg-emerald-950/70 border-emerald-600/40', label: 'Fluida' },
    medium: { badge: 'text-sky-400 bg-sky-950/70 border-sky-600/40', label: 'Tensión Media' },
    high: { badge: 'text-amber-400 bg-amber-950/70 border-amber-600/40', label: 'Clave' },
    critical: { badge: 'text-rose-400 bg-rose-950/70 border-rose-600/40', label: 'Crítica' },
  };

  return (
    <div className="w-full bg-slate-900/95 border border-slate-800 rounded-xl p-2 sm:p-2.5 shadow-sm space-y-2 mb-3">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
            <span className="text-xs">{userColor === 'w' ? '♔' : '♚'}</span>
            <span className="font-semibold text-slate-200 text-[11px]">
              Juegas con {userColor === 'w' ? 'Blancas' : 'Negras'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 hidden sm:inline">
            {gameMode === 'vs_ai' ? '• Contra IA Offline' : '• Tablero Manual'}
          </span>
        </div>

        <div>
          {!isGameOver ? (
            isUserTurn ? (
              <span className="bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 font-bold px-2 py-0.5 rounded-full text-[10px] animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                ¡Tu Turno!
              </span>
            ) : (
              <span className="bg-slate-800 border border-slate-700 text-slate-400 font-medium px-2 py-0.5 rounded-full text-[10px]">
                {gameMode === 'vs_ai' ? 'Turno Rival...' : 'Rival'}
              </span>
            )
          ) : (
            <span className="bg-rose-950/80 border border-rose-500/60 text-rose-300 font-bold px-2 py-0.5 rounded-full text-[10px]">
              Finalizada
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
        <div
          className={`sm:col-span-4 px-2.5 py-1.5 rounded-lg border flex items-center justify-between transition-all ${
            isWhiteTurn && !isGameOver
              ? 'bg-slate-800 border-amber-400 shadow ring-1 ring-amber-400/30'
              : 'bg-slate-950 border-slate-800/80 opacity-75'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white border border-slate-400 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-200">Blancas</span>
            {matDiff > 0 && (
              <span className="text-[9px] font-bold text-amber-400 font-mono">
                +{matDiff}
              </span>
            )}
          </div>
          <span className={`font-mono text-sm font-bold tracking-tight ${whiteTimeSeconds === 0 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
            {formatTime(whiteTimeSeconds)}
          </span>
        </div>

        <div
          className={`sm:col-span-4 px-2.5 py-1.5 rounded-lg border flex items-center justify-between transition-all ${
            !isWhiteTurn && !isGameOver
              ? 'bg-slate-800 border-amber-400 shadow ring-1 ring-amber-400/30'
              : 'bg-slate-950 border-slate-800/80 opacity-75'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-stone-900 border border-slate-600 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-200">Negras</span>
            {matDiff < 0 && (
              <span className="text-[9px] font-bold text-amber-400 font-mono">
                +{Math.abs(matDiff)}
              </span>
            )}
          </div>
          <span className={`font-mono text-sm font-bold tracking-tight ${blackTimeSeconds === 0 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
            {formatTime(blackTimeSeconds)}
          </span>
        </div>

        <div className="sm:col-span-4 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-sky-900/30 flex items-center justify-between gap-1.5">
          {thinkingTimeEstimate ? (
            <>
              <div className="flex items-center gap-1.5 truncate">
                <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="font-mono text-xs font-bold text-sky-300">
                  ~{thinkingTimeEstimate.recommendedSeconds}s
                </span>
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border truncate ${
                    urgencyStyles[thinkingTimeEstimate.urgency]?.badge || urgencyStyles.medium.badge
                  }`}
                >
                  {urgencyStyles[thinkingTimeEstimate.urgency]?.label || 'Tensión'}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <div className="w-8 bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-700">
                  <div
                    className={`h-full rounded-full transition-all ${
                      thinkingTimeEstimate.complexityScore > 7
                        ? 'bg-rose-500'
                        : thinkingTimeEstimate.complexityScore > 4
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, thinkingTimeEstimate.complexityScore * 10)}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-slate-400 font-semibold">
                  {thinkingTimeEstimate.complexityScore}
                </span>
              </div>
            </>
          ) : (
            <span className="text-[10px] text-slate-500 italic">Calculando ritmo...</span>
          )}
        </div>
      </div>
    </div>
  );
};
