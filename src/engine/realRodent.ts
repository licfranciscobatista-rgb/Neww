import { Chess } from 'chess.js';

export interface RodentAnalysis { uci: string; scoreCp: number; mate?: number; depth: number; pv: string; }

export class RealRodentManager {
  private worker: Worker | null = null;
  private nextId = 1;
  private jobs = new Map<number, { resolve: (result: RodentAnalysis | null) => void; timer: ReturnType<typeof setTimeout>; fen: string }>();

  analyze(fen: string, movetime = 150): Promise<RodentAnalysis | null> {
    const board = new Chess(fen);
    if (board.isGameOver()) return Promise.resolve(null);
    if (!this.worker) {
      try {
        this.worker = new Worker('/rodent/worker.js');
        this.worker.onerror = event => { console.warn('[Rodent] Worker error:', event.message); this.terminate(); };
        this.worker.onmessage = event => {
          const result = event.data;
          if (result.error) { console.warn('[Rodent] Analysis failed:', result.error); this.terminate(); return; }
          const job = this.jobs.get(result.id);
          if (!job) return;
          clearTimeout(job.timer); this.jobs.delete(result.id);
          try {
            if (result.error || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(result.uci)) throw new Error('Invalid Rodent result');
            new Chess(job.fen).move({ from: result.uci.slice(0, 2), to: result.uci.slice(2, 4), promotion: result.uci[4] });
            job.resolve(result);
          } catch { job.resolve(null); }
        };
      } catch { return Promise.resolve(null); }
    }
    return new Promise(resolve => {
      const id = this.nextId++;
      const timer = setTimeout(() => { console.warn('[Rodent] Analysis timed out'); this.terminate(); }, 12000);
      this.jobs.set(id, { resolve, timer, fen });
      try { this.worker!.postMessage({ id, fen, movetime }); }
      catch { this.terminate(); }
    });
  }

  terminate() {
    this.worker?.terminate(); this.worker = null;
    for (const job of this.jobs.values()) { clearTimeout(job.timer); job.resolve(null); }
    this.jobs.clear();
  }
}
