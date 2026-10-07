import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { OPENING_PRESETS } from '../engine/openingIndex';

export function OpeningPicker({ selected, onSelect, onClose }: {
  selected: string; onSelect: (id: string) => void; onClose: () => void;
}) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-3" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label="Sistemas de GarboChess"
        className="w-full max-w-sm max-h-[85vh] overflow-y-auto bg-slate-900 border border-emerald-700 rounded-lg shadow-xl"
        onClick={event => event.stopPropagation()}>
        <header className="flex items-center justify-between p-3 border-b border-slate-700">
          <h2 className="text-sm font-bold text-white">GarboChess · Sistema o plan</h2>
          <button autoFocus type="button" onClick={onClose} aria-label="Cerrar sistemas" title="Cerrar" className="p-2 text-slate-300"><X size={18} /></button>
        </header>
        <div className="grid grid-cols-2 gap-2 p-3">
          {[{ id: 'free', name: 'Libre' }, ...OPENING_PRESETS].map(item =>
            <button type="button" key={item.id} onClick={() => { onSelect(item.id); onClose(); }} aria-pressed={selected === item.id}
              className={`min-h-10 px-2 py-2 rounded text-left text-xs flex items-center justify-between gap-2 ${item.id === 'free' ? 'col-span-2' : ''} ${selected === item.id ? 'bg-emerald-800 text-white' : 'bg-slate-800 text-slate-200'}`}>
              <span className="min-w-0 break-words">{item.name}</span>{selected === item.id && <Check size={14} className="shrink-0" />}
            </button>)}
        </div>
      </section>
    </div>, document.body);
}
