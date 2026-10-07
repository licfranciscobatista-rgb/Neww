import { Chess } from 'chess.js';
import type { RealGarboAnalysis } from './realGarbo';

export function londonGoals(chess: Chess): number {
  let score = 0;
  for (const [square, type, weight] of [['d4', 'p', 30], ['e3', 'p', 12], ['c3', 'p', 10], ['f4', 'b', 30], ['g3', 'b', 18], ['h2', 'b', 12], ['f3', 'n', 18], ['d2', 'n', 12], ['d3', 'b', 14], ['e2', 'b', 8], ['g1', 'k', 20]] as const) {
    const piece = chess.get(square);
    if (piece?.color === 'w' && piece.type === type) score += weight;
  }
  return score;
}

export async function continueLondon(chess: Chess, analyze: (fen: string) => Promise<RealGarboAnalysis | null>): Promise<{ move: string; score: number; notice: string } | null> {
  const baseline = await analyze(chess.fen());
  if (!baseline) return null;
  if (chess.turn() !== 'w') return { move: baseline.uci, score: baseline.scoreCp, notice: 'Respuesta rival analizada; Londres sigue seleccionado para blancas.' };
  const fen = chess.fen();
  const initialGoals = londonGoals(chess);
  const legal = chess.moves({ verbose: true });
  const ranked = legal.map(move => {
    const next = new Chess(fen);
    next.move(move);
    return { move, next, gain: londonGoals(next) - initialGoals };
  }).sort((a, b) => b.gain - a.gain);
  const candidates = ranked.filter(item => item.gain > 0 || item.move.san.includes('#')).slice(0, 6);
  const baseCandidate = ranked.find(item => item.move.from + item.move.to + (item.move.promotion || '') === baseline.uci);
  if (baseCandidate && !candidates.includes(baseCandidate)) candidates.push(baseCandidate);
  const evaluated: Array<{ move: string; score: number; gain: number }> = [];
  for (const candidate of candidates) {
    const uci = candidate.move.from + candidate.move.to + (candidate.move.promotion || '');
    if (candidate.next.isCheckmate()) return { move: uci, score: 100000, notice: 'Mate disponible: prioridad sobre el esquema Londres.' };
    if (candidate.next.isDraw()) continue;
    const reply = await analyze(candidate.next.fen());
    if (!reply || (reply.mate !== undefined && reply.mate > 0)) continue;
    evaluated.push({ move: uci, score: -reply.scoreCp, gain: candidate.gain });
  }
  if (!evaluated.length) return { move: baseline.uci, score: baseline.scoreCp, notice: 'Londres adaptado: prioriza la defensa; no se verificó una mejora del esquema.' };
  const verifiedBaseline = evaluated.find(item => item.move === baseline.uci);
  if (!verifiedBaseline) return { move: baseline.uci, score: baseline.scoreCp, notice: 'Londres adaptado: prioriza la respuesta del motor; alternativa sin verificar.' };
  const bestScore = Math.max(baseline.scoreCp, ...evaluated.map(item => item.score));
  if (!evaluated.some(item => item.score >= bestScore - 60)) return { move: baseline.uci, score: baseline.scoreCp, notice: 'Londres adaptado: atiende la posición antes de completar el esquema.' };
  const chosen = evaluated.filter(item => item.score >= bestScore - 60).sort((a, b) => b.gain - a.gain || b.score - a.score)[0];
  return { move: chosen.move, score: chosen.score, notice: chosen.gain > 0 ? 'Londres adaptado: desarrollo y estructura del sistema, con respuesta rival calculada.' : 'Londres adaptado: atiende la posición antes de completar el esquema.' };
}
