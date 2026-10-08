const assert = require('node:assert/strict');
const fs = require('node:fs');
const { transformSync } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { Chess } = require('chess.js');

require.extensions['.tsx'] = (module, filename) => module._compile(transformSync(
  fs.readFileSync(filename, 'utf8'),
  { loader: 'tsx', format: 'cjs', target: 'es2020', sourcefile: filename }
).code, filename);

const { SystemsRodent, SystemsDecision, SystemsControl } = require('../src/components/SystemsWorkspace.tsx');
const { emptySystemsSnapshot } = require('../src/engine/systemAssistants.ts');
const { EngineCards } = require('../src/components/EngineCards.tsx');
const noop = () => {};
const chess = new Chess();
const snapshot = emptySystemsSnapshot(chess, 'w', 'london', 'layout-test', 7);
snapshot.loading = false;
const rodent = renderToStaticMarkup(React.createElement(SystemsRodent, { snapshot, onMove: noop }));
assert.match(rodent, /Sin alternativa distinta comprobada/);
assert.ok(!rodent.includes('Cambiar sistema'));
assert.ok(!rodent.includes('Jugar alternativa'));
assert.match(rodent, /Sistema Londres/);
const decision = renderToStaticMarkup(React.createElement(SystemsDecision, { snapshot, visible: true, onToggle: noop, onAccept: noop, onReject: noop, onAdopt: noop }));
assert.ok(!decision.includes('Adoptar'));
assert.ok(!decision.includes('Elegir otro'));
assert.match(decision, /Flechas On/);
snapshot.proposal = { id: 'queens-gambit', name: 'Gambito de Dama', fen: chess.fen(), sourceSystem: 'london', reason: 'Comprobado' };
const proposed = renderToStaticMarkup(React.createElement(SystemsDecision, { snapshot, visible: false, onToggle: noop, onAccept: noop, onReject: noop, onAdopt: noop }));
assert.match(proposed, /Aceptar cambio/); assert.match(proposed, /Mantener actual/); assert.match(proposed, /Flechas Off/);
const helpers = renderToStaticMarkup(React.createElement(SystemsControl, { snapshot, limit: 7, onLimit: noop }));
assert.equal((helpers.match(/<details/g) || []).length, 6);
for (const removed of ['Radar del Sistema', 'Vigilancia Táctica', 'Agresivo', 'Sólido', 'Dinámico', 'Plan de Profilaxis']) {
  assert.ok(!rodent.includes(removed), `Removed control still visible: ${removed}`);
}
const garbo = renderToStaticMarkup(React.createElement(EngineCards, {
  systemsMode: true, chess, userColor: 'w', recommendations: {}, loadingStates: {},
  stockfishRemainingUses: 3, garboRemainingUses: 3, garboOpening: 'free',
  garboOpeningState: { activeSystem: 'london', provisional: true,
    suggestedSystem: { id: 'london', name: 'Sistema Londres', reason: 'Compatible' } },
  agreements: [], arrowFilter: {}, onToggleArrow: noop, onRequestStockfish: noop, onRequestGarbo: noop,
}));
assert.match(garbo, /Sistema Londres/);
assert.match(garbo, /Preferencias iniciales de Garbo/);
assert.ok(!garbo.includes('Adoptar'));
assert.ok(!garbo.includes('Elegir otro'));
assert.ok(!garbo.includes('Mantener actual'));
console.log('PASS: compact systems layout, changes in Rodent, no personality or radar panels, Garbo preferences and detected system.');
