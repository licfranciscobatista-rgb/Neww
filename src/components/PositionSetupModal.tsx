import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { PositionEditor } from './PositionEditor';

export function PositionSetupModal({ initialFen, userColor, onClose, onConfirm }: {
  initialFen: string;
  userColor: 'w' | 'b';
  onClose: () => void;
  onConfirm: (fen: string, color: 'w' | 'b') => void | Promise<void>;
}) {
  const [fen, setFen] = useState<string | null>(null);
  const [color, setColor] = useState(userColor);
  const [checking, setChecking] = useState(false);
  return <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3">
    <div role="dialog" aria-modal="true" aria-labelledby="position-title" className="bg-slate-900 text-slate-200 border border-slate-600 rounded-lg p-4 max-w-md w-full max-h-[94dvh] overflow-y-auto space-y-3">
      <div className="flex items-center justify-between"><h2 id="position-title" className="text-base font-bold">Ajustar tablero</h2><button type="button" disabled={checking} aria-label="Cancelar ajuste" title="Cancelar ajuste" onClick={onClose} className="p-2 disabled:opacity-40"><X size={18}/></button></div>
      <fieldset disabled={checking}><PositionEditor initialFen={initialFen} onChange={setFen}/></fieldset>
      <label className="block text-xs">Mi bando <select disabled={checking} aria-label="Mi bando" value={color} onChange={e => setColor(e.target.value as 'w' | 'b')} className="ml-2 bg-slate-800 border border-slate-600 rounded p-1"><option value="w">Blancas</option><option value="b">Negras</option></select></label>
      <button type="button" disabled={!fen || checking} onClick={async () => { if (!fen) return; setChecking(true); try { await onConfirm(fen, color); } finally { setChecking(false); } }} className="w-full flex justify-center items-center gap-2 p-3 bg-sky-600 disabled:opacity-40 rounded font-bold text-sm"><Check size={18}/>{checking ? 'Verificando motores...' : 'Confirmar posición e iniciar'}</button>
    </div>
  </div>;
}
