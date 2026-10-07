require('tsx/cjs');
const assert = require('node:assert/strict');
const { Chess } = require('chess.js');
const { continueLondon, londonGoals } = require('../src/engine/londonPlanner.ts');
const { ownMateSignal } = require('../src/engine/endgameSignals.ts');
assert.equal(ownMateSignal({ mate: 2 }, 'w', 'w'), true);
assert.equal(ownMateSignal({ mate: 2 }, 'b', 'w'), false);
assert.equal(ownMateSignal({ mate: -2 }, 'b', 'w'), true);
assert.equal(ownMateSignal({ mate: -2 }, 'w', 'w'), false);
assert.equal(ownMateSignal({ mate: 6 }, 'w', 'w'), false);
(async () => {
  const board = new Chess(); board.move('d4'); board.move('a6');
  const original = board.fen();
  const mock = async fen => {
    const current = new Chess(fen);
    const move = current.moves({ verbose: true })[0];
    return { uci: fen === original ? 'g1f3' : move.from + move.to, scoreCp: 0 };
  };
  const plan = await continueLondon(board, mock);
  assert.ok(plan);
  const next = new Chess(original); next.move({ from: plan.move.slice(0, 2), to: plan.move.slice(2, 4), promotion: plan.move[4] });
  assert.ok(londonGoals(next) > londonGoals(board));
  assert.equal(board.fen(), original);
  assert.equal(await continueLondon(board, async () => null), null);
  const danger = await continueLondon(board, async fen => fen === original ? { uci: 'g1f3', scoreCp: 0 } : { uci: 'a6a5', scoreCp: 100000, mate: 1 });
  assert.equal(danger.move, 'g1f3');
  const missingBaseline = await continueLondon(board, async fen => {
    if (fen === original) return { uci: 'g1f3', scoreCp: 0 };
    const position = new Chess(fen);
    if (position.get('f3')?.type === 'n') return null;
    return { uci: 'a6a5', scoreCp: 0 };
  });
  assert.equal(missingBaseline.move, 'g1f3');
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  let lines = [];
  const context = vm.createContext({ self: {}, postMessage: line => lines.push(line), console });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/garbo/garbochess.js'), 'utf8'), context);
  const realAnalyze = async fen => {
    lines = [];
    context.self.onmessage({ data: 'position ' + fen });
    context.self.onmessage({ data: 'search 100' });
    const uci = lines.find(line => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(line));
    const pv = lines.filter(line => line.startsWith('pv ')).at(-1);
    assert.ok(uci, 'Real Garbo must return a move');
    const score = Number(pv?.match(/Score:(-?\d+)/)?.[1] || 0);
    return { uci, scoreCp: Math.round(score / 10), ...(Math.abs(score) > 1998000 ? { mate: Math.sign(score) * Math.ceil((2000000 - Math.abs(score)) / 2) } : {}) };
  };
  for (const moves of [['d4', 'a6'], ['d4', 'e5'], ['d4', 'd5', 'Bf4', 'c5']]) {
    const position = new Chess();
    moves.forEach(move => position.move(move));
    const saved = position.fen();
    const adapted = await continueLondon(position, realAnalyze);
    assert.ok(adapted, 'Off-book London must continue');
    assert.ok(position.move({ from: adapted.move.slice(0, 2), to: adapted.move.slice(2, 4), promotion: adapted.move[4] }));
    position.undo();
    assert.equal(position.fen(), saved);
    console.log('PASS real Garbo:', moves.join(' '), '->', adapted.move);
  }
  console.log('PASS: London deviation, goal recovery, missing worker, mate rejection, board preservation and own-side mate filter.');
})().catch(error => { console.error(error); process.exitCode = 1; });
