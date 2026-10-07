import React, { useEffect, useState } from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import { controlDirector } from '../engine/controlDirector';
import { subDirectorAuditor, type SubDirectorPreflightResult } from '../engine/director/subDirectorEngineAuditor';
import { loadGameRecords } from '../storage/chessStorage';
import { ControlJsonInspector } from './control/ControlJsonInspector';

export const ControlView: React.FC = () => {
  const [telemetry, setTelemetry] = useState(() => controlDirector.getTelemetry(loadGameRecords().length));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<SubDirectorPreflightResult | null>(null);
  useEffect(() => {
    const handler = (value: typeof telemetry) => setTelemetry(value);
    controlDirector.on('telemetry', handler);
    return () => controlDirector.off('telemetry', handler);
  }, []);
  const verify = async () => {
    setBusy(true); setMessage('');
    try {
      const checks = await controlDirector.verifyAllEnginesDeep(loadGameRecords().length);
      const missing = Object.values(checks).filter(check => !check.isOperational).map(check => check.name);
      setMessage(missing.length ? `Sin verificar: ${missing.join(', ')}` : 'Pruebas operativas completadas.');
      setTelemetry(controlDirector.getTelemetry(loadGameRecords().length));
    } catch { setMessage('No se pudo completar la auditoría.'); }
    finally { setBusy(false); }
  };
  const verifyFiles = async () => {
    setBusy(true);
    try { setFiles(await subDirectorAuditor.auditAndCertifyEngines(loadGameRecords().length)); }
    catch { setMessage('No se pudo completar la comprobación de archivos.'); }
    finally { setBusy(false); }
  };
  return <div className="max-w-5xl mx-auto space-y-4 text-slate-200">
    <header className="flex items-center justify-between gap-3 border-b border-slate-700 pb-3">
      <h2 className="text-base font-bold flex items-center gap-2"><Activity size={18} />Control</h2>
      <button type="button" disabled={busy} onClick={verify} className="flex items-center gap-2 px-3 py-2 rounded bg-emerald-700 text-xs disabled:opacity-50"><RefreshCw size={15} className={busy ? 'animate-spin' : ''} />{busy ? 'Verificando' : 'Verificar motores'}</button>
    </header>
    <p className="text-xs">{telemetry.fps} FPS medidos · {telemetry.directorHelpRequestsCount} solicitudes registradas</p>
    {message && <p role="status" className="text-xs text-amber-300">{message}</p>}
    <div className="divide-y divide-slate-700">
      {Object.values(telemetry.engineHealthChecks).map(check => <div key={check.id} className="py-3 flex flex-wrap justify-between gap-2 text-xs">
        <strong>{check.name}</strong><span className={check.isOperational ? 'text-emerald-300' : 'text-amber-300'}>{check.statusText}</span>
      </div>)}
    </div>
    <details className="border-t border-slate-700 pt-3">
      <summary className="text-sm font-bold cursor-pointer">Diagnósticos avanzados</summary>
      <div className="mt-4 space-y-4 text-xs">
        <h3 className="font-bold">Presupuestos configurados, no mediciones de RAM</h3>
        {Object.values(telemetry.memoryAllocations).map(memory => <p key={memory.engine}>{memory.engineName}: {memory.allocatedMb} MB asignados en la configuración</p>)}
        <button type="button" disabled={busy} onClick={verifyFiles} className="px-3 py-2 rounded bg-slate-700 disabled:opacity-50">Comprobar archivos y workers</button>
        {files && <div role="status" className="space-y-2">
          <p>{files.allFilesAccessible ? 'Archivos accesibles' : 'Hay archivos no verificados'}</p>
          {Object.values(files.engines).map(engine => <div key={engine.engine}>
            <p>{engine.name}: {engine.diagnosticNote}</p>
            {engine.filesVerified.filter(file => !file.verified).map(file => <p key={file.path} className="text-amber-300 break-all">Sin verificar: {file.path}</p>)}
          </div>)}
        </div>}
        <ControlJsonInspector />
      </div>
    </details>
  </div>;
};
