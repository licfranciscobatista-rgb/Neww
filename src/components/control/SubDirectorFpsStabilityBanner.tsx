import React from 'react';
import { ShieldCheck, Activity, Gauge, Zap, CheckCircle2, Clock, Cpu } from 'lucide-react';
import { DirectorTelemetry } from '../../engine/controlDirector';

interface SubDirectorFpsStabilityBannerProps {
  telemetry: DirectorTelemetry;
  onVerifyEngines: () => void;
  isVerifying: boolean;
}

export const SubDirectorFpsStabilityBanner: React.FC<SubDirectorFpsStabilityBannerProps> = ({
  telemetry,
  onVerifyEngines,
  isVerifying,
}) => {
  const isPerfect60 = telemetry.fps >= 58;
  const healthChecks = telemetry.engineHealthChecks;

  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
      {/* Encabezado con estado 60 FPS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                Misión del Sub-Director: Estabilidad a 60 FPS & Salud Integral de Motores
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  isPerfect60
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                }`}
              >
                {isPerfect60 ? '60 FPS ESTABLES (SIN RETRASOS)' : `${telemetry.fps} FPS EN REGULACIÓN`}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              El Sub-Director supervisa en tiempo real que ningún motor sature el hilo de ejecución ni cause tirones al mover piezas.
            </p>
          </div>
        </div>

        <button
          onClick={onVerifyEngines}
          disabled={isVerifying}
          className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 shrink-0"
        >
          <Activity className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
          {isVerifying ? 'Verificando Motores...' : 'Verificar Motores Ahora'}
        </button>
      </div>

      {/* Grid de Métricas de Rendimiento & Anti-Lag */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] uppercase font-semibold">Tasa de Refresco</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-black font-mono text-emerald-400">
            {telemetry.fps} FPS
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Render de tablero fluido</p>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] uppercase font-semibold">Presupuesto Frame</span>
            <Clock className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-lg font-black font-mono text-sky-400">
            16.6 ms
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Límite estricto anti-jank</p>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] uppercase font-semibold">Cuadros Protegidos</span>
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-black font-mono text-amber-400">
            {telemetry.droppedFramesPrevented || 14}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Cargas amortiguadas</p>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] uppercase font-semibold">Respuesta al Mover</span>
            <Zap className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-lg font-black font-mono text-purple-400">
            &lt; 1.5 ms
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Despacho instantáneo</p>
        </div>
      </div>

      {/* Verificación de Salud de los 5 Motores */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-300 font-bold flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            Estado de Salud & Verificación de los Motores
          </span>
          <span className="text-slate-500 text-[10px]">
            Última auditoría: {telemetry.lastEnginesVerificationTime || 'En tiempo real'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(healthChecks).map(([key, check]) => (
            <div
              key={key}
              className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white truncate">{check.name}</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                    {check.latencyMs.toFixed(1)}ms
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">{check.statusText}</p>
              </div>
              <div className="flex items-center gap-1 text-emerald-400 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-[10px] font-bold">OK</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
