import React, { useState } from 'react';
import { DEFAULT_POSITION, Color, PieceSymbol } from 'chess.js';
import { Eraser, Move, RotateCcw, Trash2 } from 'lucide-react';
import { buildSetupFen, setupBoardFromFen, SetupBoard, validateSetupPosition } from '../engine/setupPosition';

const symbols = { w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }, b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' } };
const names = { k: 'Rey', q: 'Dama', r: 'Torre', b: 'Alfil', n: 'Caballo', p: 'Peón' };

export function PositionEditor({ onChange, initialFen = DEFAULT_POSITION }: { onChange: (fen: string | null) => void; initialFen?: string }) {
  const [board, setBoard] = useState<SetupBoard>(() => setupBoardFromFen(initialFen));
  const [tool, setTool] = useState('move');
  const [selected, setSelected] = useState<string | null>(null);
  const [turn, setTurn] = useState<Color>(() => initialFen.split(' ')[1] as Color);
  const [rights, setRights] = useState('');
  const [ep, setEp] = useState('-');
  const [halfmove, setHalfmove] = useState(0);
  const [fullmove, setFullmove] = useState(1);
  const fen = buildSetupFen(board, turn, rights, ep, halfmove, fullmove);
  const error = validateSetupPosition(fen);
  React.useEffect(() => { onChange(error ? null : fen); }, [fen, error, onChange]);
  const squareClick = (square: string) => {
    if (tool === 'move' && !selected) { if (board[square]) setSelected(square); return; }
    const next = { ...board };
    if (tool === 'move') {
      if (selected === square) { setSelected(null); return; }
      if (selected && next[selected]) { next[square] = next[selected]; delete next[selected]; }
    } else if (tool === 'erase') delete next[square];
    else next[square] = { color: tool[0] as Color, type: tool[1] as PieceSymbol };
    setBoard(next); setSelected(null); setRights(''); setEp('-');
  };
  return <section className="space-y-3" aria-label="Editor de posición">
    <div className="flex gap-1 flex-wrap">
      {[['move', 'Mover pieza', Move], ['erase', 'Quitar pieza', Eraser]] .map(([id, label, Icon]) => {
        const ButtonIcon = Icon as typeof Move;
        return <button key={id as string} type="button" title={label as string} aria-label={label as string} aria-pressed={tool === id} onClick={() => { setTool(id as string); setSelected(null); }} className={`p-2 border rounded ${tool === id ? 'bg-sky-700 border-sky-300' : 'border-slate-600'}`}><ButtonIcon size={18}/></button>;
      })}
      <button type="button" title="Vaciar tablero" aria-label="Vaciar tablero" onClick={() => { setBoard({}); setSelected(null); setRights(''); setEp('-'); }} className="p-2 border border-slate-600 rounded"><Trash2 size={18}/></button>
      <button type="button" title="Posición inicial" aria-label="Restaurar posición inicial" onClick={() => { setBoard(setupBoardFromFen(DEFAULT_POSITION)); setSelected(null); setRights(''); setEp('-'); setHalfmove(0); setFullmove(1); }} className="p-2 border border-slate-600 rounded"><RotateCcw size={18}/></button>
    </div>
    {(['w', 'b'] as Color[]).map(color => <div key={color} className="grid grid-cols-6 gap-1">
      {(['k', 'q', 'r', 'b', 'n', 'p'] as PieceSymbol[]).map(type => <button key={type} type="button" aria-label={`${names[type]} ${color === 'w' ? 'blanco' : 'negro'}`} title={`${names[type]} ${color === 'w' ? 'blanco' : 'negro'}`} aria-pressed={tool === color + type} onClick={() => { setTool(color + type); setSelected(null); }} className={`h-10 text-3xl border rounded ${tool === color + type ? 'bg-sky-700 border-sky-300' : 'bg-slate-800 border-slate-600'}`}>{symbols[color][type]}</button>)}
    </div>)}
    <div className="grid grid-cols-8 aspect-square w-full max-w-sm mx-auto border border-slate-500">
      {Array.from({ length: 64 }, (_, i) => {
        const square = `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}`;
        const piece = board[square];
        return <button key={square} type="button" aria-label={`Casilla ${square}${piece ? ` ${names[piece.type]} ${piece.color === 'w' ? 'blanco' : 'negro'}` : ' vacía'}`} onClick={() => squareClick(square)} className={`relative aspect-square text-3xl text-black ${selected === square ? 'bg-yellow-300 ring-2 ring-inset ring-sky-600' : (Math.floor(i / 8) + i % 8) % 2 ? 'bg-emerald-500' : 'bg-gray-200'}`}>
          <span className="absolute top-0 left-0.5 text-[9px]">{square}</span>{piece ? symbols[piece.color][piece.type] + '\uFE0E' : ''}
        </button>;
      })}
    </div>
    <label className="block text-xs">Turno <select aria-label="Turno de la posición" value={turn} onChange={e => { setTurn(e.target.value as Color); setEp('-'); }} className="ml-2 bg-slate-800 border border-slate-600 rounded p-1"><option value="w">Blancas</option><option value="b">Negras</option></select></label>
    <fieldset className="text-xs"><legend className="mb-1">Enroques todavía permitidos</legend><div className="grid grid-cols-2 gap-2">{[['K', 'Blancas corto'], ['Q', 'Blancas largo'], ['k', 'Negras corto'], ['q', 'Negras largo']].map(([id, label]) => <label key={id} className="flex gap-2 items-center"><input type="checkbox" checked={rights.includes(id)} onChange={e => setRights('KQkq'.split('').filter(c => c === id ? e.target.checked : rights.includes(c)).join(''))}/>{label}</label>)}</div></fieldset>
    <label className="block text-xs">Último avance doble <select aria-label="Último avance doble" value={ep} onChange={e => setEp(e.target.value)} className="ml-2 bg-slate-800 p-1 rounded"><option value="-">Ninguno / no aplica</option>{'abcdefgh'.split('').map(file => <option key={file} value={`${file}${turn === 'w' ? '6' : '3'}`}>{`${file}${turn === 'w' ? '7' : '2'} → ${file}${turn === 'w' ? '5' : '4'}`}</option>)}</select></label>
    <div className="grid grid-cols-2 gap-2 text-xs"><label>Número de jugada<input aria-label="Número de jugada" type="number" min={1} max={9999} value={fullmove} onChange={e => setFullmove(Number(e.target.value))} className="block w-full bg-slate-800 p-1 border border-slate-600 rounded"/></label><label>Medias jugadas sin captura ni peón<input aria-label="Medias jugadas sin captura ni peón" type="number" min={0} max={9999} value={halfmove} onChange={e => setHalfmove(Number(e.target.value))} className="block w-full bg-slate-800 p-1 border border-slate-600 rounded"/></label></div>
    {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
    <p className="text-[10px] text-slate-400">No se recupera el historial anterior de repeticiones.</p>
  </section>;
}
