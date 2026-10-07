require('tsx/cjs');
const assert = require('node:assert/strict');
const {matchesHistoryFilters} = require('../src/utils/historyFilters.ts');
const base = {title:'Prueba', openingName:'Gambito de Dama', date:'7/10/2026', playerColor:'b', result:'0-1'};
const filters = {search:'', color:'', result:'', date:''};
assert.equal(matchesHistoryFilters(base, filters), true);
for (const result of ['1-0','0-1','1/2-1/2','*']) for (const color of ['w','b']) {
  const expected = result === '1/2-1/2' ? 'draw' : result === '*' ? 'unfinished' : result === (color === 'w' ? '1-0' : '0-1') ? 'win' : 'loss';
  assert.equal(matchesHistoryFilters({...base, result, playerColor:color}, {...filters, result:expected, color}), true);
}
assert.equal(matchesHistoryFilters(base, {...filters, search:'  GÁMBITO  '}), true);
assert.equal(matchesHistoryFilters(base, {...filters, date:'otra fecha'}), false);
assert.equal(matchesHistoryFilters(base, {...filters, color:'w'}), false);
assert.equal(matchesHistoryFilters(base, {...filters, result:'loss'}), false);
assert.equal(matchesHistoryFilters(base, {...filters, search:'otro evento'}), false);
console.log('PASS: combined history filters, dates, accented search and outcomes for both colors.');
