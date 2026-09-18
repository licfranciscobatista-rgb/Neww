import React, { useState } from 'react';
import { Chess } from 'chess.js';
import {
  Trophy,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Award,
  BookOpen,
  Play,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { GameAnalysisReport, GameRecord, MoveAnalysis, MoveQuality } from '../types/chess';
import { analyzeFullGame } from '../engine/gameAnalysisEngine';

interface AnalysisViewProps {
  game: GameRecord | null;
  report: GameAnalysisReport | null;
  onUpdateReport: (report: GameAnalysisReport) => void;
  onBackToBoard: () => void;
}

const QUALITY_STYLES: Record<MoveQuality, { label: string; badge: string; icon: string }> = {
  brilliant: { label: 'Brillante', badge: 'bg-teal-950 text-teal-300 border-teal-500', icon: '✦✦' },
  great: { label: 'Gran Jugada', badge: 'bg-cyan-950 text-cyan-300 border-cyan-500', icon: '✦' },
  best: { label: 'Mejor Jugada', badge: 'bg-emerald-950 text-emerald-300 border-emerald-500', icon: '★' },
  excellent: { label: 'Excelente', badge: 'bg-green-950 text-green-300 border-green-600', icon: '✓' },
  good: { label: 'Buena', badge: 'bg-slate-800 text-slate-300 border-slate-700', icon: '·' },
  book: { label: 'Teoría / Libro', badge: 'bg-amber-950 text-amber-300 border-amber-600', icon: '📖' },
  inaccuracy: { label: 'Imprecisión', badge: 'bg-yellow-950 text-yellow-300 border-yellow-600', icon: '?!' },
  mistake: { label: 'Error', badge: 'bg-orange-950 text-orange-300 border-orange-600', icon: '?' },
  blunder: { label: 'Error Grave (Blunder)', badge: 'bg-rose-950 text-rose-300 border-rose-600', icon: '??' },
};

export const AnalysisView: React.FC<AnalysisViewProps> = ({
  game,
  report,
  onUpdateReport,
  onBackToBoard,
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; pct: number } | null>(null);
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number>(0);

  if (!game) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto space-y-3">
        <Trophy className="w-10 h-10 text-slate-600 mx-auto" />
        <h3 className="text-base font-bold text-white">Ninguna partida seleccionada</h3>
        <p className="text-xs text-slate-400">
          Selecciona una partida desde el Historial o termina una en el tablero para auditar la precisión y errores.
        </p>
        <button
          onClick={onBackToBoard}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-xs"
        >
          Volver al Tablero
        </button>
      </div>
    );
  }

  const handleStartAnalysis = async () => {
    setAnalyzing(true);
    try {
      const rep = await analyzeFullGame(
        game.id,
        game.title,
        game.date,
        game.playerColor,
        game.moves,
        (current, total, pct) => {
          setProgress({ current, total, pct });
        }
      );
      onUpdateReport(rep);
      setSelectedMoveIndex(0);
    } finally {
      setAnalyzing(false);
      setProgress(null);
    }
  };

  const currentMoveAnalysis: MoveAnalysis | undefined = report?.moves[selectedMoveIndex];

  return (
    <div className="max-w-4xl mx-auto p-2 sm:p-4 space-y-4 text-xs text-slate-200">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-purple-400" />
            Auditoría y Análisis de Partida
          </h2>
          <p className="text-xs text-slate-400">
            {game.title} ({game.date}) • {game.movesCount} jugadas
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!report && !analyzing && (
            <button
              onClick={handleStartAnalysis}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg"
            >
              <Sparkles className="w-4 h-4" />
              <span>Ejecutar Análisis Completo</span>
            </button>
          )}

          <button
            onClick={onBackToBoard}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
          >
            Volver al Tablero
          </button>
        </div>
      </div>

      {analyzing && (
        <div className="p-6 bg-slate-900 border border-slate-700 rounded-2xl text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-3 border-purple-500 border-t-transparent animate-spin mx-auto" />
          <h3 className="font-bold text-white text-sm">Calculando análisis objetivo con Stockfish...</h3>
          {progress && (
            <div className="max-w-xs mx-auto space-y-1">
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Evaluando jugada {progress.current} de {progress.total} ({progress.pct}%)
              </p>
            </div>
          )}
        </div>
      )}

      {report && (
        <div className="space-y-4">
          {/* Accuracy header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Precisión Blancas
                </span>
                <span className="text-2xl font-black font-mono text-white block">
                  {report.whiteAccuracy}%
                </span>
                <span className="text-[11px] text-slate-400">
                  {report.breakdown.white.blunder} fallas graves, {report.breakdown.white.mistake} errores
                </span>
              </div>
              <div className="w-12 h-12 rounded-full bg-white/10 border-2 border-slate-400 flex items-center justify-center font-bold text-lg text-white">
                ♔
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Precisión Negras
                </span>
                <span className="text-2xl font-black font-mono text-white block">
                  {report.blackAccuracy}%
                </span>
                <span className="text-[11px] text-slate-400">
                  {report.breakdown.black.blunder} fallas graves, {report.breakdown.black.mistake} errores
                </span>
              </div>
              <div className="w-12 h-12 rounded-full bg-stone-900 border-2 border-slate-600 flex items-center justify-center font-bold text-lg text-white">
                ♚
              </div>
            </div>
          </div>

          {/* Move inspector */}
          {currentMoveAnalysis && (
            <div className="p-4 bg-slate-900 border border-slate-700 rounded-2xl space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-slate-300">
                    {currentMoveAnalysis.moveNumber}.{currentMoveAnalysis.color === 'b' ? '..' : ''} {currentMoveAnalysis.san}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold flex items-center gap-1 ${
                      QUALITY_STYLES[currentMoveAnalysis.quality].badge
                    }`}
                  >
                    <span>{QUALITY_STYLES[currentMoveAnalysis.quality].icon}</span>
                    <span>{QUALITY_STYLES[currentMoveAnalysis.quality].label}</span>
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    disabled={selectedMoveIndex === 0}
                    onClick={() => setSelectedMoveIndex((prev) => Math.max(0, prev - 1))}
                    className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-xs text-slate-400 px-1">
                    {selectedMoveIndex + 1} / {report.moves.length}
                  </span>
                  <button
                    disabled={selectedMoveIndex >= report.moves.length - 1}
                    onClick={() => setSelectedMoveIndex((prev) => Math.min(report.moves.length - 1, prev + 1))}
                    className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <p className="text-slate-300 leading-snug">
                  {currentMoveAnalysis.explanation}
                </p>
                {currentMoveAnalysis.bestMoveSan && currentMoveAnalysis.quality !== 'best' && currentMoveAnalysis.quality !== 'book' && (
                  <div className="pt-1 text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span className="text-emerald-400 font-semibold">Alternativa óptima sugerida:</span>
                    <span className="font-mono font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                      {currentMoveAnalysis.bestMoveSan}
                    </span>
                    <span>({(currentMoveAnalysis.deltaLoss / 100).toFixed(2)} peones mejor)</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Move list grid */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px] block">
              Lista Cronológica de Jugadas
            </span>
            <div className="max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-1.5 font-mono text-xs">
              {report.moves.map((m, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedMoveIndex(idx)}
                  className={`p-1.5 rounded text-left border flex items-center justify-between transition-colors ${
                    selectedMoveIndex === idx
                      ? 'bg-purple-950 border-purple-500 text-white font-bold ring-1 ring-purple-400'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">
                    {m.ply % 2 !== 0 ? `${m.moveNumber}. ` : `${m.moveNumber}.. `}{m.san}
                  </span>
                  <span
                    className={`text-[9px] px-1 rounded font-bold ${
                      m.quality === 'blunder'
                        ? 'text-rose-400'
                        : m.quality === 'mistake'
                        ? 'text-orange-400'
                        : m.quality === 'best'
                        ? 'text-emerald-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {QUALITY_STYLES[m.quality].icon}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
