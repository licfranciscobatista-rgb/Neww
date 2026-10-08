import React, { useEffect, useState, useMemo } from 'react';
import { Chess, type Square } from 'chess.js';
import { Compass, Eye, EyeOff, ArrowRight, ShieldAlert, Settings2, Check } from 'lucide-react';
import {
  getLiveRodentRecommendation,
  getLiveRivalThreat,
  proposeSaferSystem,
  type RodentRecommendation,
  type RivalThreatInfo,
  type SystemProposal,
} from '../engine/rodentAdvisor';
import { getSystemAnalysis } from '../engine/systemObjectives';
import { OPENING_PRESETS } from '../engine/openingIndex';
import { getDirectMoveInstruction } from '../utils/moveInstruction';
import { identifySystem } from '../engine/systemsCoordinator';
import { realRodent } from '../engine/realRodent';
import { OpeningPicker } from './OpeningPicker';

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
  gameId,
  userColor,
  selected,
  currentMove,
  garboSan,
  garboLoading,
  onAccept,
  onArrow,
  onMove,
  systemsMode = false,
  onThreat,
  onChangeSystem,
}: RodentPanelProps) {
  const personality = 'dinamico' as const;
  const [visibleArrow, setVisibleArrow] = useState(true);
  const [rodentRec, setRodentRec] = useState<RodentRecommendation | null>(null);
  const [rivalThreat, setRivalThreat] = useState<RivalThreatInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [systemPickerOpen, setSystemPickerOpen] = useState(false);
  const [proposal, setProposal] = useState<SystemProposal | null>(null);
  const [checkingChange, setCheckingChange] = useState(false);
  const [rejectedFen, setRejectedFen] = useState('');

  const fen = chess.fen();
  const isPlayerTurn = chess.turn() === userColor;

  // Detección atenta de sistema cuando está en modo libre o sin sistema fijado
  const isFreeMode = selected === 'free' || selected === 'auto';
  const recommendedSystem = useMemo(() => {
    return identifySystem(chess, userColor, selected);
  }, [chess, userColor, selected]);
  const effectiveSystem = isFreeMode ? recommendedSystem.id : (selected || 'london');

  // 1. Análisis de Rodent y de la amenaza rival en cada cambio de posición
  useEffect(() => {
    let cancelled = false;
    setRodentRec(null);
    setRivalThreat(null);
    setProposal(null);
    setCheckingChange(false);
    onArrow(fen, null);
    onThreat?.(fen, null);
    if (chess.isGameOver() || !systemsMode) { setLoading(false); return; }
    if (isPlayerTurn && garboLoading) { setLoading(true); return; }
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const rec = isPlayerTurn ? await getLiveRodentRecommendation(chess, personality, effectiveSystem,
          { uci: currentMove, san: garboSan }, () => cancelled) : null;
        if (cancelled) return;
        const threat = await getLiveRivalThreat(chess, effectiveSystem, userColor, rec?.uci || currentMove);

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
          if (rec?.systemPlan?.changeNeeded && rejectedFen !== fen) {
            setCheckingChange(true);
            const next = await proposeSaferSystem(chess, rec.systemPlan,
              position => realRodent.analyze(position, 100, personality), () => cancelled);
            if (!cancelled) { setProposal(next); setCheckingChange(false); }
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
  }, [fen, gameId, personality, effectiveSystem, chess, onThreat, onArrow, currentMove, garboSan, garboLoading, isPlayerTurn, systemsMode, userColor]);

  // 2. Emitir flecha de Rodent al tablero
  useEffect(() => {
    if (visibleArrow && rodentRec?.systemPlan?.fen === fen && isPlayerTurn) {
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

  const moveInstr = rodentRec?.systemPlan?.fen === fen
    ? getDirectMoveInstruction(chess, rodentRec.from, rodentRec.to, rodentRec.san)
    : null;

  return (
    <section aria-label="Rodent IV" className="bg-slate-900/90 border border-teal-500/40 rounded-lg p-3.5 space-y-3 shadow-lg">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="w-4 h-4 text-teal-300 shrink-0" />
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-200">Rodent IV</h4>
            <p className="text-[11px] text-teal-300 break-words">
              {activeSystemName}{isFreeMode && recommendedSystem.provisional ? ' · Provisional' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isFreeMode && <button type="button" onClick={() => onChangeSystem?.(effectiveSystem)}
            aria-label="Fijar sistema detectado" title="Fijar sistema detectado"
            className="p-2 text-teal-300 hover:bg-slate-800 rounded"><Check size={16} /></button>}
          <button type="button" onClick={() => setSystemPickerOpen(true)}
            aria-label="Cambiar sistema desde Rodent" title="Cambiar sistema"
            className="p-2 text-teal-300 hover:bg-slate-800 rounded"><Settings2 size={16} /></button>
          <button type="button" onClick={() => setVisibleArrow(value => !value)}
            aria-label={visibleArrow ? 'Ocultar flecha de Rodent' : 'Mostrar flecha de Rodent'}
            title={visibleArrow ? 'Ocultar flecha de Rodent' : 'Mostrar flecha de Rodent'}
            className="p-2 text-teal-300 hover:bg-slate-800 rounded">
            {visibleArrow ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>
      </header>

      {loading && !rodentRec ? (
        <p className="py-3 text-xs text-slate-400 animate-pulse">Comprobando el plan del sistema...</p>
      ) : rodentRec && moveInstr ? (
        <>
          <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white break-words">{moveInstr.actionTitle}</p>
              <p className="text-[11px] font-mono text-teal-300">{moveInstr.fromToLabel}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold font-mono text-white">{rodentRec.san}</p>
              <p className="text-[10px] text-teal-300">
                {rodentRec.source === 'fallback' ? 'Respaldo heurístico' : `${rodentRec.evalDisplay} · Prof. ${rodentRec.depth}`}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {rodentRec.isAlternativeToGarbo ? 'Alternativa en el mismo sistema. ' : 'Coincide con Garbo. '}
            {rodentRec.tacticalIntent}
          </p>
          <button type="button" disabled={!isPlayerTurn || chess.isGameOver()}
            onClick={() => onMove(rodentRec.uci)}
            className="w-full py-2 px-3 rounded border border-teal-600 bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            Jugar con Rodent: {moveInstr.pieceName} a {rodentRec.to.toUpperCase()} ({rodentRec.san})
            <ArrowRight size={14} className="shrink-0" />
          </button>
        </>
      ) : (
        <p className="text-xs text-slate-400 py-2">
          {chess.isGameOver() ? 'Partida finalizada' : !isPlayerTurn ? 'Turno rival' : 'Sin recomendación comprobada'}
        </p>
      )}

      {rivalThreat && <div aria-label="Respuesta rival que afecta al sistema"
        className="flex items-start gap-2 border-t border-amber-800/50 pt-2 text-[11px] text-amber-200">
        <ShieldAlert size={14} className="shrink-0 mt-0.5" />
        <p className="leading-relaxed"><strong>{rivalThreat.san}: </strong>{rivalThreat.explanation}</p>
      </div>}
      {checkingChange && <p role="status" className="text-xs text-amber-300">Comprobando un cambio de sistema...</p>}
      {proposal && proposal.fen === fen && <div aria-label="Propuesta de cambio de sistema" className="border-t border-amber-700 pt-3 space-y-2 text-xs">
        <strong className="text-amber-200">{proposal.name} · {proposal.san}</strong>
        <p className="text-slate-300">{proposal.reason}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { onAccept({ ...proposal, sourceSystem: selected }); setProposal(null); }}
            className="bg-emerald-700 px-3 py-2 rounded text-white">Aceptar cambio de sistema</button>
          <button type="button" onClick={() => { setRejectedFen(fen); setProposal(null); }}
            className="border border-slate-600 px-3 py-2 rounded text-slate-200">Mantener sistema</button>
        </div>
      </div>}
      {!checkingChange && !proposal && rodentRec?.systemPlan?.changeNeeded && <p className="text-xs text-amber-300">
        {rejectedFen === fen ? 'Mantienes el sistema actual.' : 'No se comprobó otro sistema suficientemente seguro. El actual sigue seleccionado.'}
      </p>}
      {systemPickerOpen && <OpeningPicker selected={selected} userColor={userColor}
        title="Cambiar sistema"
        onSelect={id => { onChangeSystem?.(id); setSystemPickerOpen(false); }}
        onClose={() => setSystemPickerOpen(false)} />}
    </section>
  );
}

