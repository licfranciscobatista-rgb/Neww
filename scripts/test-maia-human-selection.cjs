require('tsx/cjs');
const assert = require('node:assert/strict');
const { Chess } = require('chess.js');
const { runMaiaRecommendation } = require('../src/engine/maiaEngine.ts');
for (const elo of [500, 1100, 1900, 2400]) {
  const board = new Chess();
  const fen = board.fen();
  const recommendation = runMaiaRecommendation(board, elo);
  assert.equal(board.fen(), fen);
  assert.ok(recommendation.humanProbability > 0 && recommendation.humanProbability <= 1);
  assert.ok(board.move({ from: recommendation.from, to: recommendation.to }));
}
const mate = new Chess('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1');
const mateFen = mate.fen();
const choice = runMaiaRecommendation(mate, 1100);
assert.ok(choice.san.includes('#'), 'Immediate mate must take priority');
assert.equal(mate.fen(), mateFen);
assert.equal(choice.move, choice.from + choice.to);
const promotion = new Chess('7k/P7/6K1/8/8/8/8/8 w - - 0 1');
const promoted = runMaiaRecommendation(promotion, 1100);
assert.ok(promotion.move({ from: promoted.from, to: promoted.to, promotion: promoted.move[4] }));
console.log('PASS: Maia legal choices, Elo range, probability bounds, mate priority, promotions and board preservation.');
