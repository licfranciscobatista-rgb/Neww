/**
 * Real Stockfish 19 WebAssembly Engine Integration via Web Worker.
 * Communicates over UCI protocol and runs completely offline in-browser or inside an APK.
 *
 * Diseño de concurrencia (importante):
 *  - El motor procesa UN solo `go` a la vez y responde con exactamente UN `bestmove` por cada `go`.
 *  - Si se envía un `go` nuevo mientras otro sigue activo, el motor lo descarta y la petición se
 *    queda sin respuesta; además, el `bestmove` de la búsqueda vieja se entregaría a la nueva.
 *  - Por eso las peticiones se ponen en cola y solo se manda un `go` cuando el anterior terminó.
 *    Las peticiones en cola de otra posición se descartan, y a la búsqueda activa de otra
 *    posición se le manda `stop` (el motor devuelve el mejor movimiento parcial al instante).
 */

import { Chess } from 'chess.js';
import { getDevicePerformanceProfile } from '../utils/devicePerformance';

export interface RealStockfishAnalysis {
  from: string;
  to: string;
  promotion?: string;
  uci: string;
  san: string;
  scoreCp?: number;
  depth?: number;
  mate?: number;
  evalDisplay: string;
  pv?: string;
  raw: string;
}

export interface AnalyzeOptions {
  movetime?: number;
  depth?: number;
  limitElo?: number;
}

interface SearchJob {
  fen: string;
  movetime: number;
  depth?: number;
  limitElo?: number;
  resolve: (result: RealStockfishAnalysis | null) => void;
  // Estado de la búsqueda en curso (se rellena con las líneas `info`)
  lastDepth: number;
  lastScoreCp: number;
  lastMate?: number;
  lastPv: string;
}

// Compilar y cargar el .wasm con límites estrictos para jamás colgar una tablet
const INIT_TIMEOUT_MS = 3500;
const MAX_INIT_ATTEMPTS = 2;
// Margen estricto sobre movetime antes de forzar fallback instantáneo
const SEARCH_SLACK_MS = 600;
const DEPTH_SEARCH_TIMEOUT_MS = 2500;
// Tiempo de espera tras stop
const STOP_GRACE_MS = 400;

class RealStockfishManager {
  private worker: Worker | null = null;
  private isInitialized = false;
  private initPromise: Promise<boolean> | null = null;
  private initAttempts = 0;

  private active: SearchJob | null = null;
  private queue: SearchJob[] = [];
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;

  // El .js de Stockfish ya funciona como worker por sí mismo; el .wasm se busca junto a él (mismo nombre).
  // No usar '#...,worker' en la URL: esa marca es para sub-workers internos y deja el motor inerte.
  private scriptUrl = '/stockfish/stockfish-19-lite-single.js';

  public async init(): Promise<boolean> {
    if (this.isInitialized && this.worker) return true;
    if (this.initPromise) return this.initPromise;
    if (this.initAttempts >= MAX_INIT_ATTEMPTS) return false;

    this.initAttempts++;
    const attempt: Promise<boolean> = this.startWorker().then((ok) => {
      // Si falló, se permite reintentar en la próxima petición (antes quedaba en "falso" para siempre).
      if (!ok && this.initPromise === attempt) this.initPromise = null;
      if (ok) this.initAttempts = 0;
      return ok;
    });
    this.initPromise = attempt;
    return attempt;
  }

  private startWorker(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      console.warn('[RealStockfish] Web Workers no disponibles en este entorno.');
      return Promise.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      let worker: Worker;
      try {
        worker = new Worker(this.scriptUrl);
      } catch (e) {
        console.warn('[RealStockfish] Falló inicialización del motor Stockfish real:', e);
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
          console.log('[RealStockfish] Motor Stockfish 19 WASM listo y operativo.');
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
        console.warn('[RealStockfish] Tiempo de espera agotado al inicializar Worker.');
        finish(false);
      }, INIT_TIMEOUT_MS);

      const onInitMessage = (e: MessageEvent) => {
        const line = typeof e.data === 'string' ? e.data.trim() : '';
        if (line === 'uciok') {
          const profile = getDevicePerformanceProfile();
          worker.postMessage(`setoption name Hash value ${profile.stockfishHashMb}`);
          worker.postMessage('setoption name Threads value 1');
          worker.postMessage('isready');
        } else if (line === 'readyok') {
          finish(true);
        }
      };

      const onInitError = (err: ErrorEvent) => {
        console.warn('[RealStockfish] Error en Worker de Stockfish:', err);
        finish(false);
      };

      worker.addEventListener('message', onInitMessage);
      worker.addEventListener('error', onInitError);
      worker.postMessage('uci');
    });
  }

  private attachRuntimeListeners(worker: Worker) {
    worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data.trim() : '';
      if (line) this.handleLine(line);
    };

    worker.onerror = (err) => {
      console.warn('[RealStockfish] Error en worker durante ejecución:', err);
      this.recover();
    };
  }

  private handleLine(line: string) {
    const job = this.active;
    if (!job) return;

    // Parsing UCI info: info depth 12 seldepth 16 score cp 45 nodes 12431 pv e2e4 e7e5 ...
    if (line.startsWith('info ') && line.includes('score ')) {
      const depthMatch = line.match(/\bdepth\s+(\d+)\b/);
      if (depthMatch) job.lastDepth = parseInt(depthMatch[1], 10);

      const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)\b/);
      if (cpMatch) {
        job.lastScoreCp = parseInt(cpMatch[1], 10);
        job.lastMate = undefined;
      }

      const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)\b/);
      if (mateMatch) job.lastMate = parseInt(mateMatch[1], 10);

      const pvMatch = line.match(/\bpv\s+([a-h1-8qrbn\s]+)/);
      if (pvMatch) job.lastPv = pvMatch[1].trim();
      return;
    }

    // Parsing bestmove: bestmove e2e4 ponder e7e5 or bestmove e7e8q
    if (line.startsWith('bestmove ')) {
      this.clearTimers();
      this.active = null;
      job.resolve(this.buildResult(job, line));
      this.pump();
    }
  }

  private buildResult(job: SearchJob, line: string): RealStockfishAnalysis | null {
    const bestmove = line.split(/\s+/)[1];
    if (!bestmove || bestmove === '(none)' || bestmove.length < 4) return null;

    const from = bestmove.slice(0, 2);
    const to = bestmove.slice(2, 4);
    const promotion = bestmove.length > 4 ? bestmove[4] : undefined;

    // Convert to SAN using chess.js
    let san = bestmove;
    try {
      const tempChess = new Chess(job.fen);
      const moveRes = tempChess.move({ from, to, promotion: promotion || 'q' });
      if (moveRes) san = moveRes.san;
    } catch {
      // Keep uci string as fallback
    }

    let evalDisplay: string;
    if (job.lastMate !== undefined) {
      evalDisplay = job.lastMate > 0 ? `#+${job.lastMate}` : `#-${Math.abs(job.lastMate)}`;
    } else {
      const evalNum = (job.lastScoreCp / 100).toFixed(1);
      evalDisplay = job.lastScoreCp > 0 ? `+${evalNum}` : `${evalNum}`;
    }

    return {
      from,
      to,
      promotion,
      uci: bestmove,
      san,
      scoreCp: job.lastScoreCp,
      depth: job.lastDepth,
      mate: job.lastMate,
      evalDisplay,
      pv: job.lastPv,
      raw: line,
    };
  }

  /** Lanza la siguiente búsqueda de la cola, solo si el motor está libre. */
  private pump() {
    if (this.active || this.queue.length === 0 || !this.worker) return;

    const job = this.queue.shift()!;
    this.active = job;

    if (job.limitElo && job.limitElo >= 1320 && job.limitElo <= 3190) {
      this.post('setoption name UCI_LimitStrength value true');
      this.post(`setoption name UCI_Elo value ${job.limitElo}`);
    } else {
      this.post('setoption name UCI_LimitStrength value false');
    }

    this.post(`position fen ${job.fen}`);
    this.post(job.depth ? `go depth ${job.depth}` : `go movetime ${job.movetime}`);

    // Vigilante: si el motor no responde, se le pide parar y, si sigue mudo, se reinicia el worker.
    const limitMs = job.depth ? DEPTH_SEARCH_TIMEOUT_MS : job.movetime + SEARCH_SLACK_MS;
    this.watchdogTimer = setTimeout(() => {
      if (this.active !== job) return;
      console.warn('[RealStockfish] Timeout en análisis, forzando stop.');
      this.post('stop');
      this.graceTimer = setTimeout(() => {
        if (this.active === job) this.recover();
      }, STOP_GRACE_MS);
    }, limitMs);
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
    if (this.graceTimer) clearTimeout(this.graceTimer);
    this.watchdogTimer = null;
    this.graceTimer = null;
  }

  /** El motor dejó de responder: se descartan las búsquedas y se reinicia el worker en la próxima petición. */
  private recover() {
    console.warn('[RealStockfish] Reiniciando worker del motor.');
    this.terminate();
  }

  public isReady(): boolean {
    return this.isInitialized && this.worker !== null;
  }

  public stop(): void {
    if (this.worker && this.active) this.post('stop');
  }

  public async analyze(
    fen: string,
    options: AnalyzeOptions = {}
  ): Promise<RealStockfishAnalysis | null> {
    const ready = await this.init();
    if (!ready || !this.worker) return null;

    return new Promise<RealStockfishAnalysis | null>((resolve) => {
      const job: SearchJob = {
        fen,
        movetime: options.movetime ?? 180,
        depth: options.depth,
        limitElo: options.limitElo,
        resolve,
        lastDepth: 0,
        lastScoreCp: 0,
        lastMate: undefined,
        lastPv: '',
      };

      // Las peticiones en cola de OTRA posición ya no sirven: se descartan.
      this.queue = this.queue.filter((queued) => {
        if (queued.fen === fen) return true;
        queued.resolve(null);
        return false;
      });
      this.queue.push(job);

      // Si la búsqueda activa es de otra posición, se acorta: `stop` devuelve su mejor jugada parcial ya.
      if (this.active && this.active.fen !== fen) this.post('stop');

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
        this.worker.postMessage('quit');
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

export const realStockfish = new RealStockfishManager();
