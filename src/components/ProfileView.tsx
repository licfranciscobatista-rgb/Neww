import React, { useState, useMemo } from 'react';
import {
  User,
  Sliders,
  Shield,
  Save,
  RotateCcw,
  Check,
  Database,
  Sparkles,
  BookOpen,
  AlertTriangle,
  ShieldCheck,
  Swords,
  Timer,
  Crown,
  Activity,
  CheckCircle2,
  Lock,
  Download,
  FileCode,
  ChevronDown,
  ChevronUp,
  Cpu,
} from 'lucide-react';
import { PlayerProfile } from '../types/chess';
import { savePlayerProfile, resetPlayerProfile, loadGameRecords } from '../storage/chessStorage';
import { computeAssistantsDashboard } from '../engine/personalAssistants';
import { compilePersonalEngineDNA, PersonalEngineDNAFile } from '../engine/personalDNAFile';

interface ProfileViewProps {
  profile: PlayerProfile;
  onUpdateProfile: (profile: PlayerProfile) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ profile, onUpdateProfile }) => {
  const [name, setName] = useState(profile.username);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showJsonInspector, setShowJsonInspector] = useState(false);

  // Load user's actual game records and compute the 8 assistants' real telemetry
  const games = useMemo(() => loadGameRecords(), [profile.gamesPlayed]);
  const dashboard = useMemo(() => computeAssistantsDashboard(games), [games]);

  // Compilar el Archivo Final de ADN que alimenta al Motor Personal Soberano
  const compiledDNA = useMemo<PersonalEngineDNAFile>(
    () => compilePersonalEngineDNA(profile, games, dashboard.distilled),
    [profile, games, dashboard.distilled]
  );

  const handleDownloadDNA = () => {
    const jsonString = JSON.stringify(compiledDNA, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `personal-engine-dna-${profile.username || 'jugador'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Valores automáticos extraídos por los ayudantes a partir de las partidas reales del jugador
  const autoAggressiveness = dashboard.history.manualGames > 0
    ? dashboard.distilled.aggressionScore
    : (profile.style?.aggressiveness || 0);

  const autoTacticalInclination = dashboard.history.manualGames > 0
    ? Math.min(95, Math.max(5, dashboard.tactics.tacticalDensityPct || (100 - dashboard.distilled.patienceScore)))
    : (profile.style?.tacticalInclination || 0);

  const autoPatience = dashboard.history.manualGames > 0
    ? dashboard.distilled.patienceScore
    : (profile.style?.patience || 0);

  const calibrationPct = Math.min(100, Math.round((profile.gamesPlayed / 10) * 100));

  const handleSave = () => {
    const updated: PlayerProfile = {
      ...profile,
      username: name,
      style: {
        ...profile.style,
        aggressiveness: autoAggressiveness,
        tacticalInclination: autoTacticalInclination,
        patience: autoPatience,
        isCalibrated: profile.gamesPlayed >= 10,
      },
    };
    savePlayerProfile(updated);
    onUpdateProfile(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleReset = () => {
    if (window.confirm('¿Deseas reiniciar la calibración de tu perfil y memoria del motor personal?')) {
      const reset = resetPlayerProfile();
      setName(reset.username);
      onUpdateProfile(reset);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-2 sm:p-4 space-y-5 text-xs text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-sky-400" />
            Perfil del Jugador y Resultados del Motor Personal
          </h2>
          <p className="text-xs text-slate-400">
            Telemetría activa y resultados de los 8 Ayudantes especializados que construyen tu identidad de juego
          </p>
        </div>

        <button
          onClick={handleReset}
          className="px-3 py-1.5 bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-300 border border-slate-700 rounded-lg transition-colors text-xs flex items-center gap-1.5"
          title="Reiniciar perfil a valores limpios"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reiniciar Perfil</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-950 border border-emerald-600 rounded-xl text-emerald-200 font-bold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>¡Perfil guardado correctamente! Los cambios se aplican al motor personal.</span>
        </div>
      )}

      {/* KPI Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Partidas Jugadas
          </span>
          <span className="text-2xl font-black font-mono text-white block">
            {profile.gamesPlayed}
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            {profile.gamesPlayed === 0 ? (
              '0 partidas registradas'
            ) : profile.gamesPlayed >= 10 ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Motor Personal Desbloqueado (10/10)
              </span>
            ) : (
              <span className="text-amber-400">
                Faltan {10 - profile.gamesPlayed} partidas para calibración completa
              </span>
            )}
          </span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Rango Elo Estimado
          </span>
          <span
            className={`text-2xl font-black font-mono block ${
              profile.estimatedElo ? 'text-sky-400' : 'text-slate-500'
            }`}
          >
            {profile.estimatedElo ? `${profile.estimatedElo} Elo` : 'Sin calificar'}
          </span>
          <span className="text-[11px] text-slate-400">
            {profile.estimatedElo
              ? profile.gamesPlayed >= 10
                ? 'Calculado con tus partidas reales'
                : `Provisional (${profile.gamesPlayed}/10 partidas)`
              : 'Requiere jugar partidas para calcular'}
          </span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Memoria Destilada (8 Ayudantes)
          </span>
          <span
            className={`text-2xl font-black font-mono block ${
              dashboard.history.distilledBytes > 0 ? 'text-amber-400' : 'text-slate-500'
            }`}
          >
            {dashboard.history.distilledBytes} B
          </span>
          <span className="text-[11px] text-slate-400">
            {dashboard.history.distilledBytes > 0
              ? `${dashboard.distilled.userMoves.length} jugadas manuales puras`
              : 'Se destilará de tus jugadas'}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECCIÓN CRÍTICA: EL ARCHIVO FINAL QUE ALIMENTA AL MOTOR PERSONAL          */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 border-2 border-amber-500/50 rounded-2xl space-y-4 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-500/20">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 flex items-center gap-1 shadow-sm">
                <FileCode className="w-3 h-3" />
                Archivo Final de ADN
              </span>
              <span className="font-mono text-xs font-bold text-amber-300">
                personal-engine-dna.json
              </span>
              <span className="text-[10px] font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-400">
                {compiledDNA.checksum}
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Este es el artefacto compilado por los <strong>8 Sub-Motores</strong>. El <strong>Motor Personal Soberano</strong> es un módulo independiente que consume este archivo como su único combustible de cálculo.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDownloadDNA}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow transition-all"
              title="Descargar archivo personal-engine-dna.json para auditarlo externamente"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar .JSON</span>
            </button>
            <button
              onClick={() => setShowJsonInspector(!showJsonInspector)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs flex items-center gap-1.5 transition-all"
            >
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span>{showJsonInspector ? 'Ocultar JSON' : 'Inspeccionar RAW'}</span>
              {showJsonInspector ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Diagrama del Flujo Arquitectónico */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-[11px]">
          <div className="space-y-1 p-2 bg-slate-900/60 rounded border border-slate-800">
            <span className="font-bold text-sky-400 block flex items-center gap-1.5">
              <span>1. Refinería de 8 Sub-Motores</span>
            </span>
            <p className="text-slate-400 text-[10px] leading-snug">
              Analizan tus partidas, eliminan ruido PGN, indexan el grafo de posiciones y catalogan sesgos.
            </p>
            <span className="text-[9px] font-mono text-emerald-400 block pt-1">
              • Estado: {games.length} partidas procesadas
            </span>
          </div>

          <div className="space-y-1 p-2 bg-slate-900/60 rounded border border-amber-800/40">
            <span className="font-bold text-amber-400 block flex items-center gap-1.5">
              <span>2. Compilación del Archivo Final</span>
            </span>
            <p className="text-slate-400 text-[10px] leading-snug">
              Se empaqueta el ADN en <code className="text-amber-300">personal-engine-dna.json</code> con {compiledDNA.subEnginesCompilation.subEngine1_PositionGraph.totalNodesMapped} nodos posicionales.
            </p>
            <span className="text-[9px] font-mono text-amber-300 block pt-1">
              • Tamaño: {dashboard.history.distilledBytes} B ({compiledDNA.source.compressionEfficiency})
            </span>
          </div>

          <div className="space-y-1 p-2 bg-slate-900/60 rounded border border-slate-800">
            <span className="font-bold text-emerald-400 block flex items-center gap-1.5">
              <span>3. Motor Personal Independiente</span>
            </span>
            <p className="text-slate-400 text-[10px] leading-snug">
              Carga este archivo en memoria y emite jugadas soberanas sin intervención externa.
            </p>
            <span className="text-[9px] font-mono text-slate-300 block pt-1">
              • Modo: {compiledDNA.engineReadiness.operationalMode} ({compiledDNA.engineReadiness.calibrationProgress})
            </span>
          </div>
        </div>

        {/* Inspector RAW expandible */}
        {showJsonInspector && (
          <div className="p-3 bg-slate-950 rounded-xl border border-amber-900/60 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span className="text-amber-400 font-bold">Contenido en memoria entregado al Motor Personal:</span>
              <span>{new Date(compiledDNA.compilationTimestamp).toLocaleTimeString()}</span>
            </div>
            <pre className="p-3 bg-slate-900/90 text-emerald-300 font-mono text-[10px] rounded-lg overflow-x-auto max-h-64 border border-slate-800 leading-relaxed">
              {JSON.stringify(compiledDNA, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Basic Profile Name Field */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
        <label className="text-xs font-bold text-slate-300 block">
          Nombre del Jugador
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
            placeholder="Introduce tu nombre"
          />
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECCIÓN PRINCIPAL: RESULTADOS DE LOS 8 AYUDANTES DEL MOTOR PERSONAL       */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 bg-slate-900/90 border border-amber-500/30 rounded-2xl space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Arquitectura del Motor Personal
              </span>
              <h3 className="text-sm font-bold text-white">
                Resultados y Telemetría de los 8 Ayudantes Especializados
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Programaciones complejas dedicadas exclusivamente a construir tu ADN ajedrecístico a partir de tus jugadas manuales
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${
                dashboard.history.isCalibrated
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  : dashboard.history.manualGames > 0
                  ? 'bg-amber-950 text-amber-300 border-amber-700'
                  : 'bg-slate-950 text-slate-400 border-slate-800'
              }`}
            >
              {dashboard.history.isCalibrated ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Motor Personal Calibrado al 100% ({dashboard.history.manualGames} partidas)</span>
                </>
              ) : dashboard.history.manualGames > 0 ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-amber-400" />
                  <span>Motor Personal Activo (Calibrando: {dashboard.history.manualGames}/10)</span>
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>Motor en Aprendizaje Inicial (0/10)</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Global Pipeline Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800/80 font-mono text-[11px]">
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-500 block uppercase">Partidas Manuales</span>
            <span className="text-white font-bold text-sm">{dashboard.history.manualGames} / 10</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-500 block uppercase">Jugadas Puras Destiladas</span>
            <span className="text-sky-400 font-bold text-sm">{dashboard.distilled.userMoves.length} plies</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-500 block uppercase">Jugadas IA Descartadas</span>
            <span className="text-rose-400 font-bold text-sm">{dashboard.history.discardedIa} plies</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-500 block uppercase">Libro Teórico Descartado</span>
            <span className="text-amber-400 font-bold text-sm">{dashboard.history.discardedBook} plies</span>
          </div>
        </div>

        {/* Grid de los 8 Ayudantes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* 1. AYUDANTE DE HISTORIAL */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Database className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">1. Ayudante de Historial</h4>
                  <span className="text-[10px] text-slate-400">Filtro Anti-IA & Compresión</span>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                {dashboard.history.distilledBytes} B destilados
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-snug">
              Aísla las jugadas de tus PGN. Detecta y descarta sistemáticamente jugadas asistidas con IA (Stockfish) y jugadas de libro teórico para preservar únicamente tu pensamiento manual.
            </p>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>{dashboard.history.manualGames} partidas manuales</span>
              <span>{dashboard.distilled.userMoves.length} jugadas destiladas</span>
            </div>
          </div>

          {/* 2. AYUDANTE DE ESTILO */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">2. Ayudante de Estilo</h4>
                  <span className="text-[10px] text-slate-400">Scoring Posicional (1.0 a 10.0)</span>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                {dashboard.style.archetype}
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-snug">
              {dashboard.style.description}
            </p>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>Agresividad: <strong className="text-amber-400">{dashboard.style.aggressiveness}%</strong></span>
              <span>Paciencia: <strong className="text-emerald-400">{dashboard.style.patience}%</strong></span>
            </div>
          </div>

          {/* 3. AYUDANTE DE APERTURAS & REPERTORIO */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <BookOpen className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">3. Ayudante de Aperturas</h4>
                  <span className="text-[10px] text-slate-400">Repertorio & Frecuencia</span>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                {dashboard.openings.topList.length} líneas
              </span>
            </div>

            {dashboard.openings.topList.length === 0 ? (
              <p className="text-[11px] text-slate-400 leading-snug">
                Sin aperturas registradas aún. Detectará tus líneas predilectas con blancas y negras a medida que juegues.
              </p>
            ) : (
              <div className="space-y-1">
                {dashboard.openings.topList.map((op, i) => (
                  <div key={i} className="flex justify-between text-[10px] text-slate-300 font-mono">
                    <span className="truncate max-w-[200px]">{op.name}</span>
                    <span className="text-emerald-400 font-bold">{op.count}x ({op.winRatePct}% vict)</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>Fav Blancas: <strong className="text-slate-200">{dashboard.openings.favoriteMoveWhite}</strong></span>
              <span>Fav Negras: <strong className="text-slate-200">{dashboard.openings.favoriteMoveBlack}</strong></span>
            </div>
          </div>

          {/* 4. AYUDANTE DE ERRORES RECURRENTES */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">4. Ayudante de Errores</h4>
                  <span className="text-[10px] text-slate-400">Tracker de Despistes</span>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                {dashboard.mistakes.length} patrones
              </span>
            </div>

            {dashboard.mistakes.length === 0 ? (
              <p className="text-[11px] text-slate-400 leading-snug">
                Sin descuidos recurrentes detectados. Supervisa salidas de dama apresuradas o pérdidas de enroque bajo presión.
              </p>
            ) : (
              <div className="space-y-1">
                {dashboard.mistakes.map((m, i) => (
                  <div key={i} className="text-[10px] bg-rose-950/40 p-1.5 rounded border border-rose-900/50 space-y-0.5">
                    <span className="font-bold text-rose-300 block">{m.pattern} ({m.frequency}x)</span>
                    <span className="text-slate-400 text-[9px]">{m.advice}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 font-mono">
              <span>Genera alertas preventivas en tiempo real durante la partida</span>
            </div>
          </div>

          {/* 5. AYUDANTE DE PROFILAXIS Y PACIENCIA */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">5. Ayudante de Profilaxis</h4>
                  <span className="text-[10px] text-slate-400">Paciencia & Seguridad del Rey</span>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800">
                {dashboard.patience.score}% paciencia
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-snug">
              {dashboard.patience.evaluation}
            </p>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>Jugadas tranquilas: <strong className="text-slate-200">{dashboard.patience.quietMovesCount}</strong></span>
              <span>Profilaxis activa: <strong className="text-teal-300">{dashboard.patience.prophylacticMovesCount}</strong></span>
            </div>
          </div>

          {/* 6. AYUDANTE DE TÁCTICA Y AGRESIVIDAD */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Swords className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">6. Ayudante de Táctica</h4>
                  <span className="text-[10px] text-slate-400">Iniciativa, Jaques & Capturas</span>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                {dashboard.tactics.score}% táctica
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-snug">
              {dashboard.tactics.evaluation}
            </p>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>Jaques: <strong className="text-purple-300">{dashboard.tactics.checksCount}</strong></span>
              <span>Capturas: <strong className="text-purple-300">{dashboard.tactics.capturesCount}</strong></span>
              <span>Densidad táctica: <strong className="text-white">{dashboard.tactics.tacticalDensityPct}%</strong></span>
            </div>
          </div>

          {/* 7. AYUDANTE DE GESTIÓN DEL TIEMPO */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Timer className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">7. Ayudante de Tiempo</h4>
                  <span className="text-[10px] text-slate-400">Ritmo & Cadencia</span>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                {dashboard.time.averageSeconds}s / jugada
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-snug">
              {dashboard.time.recommendation}
            </p>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>Cadencia: <strong className="text-sky-300">{dashboard.time.cadenceCategory}</strong></span>
              <span>{dashboard.time.timePressureAlert ? '⚠️ Alerta de apuro' : '✓ Ritmo saludable'}</span>
            </div>
          </div>

          {/* 8. AYUDANTE DE TRANSICIÓN Y FINALES */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-600/10 border border-amber-600/30 flex items-center justify-center text-amber-500">
                  <Crown className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">8. Ayudante de Finales</h4>
                  <span className="text-[10px] text-slate-400">Simplificación & Técnica</span>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                {dashboard.endgame.endgameMovesCount} plies en final
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-snug">
              {dashboard.endgame.advice}
            </p>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>Cambio de damas: <strong className="text-slate-200">{dashboard.endgame.queenTradeFrequency}</strong></span>
              <span>{dashboard.endgame.endgameExperienceRating}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Avance y Ponderaciones Automáticas del Motor Personal (Sin intervención manual) */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Avance y Ponderaciones del Motor Personal</span>
          </h4>
          <div className="text-[10px]">
            {profile.gamesPlayed >= 10 ? (
              <span className="px-2 py-0.5 rounded font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 w-fit">
                <CheckCircle2 className="w-3 h-3" />
                Calibración Completa (10/10)
              </span>
            ) : profile.gamesPlayed > 0 ? (
              <span className="px-2 py-0.5 rounded font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1 w-fit">
                <Activity className="w-3 h-3" />
                En Aprendizaje ({profile.gamesPlayed}/10 partidas)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded font-bold bg-slate-800 text-slate-400 border border-slate-700 w-fit">
                Sin partidas (0/10) - Se calibrará automáticamente
              </span>
            )}
          </div>
        </div>

        {/* Barra de progreso global del motor */}
        <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-300 font-medium">Progreso de maduración del motor</span>
            <span className="font-mono font-bold text-amber-400">{calibrationPct}% ({profile.gamesPlayed}/10 partidas)</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${Math.max(calibrationPct > 0 ? calibrationPct : 2, 2)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            {profile.gamesPlayed >= 10
              ? 'El motor personal ha alcanzado maduración completa y replica tus decisiones con fidelidad.'
              : 'Juega partidas completas en modo manual; los 8 ayudantes extraen tu estilo automáticamente sin necesidad de ajustes manuales.'}
          </p>
        </div>

        {/* Métricas resultantes del aprendizaje */}
        <div className="space-y-3.5 pt-1">
          {/* 1. Agresividad */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                <Swords className="w-3.5 h-3.5 text-amber-400" />
                <span>Ponderación de Agresividad</span>
              </span>
              <span className="font-mono text-amber-400 font-bold">{autoAggressiveness}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 border border-slate-800 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(autoAggressiveness, 0)}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400">
              {profile.gamesPlayed > 0
                ? dashboard.tactics.evaluation
                : 'Se calculará automáticamente analizando tus capturas, jaques y rupturas tácticas.'}
            </div>
          </div>

          {/* 2. Táctica vs Posicional */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
                <span>Ponderación Táctica (vs Posicional)</span>
              </span>
              <span className="font-mono text-sky-400 font-bold">{autoTacticalInclination}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 border border-slate-800 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-sky-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(autoTacticalInclination, 0)}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400">
              {profile.gamesPlayed > 0
                ? `Densidad táctica: ${dashboard.tactics.tacticalDensityPct}% de jugadas de iniciativa versus juego estructural.`
                : 'Se calculará comparando tu frecuencia de jugadas forzadas frente a maniobras posicionales.'}
            </div>
          </div>

          {/* 3. Paciencia / Profilaxis */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ponderación de Paciencia / Profilaxis</span>
              </span>
              <span className="font-mono text-emerald-400 font-bold">{autoPatience}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 border border-slate-800 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(autoPatience, 0)}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400">
              {profile.gamesPlayed > 0
                ? `${dashboard.patience.evaluation} (${dashboard.patience.quietMovesCount} jugadas tranquilas).`
                : 'Se calculará midiendo jugadas de prevención de amenazas rivales y consolidación.'}
            </div>
          </div>
        </div>

        {/* Nota informativa de autonomía */}
        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-start gap-2.5 text-[11px] text-slate-400">
          <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-slate-200">Aprendizaje 100% Autónomo:</strong> Estas ponderaciones reflejan exclusivamente tu ADN ajedrecístico real. Se actualizan automáticamente cada vez que concluyes una partida, sin necesidad de calibración manual.
          </p>
        </div>
      </div>
    </div>
  );
};
