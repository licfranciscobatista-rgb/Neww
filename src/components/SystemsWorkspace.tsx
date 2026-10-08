import React from 'react';
import { ArrowRight, Check, Eye, EyeOff, ShieldAlert, X } from 'lucide-react';
import type { SystemsSnapshot } from '../engine/systemAssistants';
import type { SystemProposal } from '../engine/rodentAdvisor';
import { OPENING_PRESETS, isSystemCompatibleWithColor } from '../engine/openingIndex';
import type { SystemPreferences } from '../engine/systemPreferences';

export function SystemsDecision({ snapshot, visible, onToggle, onAccept, onReject, onAdopt }: {
  snapshot: SystemsSnapshot | null; visible: boolean; onToggle: () => void;
  onAccept: (proposal: SystemProposal) => void; onReject: () => void; onAdopt: () => void;
}) {
  return <div className="flex flex-wrap items-center gap-2 text-xs text-teal-200">
    <strong>{snapshot?.systemName || 'Identificando sistema'}{snapshot?.provisional ? ' · Provisional' : ''}</strong>
    {snapshot?.proposal ? <><span className="text-amber-200">Propuesta: {snapshot.proposal.name}</span>
      <button title={snapshot.proposal.reason} onClick={() => onAccept(snapshot.proposal!)} className="flex items-center gap-1 bg-emerald-700 px-2 py-1 rounded"><Check size={14} />Aceptar cambio</button>
      <button onClick={onReject} className="flex items-center gap-1 border border-slate-600 px-2 py-1 rounded"><X size={14} />Mantener actual</button></>
      : snapshot?.provisional ? <button onClick={onAdopt} className="flex items-center gap-1 border border-teal-700 px-2 py-1 rounded"><Check size={14} />Adoptar sistema</button> : null}
    <button aria-label="Flechas de sistemas" aria-pressed={visible} onClick={onToggle} className="flex items-center gap-1 px-2 py-1 rounded border border-teal-700">{visible ? <Eye size={14} /> : <EyeOff size={14} />}Flechas {visible ? 'On' : 'Off'}</button>
  </div>;
}

export function SystemsRodent({ snapshot, onMove }: { snapshot: SystemsSnapshot | null; onMove: (uci: string) => void }) {
  const alternative = snapshot?.alternative;
  return <section aria-label="Rodent IV" className="bg-slate-900/90 border border-teal-500/40 rounded-lg p-3.5 space-y-3">
    <header><h4 className="text-xs font-bold text-slate-200">Rodent IV</h4><p className="text-xs text-teal-300">{snapshot?.systemName}</p></header>
    {alternative ? <><strong className="text-white text-sm">{alternative.san}</strong><p className="text-xs text-slate-300">{alternative.reason}</p>
      <button onClick={() => onMove(alternative.move)} className="flex items-center justify-center gap-2 w-full py-2 rounded bg-teal-700 text-white text-xs">Jugar alternativa: {alternative.san}<ArrowRight size={14} /></button></>
      : <p role="status" className="text-xs text-slate-400">{snapshot?.loading ? 'Comprobando continuaciones...' : 'Sin alternativa distinta comprobada.'}</p>}
    {snapshot?.threat && <div className="border-t border-amber-800 pt-2 text-xs text-amber-200 space-y-1">
      <p className="flex gap-2"><ShieldAlert size={15} className="shrink-0" /><span>{snapshot.threat.afterMain ? `Tras ${snapshot.threat.afterMain}: ` : ''}<strong>{snapshot.threat.san}</strong> {snapshot.threat.reason}</span></p>
      {snapshot.threat.recovery?.source === 'wasm' && <p>{snapshot.threat.recovery.changeNeeded ? 'Respuesta defensiva' : 'Recuperación posible'}: {snapshot.threat.recovery.san}. {snapshot.threat.recovery.reason}</p>}
      <p>Línea posible: {snapshot.threat.line.join(' → ')}</p>
    </div>}
    {snapshot?.actualReply && <p className="text-xs text-slate-300">{snapshot.actualReply.san}: {snapshot.actualReply.detail}</p>}
    {snapshot?.error && <p role="alert" className="text-xs text-amber-300">No se completó el análisis: {snapshot.error}</p>}
  </section>;
}

export function SystemsControl({ snapshot, limit, onLimit, preferences, onPreferences }: { snapshot: SystemsSnapshot | null; limit: number; onLimit: (value: number) => void; preferences?: SystemPreferences; onPreferences?: (value: SystemPreferences) => void }) {
  return <section aria-label="Ayudantes de sistemas" className="border-t border-slate-700 pt-4 space-y-3">
    <h3 className="text-sm font-bold">Ayudantes de sistemas</h3>
    {preferences && <div className="flex flex-wrap gap-3">{(['w', 'b'] as const).map(color => {
      const key = color === 'w' ? 'white' : 'black';
      return <label key={key} className="text-xs flex items-center gap-2">Favorito {color === 'w' ? 'blancas' : 'negras'}<select aria-label={`Favorito ${color === 'w' ? 'blancas' : 'negras'}`} value={preferences[key]} onChange={event => onPreferences?.({ ...preferences, [key]: event.target.value })} className="bg-slate-800 border border-slate-600 rounded p-1"><option value="free">Libre</option>{OPENING_PRESETS.filter(p => p.id !== 'free' && p.id !== 'auto' && isSystemCompatibleWithColor(p.id, color)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>;
    })}</div>}
    <label className="flex items-center gap-2 text-xs">Ventana de cambio (jugadas completas)<input aria-label="Ventana de cambio de sistema" type="number" min={3} max={12} value={limit} onChange={event => onLimit(Number(event.target.value))} className="w-16 bg-slate-800 border border-slate-600 rounded p-1" /></label>
    <p className="text-xs text-slate-400">{snapshot?.systemName || 'Sin partida de sistemas'} · {snapshot?.searches || 0} posiciones consultadas · {snapshot?.elapsedMs || 0} ms</p>
    <div className="divide-y divide-slate-700">{snapshot?.helpers.map(helper => <details key={helper.id} className="py-2 text-xs">
      <summary className="cursor-pointer"><strong>{helper.name}</strong> · {({ inactive: 'Inactivo', calculating: 'Calculando', checked: 'Comprobado', limited: 'Limitado', warning: 'Precaución', error: 'Error' })[helper.status]}</summary>
      <p className="mt-2">{helper.detail}</p>{helper.evidence.map((item, index) => <p key={index} className="mt-1 text-slate-400 break-all">{item}</p>)}
    </details>)}</div>
  </section>;
}
