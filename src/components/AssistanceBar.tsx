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

        {/* EN MODO SISTEMAS: Centinela de Avisos de Maia (Mates, Tablas y Colgadas) con Flecha Desactivable */}
        {systemsMode && (
          <div className="flex items-center gap-2 flex-wrap bg-slate-950/70 border border-purple-900/50 px-2.5 py-1.5 rounded-xl shadow-xs">
            <div className="flex items-center gap-1.5 text-purple-300 font-bold">
              <ShieldAlert size={15} className="text-purple-400 shrink-0" />
              <span className="text-[11px] uppercase tracking-wide">Avisos Maia</span>
            </div>

            {/* Insignia dinámica de Alerta */}
            <div
              title={alertDetail}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border transition-all ${
                isMate
                  ? 'bg-rose-950/80 border-rose-500/70 text-rose-200 animate-pulse'
                  : isBlunder
                  ? 'bg-amber-950/80 border-amber-500/70 text-amber-200'
                  : isDraw
                  ? 'bg-sky-950/80 border-sky-500/70 text-sky-200'
                  : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
              }`}
            >
              {isMate ? (
                <Skull size={13} className="shrink-0 text-rose-300" />
              ) : isBlunder ? (
                <AlertTriangle size={13} className="shrink-0 text-amber-300" />
              ) : isDraw ? (
                <Scale size={13} className="shrink-0 text-sky-300" />
              ) : (
                <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
              )}
              <span className="truncate max-w-[200px] sm:max-w-[280px]">{alertText}</span>
            </div>

            {/* Flecha Desactivable de Aviso */}
            <button
              type="button"
              onClick={onToggleMaia}
              title={
                maiaVisible
                  ? 'Flecha de aviso activa en tablero. Toca para desactivar.'
                  : 'Flecha de aviso desactivada. Toca para ver en tablero.'
              }
              aria-label="Alternar flecha de aviso"
              aria-pressed={maiaVisible}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                maiaVisible
                  ? 'bg-purple-950/90 border-purple-500 text-purple-200 shadow-xs'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'
              }`}
            >
              {maiaVisible ? (
                <Eye size={13} className="text-purple-300 shrink-0" />
              ) : (
                <EyeOff size={13} className="text-slate-500 shrink-0" />
              )}
              <span>Flecha {maiaVisible ? 'On' : 'Off'}</span>
              {hasArrow && maia?.san && (
                <span className="font-mono bg-black/40 px-1 py-0.2 rounded text-[10px] text-purple-300">
                  {maia.san}
                </span>
              )}
            </button>
          </div>
        )}

      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <button
          type="button"
          disabled={!last}
          onClick={audit}
          title="Auditar la última jugada"
          className="flex items-center gap-1.5 text-purple-300 hover:text-purple-200 disabled:opacity-35 transition-colors px-2 py-1 rounded hover:bg-slate-800/60"
        >
          <Brain size={15} />
          <span>Auditar Jugada{last ? ` (${last.san})` : ''}</span>
        </button>

        <EndgamePanels chess={chess} userColor={userColor} onArrows={onArrows} />
      </div>
    </div>
  );
}
