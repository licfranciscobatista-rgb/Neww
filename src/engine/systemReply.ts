import { Chess } from 'chess.js';
import type { AnalyzeRodent } from './rodentAdvisor';
import { systemInterference } from './systemObjectives';

export async function systemReply(board: Chess, move: string | null, analyze: AnalyzeRodent, system = 'london'): Promise<{ text: string; arrow: { from: string; to: string } | null } | null> {
  const next = new Chess(board.fen());
  if (move) { try { next.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }); } catch { return null; } }
  if (next.isGameOver()) return null;
  const candidates = next.moves({ verbose: true }).map(candidate => ({ candidate, reason: systemInterference(next, system, candidate) })).filter(item => item.reason)
    .sort((a, b) => Number(!!b.candidate.captured) - Number(!!a.candidate.captured));
  if (!candidates.length) return null;
  const reply = await analyze(next.fen());
  let chosen = candidates.find(item => item.candidate.from + item.candidate.to + (item.candidate.promotion || '') === reply?.uci);
  if (!chosen) {
    let best = -Infinity;
    for (const candidate of candidates.slice(0, 12)) {
      const position = new Chess(next.fen()); position.move(candidate.candidate);
      if (position.isCheckmate()) { chosen = candidate; break; }
      const response = await analyze(position.fen());
      if (!response || (response.mate !== undefined && response.mate > 0)) continue;
      const score = -response.scoreCp;
      if (score > best) { best = score; chosen = candidate; }
    }
  }
  // A verified system interference remains relevant even if the engine is unavailable.
  chosen ??= candidates[0];
  try {
    const played = next.move(chosen.candidate);
    return { arrow: { from: played.from, to: played.to },
      text: `${move ? `Tras ${move.slice(0, 2)}-${move.slice(2, 4)}, posible respuesta` : 'Posible jugada rival'} ${played.san}: ${chosen.reason}` };
  } catch { return null; }
}
