import React, { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from 'lucide-react';
import { GameRecord } from '../types/chess';
import { buildGameReplay } from '../engine/gameReplay';
import { ChessBoard } from './ChessBoard';

export function GameReplayModal({ game, onClose }: { game: GameRecord; onClose: () => void }) {
  const replay = useMemo(() => {
    try { return { ...buildGameReplay(game), error: '' }; }
    catch { return { fens: [], moves: [], error: 'No se pudo leer esta partida. El PGN o sus jugadas no son válidos.' }; }
  }, [game]);
  const [index, setIndex] = useState(0);
  const chess = useMemo(() => new Chess(replay.fens[index]), [replay, index]);
  return <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3">
    <section role="dialog" aria-modal="true" aria-label="Visor de partida" className="w-full max-w-lg max-h-[94dvh] overflow-y-auto p-4 rounded-lg bg-slate-900 text-slate-200 border border-slate-600 space-y-3">
      <div className="flex justify-between items-center gap-2"><h2 className="text-sm font-bold break-words">{game.title}</h2><button aria-label="Cerrar visor" title="Cerrar visor" onClick={onClose} className="p-2 shrink-0"><X size={18}/></button></div>
      {replay.error ? <p role="alert">{replay.error}</p> : <>
        <ChessBoard chess={chess} boardOrientation={game.playerColor} onMove={() => false} interactive={false} recommendations={{ stockfish: null, garbo: null, maia: null, personal: null, chessjs: null }} agreements={[]}/>
        <div className="flex items-center justify-between gap-2">
          {[[0, 'Inicio', ChevronsLeft], [Math.max(0, index - 1), 'Anterior', ChevronLeft], [Math.min(replay.moves.length, index + 1), 'Siguiente', ChevronRight], [replay.moves.length, 'Final', ChevronsRight]].map(([target, label, Icon], i) => {
            const ButtonIcon = Icon as typeof ChevronLeft;
            return <button key={label as string} aria-label={label as string} title={label as string} disabled={i < 2 ? index === 0 : index === replay.moves.length} onClick={() => setIndex(target as number)} className="p-2 border border-slate-600 rounded disabled:opacity-30"><ButtonIcon size={20}/></button>;
          })}
          <span className="text-xs font-mono">{index}/{replay.moves.length}</span>
        </div>
        <input type="range" aria-label="Posición de la partida" min={0} max={replay.moves.length} value={index} onChange={e => setIndex(Number(e.target.value))} className="w-full"/>
        <p className="text-xs">{index ? replay.moves[index - 1] : 'Posición inicial'} · {game.result}</p>
        <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">{replay.moves.map((san, i) => <button key={i} onClick={() => setIndex(i + 1)} className={`text-xs px-2 py-1 rounded ${index === i + 1 ? 'bg-sky-700' : 'bg-slate-800'}`}>{i + 1}. {san}</button>)}</div>
      </>}
    </section>
  </div>;
}
