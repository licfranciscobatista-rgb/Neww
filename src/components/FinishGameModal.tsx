import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Trophy,
  Flag,
  Clock,
  Handshake,
  ShieldAlert,
  CheckCircle2,
  ChevronRight,
  User,
  Bot,
} from 'lucide-react';

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
  gameMode,
}) => {
  const [selectedResult, setSelectedResult] = useState<GameResultType>('1/2-1/2');
  const [selectedReason, setSelectedReason] = useState<string>('Tablas por acuerdo mutuo');
  const [customReason, setCustomReason] = useState<string>('');
  const [isCustomReason, setIsCustomReason] = useState<boolean>(false);

  const prevIsOpenRef = useRef<boolean>(false);

  // REGLA CRÍTICA: Inicializar el estado ÚNICAMENTE una vez cuando el modal se abre.
  // JAMÁS incluir whiteTime ni blackTime en las dependencias para evitar que el reloj
  // sobreescriba la elección del usuario cada segundo.
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      // Determinación inteligente de la propuesta inicial según el reloj
      if (whiteTime === 0 && blackTime > 0) {
        setSelectedResult('0-1');
        setSelectedReason('Caída de bandera (Tiempo agotado de Blancas)');
      } else if (blackTime === 0 && whiteTime > 0) {
        setSelectedResult('1-0');
        setSelectedReason('Caída de bandera (Tiempo agotado de Negras)');
      } else {
        // Por defecto cuando el usuario abre voluntariamente el modal, dejar en Empate o Victoria del que tenga ventaja
        setSelectedResult('1/2-1/2');
        setSelectedReason('Tablas por acuerdo mutuo');
      }
      setIsCustomReason(false);
      setCustomReason('');
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, whiteTime, blackTime]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const finalReason = isCustomReason && customReason.trim()
      ? customReason.trim()
      : selectedReason;
    onConfirmFinish(selectedResult, finalReason);
    onClose();
  };

  const userWinResult: GameResultType = userColor === 'w' ? '1-0' : '0-1';
  const rivalWinResult: GameResultType = userColor === 'w' ? '0-1' : '1-0';

  const isUserWinner = selectedResult === userWinResult;
  const isDraw = selectedResult === '1/2-1/2';
  const isRivalWinner = selectedResult === rivalWinResult;

  const reasonsMap: Record<GameResultType, string[]> = {
    '1/2-1/2': [
      'Tablas por acuerdo mutuo',
      'Tablas por repetición de jugadas / Posición bloqueada',
      'Tablas por rey ahogado (Stalemate)',
      'Material insuficiente para dar jaque mate',
      'Fin de sesión de práctica / Estudio',
    ],
    '1-0': userColor === 'w'
      ? [
          'Victoria mía: Abandono o rendición del rival',
          'Victoria mía: Jaque mate inminente / Ventaja decisiva',
          'Victoria mía: El rival agotó su tiempo de reloj',
          'Victoria mía: Gran ventaja posicional y de material',
        ]
      : [
          'Victoria del rival (Blancas): Me rindo / Abandono mío',
          'Victoria del rival (Blancas): Mi tiempo de reloj se agotó',
          'Victoria del rival (Blancas): Ventaja decisiva del contrario',
          'Victoria del rival (Blancas): Posición insostenible',
        ],
    '0-1': userColor === 'b'
      ? [
          'Victoria mía: Abandono o rendición del rival',
          'Victoria mía: Jaque mate inminente / Ventaja decisiva',
          'Victoria mía: El rival agotó su tiempo de reloj',
          'Victoria mía: Gran ventaja posicional y de material',
        ]
      : [
          'Victoria del rival (Negras): Me rindo / Abandono mío',
          'Victoria del rival (Negras): Mi tiempo de reloj se agotó',
          'Victoria del rival (Negras): Ventaja decisiva del contrario',
          'Victoria del rival (Negras): Posición insostenible',
        ],
  };

  const isTimeOut = whiteTime === 0 || blackTime === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 text-slate-200 relative max-h-[94vh] overflow-y-auto">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold">
              <Flag className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Declarar Resultado de la Partida</h3>
              <p className="text-[11px] text-slate-400">
                Selecciona con total libertad quién ganó o si fue empate
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Cancelar y volver al tablero"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notificación si el tiempo se agotó */}
        {isTimeOut && (
          <div className="p-3 bg-amber-950/60 border border-amber-600/40 rounded-xl flex items-start gap-2.5 text-xs text-amber-200">
            <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Reloj agotado (00:00)</span>
              <span>
                {whiteTime === 0 ? 'Las Blancas se quedaron sin tiempo.' : 'Las Negras se quedaron sin tiempo.'}{' '}
                Puedes aceptar la caída de bandera o acordar tablas/otro desenlace.
              </span>
            </div>
          </div>
        )}

        {/* 1. SELECCIÓN PRINCIPAL DE RESULTADO: GANÉ YO / EMPATE / GANÓ EL RIVAL */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-white flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>1. Selecciona el resultado de la partida:</span>
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              Juegas con: <strong className="text-white">{userColor === 'w' ? 'Blancas' : 'Negras'}</strong>
            </span>
          </label>

          <div className="grid grid-cols-3 gap-2">
            {/* Opción A: Victoria mía */}
            <button
              type="button"
              onClick={() => {
                setSelectedResult(userWinResult);
                setSelectedReason(reasonsMap[userWinResult][0]);
                setIsCustomReason(false);
              }}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                isUserWinner
                  ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md ring-2 ring-emerald-500/40 scale-[1.02]'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-sm shadow-sm border border-emerald-500/40">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-xs text-white">Gané Yo</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-800">
                {userWinResult}
              </span>
              <span className="text-[9px] text-emerald-400 font-medium">Mi Victoria</span>
            </button>

            {/* Opción B: Empate / Tablas */}
            <button
              type="button"
              onClick={() => {
                setSelectedResult('1/2-1/2');
                setSelectedReason(reasonsMap['1/2-1/2'][0]);
                setIsCustomReason(false);
              }}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                isDraw
                  ? 'bg-sky-500/20 border-sky-400 text-white shadow-md ring-2 ring-sky-500/40 scale-[1.02]'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-sky-500/20 text-sky-300 font-bold flex items-center justify-center text-sm shadow-sm border border-sky-500/40">
                <Handshake className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-xs text-white">Empate</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 font-bold border border-sky-800">
                ½ - ½
              </span>
              <span className="text-[9px] text-sky-400 font-medium">Tablas</span>
            </button>

            {/* Opción C: Victoria del Rival */}
            <button
              type="button"
              onClick={() => {
                setSelectedResult(rivalWinResult);
                setSelectedReason(reasonsMap[rivalWinResult][0]);
                setIsCustomReason(false);
              }}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                isRivalWinner
                  ? 'bg-rose-500/20 border-rose-400 text-white shadow-md ring-2 ring-rose-500/40 scale-[1.02]'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-rose-500/20 text-rose-300 font-bold flex items-center justify-center text-sm shadow-sm border border-rose-500/40">
                {gameMode === 'vs_ai' ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              </div>
              <span className="font-bold text-xs text-white">Ganó Rival</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 font-bold border border-rose-800">
                {rivalWinResult}
              </span>
              <span className="text-[9px] text-rose-400 font-medium">Derrota</span>
            </button>
          </div>
        </div>

        {/* Selector adicional directo por Color Oficial FIDE */}
        <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>O selecciona por resultado oficial FIDE:</span>
            <span className="font-mono text-white font-bold">{selectedResult}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setSelectedResult('1-0');
                setSelectedReason(reasonsMap['1-0'][0]);
                setIsCustomReason(false);
              }}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-colors flex items-center justify-center gap-1 ${
                selectedResult === '1-0'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>♔ Blancas (1-0)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedResult('1/2-1/2');
                setSelectedReason(reasonsMap['1/2-1/2'][0]);
                setIsCustomReason(false);
              }}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-colors flex items-center justify-center gap-1 ${
                selectedResult === '1/2-1/2'
                  ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🤝 Tablas (½-½)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedResult('0-1');
                setSelectedReason(reasonsMap['0-1'][0]);
                setIsCustomReason(false);
              }}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-colors flex items-center justify-center gap-1 ${
                selectedResult === '0-1'
                  ? 'bg-purple-500/20 border-purple-400 text-purple-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>♚ Negras (0-1)</span>
            </button>
          </div>
        </div>

        {/* 2. SELECCIÓN DEL MOTIVO */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-white flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-sky-400" />
            <span>2. Motivo o Causa del resultado:</span>
          </label>

          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {reasonsMap[selectedResult].map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => {
                  setSelectedReason(reason);
                  setIsCustomReason(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between border transition-all cursor-pointer ${
                  !isCustomReason && selectedReason === reason
                    ? 'bg-sky-950/90 border-sky-500 text-sky-100 font-bold ring-1 ring-sky-500/40'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-white'
                }`}
              >
                <span className="truncate pr-2">{reason}</span>
                {!isCustomReason && selectedReason === reason && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                )}
              </button>
            ))}

            {/* Motivo personalizado */}
            <button
              type="button"
              onClick={() => setIsCustomReason(true)}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between border transition-all cursor-pointer ${
                isCustomReason
                  ? 'bg-sky-950/90 border-sky-500 text-sky-100 font-bold ring-1 ring-sky-500/40'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
              }`}
            >
              <span>Otro motivo personalizado...</span>
              {isCustomReason && <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
            </button>
          </div>

          {isCustomReason && (
            <input
              type="text"
              placeholder="Escribe el motivo (ej. Tablas teóricas en final de alfiles)..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-sky-500/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-400"
              autoFocus
            />
          )}
        </div>

        {/* 3. CONFIRMACIÓN VISUAL CLARA DEL IMPACTO EN EL PERFIL */}
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            isDraw
              ? 'bg-sky-950/60 border-sky-600/40 text-sky-200'
              : isUserWinner
              ? 'bg-emerald-950/60 border-emerald-600/40 text-emerald-200'
              : 'bg-rose-950/60 border-rose-600/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">
              {isDraw ? '🤝' : isUserWinner ? '🏆' : '🏳️'}
            </span>
            <div>
              <span className="font-bold block">
                {isDraw
                  ? 'Se archivará como EMPATE (½ - ½)'
                  : isUserWinner
                  ? 'Se archivará como VICTORIA TUYA'
                  : 'Se archivará como VICTORIA DEL RIVAL (Derrota)'}
              </span>
              <span className="text-[11px] opacity-80">
                {movesCount} jugadas registradas • {isCustomReason && customReason.trim() ? customReason : selectedReason}
              </span>
            </div>
          </div>
          <span className="font-mono font-extrabold text-sm px-2 py-1 rounded bg-black/40">
            {selectedResult}
          </span>
        </div>

        {/* Botones de acción */}
        <div className="pt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-semibold text-xs transition-colors border border-slate-700"
          >
            Cancelar y Seguir Jugando
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg active:scale-95 text-white ${
              isDraw
                ? 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/25'
                : isUserWinner
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25'
                : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/25'
            }`}
          >
            <span>Confirmar y Guardar</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
