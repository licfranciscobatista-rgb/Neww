import { RealStockfishManager } from './realStockfish';
import { RealGarboManager } from './realGarbo';

export async function auditWorker(engine: 'stockfish' | 'garbo', fen: string) {
  const worker = engine === 'stockfish' ? new RealStockfishManager(8) : new RealGarboManager();
  try { return await worker.analyze(fen, { movetime: 150 }); }
  finally { worker.terminate(); }
}
