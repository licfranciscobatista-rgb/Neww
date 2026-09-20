/**
 * GarboChess real (Gary Linscott, JavaScript) ejecutado en un Web Worker.
 * Funciona 100 % offline: el motor es el archivo /garbo/garbochess.js, sin modificar.
 *
 * Protocolo del worker (propio de GarboChess, NO es UCI):
 *   -> "position <fen>"    reinicia el motor y coloca la posición
 *   -> "search <ms>"       busca durante <ms> milisegundos
 *   <- "pv Ply:N Score:S Nodes:.. NPS:.. <línea en SAN>"   una vez por profundidad completada
 *   <- "e2e4" (o "a7a8q")  la mejor jugada, al terminar la búsqueda
 *   <- "message <texto>"   error al leer la posición
 *
 * Notas de diseño:
 *  - La búsqueda de GarboChess es síncrona (bloquea su worker hasta cumplir el tiempo), así que no
 *    se puede interrumpir. Por eso se trabaja con una cola: una búsqueda activa a la vez y las
 *    peticiones en cola de otra posición se descartan (solo interesa la más reciente).
 *  - La puntuación va desde el punto de vista de quien mueve (como UCI), en unidades de ~10 por
 *    centipeón (una dama ≈ 9750). El mate se codifica como ±(2 000 000 − plies hasta el mate).
 *  - Antes de tocar el motor se valida la posición con chess.js: un FEN inválido hace lanzar una
 *    excepción al motor, y una posición sin jugadas legales lo deja sin responder.
 *  - La jugada que devuelve el motor se valida con chess.js; nunca se entrega una jugada ilegal.
 */

import { Chess } from 'chess.js';

export interface RealGarboAnalysis {
  from: string;
  to: string;
  promotion?: string;
  uci: string;
  san: string;
  /** Centipeones desde el punto de vista de quien mueve (±100000 si hay mate). */
  scoreCp: number;
  /** Jugadas hasta el mate (positivo: mata quien mueve; negativo: recibe mate). */
  mate?: number;
  depth: number;
  evalDisplay: string;
  pv?: string;
  raw: string;
}

export interface GarboAnalyzeOptions {
  movetime?: number;
}

interface GarboJob {
  fen: string;
  movetime: number;
  resolve: (result: RealGarboAnalysis | null) => void;
  invalid: boolean;
  depth: number;
  score: number;
  pv: string;
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const INIT_TIMEOUT_MS = 15000;
const MAX_INIT_ATTEMPTS = 3;
// La búsqueda de GarboChess puede pasarse del tiempo pedido; este margen evita falsos bloqueos.
const SEARCH_SLACK_MS = 5000;
const MAX_EVAL = 2000000;
const MATE_THRESHOLD = MAX_EVAL - 2000;
const CP_DIVISOR = 10;

class RealGarboManager {
  private worker: Worker | null = null;
  private isInitialized = false;
  private initPromise: Promise<boolean> | null = null;
  private initAttempts = 0;

  private active: GarboJob | null = null;
  private queue: GarboJob[] = [];
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;

  private scriptUrl = '/garbo/garbochess.js';

  public async init(): Promise<boolean> {
    if (this.isInitialized && this.worker) return true;
    if (this.initPromise) return this.initPromise;
    if (this.initAttempts >= MAX_INIT_ATTEMPTS) return false;

    this.initAttempts++;
    const attempt: Promise<boolean> = this.startWorker().then((ok) => {
      if (!ok && this.initPromise === attempt) this.initPromise = null;
      if (ok) this.initAttempts = 0;
      return ok;
    });
    this.initPromise = attempt;
    return attempt;
  }

  private startWorker(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      console.warn('[RealGarbo] Web Workers no disponibles en este entorno.');
      return Promise.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      let worker: Worker;
      try {
        worker = new Worker(this.scriptUrl);
      } catch (e) {
        console.warn('[RealGarbo] No se pudo crear el worker de GarboChess:', e);
        resolve(false);
        return;
      }

      let settled = false;

      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        worker.removeEventListener('message', onInitMessage);
        worker.removeEventListener('error', onInitError);
        if (ok) {
          this.worker = worker;
          this.isInitialized = true;
          this.attachRuntimeListeners(worker);
          console.log('[RealGarbo] Motor GarboChess listo y operativo.');
        } else {
          try {
            worker.terminate();
          } catch {
            // ignore
          }
        }
        resolve(ok);
      };

      const timeout = setTimeout(() => {
        console.warn('[RealGarbo] Tiempo de espera agotado al inicializar el worker.');
        finish(false);
      }, INIT_TIMEOUT_MS);

      // GarboChess no tiene "isready": se comprueba con una búsqueda mínima desde la posición inicial.
      const onInitMessage = (e: MessageEvent) => {
        const line = typeof e.data === 'string' ? e.data.trim() : '';
        if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(line)) finish(true);
      };

      const onInitError = (err: ErrorEvent) => {
        console.warn('[RealGarbo] Error en el worker de GarboChess:', err);
        finish(false);
      };

      worker.addEventListener('message', onInitMessage);
      worker.addEventListener('error', onInitError);
      worker.postMessage(`position ${START_FEN}`);
      worker.postMessage('search 20');
    });
  }

  private attachRuntimeListeners(worker: Worker) {
    worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data.trim() : '';
      if (line) this.handleLine(line);
    };
    worker.onerror = (err) => {
      console.warn('[RealGarbo] Error en el worker durante la ejecución:', err);
      this.recover();
    };
  }

  private handleLine(line: string) {
    const job = this.active;
    if (!job) return;

    if (line.startsWith('pv ')) {
      const m = line.match(/^pv Ply:(\d+) Score:(-?\d+) Nodes:\S+ NPS:\S+\s*(.*)$/);
      if (m) {
        job.depth = parseInt(m[1], 10);
        job.score = parseInt(m[2], 10);
        job.pv = m[3].trim();
      }
      return;
    }

    if (line.startsWith('message ')) {
      // El motor no entendió la posición. Aun así responderá a "search"; se espera esa respuesta
      // para no desalinear la cola y entonces se descarta el resultado.
      job.invalid = true;
      return;
    }

    if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(line)) {
      this.clearTimers();
      this.active = null;
      job.resolve(job.invalid ? null : this.buildResult(job, line));
      this.pump();
    }
  }

  private buildResult(job: GarboJob, moveStr: string): RealGarboAnalysis | null {
    const from = moveStr.slice(0, 2);
    const to = moveStr.slice(2, 4);
    const promotion = moveStr.length > 4 ? moveStr[4] : undefined;

    // Nunca se entrega una jugada que no sea legal en la posición analizada.
    let san: string;
    try {
      const chess = new Chess(job.fen);
      const move = chess.move({ from, to, promotion });
      if (!move) return null;
      san = move.san;
    } catch {
      return null;
    }

    let scoreCp = Math.round(job.score / CP_DIVISOR);
    let mate: number | undefined;
    let evalDisplay: string;

    if (Math.abs(job.score) >= MATE_THRESHOLD) {
      const plies = MAX_EVAL - Math.abs(job.score);
      mate = Math.sign(job.score) * Math.max(1, Math.ceil(plies / 2));
      scoreCp = Math.sign(job.score) * 100000;
      evalDisplay = mate > 0 ? `#+${mate}` : `#-${Math.abs(mate)}`;
    } else {
      const pawns = (scoreCp / 100).toFixed(1);
      evalDisplay = scoreCp > 0 ? `+${pawns}` : pawns;
    }

    return {
      from,
      to,
      promotion,
      uci: moveStr,
      san,
      scoreCp,
      mate,
      // Con mate encontrado el motor sigue iterando hasta 99; se informa la distancia real al mate.
      depth: mate !== undefined ? Math.abs(mate) * 2 : job.depth,
      evalDisplay,
      pv: job.pv,
      raw: moveStr,
    };
  }

  private pump() {
    if (this.active || this.queue.length === 0 || !this.worker) return;

    const job = this.queue.shift()!;
    this.active = job;

    this.post(`position ${job.fen}`);
    this.post(`search ${job.movetime}`);

    // Vigilante: la búsqueda no se puede interrumpir, así que si el worker no responde se reinicia.
    this.watchdogTimer = setTimeout(() => {
      if (this.active === job) {
        console.warn('[RealGarbo] El motor no respondió a tiempo.');
        this.recover();
      }
    }, job.movetime + SEARCH_SLACK_MS);
  }

  private post(command: string) {
    try {
      this.worker?.postMessage(command);
    } catch {
      // ignore
    }
  }

  private clearTimers() {
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    this.watchdogTimer = null;
  }

  private recover() {
    console.warn('[RealGarbo] Reiniciando el worker del motor.');
    this.terminate();
  }

  public isReady(): boolean {
    return this.isInitialized && this.worker !== null;
  }

  public async analyze(
    fen: string,
    options: GarboAnalyzeOptions = {}
  ): Promise<RealGarboAnalysis | null> {
    // Posición inválida o sin jugadas legales: el motor no debe recibirla.
    try {
      if (new Chess(fen).isGameOver()) return null;
    } catch {
      return null;
    }

    const ready = await this.init();
    if (!ready || !this.worker) return null;

    return new Promise<RealGarboAnalysis | null>((resolve) => {
      const job: GarboJob = {
        fen,
        movetime: options.movetime ?? 400,
        resolve,
        invalid: false,
        depth: 0,
        score: 0,
        pv: '',
      };

      // Las peticiones en cola de OTRA posición ya no sirven: se descartan.
      this.queue = this.queue.filter((queued) => {
        if (queued.fen === fen) return true;
        queued.resolve(null);
        return false;
      });
      this.queue.push(job);
      this.pump();
    });
  }

  public terminate(): void {
    this.clearTimers();

    const pending = [this.active, ...this.queue];
    this.active = null;
    this.queue = [];
    for (const job of pending) job?.resolve(null);

    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {
        // ignore
      }
    }
    this.worker = null;
    this.isInitialized = false;
    this.initPromise = null;
  }
}

export const realGarbo = new RealGarboManager();
