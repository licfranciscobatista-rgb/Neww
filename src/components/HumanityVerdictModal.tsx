import React from 'react';
import { X, Brain, Cpu, UserCheck, ShieldCheck, Info } from 'lucide-react';
import { HumanityVerdictResult } from '../engine/humanityVerdict';

interface HumanityVerdictModalProps {
  isOpen: boolean;
  onClose: () => void;
  moveSan: string;
  verdict: HumanityVerdictResult | null;
}

export const HumanityVerdictModal: React.FC<HumanityVerdictModalProps> = ({
  isOpen,
  onClose,
  moveSan,
  verdict,
}) => {
  if (!isOpen || !verdict) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-200 relative">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Auditoría de Humanidad: <span className="font-mono text-sky-400">{moveSan}</span>
              </h3>
              <p className="text-xs text-slate-400">Contrarevisión multi-motor de la jugada</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`p-4 rounded-xl border flex items-center justify-between ${verdict.badgeColor}`}>
          <div>
            <span className="text-xs uppercase font-bold tracking-wider block opacity-80">
              Veredicto de Humanidad
            </span>
            <span className="text-lg font-black block">
              {verdict.verdictLabel}
            </span>
            <p className="text-xs opacity-90 mt-0.5 leading-snug">
              {verdict.synthesis}
            </p>
          </div>
          <div className="text-right shrink-0 ml-3">
            <span className="text-3xl font-black font-mono block">
              {verdict.score}%
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
              Índice
            </span>
          </div>
        </div>

        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              Estado de Calibración Histórica
            </span>
            <span className="font-mono font-bold text-sky-400">
              {verdict.gamesPlayed} / {verdict.calibratingTarget} partidas
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all rounded-full ${
                verdict.isCalibrated ? 'bg-emerald-500' : 'bg-sky-500'
              }`}
              style={{
                width: `${Math.min(100, Math.round((verdict.gamesPlayed / verdict.calibratingTarget) * 100))}%`,
              }}
            />
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            {verdict.isCalibrated
              ? '✓ Calibración completa alcanzada (≥10 partidas). El veredicto cuenta con máxima fiabilidad estadística.'
              : `Calibración preliminar en curso (${verdict.gamesPlayed}/10 partidas). Conforme acumules 10 partidas, el veredicto afinará la discriminación entre tu estilo y cálculo de motor.`}
          </p>
        </div>

        <div className="space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Desglose de los 3 Filtros de Verificación
          </span>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">1. Ayuda de Análisis Objetivo</span>
                <span className="font-mono text-blue-400 font-semibold">
                  Δ -{verdict.analysisStep.lossInPawns} peones
                </span>
              </div>
              <p className="text-slate-400 mt-1 leading-snug text-[11px]">
                {verdict.analysisStep.isTopEngineChoice
                  ? 'Coincide con la primera elección de la máquina (Stockfish).'
                  : `Diferencia de ${verdict.analysisStep.lossInPawns} peones respecto a la jugada óptima por cálculo.`}
              </p>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">2. Confrontación con tu Historial</span>
                <span className="font-mono text-amber-400 font-semibold">
                  {verdict.historyStep.personalAffinity}% afinidad
                </span>
              </div>
              <p className="text-slate-400 mt-1 leading-snug text-[11px]">
                {verdict.historyStep.isRegisteredHabit
                  ? `Registrada previamente en tu memoria consolidada (${verdict.historyStep.matchedPatternCategory || 'hábito táctico'}).`
                  : 'Alineada con tu perfil general de agresividad, paciencia y actividad de piezas.'}
              </p>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
              <Brain className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">3. Contrarevisión de Maia 3</span>
                <span className="font-mono text-purple-400 font-semibold">
                  {verdict.maiaStep.humanProbability}% prob. humana
                </span>
              </div>
              <p className="text-slate-400 mt-1 leading-snug text-[11px]">
                Evaluada contra el modelo de redes neuronales humanas para nivel Elo {verdict.maiaStep.targetElo}.
                {verdict.maiaStep.isMaiaCandidate
                  ? ` Maia la considera una respuesta humana sumamente verosímil.`
                  : ` La jugada más humana para Maia en esta posición era ${verdict.maiaStep.maiaTopSan}.`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            Motor Personal & Maia 3 Offline
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold text-xs transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
