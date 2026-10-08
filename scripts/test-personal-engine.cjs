const fs = require('node:fs');
const assert = require('node:assert/strict');
require('tsx/cjs');
const { Chess } = require('chess.js');
const { HistoryAssistant } = require('../src/engine/personalAssistants.ts');
const { PlayerGraphSubEngine, BlunderShieldSubEngine } = require('../src/engine/personalSubEngines.ts');
const { runPersonalRecommendation, getPersonalEngineStatus } = require('../src/engine/personalEngine.ts');
function game(id, sans, sources = [], color = 'w') {
  const board = new Chess();
  return { id, playerColor: color, result: '1-0', openingName: 'Apertura de Peon de Rey', pgn: '',
    moves: sans.map((san, i) => {
      const fenBefore = board.fen();
      const move = board.move(san);
      return { ...move, fenBefore, ply: i + 1, source: sources[i] || 'MANUAL' };
    }) };
}
const assisted = game('assisted', ['e4', 'e5', 'Nf3'], ['STOCKFISH_ASSISTED', 'MANUAL', 'PERSONAL_ASSISTED']);
assert.equal(HistoryAssistant.analyzeAndDistill([assisted]).manualGamesCount, 0);
assert.equal(PlayerGraphSubEngine.buildGraph([assisted]).size, 0);
assert.equal(getPersonalEngineStatus({ gamesPlayed: 99 }, [assisted]).isUnlocked, false);
const personal = game('own', ['a3', 'e5', 'h3']);
const data = HistoryAssistant.analyzeAndDistill([personal]);
assert.equal(data.userMoves.length, 2);
assert.equal(data.distilledAutonomousMovesCount, 2);
assert.equal(data.discardedBookMovesCount, 0);
const e4 = game('same-id', ['e4']);
const d4 = game('same-id', ['d4']);
const key = new Chess().fen().split(' ').slice(0, 4).join(' ');
assert.ok(PlayerGraphSubEngine.buildGraph([e4]).get(key).movesChosen.e4);
assert.ok(PlayerGraphSubEngine.buildGraph([d4]).get(key).movesChosen.d4);
assert.equal(PlayerGraphSubEngine.buildGraph([]).size, 0);
const imported = { id: 'pgn', playerColor: 'w', result: '*', moves: [], pgn: '1. d4 d5 2. Nf3 *' };
assert.equal(HistoryAssistant.analyzeAndDistill([imported]).userMoves.length, 0);
assert.equal(PlayerGraphSubEngine.buildGraph([imported]).size, 0);
assert.equal(imported.moves.length, 0);
const profile = { gamesPlayed: 1 };
const tenE4 = Array.from({ length: 10 }, (_, i) => game('e4-' + i, ['e4']));
const tenD4 = Array.from({ length: 10 }, (_, i) => game('d4-' + i, ['d4']));
for (let count = 0; count < 10; count++) {
  const games = tenD4.slice(0, count);
  assert.equal(getPersonalEngineStatus({ gamesPlayed: 999 }, games).isUnlocked, false);
  assert.equal(runPersonalRecommendation({ chess: new Chess(), profile, games }), null);
}
assert.equal(getPersonalEngineStatus(profile, tenD4).isUnlocked, true);
const full = getPersonalEngineStatus(profile, tenD4, new Chess(), true);
assert.equal(Object.keys(full.subEngineReport.subEngineVerdicts).length, 8);
assert.equal(full.compiledDNA.engineReadiness.activeInBoard, true);
assert.equal(getPersonalEngineStatus(profile, tenD4.slice(0, 9), undefined, true).compiledDNA.engineReadiness.activeInBoard, false);
assert.equal(getPersonalEngineStatus(profile, Array(10).fill(d4)).isUnlocked, false);
assert.equal(getPersonalEngineStatus(profile, tenD4.map(g => ({ ...g, result: '*' }))).isUnlocked, false);
const recE4 = runPersonalRecommendation({ chess: new Chess(), profile, games: tenE4 });
const recD4 = runPersonalRecommendation({ chess: new Chess(), profile, games: tenD4 });
assert.equal(recE4.san, 'e4');
assert.equal(recD4.san, 'd4');
const agreement = runPersonalRecommendation({ chess: new Chess(), profile, games: tenD4, stockfishMoveSan: 'd4' });
assert.equal(agreement.san, recD4.san);
const tactical = new Chess('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1');
const before = tactical.fen();
const mate = runPersonalRecommendation({ chess: tactical, profile, games: tenE4 });
assert.ok(mate.san.includes('#'));
assert.equal(tactical.fen(), before);
assert.equal(getPersonalEngineStatus(profile, tenD4.slice(0, 9)).isUnlocked, false);
assert.equal(runPersonalRecommendation({ chess: new Chess(), profile, games: [] }), null);
const invalid = game('invalid', ['e4']); invalid.moves[0].san = 'Qh8#';
assert.equal(HistoryAssistant.analyzeAndDistill([invalid]).manualGamesCount, 0);
assert.equal(PlayerGraphSubEngine.buildGraph([invalid]).size, 0);
const blackStart = { id: 'black-start', playerColor: 'b', result: '0-1', moves: [{ san: 'e5', from: 'e7', to: 'e5', source: 'MANUAL', fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', thinkTime: 0 }] };
assert.equal(HistoryAssistant.analyzeAndDistill([blackStart]).userMoves.length, 1);
assert.equal(HistoryAssistant.analyzeAndDistill([blackStart]).averageThinkTime, 0);
for (const source of ['STOCKFISH_ASSISTED', 'GARBO_ASSISTED', 'RODENT_ASSISTED', 'MAIA_ASSISTED', 'PERSONAL_ASSISTED', 'BOOK']) {
  const games = tenD4.map(g => ({ ...g, moves: g.moves.map(m => ({ ...m, source })) }));
  assert.equal(getPersonalEngineStatus(profile, games).isUnlocked, false);
}
const knight = new Chess('4k3/8/8/3p4/8/8/5N2/4K3 w - - 0 1');
const shield = BlunderShieldSubEngine.audit(knight, knight.moves({ verbose: true }), data, 1);
assert.ok(shield.vetoMoves.some(m => m.san === 'Ne4'));
console.log('PASS: manual-only learning, book detection, cache edits/deletions, different histories, independent choice, mate priority, minor-piece protection, board preservation.');



