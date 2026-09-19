import React, { useState, useEffect } from 'react';
import { X, Trophy, Flag, Clock, Handshake, ShieldAlert, CheckCircle2, ChevronRight } from 'lucide-react';

export type GameResultType = '1-0' | '0-1' | '1/2-1/2';

interface FinishGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmFinish: (result: GameResultType, reason: string) => void;
  movesCount: number;
  userColor: 'w' | 'b';
  turn: 'w' | 'b';
  whiteTime: number;
  blackTime: number;
  gameMode: 'vs_ai' | 'manual_board';
}

export const FinishGameModal: React.FC<FinishGameModalProps> = ({
  isOpen,
  onClose,
  onConfirmFinish,
  movesCount,
  userColor,
  whiteTime,
  blackTime,
}) => {
  // Preselección inteligente según estado del reloj o turno
  const [selectedResult, setSelectedResult] = useState<GameResultType>('1-0');
  const [selectedReason, setSelectedReason] = useState<string>('Abandono');

  useEffect(() => {
    if (!isOpen) return;

    if (whiteTime === 0 && blackTime > 0) {
      setSelectedResult('0-1');
      setSelectedReason('Caída de bandera (Tiempo agotado de Blancas)');
    } else if (blackTime === 0 && whiteTime > 0) {
      setSelectedResult('1-0');
      setSelectedReason('Caída de bandera (Tiempo agotado de Negras)');
    } else {
      // Si el usuario juega blancas y finaliza, suele ser o victoria o abandono
      setSelectedResult(userColor === 'w' ? '1-0' : '0-1');
      setSelectedReason('Abandono / Rendición');
    }
  }, [isOpen, whiteTime, blackTime, userColor]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirmFinish(selectedResult, selectedReason);
    onClose();
  };

  const reasonsOptions: Record<GameResultType, string[]> = {
    '1-0': [
      'Abandono / Rendición de Negras',
      'Caída de bandera (Tiempo agotado de Negras)',
      'Ventaja material decisiva',
      'Decisión técnica / Posición ganadora',
    ],
    '0-1': [
      'Abandono / Rendición de Blancas',
      'Caída de bandera (Tiempo agotado de Blancas)',
      'Ventaja material decisiva',
      'Decisión técnica / Posición ganadora',
    ],
    '1/2-1/2': [
      'Tablas por acuerdo mutuo',
      'Posición bloqueada / Sin progreso',
      'Material insuficiente / Tablas teóricas',
      'Fin de sesión de entrenamiento',
    ],
  };

  const isTimeOut = whiteTime === 0 || blackTime === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-slate-200 relative max-h-[92vh] overflow-y-auto">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold">
              <Flag className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Finalizar Partida y Registrar</h3>
              <p className="text-[11px] text-slate-400">Declara el resultado exacto para el Historial y el Motor Personal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Cancelar y seguir en el tablero"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notificación si el tiempo se agotó */}
        {isTimeOut && (
          <div className="p-3 bg-amber-950/60 border border-amber-600/40 rounded-xl flex items-start gap-2.5 text-xs text-amber-200">
            <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Reloj en 00:00</span>
              <span>
                {whiteTime === 0 ? 'Las Blancas agotaron su tiempo.' : 'Las Negras agotaron su tiempo.'} Selecciona si el desenlace fue por tiempo o si acordaron otro resultado.
              </span>
            </div>
          </div>
        )}

        {/* 1. Selección de Quién Ganó */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-white flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>1. ¿Quién ganó la partida?</span>
          </label>

          <div className="grid grid-cols-3 gap-2">
            {/* Blancas */}
            <button
              type="button"
              onClick={() => {
                setSelectedResult('1-0');
                setSelectedReason('Abandono / Rendición de Negras');
              }}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                selectedResult === '1-0'
                  ? 'bg-amber-500/15 border-amber-400 text-white shadow-sm ring-1 ring-amber-400/40'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-white text-slate-900 font-bold flex items-center justify-center text-sm shadow-sm">
                ♔
              </div>
              <span className="font-bold text-xs text-white">Ganan Blancas</span>
              <span className="font-mono text-[10px] text-amber-300 font-bold">1 - 0</span>
              {userColor === 'w' && (
                <span className="text-[9px] text-emerald-400 font-medium">(Tu bando)</span>
              )}
            </button>

            {/* Negras */}
            <button
              type="button"
              onClick={() => {
                setSelectedResult('0-1');
                setSelectedReason('Abandono / Rendición de Blancas');
              }}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                selectedResult === '0-1'
                  ? 'bg-purple-500/15 border-purple-400 text-white shadow-sm ring-1 ring-purple-400/40'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-slate-950 border border-slate-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                ♚
              </div>
              <span className="font-bold text-xs text-white">Ganan Negras</span>
              <span className="font-mono text-[10px] text-purple-300 font-bold">0 - 1</span>
              {userColor === 'b' && (
                <span className="text-[9px] text-emerald-400 font-medium">(Tu bando)</span>
              )}
            </button>

            {/* Tablas */}
            <button
              type="button"
              onClick={() => {
                setSelectedResult('1/2-1/2');
                setSelectedReason('Tablas por acuerdo mutuo');
              }}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                selectedResult === '1/2-1/2'
                  ? 'bg-sky-500/15 border-sky-400 text-white shadow-sm ring-1 ring-sky-400/40'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-sky-400 font-bold flex items-center justify-center text-xs shadow-sm">
                <Handshake className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <span className="font-bold text-xs text-white">Empate</span>
              <span className="font-mono text-[10px] text-sky-300 font-bold">½ - ½</span>
              <span className="text-[9px] text-slate-400 font-medium">Tablas</span>
            </button>
          </div>
        </div>

        {/* 2. Selección del Motivo */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-white flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-sky-400" />
            <span>2. Motivo o Causa del desenlace</span>
          </label>

          <div className="space-y-1.5">
            {reasonsOptions[selectedResult].map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => setSelectedReason(reason)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between border transition-all ${
                  selectedReason === reason
                    ? 'bg-sky-950/80 border-sky-500/70 text-sky-200 font-bold'
                    : 'bg-slate-950 border-slate-800/80 text-slate-300 hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                <span>{reason}</span>
                {selectedReason === reason && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Resumen de jugadas */}
        <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 flex items-center justify-between">
          <span>Jugadas ejecutadas: <strong className="text-white font-mono">{movesCount}</strong></span>
          <span>Bando jugador: <strong className="text-white">{userColor === 'w' ? 'Blancas' : 'Negras'}</strong></span>
        </div>

        {/* Botones de acción */}
        <div className="pt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-semibold text-xs transition-colors border border-slate-700"
          >
            Seguir Jugando
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-rose-600/20 active:scale-95"
          >
            <span>Archivar en Historial</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
