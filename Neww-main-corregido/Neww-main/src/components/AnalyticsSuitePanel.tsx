import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Brain,
  Cpu,
  Layers,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { GameAnalysisReport, GameRecord, PlayerProfile } from '../types/chess';
import {
  aggregatePositionUsage,
  aggregateMoveTracking,
  aggregateEngineUsageAndEffectiveness,
  generatePersonalEngineSummary,
} from '../engine/analyticsAggregator';

interface AnalyticsSuitePanelProps {
  games: GameRecord[];
  reports: GameAnalysisReport[];
  profile: PlayerProfile;
}

export const AnalyticsSuitePanel: React.FC<AnalyticsSuitePanelProps> = ({
  games,
  reports,
  profile,
}) => {
  const [activeTab, setActiveTab] = useState<'openings' | 'engines' | 'learning'>('openings');

  const positions = aggregatePositionUsage(games);
  const moves = aggregateMoveTracking(games);
  const engineSummary = aggregateEngineUsageAndEffectiveness(games, reports);
  const learningDigest = generatePersonalEngineSummary(games, engineSummary, positions);

  return (
    <div className="max-w-4xl mx-auto p-2 sm:p-4 space-y-4 text-xs text-slate-200">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sky-400" />
            Suite Analítica Avanzada
          </h2>
          <p className="text-xs text-slate-400">
            Métricas de aperturas, efectividad de motores y aprendizaje personalizado
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('openings')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'openings'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Aperturas & Repertorio
          </button>
          <button
            onClick={() => setActiveTab('engines')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'engines'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Comparativa Motores
          </button>
          <button
            onClick={() => setActiveTab('learning')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'learning'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Aprendizaje Propio
          </button>
        </div>
      </div>

      {activeTab === 'openings' && (
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
                      <span className="text-rose-400 font-semibold">{pos.losses}D</span>
                      <span className="text-slate-400">{pos.draws}T</span>
                    </div>
                    {pos.commonMoves.length > 0 && (
                      <span className="font-mono text-slate-300">
                        Línea: {pos.commonMoves.join(' ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'engines' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Motor Más Frecuente
              </span>
              <span className="text-xl font-bold text-white block">
                {engineSummary.mostUsedEngine.label}
              </span>
              <span className="text-[11px] text-slate-400">
                {engineSummary.mostUsedEngine.count} jugadas ({engineSummary.mostUsedEngine.percentage}% del total)
              </span>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Motor con Mayor Rendimiento
              </span>
              <span className="text-xl font-bold text-sky-400 block">
                {engineSummary.bestUsedEngine.label}
              </span>
              <span className="text-[11px] text-slate-400">
                {engineSummary.bestUsedEngine.reason} ({engineSummary.bestUsedEngine.winRate}% win rate)
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {Object.values(engineSummary.engineStats).map((stat) => (
              <div
                key={stat.source}
                className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: stat.color }}
                    />
                    <span className="font-bold text-white text-xs">{stat.label}</span>
                  </div>
                  <span className="font-mono text-xs text-slate-300 font-bold">
                    {stat.count} jugadas ({stat.percentageOfMoves}%)
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">Precisión Estimada</span>
                    <span className="font-mono font-bold text-white text-xs">{stat.estimatedAccuracy}%</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">Eficiencia Táctica</span>
                    <span className="font-mono font-bold text-emerald-400 text-xs">{stat.tacticalEfficiency}%</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">Tasa de Victoria</span>
                    <span className="font-mono font-bold text-sky-400 text-xs">{stat.gameWinRate}%</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 italic">
                  Rol sugerido: {stat.recommendedRole}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'learning' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-xs">
                  Resumen de Aprendizaje del Motor Personal
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Actualizado: {learningDigest.generatedAt}
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {learningDigest.engineSynergyAdvice}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <span className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Fortalezas Detectadas
              </span>
              <ul className="space-y-1.5 text-slate-300 text-[11px]">
                {learningDigest.topStrengths.map((str, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <span className="font-bold text-rose-400 text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Vulnerabilidades Críticas a Mitigar
              </span>
              <ul className="space-y-1.5 text-slate-300 text-[11px]">
                {learningDigest.criticalVulnerabilities.map((vuln, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-rose-400 font-bold">•</span>
                    <span>{vuln}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px] block">
              Reglas de Memoria Consolidada
            </span>
            {learningDigest.distilledKnowledgeItems.map((item, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-white text-xs block">{item.title}</span>
                  <span className="text-[11px] text-slate-400">{item.description}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-amber-400 text-xs">
                    {item.confidence}% confianza
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {item.evidenceCount} evidencias
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
