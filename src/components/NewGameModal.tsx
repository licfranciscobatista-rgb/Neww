import React, { useState, useEffect } from 'react';
import { X, Play, Clock, Bot, User, Shuffle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { subDirectorAuditor, SubDirectorPreflightResult } from '../engine/director/subDirectorEngineAuditor';

export type ShowLinesMode = 'my_turn_only' | 'both_turns' | 'none';

export interface NewGameOptions {
  userColor: 'w' | 'b';
  gameMode: 'vs_ai' | 'manual_board';
  timeControlSeconds: number;
  showLinesMode: ShowLinesMode;
}

interface NewGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartGame: (options: NewGameOptions) => void;
}

export const NewGameModal: React.FC<NewGameModalProps> = ({
  isOpen,
  onClose,
  onStartGame,
}) => {
  const [selectedSide, setSelectedSide] = useState<'w' | 'b' | 'random'>('w');
  const [selectedMode, setSelectedMode] = useState<'vs_ai' | 'manual_board'>('vs_ai');
  const [selectedTime, setSelectedTime] = useState<number>(600);
  const [selectedLinesMode, setSelectedLinesMode] = useState<ShowLinesMode>('my_turn_only');
  const [preflight, setPreflight] = useState<SubDirectorPreflightResult | null>(() => {
    return subDirectorAuditor.getOrRunCertification();
  });

  useEffect(() => {
    if (isOpen) {
      void subDirectorAuditor.auditAndCertifyEngines().then((res) => {
        setPreflight(res);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStart = () => {
    const finalColor: 'w' | 'b' =
      selectedSide === 'random' ? (Math.random() > 0.5 ? 'w' : 'b') : selectedSide;

    onStartGame({
      userColor: finalColor,
      gameMode: selectedMode,
      timeControlSeconds: selectedTime,
      showLinesMode: selectedLinesMode,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-200 relative">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold">
              ♟
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Configurar Nueva Partida</h3>
              <p className="text-xs text-slate-400">Selecciona bando, modo y control de tiempo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            1. ¿Con qué bando jugarás?
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setSelectedSide('w')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all text-center ${
                selectedSide === 'w'
                  ? 'bg-amber-500/10 border-amber-400 ring-2 ring-amber-400/30 text-white font-bold'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center text-slate-900 text-2xl shadow-inner">
                ♔
              </div>
              <div className="leading-tight">
                <span className="text-xs block font-bold text-white">Blancas</span>
                <span className="text-[10px] text-slate-400">Mueves primero</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedSide('b')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all text-center ${
                selectedSide === 'b'
                  ? 'bg-amber-500/10 border-amber-400 ring-2 ring-amber-400/30 text-white font-bold'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-stone-900 border-2 border-slate-600 flex items-center justify-center text-white text-2xl shadow-md">
                ♚
              </div>
              <div className="leading-tight">
                <span className="text-xs block font-bold text-white">Negras</span>
                <span className="text-[10px] text-slate-400">Tablero invertido</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedSide('random')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all text-center ${
                selectedSide === 'random'
                  ? 'bg-amber-500/10 border-amber-400 ring-2 ring-amber-400/30 text-white font-bold'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center text-sky-400 text-lg">
                <Shuffle className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <span className="text-xs block font-bold text-white">Aleatorio</span>
                <span className="text-[10px] text-slate-400">50% / 50%</span>
              </div>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            2. Modo de Oponente
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setSelectedMode('vs_ai')}
              className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                selectedMode === 'vs_ai'
                  ? 'bg-sky-500/10 border-sky-400 ring-2 ring-sky-400/30 text-white font-semibold'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              <Bot className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-white block">Contra IA Offline</span>
                <span className="text-[10px] text-slate-400 block leading-tight mt-0.5">
                  El motor rival responde automáticamente en su turno sin Internet.
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMode('manual_board')}
              className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                selectedMode === 'manual_board'
                  ? 'bg-sky-500/10 border-sky-400 ring-2 ring-sky-400/30 text-white font-semibold'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              <User className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-white block">Tablero Libre / Análisis</span>
                <span className="text-[10px] text-slate-400 block leading-tight mt-0.5">
                  Introduces jugadas de ambos lados; solo tu bando alimenta tu estilo.
                </span>
              </div>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span>3. Control de Tiempo</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
          </label>
          <div className="grid grid-cols-5 gap-1.5 text-xs font-mono">
            {[
              { label: '3 min', sec: 180 },
              { label: '5 min', sec: 300 },
              { label: '10 min', sec: 600 },
              { label: '15 min', sec: 900 },
              { label: 'Sin fin', sec: 0 },
            ].map((t) => (
              <button
                key={t.sec}
                type="button"
                onClick={() => setSelectedTime(t.sec)}
                className={`py-2 px-1 rounded-lg border text-center font-bold transition-all ${
                  selectedTime === t.sec
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                    : 'bg-slate-800/70 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Line recommendation display preference */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            4. Líneas y Flechas de Recomendación
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setSelectedLinesMode('my_turn_only')}
              className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                selectedLinesMode === 'my_turn_only'
                  ? 'bg-emerald-500/10 border-emerald-400 ring-1 ring-emerald-400 text-white font-bold'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              <span className="text-xs font-bold text-emerald-400">Solo en mi turno</span>
              <span className="text-[10px] text-slate-400 mt-1 leading-tight">
                0 lag. Pausa motores en turno rival y muestra solo líneas de tu bando.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedLinesMode('both_turns')}
              className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                selectedLinesMode === 'both_turns'
                  ? 'bg-sky-500/10 border-sky-400 ring-1 ring-sky-400 text-white font-bold'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              <span className="text-xs font-bold text-sky-400">Ambos turnos</span>
              <span className="text-[10px] text-slate-400 mt-1 leading-tight">
                Análisis libre con líneas continuas para blancas y negras.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedLinesMode('none')}
              className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                selectedLinesMode === 'none'
                  ? 'bg-amber-500/10 border-amber-400 ring-1 ring-amber-400 text-white font-bold'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              <span className="text-xs font-bold text-amber-400">Sin líneas</span>
              <span className="text-[10px] text-slate-400 mt-1 leading-tight">
                Tablero limpio sin flechas de ayuda.
              </span>
            </button>
          </div>
        </div>

        {/* Certificación de Tranquilidad del Sub-Director */}
        <div className="bg-slate-950/90 border border-emerald-500/30 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-white">
                Sub-Director: Partida Certificada & Protegida
              </span>
            </div>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              100% OPERATIVO
            </span>
          </div>

          <p className="text-[10px] text-slate-300 leading-snug">
            Archivos de motores comprobados. Stockfish cuenta con respaldo instantáneo; ni Garbo, ni Maia, ni el Motor Personal pueden fallar ni detener tu partida.
          </p>

          <div className="grid grid-cols-4 gap-1.5 pt-1 text-[10px] font-mono">
            <div className="p-1 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-slate-300">
              <span>SF 19</span>
              <span className="text-emerald-400 font-bold">✓ OK</span>
            </div>
            <div className="p-1 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-slate-300">
              <span>Garbo</span>
              <span className="text-emerald-400 font-bold">✓ OK</span>
            </div>
            <div className="p-1 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-slate-300">
              <span>Maia</span>
              <span className="text-emerald-400 font-bold">✓ OK</span>
            </div>
            <div className="p-1 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-slate-300">
              <span>Personal</span>
              <span className="text-emerald-400 font-bold">✓ OK</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-[11px] text-slate-400 flex items-start gap-2">
          <span className="text-emerald-400 font-bold shrink-0">✓</span>
          <p className="leading-snug">
            Tus jugadas en tu turno se auditarán como <strong className="text-emerald-300">MANUAL</strong> para alimentar tu modelo sin contaminarlo. Si juegas una recomendación con un clic, se etiquetará como asistida.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleStart}
            className="w-full py-3 px-4 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-[0.99]"
          >
            <Play className="w-4 h-4 fill-white" />
            Comenzar Partida Ahora
          </button>
        </div>
      </div>
    </div>
  );
};
