import React from 'react';
import { Chess } from 'chess.js';
import { Brain, Eye, EyeOff } from 'lucide-react';
import type { EngineRecommendation, PlayerProfile } from '../types/chess';
import { evaluateHumanityVerdict, type HumanityVerdictResult } from '../engine/humanityVerdict';
import { EndgamePanels, type EndgameArrow } from './EndgamePanels';

export function AssistanceBar({ chess, profile, userColor, maia, maiaVisible, onToggleMaia, onChangeElo, onVerdict, onArrows }: {
  chess: Chess; profile: PlayerProfile; userColor: 'w' | 'b'; maia: EngineRecommendation | null;
  maiaVisible: boolean; onToggleMaia: () => void; onChangeElo: (elo: number) => void;
  onVerdict: (san: string, verdict: HumanityVerdictResult) => void;
  onArrows: (fen: string, arrows: EndgameArrow[]) => void;
}) {
  const history = chess.history({ verbose: true });
  const last = history.at(-1);
  const audit = () => {
    if (!last) return;
    onVerdict(last.san, evaluateHumanityVerdict(last.before, last.from + last.to + (last.promotion || ''), last.san, profile));
  };
  return <div aria-label="Asistencia de partida" className="w-full border-y border-slate-700 bg-slate-900/80 px-2 py-3 flex items-center flex-wrap gap-x-4 gap-y-3 text-xs">
    <button type="button" disabled={!last} onClick={audit} title="Auditar la ultima jugada" className="flex items-center gap-1.5 text-purple-300 disabled:opacity-35"><Brain size={16} />Auditar Humanidad{last ? ` (${last.san})` : ''}</button>
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-bold text-purple-300">Maia</span>
      <select aria-label="Elo de Maia" value={profile.maiaEloCalibration || 1100} onChange={event => onChangeElo(Number(event.target.value))} className="bg-slate-800 border border-purple-700 rounded px-1 py-1">
        {[500,700,900,1100,1300,1500,1700,1900,2100,2400].map(elo => <option key={elo} value={elo}>{elo} Elo</option>)}
      </select>
      <span title={maia?.engineName.includes('red neuronal real') ? 'Probabilidad estimada por la red neuronal para este Elo; no mide cuanto humano es el jugador' : 'Probabilidad del respaldo heuristico; no es un porcentaje medido de humanidad'} className="tabular-nums text-slate-300">{maia?.engineName.includes('red neuronal real') ? 'Prob. humana' : 'Est. heuristica'} {maia?.humanProbability !== undefined ? `${Math.round(maia.humanProbability * 100)}%` : '--'}</span>
      <button type="button" onClick={onToggleMaia} title="Mostrar u ocultar flecha de Maia" aria-label="Mostrar u ocultar flecha de Maia" aria-pressed={maiaVisible} className="p-1 text-purple-300">{maiaVisible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
    </div>
    <EndgamePanels chess={chess} userColor={userColor} onArrows={onArrows} />
  </div>;
}
