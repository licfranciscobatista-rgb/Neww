import { Chess } from 'chess.js';
import { auditWorker } from './auditWorkers';
import { RealRodentManager } from './realRodent';
import { realMaia } from './realMaia';
import { runMaiaRecommendation } from './maiaEngine';
import { auditAllAssistantsHealth } from './personalAssistants';
import type { GameReadinessReport } from './controlDirector';

export async function verifyStartup(base: GameReadinessReport): Promise<GameReadinessReport> {
  const started = performance.now();
  const board = new Chess();
  const issues: string[] = [];
  const engines = { ...base.engines };
  for (const name of ['stockfish', 'garbo'] as const) {
    let result = null;
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      try { result = await auditWorker(name, board.fen()); } catch { /* Retry with a fresh worker. */ }
    }
    engines[name] = { ...engines[name], isInstalled: !!result, isOperational: !!result, status: result ? `Worker verificado: ${result.san}` : 'Worker no disponible' };
    if (!result) issues.push(`${engines[name].name}: no respondio; los demas motores siguen disponibles.`);
  }
  const rodent = new RealRodentManager();
  try {
    if (!await rodent.analyze(board.fen())) issues.push('Rodent: no respondio; sin cambio de sistema verificado.');
  } catch { issues.push('Rodent: error al cargar.'); }
  finally { rodent.terminate(); }
  let neural = null;
  try { neural = await realMaia.analyze(board.fen(), { selfElo: 1100 }); } catch { /* Report fallback explicitly. */ }
  const fallback = neural ? null : runMaiaRecommendation(board, 1100);
  engines.maia = { ...engines.maia, isInstalled: !!(neural || fallback), isOperational: !!(neural || fallback), status: neural ? 'Modelo neuronal verificado' : fallback ? 'Respaldo heuristico verificado; modelo neuronal no disponible' : 'Maia no disponible' };
  if (!neural) issues.push(engines.maia.status);
  const personalOk = auditAllAssistantsHealth().every(assistant => assistant.isHealthy);
  engines.personal = { ...engines.personal, isInstalled: personalOk, isOperational: personalOk, status: personalOk ? 'Ocho ayudantes verificados; calibracion independiente de instalacion' : 'Fallo en los ayudantes' };
  if (!personalOk) issues.push('Personal: fallo en los ayudantes.');
  return { ...base, ready: true, engines, verificationComplete: true, startupIssues: issues,
    allEnginesOk: issues.length === 0, latencyMs: Math.round(performance.now() - started),
    message: issues.length ? `Verificacion terminada. ${issues.join(' ')}` : 'Stockfish, Garbo, Rodent, Maia y ayudantes verificados mediante ejecucion.' };
}
