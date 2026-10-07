import { Chess } from 'chess.js';
import type { EngineRecommendation } from '../types/chess';
import { getReliableTheoryMoves } from './theoryBook';
import { realGarbo } from './realGarbo';
import { queryOpening } from './openingService';
import { OPENING_PRESETS, shouldPauseGarbo, type OpeningChoice } from './openingIndex';
import { continueLondon } from './londonPlanner';

// Independent fallback for synchronous engine health checks, not live recommendations.
export function runGarboRecommendation(chess: Chess): EngineRecommendation | null {
  const moves = chess.moves({ verbose: true });
  const book = getReliableTheoryMoves(chess);
  const chosen = moves.find(move => move.san.includes('#')) ||
    moves.find(move => book.includes(move.san)) || moves[0];
  if (!chosen) return null;
  return {
    engine: 'garbo', engineName: 'GarboChess',
    move: chosen.from + chosen.to + (chosen.promotion || ''), from: chosen.from, to: chosen.to,
    san: chosen.san, evaluation: 0, evalDisplay: '—', explanation: '', color: '#059669',
  };
}

export async function analyzeGarbo(chess: Chess, selected: string): Promise<{
  rec: EngineRecommendation | null; opening: OpeningChoice;
}> {
  const fen = chess.fen();
  if (selected === 'rodent-active') {
    realGarbo.terminate();
    return { rec: null, opening: { status: 'free', notice: 'Garbo apagado por cambio aceptado a Rodent.' } };
  }
  const history = chess.history({ verbose: true }).map(move => move.after);
  const opening = await queryOpening(fen, selected, history);
  const system = OPENING_PRESETS.find(item => item.id === selected)?.name || opening.name || 'el sistema elegido';
  if (selected === 'london' && (!opening.uci || chess.inCheck())) {
    const plan = await continueLondon(chess, position => realGarbo.analyze(position, { movetime: 100 }));
    opening.notice = plan?.notice || 'Londres sigue seleccionado; motor no disponible para calcular una continuación.';
    opening.suggestedSystem = undefined;
    if (!plan) return { opening, rec: null };
    const move = new Chess(fen).move({ from: plan.move.slice(0, 2), to: plan.move.slice(2, 4), promotion: plan.move[4] });
    return { opening, rec: { engine: 'garbo', engineName: 'GarboChess / Londres', move: plan.move, from: move.from, to: move.to, san: move.san, evaluation: plan.score / 100, evalDisplay: 'Plan Londres', isBookMove: false, explanation: plan.notice, color: '#059669' } };
  }
  if (shouldPauseGarbo(selected, opening)) {
    opening.notice = opening.status === 'unavailable'
      ? `${system} en pausa: repertorio no disponible.`
      : `${system} en pausa: sin continuación reconocida.`;
    if (opening.status !== 'unavailable') {
      for (const preset of OPENING_PRESETS) {
        if (preset.id === selected) continue;
        const alternative = await queryOpening(fen, preset.id, history);
        if (!alternative.uci) continue;
        try {
          new Chess(fen).move({ from: alternative.uci.slice(0, 2), to: alternative.uci.slice(2, 4), promotion: alternative.uci[4] });
          opening.suggestedSystem = { id: preset.id, name: preset.name };
          break;
        } catch { /* Only propose a system with a legal continuation here. */ }
      }
    }
    return { opening, rec: null };
  }
  if (opening.uci) {
    try {
      const board = new Chess(fen);
      const move = board.move({ from: opening.uci.slice(0, 2), to: opening.uci.slice(2, 4), promotion: opening.uci[4] });
      return { opening, rec: {
        engine: 'garbo', engineName: 'GarboChess', move: opening.uci,
        from: move.from, to: move.to, san: move.san, evaluation: 0, evalDisplay: opening.eco || 'Libro',
        isBookMove: true, bookOpeningName: opening.name, explanation: '', color: '#059669',
      } };
    } catch {
      if (selected !== 'free' && selected !== 'auto') {
        opening.status = 'unavailable';
        opening.notice = `${system} en pausa: continuación no válida.`;
        return { opening, rec: null };
      }
    }
  }
  const real = await realGarbo.analyze(fen, { movetime: 300 });
  if (!real) opening.notice = 'Garbo no pudo analizar esta posición. No hay recomendación verificada.';
  else if (real.mate !== undefined && real.mate < 0) {
    opening.notice = `Garbo detecta mate en contra en su línea (${Math.abs(real.mate)}). Prioridad: defender el rey.`;
  } else if (new Chess(fen).isCheck()) {
    opening.notice = 'El rey está en jaque. La recomendación responde al jaque; el sistema queda en pausa.';
  }
  return { opening, rec: real ? {
    engine: 'garbo', engineName: 'GarboChess', move: real.uci, from: real.from, to: real.to,
    san: real.san, evaluation: real.scoreCp / 100, evalDisplay: real.evalDisplay,
    depth: real.depth, isBookMove: false, explanation: '', color: '#059669',
  } : null };
}
