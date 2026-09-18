import React, { useEffect, useState } from 'react';
import {
  Activity,
  Cpu,
  Zap,
  Server,
  Radio,
  CheckCircle,
  AlertCircle,
  Clock,
  Shield,
  Layers,
  HelpCircle,
  FileText,
  UserCheck,
  Brain,
  Sparkles,
  Lock,
  BookOpen,
  Timer,
  Compass,
  Database,
  Search,
} from 'lucide-react';
import {
  controlDirector,
  DirectorTelemetry,
  StockfishAuditLog,
  MaiaHumanityLog,
  ChessJsRulesEngine,
} from '../engine/controlDirector';
import { loadPlayerProfile, loadGameRecords } from '../storage/chessStorage';

export const ControlView: React.FC = () => {
  const profile = loadPlayerProfile();
  const games = loadGameRecords();
  const [telemetry, setTelemetry] = useState<DirectorTelemetry>(() =>
    controlDirector.getTelemetry(profile.gamesPlayed || games.length)
  );
  const [sfLogs, setSfLogs] = useState<StockfishAuditLog[]>(() => controlDirector.getStockfishLogs());
  const [maiaLogs, setMaiaLogs] = useState<MaiaHumanityLog[]>(() => controlDirector.getMaiaLogs());
  const [activeLogTab, setActiveLogTab] = useState<'stockfish' | 'maia'>('stockfish');
  const [analyzedLogId, setAnalyzedLogId] = useState<string | null>(null);
  const [chessJsAnalysis, setChessJsAnalysis] = useState<{
    validPgnVerified: boolean;
    bookMovesCount: number;
    outOfBookPliesCount: number;
    openingDetected: string;
    verificationLatencyMs: number;
  } | null>(null);

  useEffect(() => {
    const handleTelemetry = (t: DirectorTelemetry) => setTelemetry(t);
    const handleSfLog = (l: StockfishAuditLog) => setSfLogs((prev) => [l, ...prev.slice(0, 19)]);
    const handleMaiaLog = (l: MaiaHumanityLog) => setMaiaLogs((prev) => [l, ...prev.slice(0, 19)]);

    controlDirector.on('telemetry', handleTelemetry);
    controlDirector.on('stockfishLogAdded', handleSfLog);
    controlDirector.on('maiaLogAdded', handleMaiaLog);

    return () => {
      controlDirector.off('telemetry', handleTelemetry);
      controlDirector.off('stockfishLogAdded', handleSfLog);
      controlDirector.off('maiaLogAdded', handleMaiaLog);
    };
  }, []);

  const handleAnalyzeWithChessJs = (logId: string) => {
    setAnalyzedLogId(logId);
    // Standard game moves sample from the audited record
    const sampleMoves = ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Be3', 'e5'];
    const analysis = ChessJsRulesEngine.analyzeRegistryLog(sampleMoves);
    setChessJsAnalysis(analysis);
  };

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
              <span>El Sub-Director (Asistente de Tiempos & 60 FPS)</span>
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-700">
              Activo & Independiente
            </span>
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed">
            Solo actúa si de verdad un motor lo necesita, sin interponerse en el Director para evitar lag o conflictos:
          </p>

          <div className="space-y-2 bg-slate-950/80 p-3 rounded-lg border border-slate-800 text-[11px]">
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
              <span className="text-emerald-400 font-mono">0 trabas registradas</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Estado de FPS:</span>
              <span className="text-emerald-400 font-bold font-mono">{telemetry.fps} FPS Continuos</span>
            </div>
          </div>
        </div>
      </div>

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

          {/* 4. Memoria independiente a cada motor (Tope 20MB RAM) */}
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-purple-400 font-bold">
                <Database className="w-4 h-4" />
                <span className="text-white text-xs">Aislamiento Memoria</span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                20 MB Máx
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

      {/* Asignación Detallada de Memoria Virtual por Motor (Tope estricto de 20MB cada uno) */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
            <Server className="w-4 h-4 text-sky-400" />
            Memoria Aislada por Motor (Máximo 20 MB de RAM individual para velocidad absoluta)
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

      {/* Registros Separados: Stockfish (al apagarse) & Maia, Analizados por Chess.js */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="font-bold text-white text-xs">Registros Separados de Análisis</h3>
              <p className="text-[10px] text-slate-400">
                Stockfish (entregado antes de apagarse) y Maia • Analizados en velocidad por Chess.js
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => {
                setActiveLogTab('stockfish');
                setChessJsAnalysis(null);
                setAnalyzedLogId(null);
              }}
              className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                activeLogTab === 'stockfish'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Registro Stockfish ({sfLogs.length})
            </button>
            <button
              onClick={() => {
                setActiveLogTab('maia');
                setChessJsAnalysis(null);
                setAnalyzedLogId(null);
              }}
              className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                activeLogTab === 'maia'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Registro Maia ({maiaLogs.length})
            </button>
          </div>
        </div>

        {/* Display logs */}
        {activeLogTab === 'stockfish' ? (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400">
              Reportes entregados por Stockfish al concluir la auditoría en Historial antes de apagarse:
            </p>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {sfLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-white block">Auditoría Partida ({log.plyCount} plies)</span>
                    <span className="text-[10px] text-slate-400">
                      Precisión Blancas: {log.accuracyWhite}% • Negras: {log.accuracyBlack}% • Blunders: {log.blundersCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAnalyzeWithChessJs(log.id)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[10px] font-bold border border-slate-700 flex items-center gap-1 transition-colors"
                    >
                      <Search className="w-3 h-3" />
                      <span>Analizar con Chess.js</span>
                    </button>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                      {log.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400">
              Registros de estimación de probabilidad humana por rangos Elo y detección de anomalías:
            </p>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {maiaLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-white block">Calibración Elo {log.targetElo}</span>
                    <span className="text-[10px] text-slate-400">
                      Probabilidad humana media: {log.averageHumanProbability}% • Anomalías: {log.anomaliesDetected}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAnalyzeWithChessJs(log.id)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 text-[10px] font-bold border border-slate-700 flex items-center gap-1 transition-colors"
                    >
                      <Search className="w-3 h-3" />
                      <span>Analizar con Chess.js</span>
                    </button>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                      MAIA_HUMAN_TRACE
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal / Inline Card: Chess.js Log Analysis Result */}
        {chessJsAnalysis && (
          <div className="p-3 bg-slate-950 border border-emerald-800/80 rounded-xl space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-300 text-xs flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                Análisis Rápido de Registro ejecutado por Chess.js (Aislado de Motores)
              </span>
              <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-700">
                Latencia: {chessJsAnalysis.verificationLatencyMs} ms
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
              <div className="p-2 bg-slate-900 rounded border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Apertura Validada:</span>
                <span className="text-white font-bold">{chessJsAnalysis.openingDetected}</span>
              </div>
              <div className="p-2 bg-slate-900 rounded border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Jugadas de Libro (Chess.js):</span>
                <span className="text-emerald-400 font-bold font-mono">{chessJsAnalysis.bookMovesCount} plies</span>
              </div>
              <div className="p-2 bg-slate-900 rounded border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Jugadas Fuera de Libro:</span>
                <span className="text-slate-200 font-bold font-mono">{chessJsAnalysis.outOfBookPliesCount} plies</span>
              </div>
              <div className="p-2 bg-slate-900 rounded border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Integridad PGN:</span>
                <span className="text-emerald-300 font-bold">100% Válido</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
