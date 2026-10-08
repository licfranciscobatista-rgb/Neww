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

const { RodentPanel } = require('../src/components/RodentPanel.tsx');
const { EngineCards } = require('../src/components/EngineCards.tsx');
const noop = () => {};
const chess = new Chess();
const rodent = renderToStaticMarkup(React.createElement(RodentPanel, {
  chess, gameId: 'layout-test', userColor: 'w', selected: 'free', garboLoading: false,
  activeSystem: null, systemsMode: true, onAccept: noop, onResumeGarbo: noop,
  onArrow: noop, onThreat: noop, onMove: noop, onChangeSystem: noop,
}));
assert.match(rodent, /Cambiar sistema desde Rodent/);
assert.match(rodent, /Fijar sistema detectado/);
assert.match(rodent, /Sistema Londres/);
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
