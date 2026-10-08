require('tsx/cjs');
const assert = require('node:assert/strict');
const { Chess } = require('chess.js');
const { buildTrapIndex, CLASSIC_TRAPS, findTraps, safeTrapScore } = require('../src/engine/trapHunter.ts');
const downloaded = require('../public/traps.json');
const index = buildTrapIndex([...CLASSIC_TRAPS, ...downloaded]);
for (const trap of CLASSIC_TRAPS) {
  const full = new Chess(); full.loadPgn(trap.pgn);
  const moves = full.history(); const winner = full.turn() === 'w' ? 'b' : 'w';
  const board = new Chess(); moves.slice(0, -1).forEach(m => board.move(m));
  const before = board.fen();
  const found = findTraps(index, board, winner).find(t => t.name === trap.name);
  assert.ok(found, trap.name); assert.equal(found.san, moves.at(-1));
  assert.equal(board.fen(), before); assert.equal(findTraps(index, board, winner === 'w' ? 'b' : 'w').length, 0);
  board.move(found.san); assert.ok(board.isCheckmate());
  console.log('PASS real legal mate sequence:', trap.name);
}
const pastor = new Chess(); ['e4','e5','Bc4','Nc6'].forEach(m => pastor.move(m));
assert.ok(findTraps(index, pastor, 'w').some(t => t.san === 'Qh5'));
pastor.move('Qh5'); pastor.move('g6');
assert.ok(!findTraps(index, pastor, 'w').some(t => t.name === 'Mate pastor'), 'Avoided trap must disappear');
const legal = new Chess(); ['e4','e5','Nf3','d6','Bc4','Bg4','Nc3','g6','Nxe5','Bxd1'].forEach(m => legal.move(m));
assert.ok(findTraps(index, legal, 'w').some(t => t.san === 'Bxf7+'));
assert.equal(safeTrapScore({scoreCp:30},{scoreCp:200}), false);
assert.equal(safeTrapScore({scoreCp:30},{scoreCp:-20}), true);
assert.equal(safeTrapScore({scoreCp:30},{mate:2}), false);
assert.equal(safeTrapScore({mate:1},{mate:-1}), true);
assert.equal(buildTrapIndex([{name:'invalid',pgn:'1. e4 e5',source:''}]).size,0);
assert.equal(downloaded.length,11);
for (const line of downloaded) { const board=new Chess(); board.loadPgn(line.pgn); assert.ok(board.isCheckmate()); }
console.log('PASS downloaded database, acceptance, avoidance, colors, board preservation and safety rejection.');
