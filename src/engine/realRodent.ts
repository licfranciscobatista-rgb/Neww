import { Chess, type Square } from 'chess.js';

export interface RodentAnalysis {
  uci: string;
  scoreCp: number;
  mate?: number;
  depth: number;
  pv: string;
  from?: string;
  to?: string;
  san?: string;
  evalDisplay?: string;
  source?: 'wasm' | 'fallback';
}

// Valores de piezas para evaluación posicional instantánea de respaldo
const PIECE_VALS: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
const CENTER_SQS = new Set(['d4', 'e4', 'd5', 'e5', 'c4', 'f4', 'c5', 'f5']);

/**
 * Evaluador posicional y táctico de respaldo para Rodent IV:
 * Respaldo limitado: material, legalidad y capturas inmediatas; no sustituye una busqueda profunda.
 */
export function evaluateRodentFallback(fen: string, personality: 'agresivo' | 'solido' | 'dinamico' = 'dinamico'): RodentAnalysis | null {
  try {
    const board = new Chess(fen);
    if (board.isGameOver()) return null;
    const moves = board.moves({ verbose: true });
    if (moves.length === 0) return null;

    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const m of moves) {
      let score = 0;
      // 1. Mate en 1
      const testBoard = new Chess(fen);
      const res = testBoard.move(m);
      if (testBoard.isCheckmate()) {
        return {
          uci: `${m.from}${m.to}${m.promotion || ''}`,
          scoreCp: 100000,
          mate: 1,
          depth: 1,
          source: 'fallback',
          pv: m.san,
          from: m.from,
          to: m.to,
          san: m.san,
          evalDisplay: '#+1',
        };
      }

      const side = board.turn();
      for (const piece of testBoard.board().flat()) {
        if (piece && piece.type !== 'k') score += (piece.color === side ? 1 : -1) * PIECE_VALS[piece.type];
      }
      const recaptures = testBoard.moves({ verbose: true }).filter(reply => reply.captured);
      score -= Math.max(0, ...recaptures.map(reply => PIECE_VALS[reply.captured!]));
      // 2. Capturas con MVV-LVA
      if (m.captured) {
        const victimVal = PIECE_VALS[m.captured] || 100;
        const attackerVal = PIECE_VALS[m.piece] || 100;
        score += Math.min(25, victimVal * 0.05) - attackerVal * 0.01;
      }

      // 3. Jaques y amenazas
      if (testBoard.inCheck()) {
        score += personality === 'agresivo' ? 65 : 35;
      }

      // 4. Ocupación o control del centro
      if (CENTER_SQS.has(m.to)) {
        score += 25;
      }

      // 5. Desarrollo de piezas menores (caballos y alfiles)
      if (['n', 'b'].includes(m.piece)) {
        if (['1', '8'].includes(m.from[1])) score += 30; // Salir de la primera fila
      }

      // 6. Enroque
      if (m.san.includes('O-O')) {
        score += personality === 'solido' ? 50 : 35;
      }

      // 7. Moduladores de personalidad de Rodent
      if (personality === 'agresivo') {
        // Premiar avance hacia el rey rival
        const targetRank = parseInt(m.to[1], 10);
        score += board.turn() === 'w' ? targetRank * 4 : (9 - targetRank) * 4;
      } else if (personality === 'solido') {
        // Evitar dejar piezas colgadas
        if (!m.captured && CENTER_SQS.has(m.from)) score -= 10;
      } else {
        // Dinámico: movilidad y casillas de salto
        score += CENTER_SQS.has(m.to) ? 8 : 0;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = m;
      }
    }

    const uci = `${bestMove.from}${bestMove.to}${bestMove.promotion || ''}`;
    const scoreCp = Math.round(bestScore);
    const pawns = (scoreCp / 100).toFixed(1);
    const evalDisplay = scoreCp > 0 ? `+${pawns}` : pawns;

    return {
      uci,
      scoreCp,
      depth: 1,
      source: 'fallback',
      pv: bestMove.san,
      from: bestMove.from,
      to: bestMove.to,
      san: bestMove.san,
      evalDisplay,
    };
  } catch {
    return null;
  }
}

export class RealRodentManager {
  private worker: Worker | null = null;
  private nextId = 1;
  private hasRealResult = false;
  private jobs = new Map<number, { resolve: (result: RodentAnalysis | null) => void; timer: ReturnType<typeof setTimeout>; fen: string; personality: 'agresivo' | 'solido' | 'dinamico' }>();

  analyze(fen: string, movetime = 180, personality: 'agresivo' | 'solido' | 'dinamico' = 'dinamico'): Promise<RodentAnalysis | null> {
    const board = new Chess(fen);
    if (board.isGameOver()) return Promise.resolve(null);

    if (!this.worker && typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker('/rodent/worker.js');
        this.worker.onerror = event => {
          console.warn('[Rodent] Worker error, activando respaldo:', event.message);
          this.terminate();
        };
        this.worker.onmessage = event => {
          const result = event.data;
          const job = this.jobs.get(result.id);
          if (!job) return;
          clearTimeout(job.timer);
          this.jobs.delete(result.id);
          try {
            if (result.error || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(result.uci)) throw new Error('Invalid Rodent result');
            const c = new Chess(job.fen);
            const moveRes = c.move({ from: result.uci.slice(0, 2), to: result.uci.slice(2, 4), promotion: result.uci[4] });
            if (!moveRes) throw new Error('Illegal move');
            this.hasRealResult = true;
            const pawns = (result.scoreCp / 100).toFixed(1);
            job.resolve({
              ...result,
              source: 'wasm',
              from: moveRes.from,
              to: moveRes.to,
              san: moveRes.san,
              evalDisplay: result.scoreCp > 0 ? `+${pawns}` : pawns,
            });
          } catch {
            job.resolve(evaluateRodentFallback(job.fen, job.personality));
          }
        };
      } catch {
        return Promise.resolve(evaluateRodentFallback(fen, personality));
      }
    }

    if (!this.worker) {
      return Promise.resolve(evaluateRodentFallback(fen, personality));
    }

    return new Promise(resolve => {
      const id = this.nextId++;
      // Watchdog rápido (800ms) para garantizar fluidez sin esperas eternas
      const timer = setTimeout(() => {
        const job = this.jobs.get(id);
        if (job) {
          this.jobs.delete(id);
          resolve(evaluateRodentFallback(fen, personality));
        }
      }, this.hasRealResult ? 1200 : 5000);

      this.jobs.set(id, { resolve, timer, fen, personality });
      try {
        this.worker!.postMessage({ id, fen, movetime, personality });
      } catch {
        clearTimeout(timer);
        this.jobs.delete(id);
        resolve(evaluateRodentFallback(fen, personality));
      }
    });
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.hasRealResult = false;
    for (const job of this.jobs.values()) {
      clearTimeout(job.timer);
      job.resolve(evaluateRodentFallback(job.fen, job.personality));
    }
    this.jobs.clear();
  }
}

export const realRodent = new RealRodentManager();

