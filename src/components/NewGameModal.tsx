import React, { useState } from 'react';
import { X, Play } from 'lucide-react';
import { StockfishOperatingMode } from '../types/chess';

export type ShowLinesMode = 'my_turn_only' | 'both_turns' | 'none';
export interface NewGameOptions {
  userColor: 'w' | 'b';
  gameMode: 'vs_ai' | 'manual_board';
  timeControlSeconds: number;
  showLinesMode: ShowLinesMode;
  stockfishMode: StockfishOperatingMode;
  startingFen?: string;
  systemsMode?: boolean;
}
interface NewGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartGame: (options: NewGameOptions) => void | Promise<void>;
  stockfishMode?: StockfishOperatingMode;
}
export const NewGameModal: React.FC<NewGameModalProps> = ({ isOpen, onClose, onStartGame, stockfishMode = 'per_request' }) => {
  const [side, setSide] = useState<'w' | 'b' | 'random'>('w');
  const [mode, setMode] = useState<'vs_ai' | 'manual_board'>('vs_ai');
  const [time, setTime] = useState(600);
  const [lines, setLines] = useState<ShowLinesMode>('my_turn_only');
  const [systemsMode, setSystemsMode] = useState(false);
  const [checking, setChecking] = useState(false);
  if (!isOpen) return null;
  const choices = <T extends string | number,>(label: string, value: T, options: [T, string][], change: (v: T) => void) => (
    <fieldset disabled={checking} className="space-y-2"><legend className="text-xs font-bold mb-2">{label}</legend>
      <div className="flex flex-wrap gap-2">{options.map(([id, text]) => <label key={id} className={`flex items-center gap-2 px-3 py-2 border rounded text-xs ${value === id ? 'border-sky-400 bg-sky-950' : 'border-slate-600 bg-slate-800'}`}>
        <input type="radio" name={label} checked={value === id} onChange={() => change(id)}/>{text}
      </label>)}</div>
    </fieldset>
  );
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
    <section role="dialog" aria-modal="true" aria-label="Nueva partida" className="bg-slate-900 border border-slate-600 rounded-lg max-w-md w-full max-h-[90dvh] overflow-y-auto p-5 space-y-5 text-slate-200">
      <div className="flex justify-between items-center"><h2 className="text-base font-bold">Nueva partida</h2><button disabled={checking} aria-label="Cerrar nueva partida" title="Cerrar" onClick={onClose} className="p-2 disabled:opacity-40"><X size={18}/></button></div>
      {choices('Mi bando', side, [['w', 'Blancas'], ['b', 'Negras'], ['random', 'Aleatorio']], setSide)}
      {choices('Asistencia', systemsMode ? 'systems' : 'normal', [['normal', 'Juego'], ['systems', 'Sistemas']], value => setSystemsMode(value === 'systems'))}
      {choices('Oponente', mode, [['vs_ai', 'IA Offline'], ['manual_board', 'Tablero manual']], setMode)}
      {choices('Tiempo', time, [[180, '3 min'], [300, '5 min'], [600, '10 min'], [900, '15 min'], [0, 'Sin fin']], setTime)}
      {choices('Líneas y flechas', lines, [['my_turn_only', 'Mi turno'], ['both_turns', 'Ambos turnos'], ['none', 'Sin líneas']], setLines)}
      <button disabled={checking} onClick={async () => { setChecking(true); try { await onStartGame({ userColor: side === 'random' ? Math.random() < 0.5 ? 'w' : 'b' : side, gameMode: mode, timeControlSeconds: time, showLinesMode: lines, stockfishMode, systemsMode }); } finally { setChecking(false); } }} className="w-full flex justify-center items-center gap-2 bg-sky-600 rounded p-3 text-sm font-bold disabled:opacity-60"><Play size={17}/>{checking ? 'Verificando motores...' : 'Comenzar partida'}</button>
    </section>
  </div>;
};
