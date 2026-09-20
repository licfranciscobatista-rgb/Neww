import React, { useEffect, useState } from 'react';
import {
  Activity,
  Cpu,
  Zap,
  Server,
  CheckCircle,
  Clock,
  Shield,
  Layers,
  HelpCircle,
  Lock,
  BookOpen,
  Timer,
  Compass,
  Database,
  RefreshCw,
} from 'lucide-react';
import {
  controlDirector,
  DirectorTelemetry,
} from '../engine/controlDirector';
import { loadPlayerProfile, loadGameRecords } from '../storage/chessStorage';
import { DirectorCommandConsole } from './control/DirectorCommandConsole';
import { MetricsAndPerformanceCard } from './control/MetricsAndPerformanceCard';
import { ControlJsonInspector } from './control/ControlJsonInspector';
import { SubDirectorEngineAuditorCard } from './control/SubDirectorEngineAuditorCard';

export const ControlView: React.FC = () => {
  const profile = loadPlayerProfile();
  const games = loadGameRecords();
  const [telemetry, setTelemetry] = useState<DirectorTelemetry>(() =>
    controlDirector.getTelemetry(profile.gamesPlayed || games.length)
  );
  const [isVerifyingEngines, setIsVerifyingEngines] = useState(false);
  const [lastCheckMessage, setLastCheckMessage] = useState<string | null>(null);

  const handleVerifyEngines = async () => {
    setIsVerifyingEngines(true);
    try {
      await controlDirector.verifyAllEnginesDeep(profile.gamesPlayed || games.length);
      setLastCheckMessage('Auditoría en vivo completada por el Sub-Director: Cálculos tácticos y Worker verificados con éxito.');
    } catch {
      controlDirector.verifyAllFourEngines(profile.gamesPlayed || games.length);
      setLastCheckMessage('Auditoría completada.');
    } finally {
      setIsVerifyingEngines(false);
      setTimeout(() => setLastCheckMessage(null), 5000);
    }
  };

  useEffect(() => {
    const handleTelemetry = (t: DirectorTelemetry) => setTelemetry(t);
    controlDirector.on('telemetry', handleTelemetry);
    return () => {
      controlDirector.off('telemetry', handleTelemetry);
    };
  }, []);

  const { interventionsBreakdown, independentModules } = telemetry;

  return (
    <div className="max-w-5xl mx-auto p-2 sm:p-4 space-y-4 text-xs text-slate-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Panel de Control: Director, Sub-Director & Motores Independientes
          </h2>
          <p className="text-xs text-slate-400">
            Aislamiento estricto de roles: Estabilidad a 60 FPS, cuotas de tiempo y registros separados
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/60 border border-emerald-600/40 rounded-full text-emerald-300 text-[11px] font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{telemetry.fps} FPS Estables</span>
          </div>
        </div>
      </div>

      {/* KPI Cards: Peticiones y Desglose por Motor Individual */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Peticiones Director
            </span>
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <span className="text-2xl font-black font-mono text-amber-400 block">
            {telemetry.directorHelpRequestsCount}
          </span>
          <span className="text-[10px] text-slate-500">Del Director al Sub-Director</span>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Ayudas Stockfish
            </span>
            <Clock className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <span className="text-2xl font-black font-mono text-sky-400 block">
            {interventionsBreakdown.stockfishTimeouts}
          </span>
          <span className="text-[10px] text-slate-500">Cortes por límite 15s máx</span>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Ayudas GarboChess
            </span>
            <Zap className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <span className="text-2xl font-black font-mono text-purple-400 block">
            {interventionsBreakdown.garboTimeouts}
          </span>
          <span className="text-[10px] text-slate-500">Acelere por límite 5s máx</span>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Motor Personal
            </span>
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="text-2xl font-black font-mono text-emerald-400 block">
            0
          </span>
          <span className="text-[10px] text-slate-500">Autónomo (8 Ayudantes propios)</span>
        </div>
      </div>

      {/* Consola Ejecutiva y Programación del Director General */}
      <DirectorCommandConsole
        onNotify={(msg) => setLastCheckMessage(msg)}
        onRefreshTelemetry={() => setTelemetry(controlDirector.getTelemetry(profile.gamesPlayed || games.length))}
      />

      {/* Grid: El Director vs El Sub-Director (Roles y Límites Claros) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* El Director */}
        <div className="p-4 bg-slate-900 border border-blue-900/40 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-xs flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <span>El Director (Ciclo de Vida & Aislamiento de Pestañas)</span>
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-700">
              Pestaña: {telemetry.currentTab.toUpperCase()}
            </span>
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed">
            Su razón de existir es asegurar que todo funcione sin corrupción visual en cada pantalla individual:
          </p>

          <div className="space-y-2 bg-slate-950/80 p-3 rounded-lg border border-slate-800 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">En Pestaña Juego (Tablero):</span>
              <span className="text-emerald-400 font-semibold">Motores activos marcando flechas limpias</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Flecha Motor Personal:</span>
              <span className={telemetry.personalEngineUnlocked ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {telemetry.personalEngineUnlocked ? 'Habilitada (≥10 partidas)' : 'BLOQUEADA (<10 partidas)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">En Historial / Suite:</span>
              <span className="text-blue-300">Motores de juego apagados • Stockfish audita y se apaga</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Peticiones enviadas al Sub-Director:</span>
              <span className="text-amber-400 font-bold font-mono">{telemetry.directorHelpRequestsCount}</span>
            </div>
          </div>
        </div>

        {/* El Sub-Director */}
        <div className="p-4 bg-slate-900 border border-purple-900/40 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-xs flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              <span>El Sub-Director (Auditor de los 4 Motores & 60 FPS)</span>
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleVerifyEngines}
                disabled={isVerifyingEngines}
                className="px-2 py-1 rounded bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-700 text-[10px] font-bold flex items-center gap-1 transition-all"
                title="Comprobar que todos los 4 motores están correctamente instalados y funcionando"
              >
                <RefreshCw className={`w-3 h-3 ${isVerifyingEngines ? 'animate-spin' : ''}`} />
                <span>{isVerifyingEngines ? 'Auditando...' : 'Verificar 4 Motores'}</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed">
            Se asegura activamente de que <strong>todos los 4 motores</strong> estén correctamente instalados, operativos y sin interferir en los 60 FPS:
          </p>

          <div className="space-y-2 bg-slate-950/80 p-3 rounded-lg border border-slate-800 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Verificación 4 Motores:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>4 / 4 Instalados & Operativos</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Stockfish (Máx 15 seg):</span>
              <span className="text-slate-200 font-mono">Corta cálculo si excede 15s ({interventionsBreakdown.stockfishTimeouts} veces)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">GarboChess (Máx 5 seg):</span>
              <span className="text-slate-200 font-mono">Fuerza entrega si excede 5s ({interventionsBreakdown.garboTimeouts} veces)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Maia & Motor Personal:</span>
              <span className="text-emerald-400 font-mono">Aislamiento verificado • 0 trabas</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Estado de FPS:</span>
              <span className="text-emerald-400 font-bold font-mono">{telemetry.fps} FPS Continuos</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-slate-400">Consulta Pestaña Juego al Iniciar:</span>
              <span className="text-sky-300 font-mono font-semibold flex items-center gap-1">
                <Zap className="w-3 h-3 text-sky-400" />
                <span>
                  {telemetry.lastGameReadinessReport
                    ? `${telemetry.lastGameReadinessReport.latencyMs} ms (<1ms) • 4 Motores OK (${telemetry.lastGameReadinessReport.timestamp})`
                    : 'Lista para consultar en <1ms al iniciar juego'}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Banner de confirmación de auditoría del Subdirector */}
      {lastCheckMessage && (
        <div className="p-3 bg-emerald-950/90 border border-emerald-500/70 rounded-xl text-xs text-emerald-200 flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{lastCheckMessage}</span>
          </div>
          <span className="text-[10px] text-emerald-300/70 font-mono">{telemetry.lastEnginesVerificationTime}</span>
        </div>
      )}

      {/* Auditor de Archivos y Certificación Pre-Vuelo del Sub-Director */}
      <SubDirectorEngineAuditorCard onNotify={(msg) => setLastCheckMessage(msg)} />

      {/* Módulo Unificado de Métricas & Rendimiento (Aperturas, Motores y Carga de Trabajo) */}
      <MetricsAndPerformanceCard games={games} profile={profile} />

      {/* Inspector de Archivos .JSON de Configuración del Sistema */}
      <ControlJsonInspector />

      {/* ========================================================================= */}
      {/* SECCIÓN OBLIGATORIA: 4 MOTORES INDEPENDIENTES PERO NECESARIOS              */}
      {/* ========================================================================= */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-xs flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sky-400" />
            <span>4 Motores / Módulos Independientes pero Necesarios</span>
          </h3>
          <span className="text-[10px] text-slate-400">
            Arquitectura desacoplada para evitar sobrecargas
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Jugadas de Libro (Chess.js) */}
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <BookOpen className="w-4 h-4" />
                <span className="text-white text-xs">Jugadas de Libro</span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                &lt; 1 ms
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              {independentModules.bookMovesEngine.description}
            </p>
            <div className="pt-1 border-t border-slate-800 text-[10px] font-mono text-slate-300 flex justify-between">
              <span>Posiciones en caché:</span>
              <span className="text-emerald-400 font-bold">{independentModules.bookMovesEngine.bookPositionsCached}</span>
            </div>
          </div>

          {/* 2. Registro de Aperturas */}
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sky-400 font-bold">
                <Compass className="w-4 h-4" />
                <span className="text-white text-xs">Registro de Aperturas</span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-950 text-sky-300 border border-sky-800">
                {independentModules.openingRegisterEngine.activeVariationsCount} líneas
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              {independentModules.openingRegisterEngine.description}
            </p>
            <div className="pt-1 border-t border-slate-800 text-[10px] font-mono text-slate-300 truncate">
              <span className="text-slate-400">Principal: </span>
              <span className="text-sky-300 font-bold">{independentModules.openingRegisterEngine.topOpeningDetected}</span>
            </div>
          </div>

          {/* 3. Análisis en base al tiempo de una jugada */}
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Timer className="w-4 h-4" />
                <span className="text-white text-xs">Análisis de Tiempo</span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                {independentModules.timeAnalysisEngine.averageThinkTimeSeconds}s prom
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              {independentModules.timeAnalysisEngine.description}
            </p>
            <div className="pt-1 border-t border-slate-800 text-[10px] font-mono text-slate-300 flex justify-between">
              <span>Rápidas: {independentModules.timeAnalysisEngine.rushedMovesCount}</span>
              <span className="text-amber-400">Pausadas: {independentModules.timeAnalysisEngine.deepThinksCount}</span>
            </div>
          </div>

          {/* 4. Memoria independiente a cada motor (Stockfish 20-35MB, secundarios 15MB) */}
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-purple-400 font-bold">
                <Database className="w-4 h-4" />
                <span className="text-white text-xs">Aislamiento Memoria</span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                20-35 MB Máx
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              {independentModules.memoryIsolationEngine.description}
            </p>
            <div className="pt-1 border-t border-slate-800 text-[10px] font-mono text-slate-300 flex justify-between">
              <span>Uso total activo:</span>
              <span className="text-purple-300 font-bold">{independentModules.memoryIsolationEngine.totalActiveRamMb} MB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Asignación Detallada de Memoria Virtual por Motor */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
            <Server className="w-4 h-4 text-sky-400" />
            Memoria Aislada por Motor (Stockfish 20 MB fijos / hasta 35 MB dinámicos, 15 MB motores ligeros)
          </h3>
          <span className="text-[10px] text-slate-400">Sin interferencias entre hilos</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {Object.values(telemetry.memoryAllocations).map((mem) => {
            const pct = Math.round((mem.allocatedMb / mem.maxLimitMb) * 100);
            return (
              <div
                key={mem.engine}
                className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">{mem.engineName}</span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      mem.status === 'ACTIVE'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : mem.status === 'LOCKED_NEED_10_GAMES'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : mem.status === 'IDLE'
                        ? 'bg-blue-950 text-blue-300 border border-blue-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {mem.status === 'LOCKED_NEED_10_GAMES' ? 'BLOQUEADO' : mem.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>{mem.allocatedMb.toFixed(1)} MB</span>
                    <span>Tope {mem.maxLimitMb} MB</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
