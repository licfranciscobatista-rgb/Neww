require('tsx/cjs');
const assert = require('node:assert/strict');
const Module = require('node:module');
const load = Module._load;
let broken = false;
let calls = 0;
let terminated = 0;
Module._load = function(request, parent, main) {
  if (parent?.filename.endsWith('startupVerification.ts')) {
    if (request === './auditWorkers') return { auditWorker: async name => { calls++; if (broken && name === 'garbo') throw new Error('Missing worker'); return { san: 'd4' }; } };
    if (request === './realRodent') return { RealRodentManager: class { async analyze() { return broken ? null : { uci: 'd2d4' }; } terminate() { terminated++; } } };
    if (request === './realMaia') return { realMaia: { analyze: async () => broken ? null : { san: 'd4' } } };
    if (request === './personalAssistants') return { auditAllAssistantsHealth: () => Array.from({ length: 8 }, () => ({ isHealthy: !broken })) };
  }
  return load.call(this, request, parent, main);
};
const { verifyStartup } = require('../src/engine/startupVerification.ts');
const engines = Object.fromEntries(['stockfish', 'garbo', 'maia', 'personal'].map(name => [name, { name, isInstalled: false, isOperational: false, status: '' }]));
(async () => {
  const base = { engines, ready: false, allEnginesOk: false };
  const good = await verifyStartup(base);
  assert.equal(good.verificationComplete, true);
  assert.equal(good.allEnginesOk, true);
  assert.equal(good.ready, true);
  assert.equal(calls, 2);
  broken = true;
  const degraded = await verifyStartup(base);
  assert.equal(degraded.ready, true, 'A failed optional engine must not prevent manual play');
  assert.equal(degraded.verificationComplete, true);
  assert.equal(degraded.allEnginesOk, false);
  assert.equal(degraded.engines.stockfish.isOperational, true);
  assert.equal(degraded.engines.garbo.isOperational, false);
  assert.equal(degraded.engines.personal.isOperational, false);
  assert.ok(degraded.engines.maia.status.includes('heuristico'));
  assert.equal(calls, 5, 'Failed worker receives one retry');
  assert.equal(terminated, 2);
  assert.equal(base.engines.garbo.status, '', 'Base report is immutable');
  console.log('PASS: startup success, retries, degraded operation, explicit neural fallback, eight assistants and worker cleanup.');
})().catch(error => { console.error(error); process.exitCode = 1; });
