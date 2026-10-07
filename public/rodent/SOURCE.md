# Rodent IV WebAssembly

Official source: https://github.com/nescitus/rodent-iv

Rodent IV 0.33, by Pawel Koziol and Bernhard C. Maerz, derived from Sungorus
by Pablo Vazquez. Licensed under GPL version 3 or later. See LICENSE.

Corresponding source is included in vendor/rodent. Browser changes:
- web_bridge.cpp exposes initialization and synchronous UCI commands.
- util.cpp disables stdin polling in Emscripten; worker messages supply commands.
- Single thread, no opening-book files, 8 MB transposition table.

Built using Emscripten 6.0.11. Reproduce with scripts/build-rodent.ps1 and
an Emscripten em++ executable. The SDK is not a runtime dependency.

The app's system recognition and transition proposal logic lives in
src/engine/rodentAdvisor.ts, not in the upstream Rodent engine.
