const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'chess-package-'));
const assets = ['index.html', 'openings/catalogue.json', 'rodent/rodent.js', 'rodent/rodent.wasm', 'rodent/worker.js', 'rodent/LICENSE', 'garbo/garbochess.js', 'maia/maia-worker.js', 'maia/maia3.json', 'stockfish/stockfish-19-lite-single.wasm'];
for (let i = 0; i < 4; i++) assets.push(`maia/maia3.bin.${i}`);
for (const color of ['w', 'b']) for (const piece of ['p', 'n', 'b', 'r', 'q', 'k']) assets.push(`pieces/neo/${color}${piece}.png`);
function write(name, content) {
  const file = path.join(folder, name);
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, content);
}
function verifyWeb() {
  return spawnSync(process.execPath, [path.join(__dirname, 'verify-web-package.cjs'), folder], {encoding:'utf8', env:{...process.env, VITE_BUILD_COMMIT:'fixture'}});
}
try {
  for (const asset of assets) write(asset, 'runtime fixture');
  write('build-info.json', JSON.stringify({commit:'fixture'}));
  write('assets/aistudio/.gitignore', 'metadata');
  write('.hidden/metadata', 'metadata');
  assert.equal(verifyWeb().status, 0);
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'release-manifest.json'), 'utf8'));
  assert.equal(Object.keys(manifest.files).length, assets.length + 1);
  assert.ok(!Object.keys(manifest.files).some(name => name.split('/').some(part => part.startsWith('.'))));
  const python = process.platform === 'win32' ? 'python' : 'python3';
  for (const mode of ['valid', 'missing', 'tampered', 'identity']) {
    const apk = path.join(folder, `${mode}.apk`);
    const fixture = spawnSync(python, ['-c',
      "import json,pathlib,sys,zipfile; root=pathlib.Path(sys.argv[1]); mode=sys.argv[3]; manifest=json.loads((root/'release-manifest.json').read_text()); z=zipfile.ZipFile(sys.argv[2],'w'); z.write(root/'release-manifest.json','assets/public/release-manifest.json'); [(z.writestr('assets/public/'+name, b'changed' if mode=='tampered' and name=='index.html' else json.dumps({'commit':'wrong'}).encode() if mode=='identity' and name=='build-info.json' else (root/name).read_bytes())) for name in manifest['files'] if not (mode=='missing' and name=='index.html')]; z.close()",
      folder, apk, mode], {encoding:'utf8'});
    assert.equal(fixture.status, 0, fixture.stderr);
    const result = spawnSync(python, [path.join(__dirname, 'verify-apk-package.py'), apk], {encoding:'utf8'});
    assert.equal(result.status === 0, mode === 'valid', `${mode}: ${result.stderr}`);
  }
  fs.unlinkSync(path.join(folder, 'rodent/rodent.wasm'));
  assert.notEqual(verifyWeb().status, 0, 'Missing engine must fail verification');
  console.log('PASS: Android metadata exclusions, valid APK, missing/tampered assets and build identity.');
} finally {
  fs.rmSync(folder, {recursive:true, force:true});
}
