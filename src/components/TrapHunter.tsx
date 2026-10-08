import React, { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { Crosshair } from 'lucide-react';
import { RealStockfishManager } from '../engine/realStockfish';
import { buildTrapIndex, CLASSIC_TRAPS, findTraps, safeTrapScore, type TrapCandidate, type TrapLine } from '../engine/trapHunter';

let catalogue: Promise<ReturnType<typeof buildTrapIndex>> | undefined;
function loadCatalogue() {
  return catalogue ||= fetch('./traps.json').then(r => { if (!r.ok) throw new Error('catalogue'); return r.json(); })
    .then((lines: TrapLine[]) => buildTrapIndex([...CLASSIC_TRAPS, ...lines]))
    .catch(() => buildTrapIndex(CLASSIC_TRAPS));
}
export function TrapHunter({ board, color, onArrow }: { board: Chess; color: 'w' | 'b'; onArrow: (fen: string, move: string | null) => void }) {
  const [engine] = useState(() => new RealStockfishManager(4));
  const [visible, setVisible] = useState(true);
  const [state, setState] = useState<{ fen: string; loading: boolean; trap: TrapCandidate | null }>({ fen: '', loading: false, trap: null });
  const fen = board.fen();
  useEffect(() => () => engine.terminate(), [engine]);
  useEffect(() => {
    let cancelled = false;
    onArrow(fen, null);
    setState({ fen, loading: false, trap: null });
    if (!visible || board.turn() !== color || board.isGameOver()) return;
    void (async () => {
      const candidates = findTraps(await loadCatalogue(), new Chess(fen), color);
      if (cancelled || !candidates.length) return;
      setState({ fen, loading: true, trap: null });
      const root = await engine.analyze(fen, { movetime: 1000 });
      if (cancelled) return;
      if (!root) { setState({ fen, loading: false, trap: null }); return; }
      for (const trap of candidates.slice(0, 3)) {
        const next = new Chess(fen); next.move(trap.san);
        const reply = next.isCheckmate() ? { mate: -1 } : await engine.analyze(next.fen(), { movetime: 1000 });
        if (cancelled) return;
        if (reply && safeTrapScore(root, reply)) {
          setState({ fen, loading: false, trap }); onArrow(fen, trap.uci); return;
        }
      }
      setState({ fen, loading: false, trap: null });
    })().catch(() => { if (!cancelled) setState({ fen, loading: false, trap: null }); });
    return () => { cancelled = true; engine.stop(); };
  }, [fen, color, visible, engine, onArrow]);
  const current = state.fen === fen ? state : null;
  return <div role="region" aria-label="Cazador de trampas" className="w-full flex flex-wrap items-center gap-2 border-t border-rose-500/30 py-2 text-xs">
    <button title="Mostrar u ocultar trampas" aria-pressed={visible} onClick={() => setVisible(v => !v)} className="flex items-center gap-1 text-rose-300"><Crosshair size={16} />Trampas</button>
    <span role="status">{!visible ? 'Apagado' : current?.loading ? 'Verificando trampa...' : current?.trap ? `${current.trap.name}: ${current.trap.san} · ${current.trap.accepted ? 'Continuacion de mate' : 'Depende de la respuesta rival'}` : 'Sin trampa comprobada'}</span>
    {visible && current?.trap && <span className="text-slate-400">{current.trap.line.join(' → ')}</span>}
  </div>;
}
