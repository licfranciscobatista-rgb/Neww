import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Shield, Sword, Sparkles } from 'lucide-react';
import { OPENING_PRESETS, DEFAULT_WHITE_SYSTEM, DEFAULT_BLACK_SYSTEM } from '../engine/openingIndex';

export function OpeningPicker({
  selected,
  userColor = 'w',
  onSelect,
  onClose,
}: {
  selected: string;
  userColor?: 'w' | 'b';
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [filterColor, setFilterColor] = useState<'all' | 'w' | 'b'>(userColor || 'all');

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);

  const whiteSystems = OPENING_PRESETS.filter(p => p.color === 'w');
  const blackSystems = OPENING_PRESETS.filter(p => p.color === 'b');

  const visiblePresets = filterColor === 'all'
    ? OPENING_PRESETS
    : filterColor === 'w'
    ? whiteSystems
    : blackSystems;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Sistemas y Aperturas de GarboChess"
        className="w-full max-w-lg max-h-[88vh] flex flex-col bg-slate-900 border border-emerald-500/50 rounded-2xl shadow-2xl overflow-hidden"
        onClick={event => event.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/70">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Sistemas de GarboChess</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Tu bando: {userColor === 'w' ? 'Blancas' : 'Negras'}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              {userColor === 'w'
                ? `Predeterminado para Blancas: Sistema Londres`
                : `Predeterminado para Negras: Defensa India de Rey`}
            </p>
          </div>
          <button
            autoFocus
            type="button"
            onClick={onClose}
            aria-label="Cerrar sistemas"
            title="Cerrar"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 bg-slate-900 border-b border-slate-800/80">
          <button
            type="button"
            onClick={() => setFilterColor('w')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              filterColor === 'w'
                ? 'bg-amber-500/20 text-amber-200 border border-amber-500/50 shadow-xs'
                : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Sword className="w-3.5 h-3.5" />
            <span>Blancas ({whiteSystems.length})</span>
            {userColor === 'w' && <span className="text-[9px] bg-amber-500/30 px-1 rounded">Recomendado</span>}
          </button>
          <button
            type="button"
            onClick={() => setFilterColor('b')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              filterColor === 'b'
                ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/50 shadow-xs'
                : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Negras ({blackSystems.length})</span>
            {userColor === 'b' && <span className="text-[9px] bg-indigo-500/30 px-1 rounded">Recomendado</span>}
          </button>
          <button
            type="button"
            onClick={() => setFilterColor('all')}
            className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all ${
              filterColor === 'all'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/50'
                : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            Todos
          </button>
        </div>

        {/* Quick Presets row */}
        <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Atajos rápidos:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onSelect(DEFAULT_WHITE_SYSTEM);
                onClose();
              }}
              className="text-amber-300 hover:underline font-medium flex items-center gap-1"
            >
              <span>Forzar Londres (Blancas)</span>
            </button>
            <span className="text-slate-600">·</span>
            <button
              type="button"
              onClick={() => {
                onSelect(DEFAULT_BLACK_SYSTEM);
                onClose();
              }}
              className="text-indigo-300 hover:underline font-medium flex items-center gap-1"
            >
              <span>Forzar India de Rey (Negras)</span>
            </button>
          </div>
        </div>

        {/* List */}
        <div className="p-3 space-y-2 overflow-y-auto flex-1 max-h-[55vh]">
          {/* Opción Libre */}
          <button
            type="button"
            onClick={() => {
              onSelect('free');
              onClose();
            }}
            aria-pressed={selected === 'free'}
            className={`w-full p-2.5 rounded-xl text-left transition-all border flex items-center justify-between ${
              selected === 'free'
                ? 'bg-emerald-950/80 border-emerald-500 text-white shadow-md'
                : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold">Modo Libre (Auto-Detección tras Jugada 1)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-700 text-slate-300">Dinámico</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                Juega tu primer movimiento libremente. GarboChess y Rodent IV estarán atentos tras la primera jugada para recomendarte y adoptar el sistema más adecuado a la partida.
              </p>
            </div>
            {selected === 'free' && <Check size={16} className="text-emerald-400 shrink-0 ml-2" />}
          </button>

          {/* Listado de Sistemas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {visiblePresets.map(item => {
              const isSelected = selected === item.id;
              const isWhite = item.color === 'w';
              const isBlack = item.color === 'b';
              const isOptimalForPlayer = item.color === userColor;

              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                  aria-pressed={isSelected}
                  className={`p-2.5 rounded-xl text-left text-xs transition-all border flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-900/60 border-emerald-400 text-white shadow-md ring-1 ring-emerald-400'
                      : isOptimalForPlayer
                      ? 'bg-slate-800/80 hover:bg-slate-750 border-slate-650 hover:border-emerald-500/40 text-slate-200'
                      : 'bg-slate-850/60 hover:bg-slate-800 border-slate-750/70 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-[12px] truncate">{item.name}</span>
                        {isWhite ? (
                          <span className="text-[9px] font-bold px-1 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40">
                            Blancas
                          </span>
                        ) : isBlack ? (
                          <span className="text-[9px] font-bold px-1 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                            Negras
                          </span>
                        ) : null}
                        {isOptimalForPlayer && (
                          <span className="text-[9px] font-bold px-1 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-700/50 flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> Tu bando
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>
                    {isSelected && <Check size={16} className="text-emerald-400 shrink-0 ml-1" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
