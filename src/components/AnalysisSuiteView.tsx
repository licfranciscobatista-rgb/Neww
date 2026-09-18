import React, { useState } from 'react';
import { Chess } from 'chess.js';
import {
  Trophy,
  Sparkles,
  BarChart3,
  Layers,
  Cpu,
  Brain,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { GameAnalysisReport, GameRecord, PlayerProfile } from '../types/chess';
import { AnalysisView } from './AnalysisView';
import { GeminiMasterPanel } from './GeminiMasterPanel';
import {
  aggregatePositionUsage,
  aggregateMoveTracking,
  aggregateEngineUsageAndEffectiveness,
  generatePersonalEngineSummary,
} from '../engine/analyticsAggregator';

export type SuiteSubTab = 'audit' | 'master' | 'metrics';

interface AnalysisSuiteViewProps {
  games: GameRecord[];
  reports: GameAnalysisReport[];
  profile: PlayerProfile;
  selectedGame: GameRecord | null;
  selectedReport: GameAnalysisReport | null;
  chess: Chess;
  initialSubTab?: SuiteSubTab;
  onUpdateReport: (report: GameAnalysisReport) => void;
  onBackToBoard: () => void;
  onSelectGameToAudit: (game: GameRecord) => void;
}

export const AnalysisSuiteView: React.FC<AnalysisSuiteViewProps> = ({
  games,
  reports,
  profile,
  selectedGame,
  selectedReport,
  chess,
  initialSubTab = 'audit',
  onUpdateReport,
  onBackToBoard,
  onSelectGameToAudit,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SuiteSubTab>(initialSubTab);
  const [metricsTab, setMetricsTab] = useState<'openings' | 'engines' | 'learning'>('openings');

  const positions = aggregatePositionUsage(games);
  const moves = aggregateMoveTracking(games);
  const engineSummary = aggregateEngineUsageAndEffectiveness(games, reports);
  const learningDigest = generatePersonalEngineSummary(games, engineSummary, positions);

  // If no game is selected, fallback to the latest game in history if available
  const gameToAudit = selectedGame || (games.length > 0 ? games[0] : null);
  const reportToAudit = selectedReport || (gameToAudit ? reports.find((r) => r.gameId === gameToAudit.id) || null : null);

  return (
    <div className="max-w-5xl mx-auto p-2 sm:p-4 space-y-4 text-xs text-slate-200">
      {/* Top Header with Unified Suite Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sky-400" />
            Suite de Análisis Unificada
          </h2>
          <p className="text-xs text-slate-400">
            Auditoría profunda de partidas, Asesor Maestro pedagógico y métricas agregadas de rendimiento
          </p>
        </div>

        {/* Unified Sub-Tabs Navigation */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all text-xs ${
              activeSubTab === 'audit'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-900/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Auditoría de Partida</span>
          </button>

          <button
            onClick={() => setActiveSubTab('master')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all text-xs ${
              activeSubTab === 'master'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Asesor Maestro</span>
          </button>

          <button
            onClick={() => setActiveSubTab('metrics')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all text-xs ${
              activeSubTab === 'metrics'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-purple-300" />
            <span>Métricas & Rendimiento</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-SECCIÓN 1: AUDITORÍA DE PARTIDA (CON STOCKFISH & CONTROL)              */}
      {/* ========================================================================= */}
      {activeSubTab === 'audit' && (
        <div className="space-y-4">
          {games.length > 1 && (
            <div className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                Partida en auditoría:
              </span>
              <select
                value={gameToAudit?.id || ''}
                onChange={(e) => {
                  const found = games.find((g) => g.id === e.target.value);
                  if (found) onSelectGameToAudit(found);
                }}
                className="bg-slate-950 border border-slate-700 rounded-lg text-xs text-white px-2 py-1 font-mono focus:outline-none focus:border-sky-500"
              >
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title} ({g.date}) - {g.result}
                  </option>
                ))}
              </select>
            </div>
          )}

          <AnalysisView
            game={gameToAudit}
            report={reportToAudit}
            onUpdateReport={onUpdateReport}
            onBackToBoard={onBackToBoard}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-SECCIÓN 2: ASESOR MAESTRO (CONSULTAS Y PEDAGOGÍA DE LA POSICIÓN)      */}
      {/* ========================================================================= */}
      {activeSubTab === 'master' && (
        <div className="space-y-3">
          <GeminiMasterPanel chess={chess} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-SECCIÓN 3: MÉTRICAS & RENDIMIENTO AGREGADO                            */}
      {/* ========================================================================= */}
      {activeSubTab === 'metrics' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300">Dimensiones de Análisis:</span>
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setMetricsTab('openings')}
                  className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition-all ${
                    metricsTab === 'openings'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Aperturas & Repertorio
                </button>
                <button
                  onClick={() => setMetricsTab('engines')}
                  className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition-all ${
                    metricsTab === 'engines'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Comparativa Motores
                </button>
                <button
                  onClick={() => setMetricsTab('learning')}
                  className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition-all ${
                    metricsTab === 'learning'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Aprendizaje Propio
                </button>
              </div>
            </div>
          </div>

          {metricsTab === 'openings' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                <h3 className="font-bold text-white text-xs flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  Repertorio y Frecuencia de Posiciones
                </h3>
                <p className="text-slate-400 text-[11px]">
                  Estadísticas agregadas de rendimiento por línea de apertura según tu base de partidas.
                </p>
              </div>

              {positions.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl text-slate-400">
                  No hay partidas registradas todavía para generar métricas de apertura.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {positions.map((pos) => (
                    <div
                      key={pos.name}
                      className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                            {pos.eco}
                          </span>
                          <span className="font-bold text-white text-xs">{pos.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">
                            {pos.count} {pos.count === 1 ? 'partida' : 'partidas'}
                          </span>
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded-full ${
                              pos.winRate >= 60
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                : pos.winRate >= 45
                                ? 'bg-amber-950 text-amber-300 border border-amber-700'
                                : 'bg-rose-950 text-rose-300 border border-rose-700'
                            }`}
                          >
                            {pos.winRate}% Victoria
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2 pt-1 border-t border-slate-800/60">
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
                          Eficacia {pos.winRate}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {metricsTab === 'engines' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                <h3 className="font-bold text-white text-xs flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-sky-400" />
                  Efectividad y Adopción de Motores en Vivo
                </h3>
                <p className="text-slate-400 text-[11px]">
                  Frecuencia con la que has aplicado las recomendaciones de cada motor y tasa de acierto asociada.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {Object.values(engineSummary.engineStats).map((stat) => (
                  <div
                    key={stat.source}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2"
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

                    <div className="pt-2">
                      <span className="text-2xl font-black font-mono text-sky-400 block">
                        {stat.percentageOfMoves}%
                      </span>
                      <span className="text-[10px] text-slate-400">Tasa de adopción</span>
                    </div>

                    <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300 flex justify-between">
                      <span>Eficacia en victoria:</span>
                      <span className="font-bold text-emerald-400">{stat.gameWinRate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {metricsTab === 'learning' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                <h3 className="font-bold text-white text-xs flex items-center gap-2">
                  <Brain className="w-4 h-4 text-amber-400" />
                  Digestión de Aprendizaje del Motor Personal
                </h3>
                <p className="text-slate-400 text-[11px]">
                  Ponderación de conceptos tácticos y posicionales destilados para tus partidas.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                  <span className="text-xs font-bold text-white block">Patrones Tácticos Asimilados</span>
                  <div className="space-y-2">
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

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                  <span className="text-xs font-bold text-white block">Objetivos de Entrenamiento Sugeridos</span>
                  <ul className="space-y-2 text-slate-400">
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                      <span>Revisar variantes secundarias de tu apertura principal con negras.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                      <span>Limitar los movimientos apresurados de dama antes del enroque.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                      <span>Dedicar más tiempo de análisis en posiciones con 3 o más piezas bajo tensión.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
