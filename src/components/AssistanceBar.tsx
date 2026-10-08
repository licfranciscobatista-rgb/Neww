import React from 'react';
import { Chess } from 'chess.js';
import {
  Brain,
  Eye,
  EyeOff,
  Target,
  ShieldAlert,
  AlertTriangle,
  Skull,
  Scale,
  CheckCircle2,
} from 'lucide-react';
import type { EngineRecommendation, PlayerProfile } from '../types/chess';
import { evaluateHumanityVerdict, type HumanityVerdictResult } from '../engine/humanityVerdict';
import { EndgamePanels, type EndgameArrow } from './EndgamePanels';

export function AssistanceBar({
  chess,
  profile,
  userColor,
  maia,
  maiaVisible,
  onToggleMaia,
  onChangeElo,
  onVerdict,
  onArrows,
  systemsMode = false,
  systemName,
  systemProgress,
  systemControls,
}: {
  chess: Chess;
  profile: PlayerProfile;
  userColor: 'w' | 'b';
  maia: EngineRecommendation | null;
  maiaVisible: boolean;
  onToggleMaia: () => void;
  onChangeElo: (elo: number) => void;
  onVerdict: (san: string, verdict: HumanityVerdictResult) => void;
  onArrows: (fen: string, arrows: EndgameArrow[]) => void;
  systemControls?: React.ReactNode;
  systemsMode?: boolean;
  systemName?: string;
  systemProgress?: { completed: number; total: number; percent: number };
}) {
  const history = chess.history({ verbose: true });
  const last = history.at(-1);
  const audit = () => {
    if (!last) return;
    onVerdict(last.san, evaluateHumanityVerdict(last.before, last.from + last.to + (last.promotion || ''), last.san, profile));
  };

  // Determinar icono y estilo visual del aviso de Maia (Centinela)
  const alertText = maia?.evalDisplay || (chess.turn() !== userColor ? 'Turno rival' : 'Comprobando avisos');
  const alertDetail = maia?.explanation || 'No hay una revisión propia completada para esta posición.';
  const hasArrow = Boolean(maia?.from && maia?.to);

  const isMate = alertText.toLowerCase().includes('mate');
  const isDraw = alertText.toLowerCase().includes('tabla') || alertText.toLowerCase().includes('ahogado');
  const isBlunder = alertText.toLowerCase().includes('colgada') || alertText.toLowerCase().includes('peligro');

  return (
    <div
      aria-label="Asistencia y Avisos de partida"
      className="w-full border-y border-slate-700 bg-slate-900/90 px-3 py-2.5 flex items-center justify-between flex-wrap gap-x-4 gap-y-2 text-xs shadow-inner"
    >
      <div className="flex items-center gap-3 flex-wrap">
        {/* EN MODO PRINCIPAL: Maia Original de Red Neuronal con Elo y Probabilidad Humana */}
        {!systemsMode && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-purple-300 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
              Maia
            </span>
            <select
              aria-label="Elo de Maia"
              value={profile.maiaEloCalibration || 1100}
              onChange={(event) => onChangeElo(Number(event.target.value))}
              className="bg-slate-800 border border-purple-700 rounded px-1.5 py-0.5 text-xs text-slate-200"
            >
              {[500, 700, 900, 1100, 1300, 1500, 1700, 1900, 2100, 2400].map((elo) => (
                <option key={elo} value={elo}>
                  {elo} Elo
                </option>
              ))}
            </select>
            <span
              title={
                maia?.engineName.includes('red neuronal real')
                  ? 'Probabilidad estimada por la red neuronal para este Elo; no mide cuanto humano es el jugador'
                  : 'Probabilidad del respaldo heuristico; no es un porcentaje medido de humanidad'
              }
              className="tabular-nums text-slate-300 font-mono text-[11px]"
            >
              {maia?.engineName.includes('red neuronal real') ? 'Prob. humana' : 'Est. heuristica'}{' '}
              {maia?.humanProbability !== undefined ? `${Math.round(maia.humanProbability * 100)}%` : '--'}
            </span>
            <button
              type="button"
              onClick={onToggleMaia}
              title={maiaVisible ? 'Ocultar flecha de Maia' : 'Mostrar flecha de Maia'}
              aria-label="Mostrar u ocultar flecha de Maia"
              aria-pressed={maiaVisible}
              className="p-1 text-purple-300 hover:text-purple-200 transition-colors"
            >
              {maiaVisible ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          </div>
        )}

        {systemsMode && systemControls}

      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        {!systemsMode && <button
          type="button"
          disabled={!last}
          onClick={audit}
          title="Auditar la última jugada"
          className="flex items-center gap-1.5 text-purple-300 hover:text-purple-200 disabled:opacity-35 transition-colors px-2 py-1 rounded hover:bg-slate-800/60"
        >
          <Brain size={15} />
          <span>Auditar Jugada{last ? ` (${last.san})` : ''}</span>
        </button>}

        <EndgamePanels chess={chess} userColor={userColor} onArrows={onArrows} />
      </div>
    </div>
  );
}
