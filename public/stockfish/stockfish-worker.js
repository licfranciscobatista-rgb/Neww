// Stockfish 19 WebWorker Bootstrapper
// Sets the required hash parameters so stockfish-19-lite-single.js operates in worker mode
try {
  self.location.hash = '#/stockfish/stockfish-19-lite-single.wasm,worker';
} catch (e) {
  // If location.hash is read-only in some environments, ignore
}
importScripts('/stockfish/stockfish-19-lite-single.js');
