const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const path = require('node:path');
const rounds = Number(process.argv[2] || 1);
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 4) throw new Error('Use 1-4 rounds');
const tests = readdirSync(__dirname).filter(name => /^test-.*\.cjs$/.test(name)).sort();
for (let round = 1; round <= rounds; round++) {
  for (const test of tests) {
    console.log(`ROUND ${round}/${rounds}: ${test}`);
    const result = spawnSync(process.execPath, ['--require', path.join(__dirname, 'register-typescript.cjs'), path.join(__dirname, test)], {
      cwd: path.join(__dirname, '..'), stdio: 'inherit', timeout: 120000,
    });
    if (result.error || result.status !== 0) { console.error(result.error || `Failed: ${test}`); process.exit(1); }
  }
}
console.log(`PASS: ${tests.length} suites x ${rounds} rounds`);
