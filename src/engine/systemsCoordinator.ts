import { Chess, type Square } from 'chess.js';
import { OPENING_PRESETS, isSystemCompatibleWithColor } from './openingIndex';
import { SYSTEM_DETAILS_MAP, lostSystemObjective } from './systemObjectives';

export interface SystemIdentification {
  id: string;
  name: string;
  provisional: boolean;
  reason: string;
}
export interface SystemEngineResult {
  uci: string;
  scoreCp: number;
  mate?: number;
  depth: number;
  source?: 'wasm' | 'worker' | 'fallback';
}
export type SystemAnalyzer = (fen: string) => Promise<SystemEngineResult | null>;
export interface SystemPlan {
  fen: string;
  systemId: string;
  move: string;
  san: string;
  scoreCp: number;
  depth: number;
  source?: 'wasm' | 'worker' | 'fallback';
  gain: number;
  status: 'following' | 'recovering' | 'defending' | 'unrecoverable';
  reason: string;
  changeNeeded: boolean;
  rootScore: number;
  systemScore: number | null;
}

export function systemGoalScore(board: Chess, id: string): number {
  const details = SYSTEM_DETAILS_MAP[id];
  if (!details) return 0;
  let score = 0;
  const bishopGroups = new Map<number, number>();
  for (const [square, type] of details.goals) {
    const piece = board.get(square);
    if (type === 'b') {
      const parity = (square.charCodeAt(0) + Number(square[1])) % 2;
      const exact = piece?.color === details.color && piece.type === type;
      const active = board.board().flat().some(p => p?.color === details.color && p.type === 'b' &&
        (p.square.charCodeAt(0) + Number(p.square[1])) % 2 === parity && !['1', '8'].includes(p.square[1]));
      bishopGroups.set(parity, Math.max(bishopGroups.get(parity) || 0, exact ? 24 : active ? 12 : 0));
    } else if (piece?.color === details.color && piece.type === type) score += type === 'p' ? 18 : 24;
    else if (type === 'p') {
      const advanced = board.board().flat().some(p => p?.color === details.color && p.type === 'p' && p.square[0] === square[0] &&
        (details.color === 'w' ? Number(p.square[1]) > Number(square[1]) : Number(p.square[1]) < Number(square[1])));
      if (advanced) score += 12;
    }
  }
  score += [...bishopGroups.values()].reduce((sum, value) => sum + value, 0);
  const home = details.color === 'w' ? '1' : '8';
  for (const file of ['b', 'c', 'f', 'g']) {
    const piece = board.get(`${file}${home}` as Square);
    if (!piece || piece.color !== details.color || !['b', 'n'].includes(piece.type)) score += 3;
  }
  if (['g', 'c'].some(file => board.get(`${file}${home}` as Square)?.type === 'k' && board.get(`${file}${home}` as Square)?.color === details.color)) score += 12;
  for (const square of details.keySquares) {
    if (board.attackers(square as Square, details.color).length) score += 2;
  }
  return score;
}

export function identifySystem(board: Chess, color: 'w' | 'b', preferred = 'free'): SystemIdentification {
  const candidates = OPENING_PRESETS.filter(p => p.color === color || p.color === 'any');
  const fixed = candidates.find(p => p.id === preferred);
  if (fixed) return { id: fixed.id, name: fixed.name, provisional: false, reason: 'Sistema elegido por el jugador.' };
  const own = board.history({ verbose: true }).filter(m => m.color === color);
  const firstWhite = board.history({ verbose: true }).find(m => m.color === 'w')?.san;
  const ranked = candidates.map(p => {
    let score = systemGoalScore(board, p.id) - systemGoalScore(new Chess(), p.id);
    if (p.id === (color === 'w' ? 'london' : 'kings-indian')) score += 1;
    if (color === 'w') {
      if (own[0]?.san === 'd4') score += ['london', 'queens-gambit'].includes(p.id) ? 15 : -20;
      if (own[0]?.san === 'e4') score += ['italian', 'spanish', 'scotch'].includes(p.id) ? 15 : -20;
      if (own[0]?.san === 'c4' && p.id === 'english') score += 20;
      if (own[0]?.san === 'Nf3' && p.id === 'reti') score += 8;
      if (own.some(m => m.san === 'c4') && own.some(m => m.san === 'd4') && p.id === 'queens-gambit') score += 35;
      if (own.some(m => m.piece === 'b' && m.to === 'f4') && p.id === 'london') score += 45;
      if (own.some(m => m.piece === 'b' && m.to === 'c4') && p.id === 'italian') score += 35;
      if (own.some(m => m.piece === 'b' && m.to === 'b5') && p.id === 'spanish') score += 35;
      if (firstWhite === 'e4' && board.get('c5')?.color === 'b' && ['italian', 'spanish', 'scotch'].includes(p.id)) score -= 40;
    } else {
      if (firstWhite === 'e4') score += ['sicilian', 'caro', 'french'].includes(p.id) ? 12 : -8;
      if (firstWhite === 'd4') score += ['kings-indian', 'slav'].includes(p.id) ? 12 : -8;
      if (own[0]?.san === 'c5' && p.id === 'sicilian') score += 40;
      if (own[0]?.san === 'c6' && p.id === 'caro' && firstWhite === 'e4') score += 40;
      if (own[0]?.san === 'e6' && p.id === 'french' && firstWhite === 'e4') score += 40;
    }
    if (lostSystemObjective(board, p.id)) score -= 45;
    return { preset: p, score };
  }).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const provisional = own.length < 2 || best.score - (ranked[1]?.score ?? 0) < 15;
  return { id: best.preset.id, name: best.preset.name, provisional,
    reason: provisional ? 'Esquema provisional compatible con la estructura; faltan indicios para confirmarlo.' : 'Identificado por estructura propia y desarrollo, no solo por la primera jugada.' };
}

// Bound tactical verification to a few candidates; workers do the expensive search.
export async function planSystem(board: Chess, id: string, analyze: SystemAnalyzer,
  options: { alternativeTo?: string; strictAlternative?: boolean; preferredMove?: string; cancelled?: () => boolean } = {}): Promise<SystemPlan | null> {
  const cancelled = options.cancelled || (() => false);
  if (board.isGameOver() || !isSystemCompatibleWithColor(id, board.turn())) return null;
  const details = SYSTEM_DETAILS_MAP[id];
  if (!details) return null;
  const fen = board.fen();
  const root = await analyze(fen);
  if (!root || cancelled()) return null;
  const before = systemGoalScore(board, id);
  const ranked = board.moves({ verbose: true }).map(move => {
    const next = new Chess(fen); next.move(move);
    return { move, next, uci: move.from + move.to + (move.promotion || ''), gain: systemGoalScore(next, id) - before };
  }).sort((a, b) => b.gain - a.gain);
  const principal = ranked.find(item => item.uci === root.uci);
  if (!principal) return null;
  const pool = ranked.filter(item => item.gain > 0 || item.move.san.includes('#')).slice(0, 3);
  if (!pool.includes(principal)) pool.push(principal);
  if (options.alternativeTo) {
    const main = ranked.find(item => item.uci === options.alternativeTo);
    if (main && !pool.includes(main)) pool.push(main);
  }
  const preferred = ranked.find(item => item.uci === options.preferredMove);
  if (preferred && !pool.includes(preferred)) pool.push(preferred);
  const evaluated: Array<typeof principal & { score: number; verified: boolean }> = [];
  for (const candidate of pool) {
    if (cancelled()) return null;
    if (candidate.next.isCheckmate()) { evaluated.push({ ...candidate, score: 100000, verified: true }); continue; }
    if (candidate.next.isDraw()) { evaluated.push({ ...candidate, score: 0, verified: true }); continue; }
    const reply = await analyze(candidate.next.fen());
    if (!reply) continue;
    evaluated.push({ ...candidate, score: reply.mate !== undefined ? (reply.mate > 0 ? -100000 : 100000) : -reply.scoreCp,
      verified: ['wasm', 'worker'].includes(reply.source || '') && ['wasm', 'worker'].includes(root.source || '') });
  }
  if (cancelled()) return null;
  const rootScore = root.mate !== undefined ? (root.mate > 0 ? 100000 : -100000) : root.scoreCp;
  const bestScore = Math.max(rootScore, ...evaluated.map(item => item.score));
  const safe = evaluated.filter(item => item.score >= bestScore - 70);
  const thematic = safe.filter(item => item.gain > 0);
  const choices = thematic.length ? thematic : safe;
  choices.sort((a, b) => b.gain - a.gain || b.score - a.score);
  const alternatives = choices.filter(item => item.uci !== options.alternativeTo);
  const strictChoices = alternatives.filter(item => item.verified && item.gain >= 0);
  if (options.strictAlternative && (!options.alternativeTo || !strictChoices.length)) return null;
  const chosen = options.strictAlternative ? strictChoices[0]
    : choices.find(item => item.uci === options.preferredMove) || alternatives[0] || choices[0];
  const selected = chosen || evaluated.filter(item => item.verified).sort((a, b) => b.score - a.score)[0]
    || { ...principal, score: rootScore, verified: false };
  const lost = lostSystemObjective(board, id) && !ranked.some(item => item.gain > 0);
  const unsafeGoals = evaluated.some(item => item.gain > 0 && item.verified) &&
    !evaluated.some(item => item.gain > 0 && item.verified && item.score >= bestScore - 100);
  const changeNeeded = selected.verified && rootScore < -100 && (lost || unsafeGoals);
  const status = lost && changeNeeded ? 'unrecoverable' : unsafeGoals ? 'defending' : selected.gain > 0 ? (ownDevelopmentStarted(board, details.color) ? 'recovering' : 'following') : 'defending';
  const target = details.goals.find(([square, type]) => square === selected.move.to && type === selected.move.piece);
  const reason = unsafeGoals ? 'Las continuaciones temáticas comprobadas pierden evaluación; esta respuesta prioriza la defensa de la posición.'
    : selected.gain > 0 ? target
      ? `${selected.move.san} desarrolla un objetivo de ${details.name} en ${target[0]}; se comparó la respuesta rival.`
      : `${selected.move.san} adapta el desarrollo o la estructura de ${details.name}; se comparó la respuesta rival.`
    : lost ? 'Falta una pieza esencial del esquema; atiende la posición mientras se evalúa un cambio.'
    : 'Defensa o maniobra temporal: no se ha comprobado una mejora segura del esquema.';
  return { fen, systemId: id, move: selected.uci, san: selected.move.san, scoreCp: selected.score,
    depth: root.depth, source: selected.verified ? root.source : root.source === 'fallback' ? 'fallback' : undefined,
    gain: selected.gain, status, reason: selected.verified ? reason : `Sin respuesta rival verificada; ${selected.move.san} es una continuación provisional del esquema.`,
    changeNeeded, rootScore, systemScore: evaluated.filter(item => item.gain > 0 && item.verified).reduce<number | null>((best, item) => best === null ? item.score : Math.max(best, item.score), null) };
}

function ownDevelopmentStarted(board: Chess, color: 'w' | 'b'): boolean {
  return board.history({ verbose: true }).filter(m => m.color === color).length >= 2;
}
