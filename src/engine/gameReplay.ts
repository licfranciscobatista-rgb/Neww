import { Chess } from 'chess.js';
import { GameRecord } from '../types/chess';

export function buildGameReplay(game: GameRecord): { fens: string[]; moves: string[] } {
  const chess = new Chess();
  if (game.pgn?.trim()) chess.loadPgn(game.pgn);
  else if (game.moves?.length) {
    if (game.moves[0].fenBefore) chess.load(game.moves[0].fenBefore);
    for (const move of game.moves) chess.move(move.uci ? { from: move.uci.slice(0, 2), to: move.uci.slice(2, 4), promotion: move.uci[4] } : move.san);
  } else if (game.finalFen) chess.load(game.finalFen);
  const history = chess.history({ verbose: true });
  return { fens: [history[0]?.before || chess.fen(), ...history.map(m => m.after)], moves: history.map(m => m.san) };
}
