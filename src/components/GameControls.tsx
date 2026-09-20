import React from 'react';
import { Chess } from 'chess.js';
import {
  RotateCcw,
  Undo2,
  Volume2,
  VolumeX,
  Repeat,
  Sparkles,
  Copy,
  Plus,
  Brain,
  Share2,
  Flag,
} from 'lucide-react';
import { PlayerProfile } from '../types/chess';
import { evaluateHumanityVerdict, HumanityVerdictResult } from '../engine/humanityVerdict';

interface GameControlsProps {
  chess: Chess;
  profile: PlayerProfile;
  boardOrientation: 'w' | 'b';
  onFlipBoard: () => void;
  onNewGame: () => void;
  onResetPosition: () => void;
  onUndoMove?: () => void;
  canUndo?: boolean;
  onFinishGame?: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  lastMoveSan?: string;
  onShowVerdictModal: (san: string, verdict: HumanityVerdictResult) => void;
}

export const GameControls: React.FC<GameControlsProps> = ({
  chess,
  profile,
  boardOrientation,
  onFlipBoard,
  onNewGame,
  onResetPosition,
  onUndoMove,
  canUndo = false,
  onFinishGame,
  soundEnabled,
  onToggleSound,
  lastMoveSan,
  onShowVerdictModal,
}) => {
  const [copiedFen, setCopiedFen] = React.useState(false);

  const handleCopyFen = () => {
    navigator.clipboard.writeText(chess.fen());
    setCopiedFen(true);
    setTimeout(() => setCopiedFen(false), 2000);
  };

  const handleInspectHumanity = () => {
    const history = chess.history({ verbose: true });
    if (history.length === 0) return;
    const last = history[history.length - 1];

    const temp = new Chess();
    for (let i = 0; i < history.length - 1; i++) {
      temp.move(history[i].san);
    }
    const fenBefore = temp.fen();

    const verdict = evaluateHumanityVerdict(
      fenBefore,
      `${last.from}${last.to}`,
      last.san,
      profile
    );

    onShowVerdictModal(last.san, verdict);
  };

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between flex-wrap gap-2 text-xs">
      <div className="flex items-center gap-1.5">
        <button
          onClick={onNewGame}
          className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center gap-1.5 shadow-sm transition-all text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nueva Partida</span>
        </button>

        <button
          onClick={onFlipBoard}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition-colors"
          title="Girar Tablero"
        >
          <Repeat className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Girar</span>
        </button>

        <button
          onClick={onResetPosition}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition-colors"
          title="Reiniciar Posición Actual"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reiniciar</span>
        </button>

        {onUndoMove && (
          <button
            onClick={onUndoMove}
            disabled={!canUndo}
            className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
              canUndo
                ? 'bg-amber-950/70 hover:bg-amber-900 border-amber-600/50 text-amber-200 shadow-sm'
                : 'bg-slate-900/60 border-slate-800 text-slate-600 cursor-not-allowed opacity-50'
            }`}
            title={canUndo ? 'Deshacer última jugada' : 'No hay jugadas para deshacer'}
          >
            <Undo2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Deshacer</span>
          </button>
        )}

        {onFinishGame && (
          <button
            onClick={onFinishGame}
            className="px-2.5 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-700/60 font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            title="Finalizar y archivar partida actual en Historial"
          >
            <Flag className="w-3.5 h-3.5 text-rose-400" />
            <span>Finalizar Partida</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {lastMoveSan && (
          <button
            onClick={handleInspectHumanity}
            className="px-2.5 py-1.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-600/40 text-purple-300 font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            title="Verificar si la última jugada cumple patrones humanos"
          >
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span>Auditar Humanidad ({lastMoveSan})</span>
          </button>
        )}

        <button
          onClick={handleCopyFen}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          title="Copiar FEN"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onToggleSound}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          title={soundEnabled ? 'Silenciar sonidos' : 'Activar audio'}
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
        </button>
      </div>
    </div>
  );
};
