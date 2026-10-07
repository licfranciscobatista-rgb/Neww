const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../dist');
const required = ['build-info.json', 'index.html', 'openings/catalogue.json', 'rodent/rodent.js', 'rodent/rodent.wasm', 'rodent/worker.js', 'rodent/LICENSE', 'garbo/garbochess.js', 'maia/maia-worker.js', 'maia/maia3.json', ...Array.from({length:4}, (_, i) => `maia/maia3.bin.${i}`), 'stockfish/stockfish-19-lite-single.wasm'];
for (const color of ['w', 'b']) for (const piece of ['p', 'n', 'b', 'r', 'q', 'k']) required.push(`pieces/neo/${color}${piece}.png`);
for (const name of required) assert.ok(fs.statSync(path.join(root, name)).size > 0, `Missing packaged asset: ${name}`);
const identity = JSON.parse(fs.readFileSync(path.join(root, 'build-info.json'), 'utf8'));
assert.equal(identity.commit, process.env.VITE_BUILD_COMMIT || 'local');
const files = {};
function walk(folder) {
  for (const entry of fs.readdirSync(folder, {withFileTypes:true})) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) walk(file);
    else {
      const relative = path.relative(root, file).split(path.sep).join('/');
      if (relative !== 'release-manifest.json') files[relative] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    }
  }
}
walk(root);
fs.writeFileSync(path.join(root, 'release-manifest.json'), JSON.stringify({commit:identity.commit, files}, null, 2));
console.log(`PASS: ${Object.keys(files).length} packaged files, neural weights, Rodent, catalogue, pieces and build identity.`);
