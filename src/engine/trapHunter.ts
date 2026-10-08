import { Chess } from 'chess.js';

export interface TrapLine { name: string; pgn: string; source: string; }
export const CLASSIC_TRAPS: TrapLine[] = [
  { name: 'Mate pastor', pgn: '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#', source: 'Patron clasico' },
  { name: 'Mate de Legal', pgn: '1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5#', source: 'Patron clasico' },
  { name: 'Mate del loco', pgn: '1. f3 e5 2. g4 Qh4#', source: 'Patron clasico' },
];
export interface TrapCandidate { name: string; fen: string; uci: string; san: string; accepted: boolean; line: string[]; source: string; }
const key = (fen: string) => fen.split(' ').slice(0, 4).join(' ');
export function buildTrapIndex(lines: TrapLine[]) {
  const index = new Map<string, TrapCandidate[]>();
  for (const line of lines) {
    try {
      const game = new Chess(); game.loadPgn(line.pgn);
      if (!game.isCheckmate()) continue;
      const winner = game.turn() === 'w' ? 'b' : 'w';
      const moves = game.history({ verbose: true });
      const board = new Chess();
      for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        // Offer only late preparations, not an entire opening disguised as a trap.
        if (board.turn() === winner && moves.length - i <= 7) {
          const candidate = { name: line.name, fen: board.fen(), uci: move.from + move.to + (move.promotion || ''),
            san: move.san, accepted: moves.length - i <= 3, line: moves.slice(i).map(m => m.san), source: line.source };
          const k = key(board.fen()); index.set(k, [...(index.get(k) || []), candidate]);
        }
        board.move(move);
      }
    } catch { /* Reject illegal or incomplete source lines. */ }
  }
  return index;
}
export function findTraps(index: ReturnType<typeof buildTrapIndex>, board: Chess, color: 'w' | 'b') {
  if (board.turn() !== color || board.isGameOver()) return [];
  return (index.get(key(board.fen())) || []).map(candidate => ({ ...candidate, fen: board.fen() }));
}
export function safeTrapScore(root: { scoreCp?: number; mate?: number }, reply: { scoreCp?: number; mate?: number }) {
  if (reply.mate !== undefined) return reply.mate < 0;
  if (root.mate !== undefined) return false;
  return -(reply.scoreCp || 0) >= (root.scoreCp || 0) - 80;
}
