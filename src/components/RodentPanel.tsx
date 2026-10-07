import React, { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { ArrowRight, Check, Compass, Eye, EyeOff, LoaderCircle, X } from 'lucide-react';
import { RealRodentManager } from '../engine/realRodent';
import { followSystem, proposeSystem, type SystemProposal } from '../engine/rodentAdvisor';
import { queryOpening } from '../engine/openingService';
import { OPENING_PRESETS } from '../engine/openingIndex';
import { systemReply } from '../engine/systemReply';
import { lostSystemObjective } from '../engine/systemObjectives';

export interface RodentArrow { from: string; to: string; }
export function RodentPanel({ chess, gameId, userColor, selected, currentMove, garboLoading, activeSystem, onAccept, onResumeGarbo, onArrow, onMove, systemsMode = false, onThreat }: {
  onThreat?: (fen: string, arrow: RodentArrow | null) => void;
  systemsMode?: boolean;
  chess: Chess; gameId: string; userColor: 'w' | 'b'; selected: string; currentMove?: string; garboLoading: boolean;
  activeSystem: string | null; onAccept: (proposal: SystemProposal) => void; onResumeGarbo: () => void;
  onArrow: (fen: string, arrow: RodentArrow | null) => void; onMove: (uci: string) => void;
}) {
  const [engine] = useState(() => new RealRodentManager());
  const [state, setState] = useState<{ fen: string; proposal: SystemProposal | null; continuation: Awaited<ReturnType<typeof followSystem>>; loading: boolean; rejected: boolean; unavailable: boolean }>({ fen: '', proposal: null, continuation: null, loading: false, rejected: false, unavailable: false });
  const [visible, setVisible] = useState(true);
  const [warning, setWarning] = useState<{ fen: string; text: string; arrow: RodentArrow | null } | null>(null);
  const fen = chess.fen();
  const history = chess.pgn();
  useEffect(() => () => engine.terminate(), [engine]);
  useEffect(() => {
    let cancelled = false;
    setWarning(null);
    setState({ fen, proposal: null, continuation: null, loading: !chess.isGameOver() && chess.turn() === userColor && (!garboLoading || !!activeSystem), rejected: false, unavailable: false });
    const rivalTurn = chess.turn() !== userColor;
    if (chess.isGameOver() || (rivalTurn && !systemsMode) || (!rivalTurn && garboLoading && !activeSystem)) return;
    const board = new Chess(fen);
    if (history) { try { board.loadPgn(history); } catch { /* Use validated FEN. */ } }
    const analyze = async (position: string) => {
      if (cancelled) return null;
      const result = await engine.analyze(position);
      if (!result && !cancelled) setState(previous => ({ ...previous, unavailable: true }));
      return result;
    };
    const timer = setTimeout(() => {
      void (async () => {
        if (rivalTurn) {
          const reply = await systemReply(board, null, analyze, activeSystem || selected);
          if (!cancelled) { if (reply) setWarning({ fen, ...reply }); setState(previous => ({ ...previous, loading: false })); }
          return;
        }
        const continuation = activeSystem ? await followSystem(board, activeSystem, analyze, queryOpening) : null;
        const proposal = activeSystem || (systemsMode && !lostSystemObjective(board, selected)) ? null : await proposeSystem(board, selected, currentMove, analyze, queryOpening, () => cancelled);
        const plannedMove = activeSystem ? continuation?.move : currentMove;
        const text = systemsMode && plannedMove ? await systemReply(board, plannedMove, analyze, activeSystem || selected) : null;
        if (!cancelled && text) setWarning({ fen, ...text });
        if (!cancelled) setState(previous => ({ ...previous, fen, continuation, proposal, loading: false }));
      })().catch(() => { if (!cancelled) setState(previous => ({ ...previous, loading: false, unavailable: true })); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); engine.terminate(); };
  }, [engine, fen, history, userColor, selected, currentMove, garboLoading, activeSystem, gameId, systemsMode]);
  const current = state.fen === fen;
  useEffect(() => { onThreat?.(fen, systemsMode && warning?.fen === fen ? warning.arrow : null); }, [fen, systemsMode, warning, onThreat]);
  const continuation = current ? state.continuation : null;
  // Only an accepted system may add Rodent's arrow to the board.
  const uci = visible ? continuation?.move : undefined;
  useEffect(() => { onArrow(fen, uci ? { from: uci.slice(0, 2), to: uci.slice(2, 4) } : null); }, [fen, uci, onArrow]);
  const proposal = current && !state.rejected ? state.proposal : null;
  return <section aria-label="Rodent" className="border border-teal-700/50 rounded-lg p-3.5 min-w-0 flex flex-col gap-3">
    {systemsMode && warning?.fen === fen && <p role="status" className="text-xs text-amber-300">{warning.text}</p>}
    <header className="flex items-center justify-between gap-2"><h4 className="text-sm font-bold text-teal-300 flex items-center gap-2"><Compass size={17} />Rodent IV</h4>{activeSystem && <button type="button" aria-label="Mostrar u ocultar flecha de Rodent" aria-pressed={visible} onClick={() => setVisible(value => !value)} title="Flecha de Rodent">{visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>}</header>
    {state.loading && current ? <LoaderCircle size={18} className="animate-spin text-teal-300" aria-label="Rodent analizando sistemas" /> : activeSystem ? <>
      <span className="text-xs text-teal-300">{OPENING_PRESETS.find(preset => preset.id === activeSystem)?.name || activeSystem}</span>
      <p role="status" className="text-xs text-slate-300">{continuation?.text || (state.unavailable ? 'Rodent no disponible; sin recomendacion verificada.' : chess.isGameOver() ? 'Partida finalizada.' : 'Esperando tu turno.')}</p>
      {continuation && <div className="flex justify-between items-center gap-2"><strong>{continuation.san}</strong><button type="button" onClick={() => onMove(continuation.move)} aria-label="Jugar recomendación de Rodent" title="Jugar recomendacion de Rodent" className="p-2 rounded bg-teal-700"><ArrowRight size={18} /></button></div>}
      <button type="button" onClick={onResumeGarbo} className="text-xs text-emerald-300 text-left">Volver a Garbo</button>
    </> : proposal ? <>
      <strong className="text-teal-200 text-sm">{proposal.name}: {proposal.san}</strong>
      <p role="status" className="text-xs text-slate-300 leading-relaxed">{proposal.reason}</p>
      <div className="flex gap-3 flex-wrap"><button type="button" onClick={() => onAccept(proposal)} className="flex items-center gap-1 px-2 py-2 rounded bg-teal-700 text-xs"><Check size={15} />Aceptar cambio</button><button type="button" onClick={() => setState(previous => ({ ...previous, rejected: true }))} className="flex items-center gap-1 text-xs text-slate-300"><X size={15} />Mantener Garbo</button></div>
    </> : <p role="status" className="text-xs text-slate-400">{state.unavailable ? 'Rodent no disponible; sin propuesta verificada.' : state.rejected ? 'Garbo continua con el sistema elegido.' : selected === 'free' ? 'Selecciona un sistema en Garbo.' : chess.turn() !== userColor ? 'Esperando tu turno.' : 'Sin otro sistema reconocido de evaluacion comparable.'}</p>}
  </section>;
}
