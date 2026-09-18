import React from 'react';
import { Chess } from 'chess.js';
import {
  Cpu,
  Sparkles,
  Brain,
  UserCheck,
  Eye,
  EyeOff,
  ArrowRight,
  Play,
  Lock,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { EngineRecommendation, EngineType } from '../types/chess';
import { getDirectMoveInstruction } from '../utils/moveInstruction';

interface EngineCardsProps {
  chess: Chess;
  recommendations: Record<EngineType, EngineRecommendation | null>;
  loadingStates: Record<EngineType, boolean>;
  stockfishRemainingUses: number;
  garboRemainingUses: number;
  personalEngineUnlocked?: boolean;
  personalProgress?: string;
  maiaElo?: number;
  onChangeMaiaElo?: (elo: number) => void;
  agreements: { move: string; san: string; engines: EngineType[] }[];
  onRequestStockfish: () => void;
  onRequestGarbo: () => void;
  arrowFilter: Record<EngineType, boolean>;
  onToggleArrow: (engine: EngineType) => void;
  onApplyRecommendationMove?: (moveUci: string, source: EngineType) => void;
}

export const EngineCards: React.FC<EngineCardsProps> = ({
  chess,
  recommendations,
  loadingStates,
  stockfishRemainingUses,
  garboRemainingUses,
  personalEngineUnlocked = false,
  personalProgress = '0 / 10 partidas',
  maiaElo = 1100,
  onChangeMaiaElo,
  arrowFilter,
  onToggleArrow,
  onApplyRecommendationMove,
  onRequestStockfish,
  onRequestGarbo,
}) => {
  const sfRec = recommendations.stockfish;
  const garboRec = recommendations.garbo;
  const maiaRec = recommendations.maia;
  const personalRec = recommendations.personal;

  const renderMoveBox = (
    rec: EngineRecommendation | null,
    loading: boolean,
    loadingText: string,
    engineKey: EngineType,
    remainingUses?: number,
    onRequest?: () => void,
    timeLimitText?: string
  ) => {
    if (loading) {
      return (
        <div className="py-4 flex items-center justify-center gap-2 text-xs text-slate-400 animate-pulse">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin border-sky-400" />
          <span>{loadingText}</span>
        </div>
      );
    }

    if (!rec || !rec.move) {
      if (remainingUses !== undefined && remainingUses > 0 && onRequest) {
        return (
          <div className="text-center py-2 space-y-2">
            <p className="text-[11px] text-slate-400 font-medium">
              Activación bajo demanda ({timeLimitText || 'Máx 15s'})
            </p>
            <button
              onClick={onRequest}
              className={`w-full py-2 px-3 rounded-lg text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-[0.99] ${
                engineKey === 'stockfish'
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Consultar {engineKey === 'stockfish' ? 'Stockfish' : 'GarboChess'} ({remainingUses} restantes)</span>
            </button>
          </div>
        );
      }
      return (
        <div className="text-center py-3 text-xs text-slate-400">
          {remainingUses === 0
            ? 'Límite de usos alcanzado para esta partida'
            : 'Esperando solicitud de jugada'}
        </div>
      );
    }

    const instr = getDirectMoveInstruction(chess, rec.from, rec.to, rec.san);

    return (
      <div className="space-y-2.5 my-1">
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xl shadow-inner shrink-0">
              {instr.pieceSymbol}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block truncate">
                {instr.actionTitle}
              </span>
              <span className="text-[11px] font-mono text-sky-400 block font-semibold">
                {instr.fromToLabel}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0 ml-2">
            <span className="text-sm font-black font-mono text-white block">
              {instr.shortSan}
            </span>
            <span className="text-[10px] text-slate-400 font-bold">
              {rec.evalDisplay || `${rec.confidence}%`}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-300 leading-snug px-0.5">
          {instr.tacticalIntent}
        </p>

        {onApplyRecommendationMove && (
          <button
            onClick={() => onApplyRecommendationMove(rec.move, engineKey)}
            className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.99]"
          >
            <span>Mover {instr.pieceName} a {rec.to.toUpperCase()}</span>
            <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Stockfish 17 */}
        <div className="bg-slate-900/90 border border-blue-500/30 rounded-xl p-3.5 flex flex-col justify-between shadow-lg relative overflow-hidden transition-all hover:border-blue-500/60">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Stockfish 17</h4>
                  <p className="text-[10px] text-blue-400 font-medium">Ref. Objetiva (Máx 15s)</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    stockfishRemainingUses > 0
                      ? 'bg-blue-950/60 text-blue-300 border-blue-600/40'
                      : 'bg-red-950/60 text-red-300 border-red-700/50'
                  }`}
                >
                  {stockfishRemainingUses}/3 usos
                </span>
                <button
                  onClick={() => onToggleArrow('stockfish')}
                  className={`p-1 rounded text-slate-400 hover:text-white transition-colors ${
                    arrowFilter.stockfish ? 'text-blue-400' : 'opacity-40'
                  }`}
                  title="Activar/desactivar flecha de Stockfish"
                >
                  {arrowFilter.stockfish ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {renderMoveBox(
              sfRec,
              loadingStates.stockfish,
              'Calculando jugada objetiva...',
              'stockfish',
              stockfishRemainingUses,
              onRequestStockfish,
              'Tiempo máx 15s'
            )}
          </div>

          <div className="pt-2 mt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Evaluación: {sfRec?.evalDisplay || 'Bajo demanda'}</span>
            <span className="font-mono text-blue-400 font-bold">Topado a 3 usos</span>
          </div>
        </div>

        {/* GarboChess */}
        <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-3.5 flex flex-col justify-between shadow-lg relative overflow-hidden transition-all hover:border-emerald-500/60">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">GarboChess</h4>
                  <p className="text-[10px] text-emerald-400 font-medium">IA Secundaria (Máx 5s)</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    garboRemainingUses > 0
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-600/40'
                      : 'bg-red-950/60 text-red-300 border-red-700/50'
                  }`}
                >
                  {garboRemainingUses}/5 usos
                </span>
                <button
                  onClick={() => onToggleArrow('garbo')}
                  className={`p-1 rounded text-slate-400 hover:text-white transition-colors ${
                    arrowFilter.garbo ? 'text-emerald-400' : 'opacity-40'
                  }`}
                  title="Activar/desactivar flecha de Garbo"
                >
                  {arrowFilter.garbo ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {renderMoveBox(
              garboRec,
              loadingStates.garbo,
              'Buscando alternativa sólida...',
              'garbo',
              garboRemainingUses,
              onRequestGarbo,
              'Tiempo máx 5s'
            )}
          </div>

          <div className="pt-2 mt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Margen seguro ≤1 peón</span>
            <span className="font-mono text-emerald-400 font-bold">Topado a 5 usos</span>
          </div>
        </div>

        {/* Maia 3 (Modelo Neuronal Humano, Calibrado 500 a 2400 Elo) */}
        <div className="bg-slate-900/90 border border-purple-500/30 rounded-xl p-3.5 flex flex-col justify-between shadow-lg relative overflow-hidden transition-all hover:border-purple-500/60">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Brain className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Maia 3</h4>
                  <p className="text-[10px] text-purple-400 font-medium">Modelo Neuronal Humano</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Elo Quick Selector */}
                {onChangeMaiaElo && (
                  <select
                    value={maiaElo}
                    onChange={(e) => onChangeMaiaElo(Number(e.target.value))}
                    className="bg-purple-950/80 border border-purple-600/50 rounded-lg text-purple-200 text-[10px] font-bold px-1.5 py-0.5 focus:outline-none focus:border-purple-400 cursor-pointer"
                    title="Calibrar nivel Elo de Maia (500 a 2400)"
                  >
                    <option value={500}>500 (Novato)</option>
                    <option value={700}>700 Elo</option>
                    <option value={900}>900 Elo</option>
                    <option value={1100}>1100 (Club)</option>
                    <option value={1300}>1300 Elo</option>
                    <option value={1500}>1500 Elo</option>
                    <option value={1700}>1700 Elo</option>
                    <option value={1900}>1900 (Experto)</option>
                    <option value={2100}>2100 Elo</option>
                    <option value={2400}>2400 (Maestro)</option>
                  </select>
                )}

                <button
                  onClick={() => onToggleArrow('maia')}
                  className={`p-1 rounded text-slate-400 hover:text-white transition-colors ${
                    arrowFilter.maia ? 'text-purple-400' : 'opacity-40'
                  }`}
                  title="Activar/desactivar flecha de Maia"
                >
                  {arrowFilter.maia ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {renderMoveBox(
              maiaRec,
              loadingStates.maia,
              `Estimando elección humana para ${maiaElo} Elo...`,
              'maia'
            )}
          </div>

          <div className="pt-2 mt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Prob. humana: {maiaRec ? `${Math.round((maiaRec.humanProbability || 0.5) * 100)}%` : '—'}</span>
            <span className="font-mono text-purple-300 font-bold bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
              Elo {maiaElo} (500–2400)
            </span>
          </div>
        </div>

        {/* Motor Personal (Identidad Propia del Jugador, Exclusivamente Asistida por sus 7 Ayudantes) */}
        <div
          className={`rounded-xl p-3.5 flex flex-col justify-between shadow-lg relative overflow-hidden transition-all border ${
            personalEngineUnlocked
              ? 'bg-slate-900/90 border-amber-500/40 hover:border-amber-500/70'
              : 'bg-slate-950/90 border-amber-900/40 opacity-90'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
                    personalEngineUnlocked
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-amber-950/30 border-amber-800/40 text-amber-500'
                  }`}
                >
                  {personalEngineUnlocked ? (
                    <UserCheck className="w-4 h-4" />
                  ) : (
                    <Lock className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Motor Personal</h4>
                  <p className="text-[10px] text-amber-400 font-medium">Identidad Propia • 7 Ayudantes</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    personalEngineUnlocked
                      ? 'bg-amber-950/60 text-amber-300 border-amber-600/40'
                      : 'bg-amber-950/40 text-amber-400 border-amber-800/50'
                  }`}
                >
                  {personalEngineUnlocked ? 'Desbloqueado' : `Bloqueado (${personalProgress})`}
                </span>
                {personalEngineUnlocked && (
                  <button
                    onClick={() => onToggleArrow('personal')}
                    className={`p-1 rounded text-slate-400 hover:text-white transition-colors ${
                      arrowFilter.personal ? 'text-amber-400' : 'opacity-40'
                    }`}
                    title="Activar/desactivar flecha personal"
                  >
                    {arrowFilter.personal ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {!personalEngineUnlocked ? (
              <div className="py-2.5 px-3 bg-slate-900/70 border border-amber-900/30 rounded-xl space-y-2.5 my-1 text-left">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Calibrando ADN de Juego</span>
                </div>

                <p className="text-[11px] text-slate-300 leading-snug">
                  Requiere al menos <strong className="text-amber-300">10 partidas jugadas por ti</strong> para activar recomendaciones y flechas.
                </p>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                    <span>Progreso de partidas</span>
                    <span className="text-amber-400 font-bold">{personalProgress}</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                    <div
                      className="bg-amber-500 h-full transition-all duration-500 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          (parseInt(personalProgress.split('/')[0] || '0', 10) / 10) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* The 7 Specific Assistants Badges */}
                <div className="space-y-1 pt-1 border-t border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    7 Ayudantes Exclusivos (Sin Maia ni Motores Externos):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      '1. Historial',
                      '2. Estilo',
                      '3. Aperturas',
                      '4. Errores Recurrentes',
                      '5. Profilaxis',
                      '6. Táctica',
                      '7. Tiempo',
                    ].map((assistant) => (
                      <span
                        key={assistant}
                        className="px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-800/40 text-amber-300/90 text-[9px] font-medium font-mono"
                      >
                        {assistant}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              renderMoveBox(
                personalRec,
                loadingStates.personal,
                'Ayudante de Estilo evaluando...',
                'personal'
              )
            )}
          </div>

          <div className="pt-2 mt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
            <span className="truncate max-w-[200px]">
              {personalEngineUnlocked
                ? personalRec?.evalDisplay || 'Esperando posición'
                : 'Sin flecha (bloqueado < 10 partidas)'}
            </span>
            <span className="font-mono text-amber-400 font-bold bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40 shrink-0">
              Identidad Pura (7 Ayudantes)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
