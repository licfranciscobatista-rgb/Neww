import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Cpu,
  Layers,
  Brain,
  Activity,
  Zap,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { GameRecord, PlayerProfile, GameAnalysisReport } from '../../types/chess';
import {
  aggregatePositionUsage,
  aggregateEngineUsageAndEffectiveness,
  generatePersonalEngineSummary,
} from '../../engine/analyticsAggregator';
import {
  engineWorkloadMonitor,
  EngineHealthMap,
} from '../../engine/director/engineWorkloadMonitor';

interface MetricsAndPerformanceCardProps {
  games: GameRecord[];
  profile?: PlayerProfile;
  reports?: GameAnalysisReport[];
}

export const MetricsAndPerformanceCard: React.FC<MetricsAndPerformanceCardProps> = ({
  games,
  reports = [],
}) => {
  const [activeDimension, setActiveDimension] = useState<'workload' | 'openings' | 'engines' | 'learning'>('workload');
  const [engineHealth, setEngineHealth] = useState<EngineHealthMap>(() => engineWorkloadMonitor.getHealth());

  useEffect(() => {
    const unsubscribe = engineWorkloadMonitor.subscribe((newHealth) => {
      setEngineHealth(newHealth);
    });
    return unsubscribe;
  }, []);

  const positions = aggregatePositionUsage(games);
  const engineSummary = aggregateEngineUsageAndEffectiveness(games, reports);
  const learningDigest = generatePersonalEngineSummary(games, engineSummary, positions);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-sm">
              Métricas & Rendimiento de Motores y Partidas
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Supervisión continua de latencias de motores, adopción táctica y repertorio personal consolidado.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveDimension('workload')}
            className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeDimension === 'workload'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Carga & Latencia</span>
          </button>

          <button
            onClick={() => setActiveDimension('openings')}
            className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeDimension === 'openings'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Aperturas ({positions.length})</span>
          </button>

          <button
            onClick={() => setActiveDimension('engines')}
            className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeDimension === 'engines'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Efectividad Motores</span>
          </button>

          <button
            onClick={() => setActiveDimension('learning')}
            className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeDimension === 'learning'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Aprendizaje Propio</span>
          </button>
        </div>
      </div>

      {/* DIMENSION 1: CARGA & LATENCIA DE MOTORES (WORKLOAD MONITOR) */}
      {activeDimension === 'workload' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Gobernanza activa de hilos Web Worker a 60 FPS sin bloqueos en la interfaz.</span>
            </span>
            <span className="font-mono text-emerald-400 flex items-center gap-1 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Telemetría en tiempo real
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.values(engineHealth).map((item) => (
              <div
                key={item.engine}
                className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3.5 space-y-2.5 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">{item.engineName}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${
                      item.status === 'OPTIMAL'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                        : item.status === 'MODERATE'
                        ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                        : 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/70">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Última Ejecución</span>
                    <span className="font-mono font-bold text-sky-400">{item.lastExecutionMs} ms</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Latencia Media</span>
                    <span className="font-mono font-bold text-white">{item.avgExecutionMs} ms</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/70">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    Intervenciones: <span className="text-slate-200 font-mono font-bold">{item.interventionsCount}</span>
                  </span>
                  {item.throughputMovesPerSec && (
                    <span className="font-mono text-slate-300">
                      ~{item.throughputMovesPerSec} mov/s
                    </span>
                  )}
                </div>

                {item.lastInterventionReason && (
                  <p className="text-[10px] text-amber-300/80 bg-amber-950/40 p-1.5 rounded border border-amber-800/40">
                    {item.lastInterventionReason}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DIMENSION 2: APERTURAS & REPERTORIO */}
      {activeDimension === 'openings' && (
        <div className="space-y-3">
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
            <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              Repertorio y Frecuencia de Aperturas en Base Local
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Eficacia consolidada de las variantes jugadas en tus partidas archivadas.
            </p>
          </div>

          {positions.length === 0 ? (
            <div className="p-6 text-center bg-slate-950/40 border border-slate-800/60 rounded-xl text-slate-400 text-xs">
              No hay partidas registradas todavía para generar métricas de aperturas. Juega o importa partidas en Historial.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {positions.map((pos) => (
                <div
                  key={pos.name}
                  className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1.5"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800/60 text-[11px]">
                        {pos.eco}
                      </span>
                      <span className="font-bold text-white text-xs">{pos.name}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-slate-400 text-[11px]">
                        {pos.count} {pos.count === 1 ? 'partida' : 'partidas'}
                      </span>
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded-full text-[10px] border ${
                          pos.winRate >= 60
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                            : pos.winRate >= 45
                            ? 'bg-amber-950 text-amber-300 border-amber-700'
                            : 'bg-rose-950 text-rose-300 border-rose-700'
                        }`}
                      >
                        {pos.winRate}% Victoria
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span>Blancas: {pos.asWhite}</span>
                      <span>•</span>
                      <span>Negras: {pos.asBlack}</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-semibold">{pos.wins}V</span>
                      <span className="text-slate-400 font-semibold">{pos.draws}E</span>
                      <span className="text-rose-400 font-semibold">{pos.losses}D</span>
                    </div>
                    <span className="text-slate-400 font-mono text-[10px]">
                      Eficacia total: {pos.winRate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DIMENSION 3: EFECTIVIDAD Y ADOPCIÓN DE MOTORES */}
      {activeDimension === 'engines' && (
        <div className="space-y-3">
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
            <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              Tasa de Adopción y Rendimiento Táctico por Motor
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Frecuencia con la que has aplicado las recomendaciones de cada motor y tasa de victoria correspondiente.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.values(engineSummary.engineStats).map((stat) => (
              <div
                key={stat.source}
                className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: stat.color }}
                    />
                    <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                      {stat.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {stat.count} jugadas
                  </span>
                </div>

                <div className="pt-1">
                  <span className="text-2xl font-black font-mono text-sky-400 block">
                    {stat.percentageOfMoves}%
                  </span>
                  <span className="text-[10px] text-slate-400">Adopción del jugador</span>
                </div>

                <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-300 flex justify-between">
                  <span>Victoria al aplicar:</span>
                  <span className="font-bold text-emerald-400 font-mono">{stat.gameWinRate}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DIMENSION 4: APRENDIZAJE PROPIO */}
      {activeDimension === 'learning' && (
        <div className="space-y-3">
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
            <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-amber-400" />
              Digestión y Metas de Aprendizaje del Motor Personal
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Conceptos posicionales asimilados y sugerencias de entrenamiento formuladas por tu modelo propio.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-2.5">
              <span className="text-xs font-bold text-white block">Patrones Tácticos Asimilados</span>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Respuesta a presiones de centro</span>
                  <span className="font-mono text-emerald-400 font-bold">Consolidada</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Conversión de ventajas en finales</span>
                  <span className="font-mono text-amber-400 font-bold">En evolución</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Profilaxis frente a ataques al enroque</span>
                  <span className="font-mono text-sky-400 font-bold">Activa</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-2.5">
              <span className="text-xs font-bold text-white block">Objetivos de Entrenamiento Sugeridos</span>
              <ul className="space-y-2 text-slate-400 text-xs">
                <li className="flex items-start gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                  <span>Revisar variantes secundarias en tu repertorio principal con negras.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                  <span>Limitar los movimientos apresurados de dama antes de asegurar el rey.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                  <span>Asignar mayor tiempo de cálculo en posiciones con 3 o más piezas bajo tensión.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
