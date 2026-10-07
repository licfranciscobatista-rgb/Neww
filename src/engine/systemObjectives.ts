import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

type Goal = [Square, PieceSymbol];
const plans: Record<string, { color: Color; goals: Goal[]; essential: PieceSymbol }> = {
  london: { color: 'w', goals: [['d4', 'p'], ['e3', 'p'], ['c3', 'p'], ['f4', 'b'], ['g3', 'b'], ['f3', 'n'], ['d2', 'n']], essential: 'b' },
  italian: { color: 'w', goals: [['e4', 'p'], ['c4', 'b'], ['f3', 'n'], ['d3', 'p']], essential: 'b' },
  spanish: { color: 'w', goals: [['e4', 'p'], ['b5', 'b'], ['f3', 'n']], essential: 'b' },
  scotch: { color: 'w', goals: [['e4', 'p'], ['d4', 'p'], ['f3', 'n']], essential: 'n' },
  'queens-gambit': { color: 'w', goals: [['d4', 'p'], ['c4', 'p'], ['c3', 'n']], essential: 'p' },
  english: { color: 'w', goals: [['c4', 'p'], ['c3', 'n'], ['g2', 'b']], essential: 'p' },
  reti: { color: 'w', goals: [['f3', 'n'], ['g2', 'b'], ['c4', 'p']], essential: 'n' },
  sicilian: { color: 'b', goals: [['c5', 'p'], ['d6', 'p'], ['c6', 'n']], essential: 'p' },
  french: { color: 'b', goals: [['e6', 'p'], ['d5', 'p'], ['c5', 'p']], essential: 'p' },
  caro: { color: 'b', goals: [['c6', 'p'], ['d5', 'p'], ['f5', 'b']], essential: 'p' },
  slav: { color: 'b', goals: [['c6', 'p'], ['d5', 'p']], essential: 'p' },
  'kings-indian': { color: 'b', goals: [['g7', 'b'], ['f6', 'n'], ['d6', 'p']], essential: 'b' },
};

export function lostSystemObjective(board: Chess, system: string): boolean {
  const plan = plans[system];
  if (!plan) return false;
  const pieces = board.board().flat().filter(piece => piece?.color === plan.color);
  if (plan.essential === 'b') {
    const bishopGoal = plan.goals.find(([, type]) => type === 'b')!;
    const parity = (bishopGoal[0].charCodeAt(0) + Number(bishopGoal[0][1])) % 2;
    return !pieces.some(piece => piece?.type === 'b' && (piece.square.charCodeAt(0) + Number(piece.square[1])) % 2 === parity);
  }
  return !pieces.some(piece => piece?.type === plan.essential);
}

export function systemInterference(board: Chess, system: string, move: { from: string; to: string; promotion?: string }): string | null {
  const plan = plans[system];
  if (!plan || board.turn() === plan.color) return null;
  const after = new Chess(board.fen());
  let played;
  try { played = after.move(move); } catch { return null; }
  const capturedGoal = plan.goals.find(([square, type]) => square === played.to && board.get(square)?.color === plan.color && board.get(square)?.type === type);
  if (capturedGoal && played.captured) return `captura una pieza del esquema en ${played.to}; hay que reconstruir ese objetivo.`;
  for (const [square, type] of plan.goals) {
    if (after.get(square)?.color !== plan.color || after.get(square)?.type !== type) continue;
    const beforeAttackers = board.attackers(square, played.color);
    const addedPressure = after.attackers(square, played.color).some(attacker => !beforeAttackers.includes(attacker));
    if (addedPressure) return `crea presion sobre ${square}, un objetivo del sistema; protege o reubica esa pieza para conservar el plan.`;
  }
  return null;
}
