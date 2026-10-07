import React, { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { Crosshair, Equal, LoaderCircle } from 'lucide-react';
import { RealStockfishManager, type RealStockfishAnalysis } from '../engine/realStockfish';
import { drawMoves, drawReason, legalVariation, ownMateSignal } from '../engine/endgameSignals';

export interface EndgameArrow { from: string; to: string; kind: 'mate' | 'draw'; }

export function EndgamePanels({ chess, userColor, onArrows }: { chess: Chess; userColor: 'w' | 'b'; onArrows: (fen: string, arrows: EndgameArrow[]) => void }) {
  const [visible, setVisible] = useState({ mate: true, draw: true });
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
  const ownMate = ownMateSignal(result, chess.turn(), userColor);
  const line = result ? legalVariation(fen, result.pv) : [];
  const balanced = result?.mate === undefined && result?.scoreCp !== undefined && Math.abs(result.scoreCp) <= 30 && (result.depth || 0) >= 10;
  const loading = !current || state.loading;
  const mateText = ownMate ? `Mate a tu favor en ${Math.abs(result!.mate!)}: ${line.join(' · ') || result!.san}` : null;
  const ourTurn = chess.turn() === userColor;
  const mateMove = ownMate && ourTurn ? result : null;
  const drawSan = current && ourTurn ? state.draws[0]?.san : undefined;
  let drawMove: { from: string; to: string } | null = null;
  if (drawSan) {
    try { drawMove = new Chess(fen).move(drawSan); } catch { /* Ignore obsolete moves. */ }
  }
  const arrows: EndgameArrow[] = [];
  if (mateMove && visible.mate) arrows.push({ from: mateMove.from, to: mateMove.to, kind: 'mate' });
  if (drawMove && visible.draw) arrows.push({ from: drawMove.from, to: drawMove.to, kind: 'draw' });
  const arrowKey = JSON.stringify(arrows);
  useEffect(() => { onArrows(fen, JSON.parse(arrowKey)); }, [fen, arrowKey, onArrows]);
  const drawText = current && state.reason ? `Tablas: ${state.reason}` : drawSan ? `Tablas con ${drawSan}: ${state.draws[0].reason}` : balanced ? 'Posicion equilibrada; tablas no confirmadas' : loading ? 'Analizando tablas' : 'Sin tablas confirmadas';
  return <div className="flex items-center gap-3 flex-wrap min-w-0">
    <button type="button" aria-label="Flecha de mate" aria-pressed={!!mateMove && visible.mate} disabled={!mateMove} onClick={() => setVisible(previous => ({ ...previous, mate: !previous.mate }))} title={mateText || (loading ? 'Analizando mate' : 'Sin mate a tu favor en cinco jugadas o menos')} className={`flex items-center gap-1.5 min-h-8 ${ownMate ? 'text-rose-400' : 'text-slate-500'}`}>
      <Crosshair size={18} /><span>Mate{ownMate ? ` ${Math.abs(result!.mate!)}` : ''}</span>{mateMove && <span className="font-mono">{mateMove.san}</span>}
    </button>
    <button type="button" aria-label="Flecha de tablas" aria-pressed={!!drawMove && visible.draw} disabled={!drawMove} onClick={() => setVisible(previous => ({ ...previous, draw: !previous.draw }))} title={drawText} className={`flex items-center gap-1.5 min-h-8 ${drawMove || (current && state.reason) ? 'text-cyan-300' : 'text-slate-500'}`}>
      <Equal size={18} /><span>Tablas</span>{drawSan && <span className="font-mono">{drawSan}</span>}
    </button>
    {loading && <LoaderCircle size={12} className="animate-spin text-slate-500" aria-label="Analizando mate y tablas" />}
    <span role="status" className="sr-only">{mateText || 'Sin mate confirmado'}. {drawText}</span>
  </div>;
}
