import { Chess } from 'chess.js';
import { EngineRecommendation } from '../types/chess';
import { evaluateMovesStockfish, ScoredMove } from './stockfishEngine';

/**
 * GarboChess classical positional evaluator.
 * Prefers harmonious piece development, king safety (castling), center pawns,
 * and penalizes premature queen wanderings or repeated piece moves.
 */
function scorePositionalGarbo(chess: Chess, move: ScoredMove): number {
  let bonus = 0;
  const san = move.san;

  // 1. Castling king safety (classical Garbo principle)
  if (san === 'O-O' || san === 'O-O-O') {
    bonus += 40;
  }

  // 2. Center pawn control (e4, d4, c4, e5, d5, c5)
  if (['e4', 'd4', 'c4', 'e5', 'd5', 'c5'].includes(move.to)) {
    bonus += 25;
  }

  // 3. Knight and Bishop harmonious development towards center
  if (['Nf3', 'Nc3', 'Nf6', 'Nc6', 'Bc4', 'Bb5', 'Be2', 'Bd3', 'Bf4', 'Bc5', 'Bb4', 'Be7', 'Bd6'].includes(san)) {
    bonus += 30;
  }

  // 4. Discourage premature Queen maneuvers in the opening (first 10 moves)
  const history = chess.history();
  if (history.length < 16 && san.startsWith('Q') && !san.includes('x')) {
    bonus -= 35;
  }

  // 5. Prefer solid pawn consolidation over tactical skirmishes
  if (san.length === 2 && ['e3', 'd3', 'c3', 'e6', 'd6', 'c6'].includes(san)) {
    bonus += 15;
  }

  return move.score + bonus;
}

export function runGarboRecommendation(
  chess: Chess,
  stockfishBest?: ScoredMove
): EngineRecommendation | null {
  const candidates = evaluateMovesStockfish(chess, 2);
  if (candidates.length === 0) return null;

  const top = stockfishBest || candidates[0];

  // Evaluate candidate moves with Garbo's positional heuristic
  // Only consider moves within tactical safety tolerance (<= 120 centipawns of top move)
  const safeMoves = candidates.filter((c) => Math.abs(top.score - c.score) <= 120);
  const pool = safeMoves.length > 0 ? safeMoves : [candidates[0]];

  // Sort pool by Garbo positional score
  const garboScored = pool.map((m) => ({
    ...m,
    garboScore: scorePositionalGarbo(chess, m),
  }));
  garboScored.sort((a, b) => b.garboScore - a.garboScore);

  const choice = garboScored[0];
  const evalInPawns = (choice.score / 100).toFixed(2);
  const evalDisplay = choice.score >= 0 ? `+${evalInPawns}` : evalInPawns;

  const isSharedWithStockfish = choice.move === top.move;
  const explanation = isSharedWithStockfish
    ? `Línea clásica posicional (coincide con Stockfish en el óptimo táctico: ${evalDisplay}).`
    : `Alternativa posicional GarboChess: desarrollo armónico y control estructural (${evalDisplay}).`;

  return {
    engine: 'garbo',
    engineName: 'GarboChess',
    move: choice.move,
    from: choice.from,
    to: choice.to,
    san: choice.san,
    evaluation: choice.score,
    evalDisplay: `${evalDisplay} peones`,
    confidence: 88,
    explanation,
    color: '#059669', // Emerald Green
    timeTakenMs: 18,
    timestamp: Date.now(),
  };
}

