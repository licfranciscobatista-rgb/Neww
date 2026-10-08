require('tsx/cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Chess } = require('chess.js');
const { runSystemAssistants } = require('../src/engine/systemAssistants.ts');
const { planSystem } = require('../src/engine/systemsCoordinator.ts');
const { systemInterference } = require('../src/engine/systemObjectives.ts');
const { validateSystemPreferences, favoriteForColor, canTransitionSystem } = require('../src/engine/systemPreferences.ts');
const folder = path.join(__dirname, '../public/rodent');
const context = { module: { exports: {} }, require, process, __dirname: folder, console, Buffer, setTimeout, clearTimeout, TextDecoder, TextEncoder, WebAssembly, URL, performance };
vm.runInNewContext(fs.readFileSync(path.join(folder, 'rodent.js'), 'utf8'), context);
(async () => {
  const preferences = validateSystemPreferences({ white: 'london', black: 'london', transitionMoves: 99 });
  assert.equal(favoriteForColor(preferences, 'b'), 'kings-indian');
  assert.equal(preferences.transitionMoves, 12);
  assert.equal(canTransitionSystem(new Chess().fen(), 7), true);
  assert.equal(canTransitionSystem(new Chess().fen().replace(/ 1$/, ' 8'), 7), false);
  let lines = [];
  const engine = await context.RodentModule({ wasmBinary: fs.readFileSync(path.join(folder, 'rodent.wasm')), print: line => lines.push(line), printErr: console.error });
  engine.ccall('rodent_init', null, [], []);
  const analyze = async fen => {
    lines = [];
    engine.ccall('rodent_command', null, ['string'], ['position fen ' + fen]);
    engine.ccall('rodent_command', null, ['string'], ['go movetime 60']);
    const best = lines.find(line => line.startsWith('bestmove '));
    const info = lines.filter(line => /score (cp|mate)/.test(line)).at(-1) || '';
    const score = info.match(/score (cp|mate) (-?\d+)/);
    return { uci: best.split(/\s+/)[1], scoreCp: score?.[1] === 'cp' ? Number(score[2]) : 0,
      mate: score?.[1] === 'mate' ? Number(score[2]) : undefined, depth: Number(info.match(/depth (\d+)/)?.[1] || 0), source: 'wasm' };
  };
  for (const [moves, color, system, main] of [
    [['d4', 'a6'], 'w', 'london', 'c1f4'],
    [['d4', 'd5', 'Bf4', 'c5'], 'w', 'london', 'g1f3'],
    [['d4'], 'b', 'kings-indian', 'g8f6'],
  ]) {
    const board = new Chess(); moves.forEach(move => board.move(move));
    const before = board.fen(), history = board.pgn();
    const seen = new Set();
    const scores = new Map();
    const result = await runSystemAssistants(board, color, system, main, async fen => {
      assert.ok(!seen.has(fen), 'Duplicate searches must be cached'); seen.add(fen);
      const score = await analyze(fen); scores.set(fen, score); return score;
    }, { gameId: 'test', budgetMs: 20000 });
    assert.equal(board.fen(), before); assert.equal(board.pgn(), history);
    assert.equal(result.loading, false); assert.equal(result.helpers.length, 6);
    assert.ok(result.helpers.every(helper => helper.status !== 'calculating'));
    assert.ok(result.currentPlan?.source === 'wasm');
    if (result.alternative) { assert.notEqual(result.alternative.move, main); assert.equal(result.alternative.source, 'wasm'); }
    if (!result.threat) {
      assert.equal(result.helpers.find(helper => helper.id === 'rival').status, 'limited');
      assert.match(result.helpers.find(helper => helper.id === 'rival').detail, /búsqueda real/);
      console.log('PASS real system helpers:', system, 'No sufficiently sound rival interference: no forced arrow.');
      continue;
    }
    assert.equal(result.threat.uci, scores.get(result.threat.rivalFen).uci, 'Display the rival engine bestmove, never a system-filtered substitute');
    const future = new Chess(before); future.move({ from: main.slice(0, 2), to: main.slice(2, 4) });
    assert.equal(result.threat.rivalFen, future.fen(), 'Forecast follows Garbo, not Rodent');
    assert.ok(future.move({ from: result.threat.uci.slice(0, 2), to: result.threat.uci.slice(2, 4), promotion: result.threat.uci[4] }));
    assert.equal(result.threat.afterFen, future.fen());
    assert.ok(result.threat.recovery?.source === 'wasm', 'Calculate a recovery before interference happens');
    console.log('PASS real system helpers:', system, moves.join(' '), { main, alternative: result.alternative?.san, rival: result.threat.san, recovery: result.threat.recovery.san, searches: result.searches });
    board.move({ from: main.slice(0, 2), to: main.slice(2, 4) });
    board.move({ from: result.threat.uci.slice(0, 2), to: result.threat.uci.slice(2, 4), promotion: result.threat.uci[4] });
    const actual = await runSystemAssistants(board, color, system, undefined, analyze, { gameId: 'test', previous: result, maxSearches: 1 });
    assert.equal(actual.actualReply?.predicted, true);
    assert.equal(actual.helpers.find(helper => helper.id === 'coordination').status, 'limited');
  }
  const board = new Chess(); board.move('d4'); board.move('a6');
  const reported = new Chess('rnb1kbnr/1p1ppppp/pq6/8/5B2/4PN2/PPPN2PP/R2QKB1R b KQkq - 2 6');
  assert.match(systemInterference(reported, 'london', { from: 'b6', to: 'b2' }), /material propio en b2/);
  const unrestricted = await runSystemAssistants(reported, 'w', 'london', undefined, analyze, {
    rivalEngineName: 'Stockfish', rivalAnalyzer: async () => ({ uci: 'b6a5', scoreCp: 0, depth: 10, source: 'wasm' }),
  });
  assert.equal(unrestricted.threat.uci, 'b6a5', 'The opponent search is independent of the selected system');
  assert.match(unrestricted.threat.reason, /Stockfish/);
  const reportedResult = await runSystemAssistants(reported, 'w', 'london', undefined, analyze, { budgetMs: 20000 });
  assert.ok(reportedResult.threat, 'Inspect threats outside the original formation in the reported position');
  console.log('PASS reported position:', reportedResult.threat.san, reportedResult.threat.reason);
  const rivalPosition = new Chess(); rivalPosition.move('d4');
  const badForRival = await runSystemAssistants(rivalPosition, 'w', 'london', undefined, async fen => {
    const position = new Chess(fen), move = position.moves({ verbose: true })[0];
    return { uci: position.turn() === 'b' ? 'c7c5' : move.from + move.to,
      scoreCp: position.turn() === 'b' ? 50 : 300, depth: 8, source: 'wasm' };
  });
  assert.equal(badForRival.threat.uci, 'c7c5', 'Follow the actual rival bestmove rather than a structural ranking');
  const fallback = await runSystemAssistants(board, 'w', 'london', 'c1f4', async fen => ({ ...await analyze(fen), source: 'fallback' }));
  assert.equal(fallback.alternative, null); assert.equal(fallback.threat, null); assert.equal(fallback.proposal, null);
  assert.equal(await runSystemAssistants(board, 'w', 'london', 'c1f4', analyze, { cancelled: () => true }), null);
  assert.equal(await planSystem(board, 'london', analyze, { strictAlternative: true }), null);
  const onlyMain = await planSystem(new Chess(), 'london', async fen => {
    const position = new Chess(fen), root = position.turn() === 'w';
    const move = position.moves({ verbose: true })[0];
    return { uci: root ? 'd2d4' : move.from + move.to, scoreCp: root ? 100 : position.get('d4')?.color === 'w' ? -100 : 500, depth: 4, source: 'wasm' };
  }, { alternativeTo: 'd2d4', strictAlternative: true });
  assert.equal(onlyMain, null, 'Do not invent a second recommendation if only Garbo meets the safety threshold');
  const endangered = new Chess(); endangered.move('d4'); endangered.move('d5');
  const controlled = async fen => {
    const position = new Chess(fen), move = position.moves({ verbose: true })[0];
    if (!move) return null;
    return { uci: move.from + move.to + (move.promotion || ''), scoreCp: position.turn() === 'w' ? -200 : position.get('c4')?.color === 'w' ? 0 : 500, depth: 4, source: 'wasm' };
  };
  const transition = await runSystemAssistants(endangered, 'w', 'london', 'c1f4', controlled);
  assert.ok(transition.currentPlan.changeNeeded);
  assert.ok(transition.proposal, 'A reachable safer system must be proposed during opening');
  assert.equal(transition.systemId, 'london', 'A proposal never silently changes the active system');
  assert.equal(transition.proposal.sourceSystem, 'london');
  const late = new Chess(endangered.fen().replace(/ 2$/, ' 8'));
  const closed = await runSystemAssistants(late, 'w', 'london', 'c1f4', controlled);
  assert.equal(closed.phase, 'continuation'); assert.equal(closed.proposal, null);
  console.log('PASS: controlled transition proposal is manual and closes after fullmove 7.');
  const done = new Chess('7k/8/8/8/8/8/8/K7 w - - 0 8');
  const terminal = await runSystemAssistants(done, 'w', 'london', undefined, () => { throw Error('No search after game over'); });
  assert.equal(terminal.searches, 0); assert.equal(terminal.phase, 'continuation');
  console.log('PASS: strict alternatives, real rival forecasts and recovery, cache, cancellation, budget, colors, phase and fallback provenance.');
})().catch(error => { console.error(error); process.exitCode = 1; });
