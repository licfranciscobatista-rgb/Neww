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
} from 'lucide-react';
import { PlayerProfile } from '../types/chess';
import { savePlayerProfile, resetPlayerProfile, loadGameRecords } from '../storage/chessStorage';
import { computeAssistantsDashboard } from '../engine/personalAssistants';

interface ProfileViewProps {
  profile: PlayerProfile;
  onUpdateProfile: (profile: PlayerProfile) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ profile, onUpdateProfile }) => {
  const [name, setName] = useState(profile.username);
  const [aggressiveness, setAggressiveness] = useState<number>(profile.style?.aggressiveness || 0);
  const [tacticalInclination, setTacticalInclination] = useState<number>(profile.style?.tacticalInclination || 0);
  const [patience, setPatience] = useState<number>(profile.style?.patience || 0);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Load user's actual game records and compute the 8 assistants' real telemetry
  const games = useMemo(() => loadGameRecords(), [profile.gamesPlayed]);
  const dashboard = useMemo(() => computeAssistantsDashboard(games), [games]);

  const handleSave = () => {
    const updated: PlayerProfile = {
      ...profile,
      username: name,
      style: {
        ...profile.style,
        aggressiveness,
        tacticalInclination,
        patience,
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
      setAggressiveness(reset.style.aggressiveness);
      setTacticalInclination(reset.style.tacticalInclination);
      setPatience(reset.style.patience);
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
                  <span>Motor Personal Desbloqueado</span>
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>Bloqueado ({dashboard.history.manualGames}/10 partidas)</span>
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

      {/* Manual Fine-Tuning Sliders (Only active once games exist or allowed to adjust) */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Ajuste Fino de Ponderaciones del Motor Personal</span>
          </h4>
          <span className="text-[10px] text-slate-400">
            {profile.gamesPlayed >= 10 ? 'Calibrado con tus partidas' : 'Se ajustará con tus jugadas'}
          </span>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300">Ponderación de Agresividad</span>
              <span className="font-mono text-amber-400 font-bold">{aggressiveness}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="95"
              value={aggressiveness}
              onChange={(e) => setAggressiveness(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300">Ponderación Táctica (vs Posicional)</span>
              <span className="font-mono text-sky-400 font-bold">{tacticalInclination}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="95"
              value={tacticalInclination}
              onChange={(e) => setTacticalInclination(Number(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300">Ponderación de Paciencia / Profilaxis</span>
              <span className="font-mono text-emerald-400 font-bold">{patience}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="95"
              value={patience}
              onChange={(e) => setPatience(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={handleSave}
            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Ajustes del Perfil</span>
          </button>
        </div>
      </div>
    </div>
  );
};
