import { Chess } from 'chess.js';
import { OPENING_PRESETS, type OpeningChoice } from './openingIndex';
import type { RodentAnalysis } from './realRodent';

export interface SystemProposal { id: string; sourceSystem: string; name: string; fen: string; move: string; san: string; scoreCp: number; comparisonCp: number; reason: string; }
export type AnalyzeRodent = (fen: string) => Promise<RodentAnalysis | null>;
export type QuerySystem = (fen: string, id: string, history: string[]) => Promise<OpeningChoice>;

async function evaluateMove(board: Chess, uci: string, analyze: AnalyzeRodent): Promise<number | null> {
  const next = new Chess(board.fen());
  try { next.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); } catch { return null; }
  if (next.isCheckmate()) return 100000;
  if (next.isDraw()) return 0;
  const reply = await analyze(next.fen());
  if (!reply || (reply.mate !== undefined && reply.mate > 0)) return null;
  return -reply.scoreCp;
}

export async function proposeSystem(board: Chess, selected: string, currentMove: string | undefined, analyze: AnalyzeRodent, query: QuerySystem, cancelled = () => false): Promise<SystemProposal | null> {
  if (board.isGameOver() || selected === 'free' || selected === 'rodent-active') return null;
  const fen = board.fen();
  const history = board.history({ verbose: true }).map(move => move.after);
  const root = await analyze(fen);
  if (!root || root.mate !== undefined || cancelled()) return null;
  const currentScore = currentMove ? await evaluateMove(board, currentMove, analyze) : null;
  if (cancelled() || (currentMove && currentScore === null)) return null;
  const baseline = currentScore ?? root.scoreCp;
  const candidates: SystemProposal[] = [];
  const evaluated = new Map<string, number | null>();
  for (const preset of OPENING_PRESETS) {
    if (cancelled()) return null;
    if (preset.id === selected) continue;
    const opening = await query(fen, preset.id, history);
    if (!opening.uci || opening.uci === currentMove) continue;
    if (!evaluated.has(opening.uci)) {
      if (evaluated.size >= 5) continue;
      evaluated.set(opening.uci, await evaluateMove(board, opening.uci, analyze));
    }
    const score = evaluated.get(opening.uci);
    if (score === null || score === undefined || score < baseline - 15) continue;
    const copy = new Chess(fen);
    const move = copy.move({ from: opening.uci.slice(0, 2), to: opening.uci.slice(2, 4), promotion: opening.uci[4] });
    candidates.push({ id: preset.id, sourceSystem: selected, name: preset.name, fen, move: opening.uci, san: move.san, scoreCp: score, comparisonCp: score - baseline,
      reason: `Continuacion reconocida de ${preset.name}; Rodent comparo la respuesta rival. ${score >= baseline + 20 ? 'Mejora estimada' : 'Alternativa de evaluacion similar, no una mejora demostrada'}; no garantiza ventaja.` });
  }
  return candidates.sort((a, b) => b.scoreCp - a.scoreCp)[0] || null;
}

export async function followSystem(board: Chess, selected: string, analyze: AnalyzeRodent, query: QuerySystem): Promise<{ move: string; san: string; text: string } | null> {
  if (board.isGameOver()) return null;
  const root = await analyze(board.fen());
  if (!root) return null;
  const opening = await query(board.fen(), selected, board.history({ verbose: true }).map(move => move.after));
  let uci = root.uci;
  let inSystem = false;
  if (opening.uci) {
    const score = await evaluateMove(board, opening.uci, analyze);
    if (score !== null && score >= root.scoreCp - 30 && root.mate === undefined) { uci = opening.uci; inSystem = true; }
  }
  const copy = new Chess(board.fen());
  const move = copy.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return { move: uci, san: move.san, text: inSystem ? 'Continuacion del sistema verificada por Rodent.' : 'Fuera del repertorio: Rodent atiende la posicion; no afirma haber recuperado el sistema.' };
}
