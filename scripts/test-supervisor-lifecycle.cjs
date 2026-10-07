require('tsx/cjs');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { Chess } = require('chess.js');
const load = Module._load;
const sfJobs = [];
const maiaJobs = [];
Module._load = function(request, parent, main) {
  if (parent?.filename.endsWith('supervisor.ts')) {
    if (request === './controlDirector') return {
      controlDirector: { watchEngineExecution() {} },
      subDirector: { consultReadiness() {}, scheduleZeroLagFrame(fn) { fn(); } },
    };
    if (request === './realStockfish') return { realStockfish: { isReady: () => false, stop() {}, analyze: () => new Promise(resolve => sfJobs.push(resolve)) } };
    if (request === './realMaia') return { realMaia: { analyze: () => new Promise(resolve => maiaJobs.push(resolve)) } };
    if (request === './garboEngine') return { analyzeGarbo: async () => ({ rec: null, opening: {status:'free'} }) };
  }
  return load.call(this, request, parent, main);
};
const { ChessSupervisor } = require('../src/engine/supervisor.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));
const real = { uci:'e2e4', san:'e4', from:'e2', to:'e4', scoreCp:0, depth:5, evalDisplay:'0.0' };
const neural = { ...real, selfElo:1100, probability:0.6, win:0.4, draw:0.3, loss:0.3, candidates:[], ms:1 };
(async () => {
  const supervisor = new ChessSupervisor(() => {});
  const board = new Chess();
  const position = (id, chess = board, games = []) => supervisor.onPositionChange({ gameId:id, chess, games, profile:{gamesPlayed:0}, clockRemainingSeconds:600, averageUserMoveTime:0, userColor:'w', gameMode:'manual_board', showLinesMode:'my_turn_only' });
  position('first');
  assert.equal(maiaJobs.length, 1, 'Neural inference must be invoked after fallback publication');
  maiaJobs.shift()(neural); await tick();
  assert.ok(supervisor.getState().recommendations.maia.engineName.includes('red neuronal real'));
  for (let remaining = 2; remaining >= 0; remaining--) {
    const job = supervisor.requestStockfishUse(board);
    sfJobs.shift()(real); await job;
    assert.equal(supervisor.getState().stockfishRemainingUses, remaining);
  }
  await supervisor.requestStockfishUse(board);
  assert.equal(sfJobs.length, 0, 'Fourth limited consultation must not reach the engine');
  const generation = supervisor.getState().generation;
  supervisor.resetForNewGame('next');
  assert.ok(supervisor.getState().generation > generation, 'New games must invalidate previous engine results');
  assert.equal(supervisor.getState().stockfishRemainingUses, 3);
  position('next');
  const old = supervisor.requestStockfishUse(board);
  supervisor.setStockfishMode('off'); supervisor.setStockfishMode('per_request');
  const current = supervisor.requestStockfishUse(board);
  sfJobs.shift()(real); await old;
  assert.equal(supervisor.getState().loadingStates.stockfish, true, 'Cancelled result must not clear a newer request');
  sfJobs.shift()(real); await current;
  assert.equal(supervisor.getState().loadingStates.stockfish, false);
  board.move('e4'); position('next');
  assert.ok(Object.values(supervisor.getState().recommendations).every(rec => rec === null), 'Rival turn must not show recommendations from the previous position');
  const finish = new Chess('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1');
  const fenBefore = finish.fen(); const move = finish.move('Qg7#');
  const games = [{ id:'complete', result:'1-0', playerColor:'w', pgn:finish.pgn(), moves:[{...move, fenBefore, source:'MANUAL', thinkTime:1}] }];
  position('finished', finish, games);
  assert.equal(supervisor.getState().personalProgress, '1 / 10 partidas');
  while (maiaJobs.length) maiaJobs.shift()(neural);
  await tick();
  assert.equal(supervisor.getState().recommendations.maia, null, 'Late neural output must not overwrite a completed game');
  console.log('PASS: neural activation, three uses, exhausted limit, monotonic generations, rapid mode changes, stale results and terminal learning progress.');
})().catch(error => { console.error(error); process.exitCode = 1; });
