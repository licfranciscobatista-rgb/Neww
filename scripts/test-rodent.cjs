require('tsx/cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Chess } = require('chess.js');
const { OpeningIndex } = require('../src/engine/openingIndex.ts');
const { proposeSystem, followSystem } = require('../src/engine/rodentAdvisor.ts');
const { systemReply } = require('../src/engine/systemReply.ts');
const folder = path.join(__dirname, '../public/rodent');
const context = { module: { exports: {} }, require, process, __dirname: folder, __filename: path.join(folder, 'rodent.js'), console, Buffer, setTimeout, clearTimeout, TextDecoder, TextEncoder, WebAssembly, URL, performance };
vm.runInNewContext(fs.readFileSync(path.join(folder, 'rodent.js'), 'utf8'), context);
(async () => {
  let lines = [];
  const engine = await context.RodentModule({ wasmBinary: fs.readFileSync(path.join(folder, 'rodent.wasm')), print: line => lines.push(line), printErr: console.error });
  engine.ccall('rodent_init', null, [], []);
  const analyze = async fen => {
    lines = [];
    engine.ccall('rodent_command', null, ['string'], ['position fen ' + fen]);
    engine.ccall('rodent_command', null, ['string'], ['go movetime 150']);
    const best = lines.find(line => line.startsWith('bestmove '));
    assert.ok(best, 'Actual Rodent must finish searching');
    const uci = best.split(/\s+/)[1];
    const info = lines.filter(line => /score (cp|mate)/.test(line)).at(-1) || '';
    const score = info.match(/score (cp|mate) (-?\d+)/);
    const mate = score?.[1] === 'mate' ? Number(score[2]) : undefined;
    const result = { uci, scoreCp: mate !== undefined ? Math.sign(mate) * 100000 : Number(score?.[2] || 0), mate, depth: Number(info.match(/depth (\d+)/)?.[1] || 0), pv: info.split(' pv ')[1] || '' };
    assert.ok(new Chess(fen).move({ from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] }));
    return result;
  };
  const entries = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/openings/catalogue.json'), 'utf8'));
  const index = new OpeningIndex(entries); entries.forEach((_, i) => index.add(i));
  const query = async (fen, id, history) => index.choose(fen, id, history);
  for (const [moves, planned] of [[['d4', 'a6'], 'c1f4'], [['d4', 'd5'], 'c2c4'], [['d4', 'd5', 'c4', 'e6'], 'b1c3']]) {
    const example = new Chess(); moves.forEach(move => example.move(move));
    const before = example.fen();
    const warning = await systemReply(example, planned, analyze, planned === 'c1f4' ? 'london' : 'queens-gambit');
    if (warning) assert.ok(warning.text.includes('posible respuesta'));
    if (warning?.arrow) {
      const replyBoard = new Chess(before);
      replyBoard.move({ from: planned.slice(0, 2), to: planned.slice(2, 4), promotion: planned[4] });
      assert.ok(replyBoard.move(warning.arrow), 'Rival arrow must be legal after the recommended move');
    }
    assert.equal(example.fen(), before);
    console.log('PASS system reply example:', moves.join(' '), warning);
  }
  for (const [system, moves, uci] of [
    ['london', ['d4', 'd5', 'Bf4'], 'c7c5'],
    ['italian', ['e4', 'e5', 'Bc4'], 'g8f6'],
    ['queens-gambit', ['d4', 'd5', 'c4'], 'd5c4'],
  ]) {
    const position = new Chess(); moves.forEach(move => position.move(move));
    const warning = await systemReply(position, null, async () => ({ uci, scoreCp: 0, depth: 5, pv: '' }), system);
    assert.equal(warning?.arrow?.from + warning?.arrow?.to, uci);
    console.log('PASS system-specific interference:', system, warning.text);
  }
  const quiet = new Chess(); quiet.move('d4');
  const reportedPosition = new Chess('r2qkbnr/ppp1pppp/2n5/3p4/3P1Bb1/5N2/PPPNPPPP/R2QKB1R b KQkq - 3 4');
  const reportedWarning = await systemReply(reportedPosition, null, analyze, 'london');
  console.log('Reported position warning:', reportedWarning);
  assert.ok(reportedWarning?.arrow, 'Reported London position must detect a verified interference');
  const unavailableWarning = await systemReply(reportedPosition, null, async () => null, 'london');
  assert.ok(unavailableWarning?.arrow, 'System interference must not disappear when search is unavailable');
  const inferiorWarning = await systemReply(reportedPosition, null, async fen => ({ uci: 'a7a6', scoreCp: fen === reportedPosition.fen() ? 5000 : 0, depth: 1, pv: '' }), 'london');
  assert.ok(inferiorWarning?.arrow, 'General evaluation must not suppress a system threat');
  assert.equal(require('../src/engine/systemObjectives.ts').systemInterference(quiet, 'london', { from: 'g8', to: 'f6' }), null);
  const { lostSystemObjective } = require('../src/engine/systemObjectives.ts');
  assert.equal(lostSystemObjective(quiet, 'london'), false);
  const missingBishop = new Chess(); missingBishop.remove('c1');
  assert.equal(lostSystemObjective(missingBishop, 'london'), true);
  missingBishop.put({ type: 'b', color: 'w' }, 'f4');
  assert.equal(lostSystemObjective(missingBishop, 'london'), false);
  const mateBoard = new Chess('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1');
  const mate = await analyze(mateBoard.fen());
  assert.equal(mate.mate, 1);
  console.log('PASS real Rodent mate:', mate.uci, 'depth', mate.depth);
  const board = new Chess(); board.move('d4'); board.move('d5');
  const fen = board.fen();
  const independentProposal = await proposeSystem(board, 'london', undefined, analyze, query);
  const compared = await proposeSystem(board, 'london', 'c1f4', analyze, query);
  console.log('Compared with Garbo Bf4:', compared);
  const proposal = independentProposal || compared;
  assert.equal(board.fen(), fen);
  console.log('Real Rodent proposal:', proposal);
  if (proposal) assert.ok(proposal.comparisonCp >= -15, 'Only comparable alternatives may be offered');
  const followed = await followSystem(board, proposal?.id || 'queens-gambit', analyze, query);
  assert.ok(followed);
  console.log('PASS following accepted system:', proposal?.name || 'Gambito de Dama', followed);
  assert.equal(await proposeSystem(board, 'london', undefined, analyze, query, () => true), null);
  assert.equal(await proposeSystem(board, 'london', undefined, async () => null, query), null);
  const losingReply = async fen => ({ uci: 'a7a6', scoreCp: fen === board.fen() ? 0 : 100000, mate: fen === board.fen() ? undefined : 1, depth: 5, pv: '' });
  assert.equal(await proposeSystem(board, 'london', undefined, losingReply, query), null);
  for (let i = 0; i < 12; i++) {
    const repeat = await analyze(i % 2 ? board.fen() : new Chess().fen());
    assert.ok(repeat.uci);
  }
  console.log('PASS: twelve consecutive searches without memory corruption.');
  console.log('PASS: real WASM engine, mate, reachable proposal, accepted continuation, cancellation, unavailable engine and board preservation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
