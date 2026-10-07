importScripts('/rodent/rodent.js');
let active = null;
let scoreCp = 0, mate, depth = 0, pv = '';
const ready = RodentModule({
  locateFile: name => '/rodent/' + name,
  print: line => {
    if (!active) return;
    const score = line.match(/score (cp|mate) (-?\d+)/);
    if (score) {
      mate = score[1] === 'mate' ? Number(score[2]) : undefined;
      scoreCp = score[1] === 'cp' ? Number(score[2]) : Math.sign(mate) * 100000;
    }
    const ply = line.match(/\bdepth (\d+)/); if (ply) depth = Number(ply[1]);
    const variation = line.match(/\bpv (.*)/); if (variation) pv = variation[1];
    const best = line.match(/^bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
    if (best) postMessage({ id: active.id, uci: best[1], scoreCp, mate, depth, pv });
  },
  printErr: message => console.warn('[Rodent]', message),
}).then(module => { module.ccall('rodent_init', null, [], []); return module; });
self.onmessage = async event => {
  const job = event.data;
  try {
    const module = await ready;
    active = job; scoreCp = 0; mate = undefined; depth = 0; pv = '';
    module.ccall('rodent_command', null, ['string'], ['position fen ' + job.fen]);
    module.ccall('rodent_command', null, ['string'], ['go movetime ' + Math.min(500, Math.max(50, job.movetime || 150))]);
    active = null;
  } catch (error) { postMessage({ id: job.id, error: String(error) }); active = null; }
};
