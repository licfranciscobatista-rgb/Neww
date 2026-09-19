/**
 * Real Stockfish 19 WebAssembly Engine Integration via Web Worker.
 * Communicates over UCI protocol and runs completely offline in-browser or inside an APK.
 */

import { Chess } from 'chess.js';

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

class RealStockfishManager {
  private worker: Worker | null = null;
  private isInitialized = false;
  private isInitializing = false;
  private isBusy = false;
  private currentResolver: ((result: RealStockfishAnalysis | null) => void) | null = null;
  private currentFen = '';
  private lastDepth = 0;
  private lastScoreCp = 0;
  private lastMate: number | undefined = undefined;
  private lastPv = '';
  private initPromise: Promise<boolean> | null = null;
  private currentTimeout: NodeJS.Timeout | null = null;
  private scriptUrl = '/stockfish/stockfish-19-lite-single.js';

  public async init(): Promise<boolean> {
    if (this.isInitialized && this.worker) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.startWorker();
    return this.initPromise;
  }

  private async startWorker(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      console.warn('[RealStockfish] Web Workers no disponibles en este entorno.');
      return false;
    }

    this.isInitializing = true;

    try {
      // Intentar leer engine.json para confirmar ruta del script
      try {
        const resp = await fetch('/stockfish/engine.json');
        if (resp.ok) {
          const config = await resp.json();
          if (config && config.js) {
            this.scriptUrl = `/stockfish/${config.js}`;
          }
        }
      } catch {
        // Usar ruta por defecto
      }

      const worker = new Worker(this.scriptUrl);

      const readyPromise = new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('[RealStockfish] Tiempo de espera agotado al inicializar Worker.');
          resolve(false);
        }, 6000);

        const onInitMessage = (e: MessageEvent) => {
          const line = typeof e.data === 'string' ? e.data.trim() : '';
          if (line === 'uciok') {
            worker.postMessage('setoption name Hash value 20');
            worker.postMessage('isready');
          } else if (line === 'readyok') {
            clearTimeout(timeout);
            worker.removeEventListener('message', onInitMessage);
            this.setupMainListener(worker);
            this.worker = worker;
            this.isInitialized = true;
            this.isInitializing = false;
            console.log('[RealStockfish] Motor Stockfish 19 WASM listo y operativo.');
            resolve(true);
          }
        };

        worker.addEventListener('message', onInitMessage);
        worker.addEventListener('error', (err) => {
          console.warn('[RealStockfish] Error en Worker de Stockfish:', err);
          clearTimeout(timeout);
          resolve(false);
        });

        worker.postMessage('uci');
      });

      return await readyPromise;
    } catch (e) {
      console.warn('[RealStockfish] Falló inicialización del motor Stockfish real:', e);
      this.isInitializing = false;
      return false;
    }
  }

  private setupMainListener(worker: Worker) {
    worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data.trim() : '';
      if (!line) return;

      // Parsing UCI info: info depth 12 seldepth 16 score cp 45 nodes 12431 pv e2e4 e7e5 ...
      if (line.startsWith('info ') && line.includes('score ')) {
        const depthMatch = line.match(/\bdepth\s+(\d+)\b/);
        if (depthMatch) {
          this.lastDepth = parseInt(depthMatch[1], 10);
        }

        const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)\b/);
        if (cpMatch) {
          this.lastScoreCp = parseInt(cpMatch[1], 10);
          this.lastMate = undefined;
        }

        const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)\b/);
        if (mateMatch) {
          this.lastMate = parseInt(mateMatch[1], 10);
        }

        const pvMatch = line.match(/\bpv\s+([a-h1-8qrbn\s]+)/);
        if (pvMatch) {
          this.lastPv = pvMatch[1].trim();
        }
      }

      // Parsing bestmove: bestmove e2e4 ponder e7e5 or bestmove e7e8q
      if (line.startsWith('bestmove ')) {
        if (this.currentTimeout) {
          clearTimeout(this.currentTimeout);
          this.currentTimeout = null;
        }

        const parts = line.split(/\s+/);
        const bestmove = parts[1];

        this.isBusy = false;
        const resolver = this.currentResolver;
        this.currentResolver = null;

        if (!resolver) return;

        if (!bestmove || bestmove === '(none)' || bestmove.length < 4) {
          resolver(null);
          return;
        }

        const from = bestmove.slice(0, 2);
        const to = bestmove.slice(2, 4);
        const promotion = bestmove.length > 4 ? bestmove[4] : undefined;

        // Convert to SAN using chess.js
        let san = bestmove;
        try {
          const tempChess = new Chess(this.currentFen);
          const moveRes = tempChess.move({ from, to, promotion: promotion || 'q' });
          if (moveRes) {
            san = moveRes.san;
          }
        } catch {
          // Keep uci string as fallback
        }

        let evalDisplay = '+0.0';
        if (this.lastMate !== undefined) {
          evalDisplay = this.lastMate > 0 ? `#+${this.lastMate}` : `-${Math.abs(this.lastMate)}`;
        } else {
          const evalNum = (this.lastScoreCp / 100).toFixed(1);
          evalDisplay = this.lastScoreCp > 0 ? `+${evalNum}` : `${evalNum}`;
        }

        resolver({
          from,
          to,
          promotion,
          uci: bestmove,
          san,
          scoreCp: this.lastScoreCp,
          depth: this.lastDepth,
          mate: this.lastMate,
          evalDisplay,
          pv: this.lastPv,
          raw: line,
        });
      }
    };

    worker.onerror = (err) => {
      console.warn('[RealStockfish] Error en worker durante ejecución:', err);
      if (this.currentResolver) {
        this.currentResolver(null);
        this.currentResolver = null;
      }
      this.isBusy = false;
    };
  }

  public isReady(): boolean {
    return this.isInitialized && this.worker !== null;
  }

  public stop(): void {
    if (this.worker && this.isBusy) {
      try {
        this.worker.postMessage('stop');
      } catch {
        // ignore
      }
    }
  }

  public async analyze(
    fen: string,
    options: AnalyzeOptions = {}
  ): Promise<RealStockfishAnalysis | null> {
    const ready = await this.init();
    if (!ready || !this.worker) {
      return null;
    }

    // Stop current search if busy
    if (this.isBusy) {
      this.stop();
      if (this.currentResolver) {
        this.currentResolver(null);
        this.currentResolver = null;
      }
    }

    this.isBusy = true;
    this.currentFen = fen;
    this.lastDepth = 0;
    this.lastScoreCp = 0;
    this.lastMate = undefined;
    this.lastPv = '';

    const movetime = options.movetime ?? 600;
    const depth = options.depth;
    const limitElo = options.limitElo;

    return new Promise<RealStockfishAnalysis | null>((resolve) => {
      this.currentResolver = resolve;

      // Timeout safety: movetime + 2000ms
      const timeoutMs = Math.max(2500, movetime + 2500);
      this.currentTimeout = setTimeout(() => {
        console.warn('[RealStockfish] Timeout en análisis, forzando stop.');
        this.stop();
        if (this.currentResolver) {
          this.currentResolver(null);
          this.currentResolver = null;
        }
        this.isBusy = false;
      }, timeoutMs);

      // Configure Elo strength if requested
      if (limitElo && limitElo >= 1320 && limitElo <= 3190) {
        this.worker!.postMessage('setoption name UCI_LimitStrength value true');
        this.worker!.postMessage(`setoption name UCI_Elo value ${limitElo}`);
      } else {
        this.worker!.postMessage('setoption name UCI_LimitStrength value false');
      }

      this.worker!.postMessage(`position fen ${fen}`);

      if (depth) {
        this.worker!.postMessage(`go depth ${depth}`);
      } else {
        this.worker!.postMessage(`go movetime ${movetime}`);
      }
    });
  }

  public terminate(): void {
    if (this.worker) {
      try {
        this.worker.postMessage('quit');
        this.worker.terminate();
      } catch {
        // ignore
      }
      this.worker = null;
      this.isInitialized = false;
      this.isBusy = false;
    }
  }
}

export const realStockfish = new RealStockfishManager();
