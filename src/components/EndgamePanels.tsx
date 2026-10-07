import React, { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { Crosshair, Equal, LoaderCircle } from 'lucide-react';
import { RealStockfishManager, type RealStockfishAnalysis } from '../engine/realStockfish';
import { drawMoves, drawReason, legalVariation, mateSignal } from '../engine/endgameSignals';

export function EndgamePanels({ chess }: { chess: Chess }) {
  const [engine] = useState(() => new RealStockfishManager(8));
  const [state, setState] = useState<{ fen: string; result: RealStockfishAnalysis | null; loading: boolean; draws: ReturnType<typeof drawMoves>; reason?: string }>({ fen: '', result: null, loading: true, draws: [] });
  const fen = chess.fen();
  const history = chess.pgn();
  useEffect(() => () => engine.terminate(), [engine]);
  useEffect(() => {
    let cancelled = false;
    const board = new Chess(fen);
    if (history) {
      try { board.loadPgn(history); } catch { /* FEN remains usable without history. */ }
    }
    const draws = drawMoves(board);
    const reason = drawReason(board);
    setState({ fen, result: null, loading: !board.isGameOver(), draws, reason });
    if (board.isGameOver()) return;
    const timer = setTimeout(() => {
      void engine.analyze(fen, { movetime: 700 }).then(result => {
        if (!cancelled) setState({ fen, result, loading: false, draws, reason });
      }).catch(() => {
        if (!cancelled) setState({ fen, result: null, loading: false, draws, reason });
      });
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); engine.stop(); };
  }, [engine, fen, history]);
  const current = state.fen === fen;
  const result = current ? state.result : null;
  const mate = mateSignal(result);
  const line = result ? legalVariation(fen, result.pv) : [];
  const balanced = result?.mate === undefined && result?.scoreCp !== undefined && Math.abs(result.scoreCp) <= 30 && (result.depth || 0) >= 10;
  const loading = !current || state.loading;
  return <>
    <section aria-label="Mate" className={`border rounded-lg p-3 min-w-0 ${mate ? 'border-red-500 bg-red-950/30' : 'border-slate-700 bg-slate-900/90'}`}>
      <h4 className="text-sm font-bold flex items-center gap-2"><Crosshair size={17} />Mate {loading && <LoaderCircle size={14} className="animate-spin" aria-label="Analizando mate" />}</h4>
      <p role="status" className="text-xs mt-3">{mate ? `Mate ${result!.mate! > 0 ? 'a favor' : 'en contra'} de ${chess.turn() === 'w' ? 'blancas' : 'negras'} en ${Math.abs(result!.mate!)} jugadas` : loading ? 'Analizando' : result || chess.isGameOver() ? 'Inactivo: sin mate detectado en 5 o menos' : 'Análisis no disponible'}</p>
      {mate && <p className="text-xs mt-2 leading-relaxed break-words">{line.join(' · ') || result!.san}</p>}
    </section>
    <section aria-label="Tablas" className="border border-slate-700 rounded-lg p-3 min-w-0 bg-slate-900/90">
      <h4 className="text-sm font-bold flex items-center gap-2"><Equal size={17} />Tablas {loading && <LoaderCircle size={14} className="animate-spin" aria-label="Analizando tablas" />}</h4>
      <p role="status" className="text-xs mt-3">{current && state.reason ? `Tablas: ${state.reason}` : current && state.draws.length ? 'Tablas disponibles' : balanced ? 'Buscar tablas: posición equilibrada, no garantizadas' : loading ? 'Analizando' : result || chess.isGameOver() ? 'Sin continuación de tablas confirmada' : 'Análisis no disponible'}</p>
      {current && state.draws.map(move => <p key={move.san} className="text-xs mt-2 break-words">{move.san}: {move.reason}</p>)}
      {balanced && !state.reason && !state.draws.length && <p className="text-xs mt-2 break-words">{line.join(' · ') || result!.san}</p>}
    </section>
  </>;
}
