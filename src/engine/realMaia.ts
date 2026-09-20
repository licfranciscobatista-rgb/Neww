/**
 * Maia 3 real (red neuronal del CSSLab, Universidad de Toronto) ejecutada offline en un Web Worker.
 *
 * Los pesos NO van en el código: se cargan de /maia/maia3.json + /maia/maia3.bin, generados con
 * scripts/convert-maia3.py a partir del checkpoint oficial (.pt). Si esos archivos no existen, el motor
 * queda "no disponible" y la app sigue usando la simulación heurística de maiaEngine.ts.
 *
 * El worker (public/maia/maia-worker.js) solo hace la inferencia; la codificación del tablero y el filtrado
 * por jugadas legales se hacen aquí con chess.js (ver maiaEncoding.ts).
 */
import { Chess } from 'chess.js';
import { encodeFrame, legalMoveEntries, legalProbabilities, wdlFromValueLogits } from './maiaEncoding';

export interface RealMaiaCandidate {
  uci: string;
  san: string;
  from: string;
  to: string;
  promotion?: string;
  /** Probabilidad de que una persona de ese Elo juegue esta jugada (entre las legales). */
  prob: number;
}

export interface RealMaiaAnalysis {
  from: string;
  to: string;
  promotion?: string;
  uci: string;
  san: string;
  probability: number;
  candidates: RealMaiaCandidate[];
  /** Resultado esperado desde el punto de vista de quien mueve (suman 1). */
  win: number;
  draw: number;
  loss: number;
  selfElo: number;
  /** Duración de la inferencia en el worker. */
  ms: number;
}

export interface MaiaAnalyzeOptions {
  selfElo?: number;
  oppoElo?: number;
  /** 0 = jugada más probable (por defecto). */
  temperature?: number;
}

interface MaiaJob {
  id: number;
  fen: string;
  selfElo: number;
  oppoElo: number;
  temperature: number;
  chess: Chess;
  resolve: (r: RealMaiaAnalysis | null) => void;
}

// Cargar 80 MB de pesos y construir el modelo puede tardar en un móvil.
const INIT_TIMEOUT_MS = 120000;
const MAX_INIT_ATTEMPTS = 2;
const RUN_TIMEOUT_MS = 90000;

class RealMaiaManager {
  private worker: Worker | null = null;
  private isInitialized = false;
  private initPromise: Promise<boolean> | null = null;
  private initAttempts = 0;

  private active: MaiaJob | null = null;
  private queue: MaiaJob[] = [];
  private nextId = 1;
  private watchdog: ReturnType<typeof setTimeout> | null = null;

  /** Tamaño del modelo cargado (parámetros deducidos de la configuración). */
  public modelInfo: { dim: number; layers: number; heads: number } | null = null;
  public lastRunMs = 0;

  private workerUrl = '/maia/maia-worker.js';
  private manifestUrl = '/maia/maia3.json';
  private binUrl = '/maia/maia3.bin';

  public async init(): Promise<boolean> {
    if (this.isInitialized && this.worker) return true;
    if (this.initPromise) return this.initPromise;
    if (this.initAttempts >= MAX_INIT_ATTEMPTS) return false;

    this.initAttempts++;
    const attempt: Promise<boolean> = this.startWorker().then((ok) => {
      if (!ok && this.initPromise === attempt) this.initPromise = null;
      return ok;
    });
    this.initPromise = attempt;
    return attempt;
  }

  private startWorker(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') return Promise.resolve(false);

    return new Promise<boolean>((resolve) => {
      let worker: Worker;
      try {
        worker = new Worker(this.workerUrl);
      } catch (e) {
        console.warn('[RealMaia] No se pudo crear el worker:', e);
        resolve(false);
        return;
      }

      let settled = false;
      const finish = (ok: boolean, config?: { dim: number; layers: number; heads: number }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        worker.removeEventListener('message', onInit);
        worker.removeEventListener('error', onError);
        if (ok) {
          this.worker = worker;
          this.isInitialized = true;
          this.modelInfo = config ?? null;
          this.attachRuntimeListeners(worker);
          console.log('[RealMaia] Modelo Maia 3 cargado y listo.');
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
        console.warn('[RealMaia] Tiempo de espera agotado al cargar el modelo.');
        finish(false);
      }, INIT_TIMEOUT_MS);

      const onInit = (e: MessageEvent) => {
        const d = e.data;
        if (d?.type === 'ready') finish(true, d.config);
        else if (d?.type === 'error') {
          // Normalmente: los archivos del modelo no están instalados (opcional).
          console.info('[RealMaia] Modelo no disponible:', d.message);
          finish(false);
        }
      };
      const onError = (err: ErrorEvent) => {
        console.warn('[RealMaia] Error en el worker:', err);
        finish(false);
      };

      worker.addEventListener('message', onInit);
      worker.addEventListener('error', onError);
      worker.postMessage({ type: 'init', manifestUrl: this.manifestUrl, binUrl: this.binUrl });
    });
  }

  private attachRuntimeListeners(worker: Worker) {
    worker.onmessage = (e: MessageEvent) => {
      const d = e.data;
      const job = this.active;
      if (!job || !d || d.id !== job.id) return;

      if (d.type === 'result') {
        this.clearWatchdog();
        this.active = null;
        this.lastRunMs = d.ms;
        job.resolve(this.buildResult(job, d.move as Float32Array, d.value as Float32Array, d.ms));
        this.pump();
      } else if (d.type === 'error') {
        console.warn('[RealMaia] Error de inferencia:', d.message);
        this.clearWatchdog();
        this.active = null;
        job.resolve(null);
        this.pump();
      }
    };
    worker.onerror = (err) => {
      console.warn('[RealMaia] Error en el worker durante la ejecución:', err);
      this.terminate();
    };
  }

  private buildResult(job: MaiaJob, logits: Float32Array, value: Float32Array, ms: number): RealMaiaAnalysis | null {
    const entries = legalMoveEntries(job.chess);
    if (entries.length === 0) return null;

    const ranked = legalProbabilities(logits, entries, job.temperature > 0 ? job.temperature : 1);
    const top = ranked[0];
    const wdl = wdlFromValueLogits(value);

    return {
      from: top.from,
      to: top.to,
      promotion: top.promotion,
      uci: top.uci,
      san: top.san,
      probability: top.prob,
      candidates: ranked.slice(0, 5).map((c) => ({
        uci: c.uci,
        san: c.san,
        from: c.from,
        to: c.to,
        promotion: c.promotion,
        prob: c.prob,
      })),
      win: wdl.win,
      draw: wdl.draw,
      loss: wdl.loss,
      selfElo: job.selfElo,
      ms,
    };
  }

  private pump() {
    if (this.active || this.queue.length === 0 || !this.worker) return;

    const job = this.queue.shift()!;
    this.active = job;

    const frame = encodeFrame(job.chess);
    try {
      this.worker.postMessage(
        { type: 'run', id: job.id, frame, selfElo: job.selfElo, oppoElo: job.oppoElo },
        [frame.buffer]
      );
    } catch {
      this.active = null;
      job.resolve(null);
      return;
    }

    // La inferencia no se puede interrumpir: si el worker no responde, se reinicia.
    this.watchdog = setTimeout(() => {
      if (this.active === job) {
        console.warn('[RealMaia] El modelo no respondió a tiempo. Reiniciando el worker.');
        this.terminate();
      }
    }, RUN_TIMEOUT_MS);
  }

  private clearWatchdog() {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
  }

  public isReady(): boolean {
    return this.isInitialized && this.worker !== null;
  }

  public async analyze(fen: string, options: MaiaAnalyzeOptions = {}): Promise<RealMaiaAnalysis | null> {
    let chess: Chess;
    try {
      chess = new Chess(fen);
      if (chess.isGameOver()) return null;
    } catch {
      return null;
    }

    const ready = await this.init();
    if (!ready || !this.worker) return null;

    const selfElo = Math.round(options.selfElo ?? 1500);

    return new Promise<RealMaiaAnalysis | null>((resolve) => {
      const job: MaiaJob = {
        id: this.nextId++,
        fen,
        selfElo,
        oppoElo: Math.round(options.oppoElo ?? selfElo),
        temperature: options.temperature ?? 0,
        chess,
        resolve,
      };

      // Las peticiones en cola de OTRA posición o de otro Elo ya no sirven.
      this.queue = this.queue.filter((q) => {
        if (q.fen === fen && q.selfElo === selfElo) return true;
        q.resolve(null);
        return false;
      });
      this.queue.push(job);
      this.pump();
    });
  }

  public terminate(): void {
    this.clearWatchdog();
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

export const realMaia = new RealMaiaManager();
