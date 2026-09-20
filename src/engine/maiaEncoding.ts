/**
 * Codificación de tablero y jugadas para Maia 3 (equivale a maia3/dataset.py + maia3/utils.py).
 * Funciones puras (sin Worker) para poder probarlas por separado.
 *
 * Convención de Maia 3: el modelo siempre ve el tablero "desde Blancas". Si mueve Negras, el tablero se
 * refleja verticalmente y se intercambian los colores; las jugadas se reflejan igual (fila r -> 9 - r).
 */
import { Chess } from 'chess.js';

const PIECE_CHANNEL: Record<string, number> = { p: 0, n: 1, b: 2, r: 3, q: 4, k: 5 };
const PROMO_ORDER = 'qrbn';
export const MOVE_VOCAB_SIZE = 4352; // 64*64 jugadas + 8*8*4 promociones

/** 64 casillas x 12 canales (0-5 piezas de quien mueve, 6-11 piezas del rival). Índice = casilla*12 + canal. */
export function encodeFrame(chess: Chess): Float32Array {
  const frame = new Float32Array(64 * 12);
  const blackToMove = chess.turn() === 'b';
  const board = chess.board(); // filas de la 8 a la 1
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      let square = (7 - r) * 8 + c; // a1 = 0 ... h8 = 63
      // Con Negras al turno: reflejo vertical (casilla ^ 56) y colores intercambiados
      if (blackToMove) square ^= 56;
      // Tras el intercambio, el canal 0-5 es siempre "quien mueve"
      const isOpponent = piece.color !== chess.turn();
      frame[square * 12 + PIECE_CHANNEL[piece.type] + (isOpponent ? 6 : 0)] = 1;
    }
  }
  return frame;
}

function squareIndex(sq: string): number {
  return (parseInt(sq[1], 10) - 1) * 8 + (sq.charCodeAt(0) - 97);
}
function mirrorSquare(sq: string): string {
  return sq[0] + String(9 - parseInt(sq[1], 10));
}

export interface LegalMoveEntry {
  /** Posición en el vocabulario de 4352 jugadas del modelo. */
  index: number;
  from: string;
  to: string;
  promotion?: string;
  san: string;
  uci: string;
}

export function legalMoveEntries(chess: Chess): LegalMoveEntry[] {
  const black = chess.turn() === 'b';
  return chess.moves({ verbose: true }).map((m) => {
    const from = black ? mirrorSquare(m.from) : m.from;
    const to = black ? mirrorSquare(m.to) : m.to;
    const f = squareIndex(from);
    const t = squareIndex(to);
    const index = m.promotion
      ? 4096 + ((f % 8) * 8 + (t % 8)) * 4 + PROMO_ORDER.indexOf(m.promotion)
      : f * 64 + t;
    return { index, from: m.from, to: m.to, promotion: m.promotion, san: m.san, uci: m.from + m.to + (m.promotion ?? '') };
  });
}

/** Softmax solo sobre las jugadas legales. Devuelve las jugadas con su probabilidad, de mayor a menor. */
export function legalProbabilities(
  logits: Float32Array,
  entries: LegalMoveEntry[],
  temperature = 1
): Array<LegalMoveEntry & { prob: number }> {
  const t = temperature > 0 ? temperature : 1;
  let max = -Infinity;
  for (const e of entries) max = Math.max(max, logits[e.index] / t);
  let sum = 0;
  const w = entries.map((e) => {
    const v = Math.exp(logits[e.index] / t - max);
    sum += v;
    return v;
  });
  return entries.map((e, i) => ({ ...e, prob: w[i] / sum })).sort((a, b) => b.prob - a.prob);
}

/** [pierde, tablas, gana] desde el punto de vista de quien mueve. */
export function wdlFromValueLogits(v: Float32Array): { loss: number; draw: number; win: number } {
  const m = Math.max(v[0], v[1], v[2]);
  const e = [Math.exp(v[0] - m), Math.exp(v[1] - m), Math.exp(v[2] - m)];
  const s = e[0] + e[1] + e[2];
  return { loss: e[0] / s, draw: e[1] / s, win: e[2] / s };
}
