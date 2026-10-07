import { Chess } from 'chess.js';
import type { RealStockfishAnalysis } from './realStockfish';

export function legalVariation(fen: string, pv?: string): string[] {
  const board = new Chess(fen);
  const line: string[] = [];
  for (const uci of (pv || '').trim().split(/\s+/).slice(0, 10)) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) break;
    try {
      line.push(board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san);
    } catch { break; }
  }
  return line;
}

export function mateSignal(result: RealStockfishAnalysis | null): boolean {
  return result?.mate !== undefined && result.mate !== 0 && Math.abs(result.mate) <= 5;
}

export function drawReason(board: Chess): string | undefined {
  if (board.isStalemate()) return 'Ahogado';
  if (board.isInsufficientMaterial()) return 'Material insuficiente';
  if (board.isThreefoldRepetition()) return 'Triple repetición';
  if (board.isDrawByFiftyMoves()) return 'Regla de 50 movimientos';
  return undefined;
}

export function drawMoves(board: Chess): { san: string; reason: string }[] {
  if (board.isGameOver()) return [];
  const result: { san: string; reason: string }[] = [];
  // Push/pop preserves repetition history and restores the supplied board.
  for (const move of board.moves({ verbose: true })) {
    board.move(move);
    try {
      const reason = drawReason(board);
      if (reason) result.push({ san: move.san, reason });
    } finally { board.undo(); }
  }
  return result;
}
