import { Chess } from 'chess.js';
import type { GameRecord } from '../types/chess';

export function uniqueTrainingGames(games: GameRecord[]): GameRecord[] {
  return Array.from(new Map(games.filter(Boolean).map(game => [game.id, game])).values());
}

export function validatedTrainingMoves(game: GameRecord) {
  // A PGN alone cannot establish which moves were assisted.
  if (!game.moves?.length) return [];
  try {
    const board = game.moves[0].fenBefore ? new Chess(game.moves[0].fenBefore) : new Chess();
    const result: GameRecord['moves'] = [];
    for (const recorded of game.moves) {
      const before = board.fen();
      if (recorded.fenBefore && recorded.fenBefore !== before) break;
      let move;
      try { move = board.move(recorded.san); } catch { break; }
      if ((recorded.from && recorded.from !== move.from) || (recorded.to && recorded.to !== move.to)) break;
      result.push({ ...recorded, from: move.from, to: move.to, san: move.san, fenBefore: before });
    }
    return result;
  } catch { return []; }
}
