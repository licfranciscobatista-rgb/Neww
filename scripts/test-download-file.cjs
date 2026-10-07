require('tsx/cjs');
const assert = require('node:assert/strict');
const { downloadFile } = require('../src/utils/downloadFile.ts');
const events = [];
let blob;
let cleanup;
let anchor;
global.document = {
  createElement: () => (anchor = {
    click: () => events.push('click'),
    remove: () => events.push('remove'),
  }),
  body: { appendChild: () => events.push('append') },
};
global.URL.createObjectURL = value => { blob = value; return 'blob:test'; };
global.URL.revokeObjectURL = url => events.push(`revoke:${url}`);
global.setTimeout = (callback, delay) => { cleanup = callback; assert.equal(delay, 30000); };
(async () => {
  downloadFile('1. e4 e5 *', 'application/x-chess-pgn', 'test:/game.pgn');
  assert.deepEqual(events, ['append', 'click', 'remove']);
  assert.equal(anchor.download, 'test__game.pgn');
  assert.equal(anchor.href, 'blob:test');
  assert.equal(await blob.text(), '1. e4 e5 *');
  assert.equal(blob.type, 'application/x-chess-pgn');
  cleanup();
  assert.equal(events.at(-1), 'revoke:blob:test');
  downloadFile('{"valid":true}', 'application/json', 'dna.json');
  assert.deepEqual(JSON.parse(await blob.text()), { valid: true });
  console.log('PASS: PGN/JSON content, filename sanitization, attached download link and deferred blob cleanup.');
})().catch(error => { console.error(error); process.exitCode = 1; });
