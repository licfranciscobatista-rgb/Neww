import React, { useEffect, useState, useMemo } from 'react';
import { Chess, type Square } from 'chess.js';
import {
  Compass,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldAlert,
  Target,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Swords,
  Layers,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  getLiveRodentRecommendation,
  getLiveRivalThreat,
  type RodentRecommendation,
  type RivalThreatInfo,
  type SystemProposal,
} from '../engine/rodentAdvisor';
import { getSystemAnalysis } from '../engine/systemObjectives';
import { OPENING_PRESETS, detectRecommendedSystem } from '../engine/openingIndex';
import { getDirectMoveInstruction } from '../utils/moveInstruction';

export interface RodentArrow {
  from: string;
  to: string;
}

interface RodentPanelProps {
  chess: Chess;
  gameId: string;
  userColor: 'w' | 'b';
  selected: string;
  currentMove?: string;
  garboSan?: string;
  garboLoading: boolean;
  activeSystem: string | null;
  onAccept: (proposal: SystemProposal) => void;
  onResumeGarbo: () => void;
  onArrow: (fen: string, arrow: RodentArrow | null) => void;
  onMove: (uci: string) => void;
  systemsMode?: boolean;
  onThreat?: (fen: string, arrow: RodentArrow | null) => void;
  onChangeSystem?: (id: string) => void;
}

export function RodentPanel({
  chess,
  userColor,
  selected,
  currentMove,
  garboSan,
  onArrow,
  onMove,
  systemsMode = false,
  onThreat,
  onChangeSystem,
}: RodentPanelProps) {
  const [personality, setPersonality] = useState<'agresivo' | 'solido' | 'dinamico'>('dinamico');
  const [visibleArrow, setVisibleArrow] = useState(true);
  const [rodentRec, setRodentRec] = useState<RodentRecommendation | null>(null);
  const [rivalThreat, setRivalThreat] = useState<RivalThreatInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSystemDetails, setShowSystemDetails] = useState(false);

  const fen = chess.fen();
  const isPlayerTurn = chess.turn() === userColor;

  // Detección atenta de sistema cuando está en modo libre o sin sistema fijado
  const isFreeMode = selected === 'free' || selected === 'auto';
  const recommendedSystem = useMemo(() => {
    return detectRecommendedSystem(chess, userColor);
  }, [chess, userColor]);
  const effectiveSystem = isFreeMode ? recommendedSystem.id : (selected || 'london');

  // 1. Análisis de Rodent y de la amenaza rival en cada cambio de posición
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const [rec, threat] = await Promise.all([
          getLiveRodentRecommendation(chess, personality, effectiveSystem, { uci: currentMove, san: garboSan }),
          getLiveRivalThreat(chess, effectiveSystem),
        ]);

        if (!cancelled) {
          setRodentRec(rec);
          setRivalThreat(threat);
          setLoading(false);

          // Emitir flecha de amenaza rival al tablero
          if (threat && onThreat) {
            onThreat(fen, { from: threat.from, to: threat.to });
          } else if (onThreat) {
            onThreat(fen, null);
          }
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fen, personality, effectiveSystem, chess, onThreat, currentMove, garboSan]);

  // 2. Emitir flecha de Rodent al tablero
  useEffect(() => {
    if (visibleArrow && rodentRec && isPlayerTurn) {
      onArrow(fen, { from: rodentRec.from, to: rodentRec.to });
    } else {
      onArrow(fen, null);
    }
  }, [fen, rodentRec, visibleArrow, isPlayerTurn, onArrow]);

  // 3. Análisis dinámico de hitos y estructura del sistema activo
  const systemAnalysis = useMemo(() => {
    return getSystemAnalysis(chess, effectiveSystem);
  }, [chess, effectiveSystem]);

  const activeSystemName = OPENING_PRESETS.find(p => p.id === effectiveSystem)?.name || systemAnalysis.systemName;

  const moveInstr = rodentRec
    ? getDirectMoveInstruction(chess, rodentRec.from, rodentRec.to, rodentRec.san)
    : null;

  return (
    <div className="space-y-3 w-full">
      {/* Alerta de Recomendación Activa de Sistema de Rodent y Garbo */}
      {isFreeMode && (
        <div className="bg-amber-950/40 border border-amber-500/50 rounded-xl p-3 text-xs shadow-md space-y-2 animate-in fade-in">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-amber-200">
                    {chess.history().length >= 1
                      ? `Sistema Recomendado tras Jugada 1: ${recommendedSystem.name}`
                      : `Sistema Recomendado: ${recommendedSystem.name}`}
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-900/60 text-amber-300 border border-amber-700/40">
                    Rodent & Garbo Atentos
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                  {recommendedSystem.reason} En Modo Sistemas la partida no puede ir sin sistema; Rodent y Garbo ya han sincronizado sus planes con este esquema.
                </p>
              </div>
            </div>
            {onChangeSystem && (
              <button
                type="button"
                onClick={() => onChangeSystem(recommendedSystem.id)}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 transition-transform active:scale-95 shadow-xs flex items-center gap-1"
              >
                <span>✓ Adoptar {recommendedSystem.name}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          CASILLA 2: RODENT IV — MOTOR DE CONTRAJUEGO & PERSONALIDAD TÁCTICA
          ========================================================================= */}
      <section
        aria-label="Rodent IV"
        className="bg-slate-900/90 border border-teal-500/40 rounded-xl p-3.5 flex flex-col justify-between shadow-lg relative overflow-hidden transition-all hover:border-teal-500/70"
      >
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-300">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <span>Rodent IV</span>
                  <span className="text-[10px] font-mono text-teal-400 font-semibold px-1 py-0.2 rounded bg-teal-950/60 border border-teal-800/40">
                    WASM
                  </span>
                </h4>
                <p className="text-[10px] text-teal-400 font-medium">Contrajuego & Personalidad</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setVisibleArrow(!visibleArrow)}
                title={visibleArrow ? 'Ocultar flecha de Rodent en tablero' : 'Mostrar flecha de Rodent en tablero'}
                className={`p-1.5 rounded transition-colors ${
                  visibleArrow ? 'text-teal-300 bg-teal-950/40 border border-teal-700/50' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {visibleArrow ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
            </div>
          </div>

          {/* Selector interactivo de Personalidad de Rodent */}
          <div className="flex items-center gap-1 my-2 p-1 bg-slate-950/80 rounded-lg border border-slate-800 text-[10px]">
            <button
              type="button"
              onClick={() => setPersonality('agresivo')}
              className={`flex-1 py-1 px-1.5 rounded font-bold transition-all text-center flex items-center justify-center gap-1 ${
                personality === 'agresivo'
                  ? 'bg-rose-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title="Rodent busca rupturas directas, iniciativa y ataque al rey"
            >
              <Swords className="w-3 h-3" />
              <span>Agresivo</span>
            </button>
            <button
              type="button"
              onClick={() => setPersonality('solido')}
              className={`flex-1 py-1 px-1.5 rounded font-bold transition-all text-center flex items-center justify-center gap-1 ${
                personality === 'solido'
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title="Rodent prioriza la profilaxis, la armonía y la seguridad posicional"
            >
              <ShieldAlert className="w-3 h-3" />
              <span>Sólido</span>
            </button>
            <button
              type="button"
              onClick={() => setPersonality('dinamico')}
              className={`flex-1 py-1 px-1.5 rounded font-bold transition-all text-center flex items-center justify-center gap-1 ${
                personality === 'dinamico'
                  ? 'bg-sky-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title="Rodent equilibra el juego de piezas activas y táctica flexible"
            >
              <Sparkles className="w-3 h-3" />
              <span>Dinámico</span>
            </button>
          </div>

          {/* Caja principal de jugada de Rodent */}
          {loading && !rodentRec ? (
            <div className="py-5 flex items-center justify-center gap-2 text-xs text-slate-400 animate-pulse">
              <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin border-teal-400" />
              <span>Rodent calculando variante con estilo {personality}...</span>
            </div>
          ) : rodentRec && moveInstr ? (
            <div className="space-y-2.5 my-1">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-teal-950/60 border border-teal-600/40 flex items-center justify-center text-xl shadow-inner shrink-0 text-teal-300">
                    {moveInstr.pieceSymbol}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate">
                      {rodentRec.planTitle || moveInstr.actionTitle}
                    </span>
                    <span className="text-[11px] font-mono text-teal-400 block font-semibold">
                      {moveInstr.fromToLabel}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <span className="text-sm font-black font-mono text-white block">
                    {rodentRec.san}
                  </span>
                  <span className="text-[10px] text-teal-300 font-bold">
                    {rodentRec.evalDisplay} · Prof. {rodentRec.depth}
                  </span>
                </div>
              </div>

              {/* Relación de Rodent con Garbo y el Sistema (Directo y Sin Párrafos) */}
              <div className="bg-teal-950/30 border border-teal-800/40 rounded-lg p-2.5 space-y-1.5 text-xs">
                {/* Badge de Relación con Garbo en el Mismo Sistema */}
                {rodentRec.contrastWithGarbo && (
                  <div className={`p-2 rounded-lg border text-xs flex items-center gap-2 ${
                    rodentRec.isAlternativeToGarbo
                      ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                      : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                  }`}>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 uppercase tracking-wide font-mono ${
                      rodentRec.isAlternativeToGarbo
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {rodentRec.isAlternativeToGarbo ? '⚡ Variante Alternativa' : '✓ Consenso'}
                    </span>
                    <span className="text-[11px] leading-tight font-medium">
                      {rodentRec.contrastWithGarbo}
                    </span>
                  </div>
                )}

                <div className="text-[11px] text-slate-300 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="text-teal-400 font-bold shrink-0">Objetivo:</span>
                    <span className="truncate">{rodentRec.tacticalIntent}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 capitalize shrink-0">
                    Modo {personality}
                  </span>
                </div>
              </div>

              {/* Botón de 1-clic para jugar la jugada */}
              <button
                type="button"
                disabled={!isPlayerTurn || chess.isGameOver()}
                onClick={() => onMove(rodentRec.uci)}
                className={`w-full py-2 px-3 rounded-lg border font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                  !isPlayerTurn
                    ? 'bg-slate-800/40 border-slate-700/40 text-slate-500 cursor-not-allowed'
                    : 'bg-teal-700 hover:bg-teal-600 border-teal-600 hover:border-teal-500 text-white active:scale-[0.99]'
                }`}
              >
                <span>
                  {!isPlayerTurn
                    ? 'Esperando tu turno...'
                    : `Jugar con Rodent: ${moveInstr.pieceName} a ${rodentRec.to.toUpperCase()} (${rodentRec.san})`}
                </span>
                {isPlayerTurn && <ArrowRight className="w-3.5 h-3.5 text-teal-200" />}
              </button>
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-slate-400">
              {chess.isGameOver() ? 'Partida finalizada' : 'Rodent analizando tablero...'}
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          CASILLA 3: RADAR DE OBJETIVOS EN SEGUNDO PLANO (COMPACTO Y SIN TEXTO MOLESTO)
          ========================================================================= */}
      <section
        aria-label="Radar de Objetivos en Segundo Plano"
        className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3 space-y-2 shadow-lg"
      >
        {(() => {
          const completedMilestones = systemAnalysis.milestones.filter(m => m.status === 'completed').length;
          const totalMilestones = systemAnalysis.milestones.length;
          const progressPercent = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

          return (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                    <Target className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-200">Radar del Sistema (2º Plano)</h4>
                      <span className="text-[10px] text-indigo-400 font-medium truncate max-w-[130px] sm:max-w-[200px]">
                        {activeSystemName}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950/70 border border-indigo-800/50 text-indigo-300 font-mono">
                    {completedMilestones}/{totalMilestones} Hitos ({progressPercent}%)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSystemDetails(prev => !prev)}
                    title={showSystemDetails ? "Ocultar panel detallado" : "Ver hitos estratégicos"}
                    className="p-1 text-indigo-400 hover:text-indigo-200 rounded hover:bg-slate-800 transition-colors"
                  >
                    {showSystemDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Barra Compacta de Progreso */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-indigo-500 to-emerald-400 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Vista opcional desplegable (cerrada por defecto para no interferir en la partida) */}
              {showSystemDetails && (
                <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{systemAnalysis.pawnStructureTitle}</span>
                    </span>
                    <span className="text-[10px] text-indigo-400 font-mono font-bold">
                      {progressPercent}% alcanzado
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-1">
                    {systemAnalysis.milestones.map((milestone) => {
                      const isDone = milestone.status === 'completed';
                      const isInProgress = milestone.status === 'in_progress';
                      return (
                        <div
                          key={milestone.id}
                          className={`px-2.5 py-1 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                            isDone
                              ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-200'
                              : isInProgress
                              ? 'bg-indigo-950/20 border-indigo-500/20 text-indigo-200'
                              : 'bg-slate-950/30 border-slate-800/60 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isDone ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            ) : isInProgress ? (
                              <Clock className="w-3 h-3 text-indigo-400 shrink-0" />
                            ) : (
                              <AlertCircle className="w-3 h-3 text-slate-500 shrink-0" />
                            )}
                            <span className="font-semibold text-[11px] truncate text-slate-200">
                              {milestone.title}
                            </span>
                          </div>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 font-mono ${
                              isDone
                                ? 'bg-emerald-900/60 text-emerald-300'
                                : isInProgress
                                ? 'bg-indigo-900/60 text-indigo-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isDone ? 'Conquistado' : isInProgress ? 'En marcha' : 'Pendiente'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </section>

      {/* =========================================================================
          CASILLA 4: VIGILANCIA TÁCTICA & DETECCIÓN DE AMENAZA RIVAL
          ========================================================================= */}
      <section
        aria-label="Vigilancia Táctica Rival"
        className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3.5 space-y-2.5 shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">Vigilancia Táctica & Amenaza Rival</h4>
              <p className="text-[10px] text-amber-400 font-medium">Profilaxis & Alerta Temprana</p>
            </div>
          </div>
          <span
            className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${
              rivalThreat?.threatLevel === 'alta'
                ? 'bg-rose-950/70 border-rose-700/60 text-rose-300 animate-pulse'
                : rivalThreat?.threatLevel === 'media'
                ? 'bg-amber-950/70 border-amber-700/60 text-amber-300'
                : 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300'
            }`}
          >
            {rivalThreat?.threatLevel === 'alta'
              ? 'Amenaza Activa'
              : rivalThreat?.threatLevel === 'media'
              ? 'Presión Posicional'
              : 'Posición Sólida'}
          </span>
        </div>

        {rivalThreat ? (
          <div className="space-y-2 text-xs">
            <div className="bg-slate-950/80 border border-amber-900/40 rounded-lg p-2.5 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                <span>Respuesta Crítica Anticipada</span>
                <span className="font-mono bg-amber-950/60 px-1.5 py-0.5 rounded text-amber-200 border border-amber-800/50">
                  {rivalThreat.san} ({rivalThreat.from} → {rivalThreat.to})
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {rivalThreat.explanation}
              </p>
            </div>

            {/* Consejo de profilaxis */}
            <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-2.5 space-y-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                Plan de Profilaxis Recomendado:
              </span>
              <p className="text-[11px] text-slate-200 leading-relaxed">
                {rivalThreat.prophylaxisTip}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-1">
            No se detectan amenazas tácticas inmediatas del rival. Estructura y piezas estables.
          </p>
        )}
      </section>
    </div>
  );
}

