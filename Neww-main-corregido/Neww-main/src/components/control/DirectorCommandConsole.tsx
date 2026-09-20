import React, { useState, useEffect } from 'react';
import {
  Shield,
  Zap,
  RefreshCw,
  Moon,
  CheckCircle2,
  Trash2,
  Sliders,
  Terminal,
  Clock,
  Check,
  AlertTriangle,
} from 'lucide-react';
import {
  directorExecutive,
  DirectorExecutiveState,
  DirectorExecutiveOrder,
  ExecutiveExecutionMode,
} from '../../engine/director/directorExecutive';

interface DirectorCommandConsoleProps {
  onNotify?: (msg: string) => void;
  onRefreshTelemetry?: () => void;
}

export const DirectorCommandConsole: React.FC<DirectorCommandConsoleProps> = ({
  onNotify,
  onRefreshTelemetry,
}) => {
  const [executiveState, setExecutiveState] = useState<DirectorExecutiveState>(() =>
    directorExecutive.getExecutiveState()
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null);
  const [lastActionResult, setLastActionResult] = useState<string | null>(null);

  useEffect(() => {
    const handleState = (state: DirectorExecutiveState) => setExecutiveState(state);
    directorExecutive.on('stateChanged', handleState);
    return () => {
      directorExecutive.off('stateChanged', handleState);
    };
  }, []);

  const handleExecute = async (commandId: string) => {
    setIsExecuting(true);
    setActiveCommandId(commandId);
    setLastActionResult(null);

    try {
      const res = await directorExecutive.dispatchExecutiveCommand(commandId, onNotify);
      setLastActionResult(res.message);
      if (onNotify) onNotify(res.message);
      if (onRefreshTelemetry) onRefreshTelemetry();
    } catch (err) {
      setLastActionResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExecuting(false);
      setActiveCommandId(null);
      setTimeout(() => setLastActionResult(null), 6000);
    }
  };

  const modeBadge = (mode: ExecutiveExecutionMode) => {
    switch (mode) {
      case 'MAXIMA_PRECISION':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-700">
            MÁXIMA PRECISIÓN (Tope 35MB)
          </span>
        );
      case 'AHORRO_BATERIA':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700">
            AHORRO ENERGÍA (Hibernación)
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
            60 FPS EQUILIBRADO
          </span>
        );
    }
  };

  return (
    <div className="p-4 bg-slate-900 border border-blue-900/60 rounded-xl space-y-4 text-xs shadow-lg">
      {/* Header del Director */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-950 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-950 border border-blue-600 rounded-lg text-blue-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                Director General de Control de Motores
              </h3>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-950 text-blue-300 border border-blue-800">
                v{executiveState.version}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Autoridad suprema sobre el Sub-Director, cuotas de RAM, ciclo de vida y políticas de ejecución
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {modeBadge(executiveState.mode)}
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800">
            RAM: {executiveState.currentAllocatedMb} / {executiveState.memoryCeilingMb} MB
          </span>
        </div>
      </div>

      {/* Botonera y Automatizaciones del Director */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Acciones Operativas del Director:
          </span>
          <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Ciclo de Vida & 60 FPS Gestionados Automáticamente</span>
          </div>
        </div>

        {/* Solo 2 Acciones Manuales Relevantes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            onClick={() => handleExecute('CMD_AUDITAR_SISTEMA_COMPLETO')}
            disabled={isExecuting}
            className="p-3 bg-slate-950 hover:bg-purple-950/60 border border-slate-800 hover:border-purple-600 rounded-xl text-left transition-all group disabled:opacity-50 flex items-center justify-between"
            title="Solicita al Sub-Director un diagnóstico profundo y simultáneo de los 4 motores"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-950/80 border border-purple-800 text-purple-400 group-hover:scale-105 transition-transform">
                <Zap
                  className={`w-4 h-4 ${
                    activeCommandId === 'CMD_AUDITAR_SISTEMA_COMPLETO' ? 'animate-pulse' : ''
                  }`}
                />
              </div>
              <div>
                <span className="font-bold text-white text-xs block leading-tight">
                  Auditar Sistema Completo
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Diagnóstico exhaustivo de motores y archivos con el Sub-Director
                </span>
              </div>
            </div>
            <span className="text-[9px] font-mono font-bold text-purple-400 px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800 shrink-0">
              EJECUTAR
            </span>
          </button>

          <button
            onClick={() => handleExecute('CMD_PURGAR_MEMORIA_CACHE')}
            disabled={isExecuting}
            className="p-3 bg-slate-950 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-600 rounded-xl text-left transition-all group disabled:opacity-50 flex items-center justify-between"
            title="Limpia tablas de transposición y listas de candidatos en RAM"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-400 group-hover:scale-105 transition-transform">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white text-xs block leading-tight">
                  Purgar Memoria & Caché
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Libera tablas de transposición y recoloca cuota base de RAM
                </span>
              </div>
            </div>
            <span className="text-[9px] font-mono font-bold text-rose-400 px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800 shrink-0">
              LIMPIAR
            </span>
          </button>
        </div>

        {/* Políticas Automáticas Permanentes (Garantías en segundo plano) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[10px]">
          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center gap-2">
            <span className="text-emerald-400 font-bold">✓</span>
            <div>
              <span className="text-slate-300 font-bold block">Ciclo de Vida Autónomo</span>
              <span className="text-slate-500 text-[9px]">Hibernación y reactivación sin intervención</span>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center gap-2">
            <span className="text-emerald-400 font-bold">✓</span>
            <div>
              <span className="text-slate-300 font-bold block">Garantía 60 FPS Continua</span>
              <span className="text-slate-500 text-[9px]">Corte de cálculo a 16.6 ms por cuadro</span>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center gap-2">
            <span className="text-emerald-400 font-bold">✓</span>
            <div>
              <span className="text-slate-300 font-bold block">Precisión Calibrada por Motor</span>
              <span className="text-slate-500 text-[9px]">SF19 máxima táctica, Garbo posicional, Maia humano</span>
            </div>
          </div>
        </div>
      </div>

      {/* Banner de resultado de acción */}
      {lastActionResult && (
        <div className="p-2.5 bg-blue-950/90 border border-blue-500/60 rounded-lg text-xs text-blue-200 flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-mono">{lastActionResult}</span>
        </div>
      )}

      {/* Terminal de Órdenes del Director al Subdirector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-slate-300">
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            Canal de Órdenes: Director ➔ Sub-Director & Motores ({executiveState.recentOrders.length})
          </span>
          <span>Total órdenes: {executiveState.totalCommandsExecuted}</span>
        </div>

        <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 max-h-36 overflow-y-auto space-y-1 font-mono text-[10px]">
          {executiveState.recentOrders.map((ord) => (
            <div
              key={ord.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-1.5 hover:bg-slate-900 rounded border border-transparent hover:border-slate-800"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    ord.status === 'COMPLETED'
                      ? 'bg-emerald-400'
                      : ord.status === 'EXECUTING'
                      ? 'bg-amber-400 animate-ping'
                      : 'bg-rose-400'
                  }`}
                />
                <span className="text-slate-400">[{ord.issuedAt}]</span>
                <span className="font-bold text-white">{ord.commandName}</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-sky-300">
                  {ord.target}
                </span>
              </div>
              <div className="flex items-center gap-2 pl-3.5 sm:pl-0">
                <span className="text-slate-400 truncate max-w-xs">{ord.details}</span>
                {ord.executionTimeMs && (
                  <span className="text-emerald-400 shrink-0 font-semibold">
                    {ord.executionTimeMs} ms
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
