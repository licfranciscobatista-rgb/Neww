import React, { useState } from 'react';
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
  Settings2, TriangleAlert, BookOpen, Compass, LoaderCircle,
} from 'lucide-react';
import { EngineRecommendation, EngineType, StockfishOperatingMode } from '../types/chess';
import { getDirectMoveInstruction } from '../utils/moveInstruction';
import { OpeningPicker } from './OpeningPicker';
import { OPENING_PRESETS, type OpeningChoice } from '../engine/openingIndex';
import { getOpeningName } from '../engine/openingService';

interface EngineCardsProps {
  systemsMode?: boolean;
  rodentPanel?: React.ReactNode;
  chess: Chess;
  userColor?: 'w' | 'b';
  recommendations: Record<EngineType, EngineRecommendation | null>;
  loadingStates: Record<EngineType, boolean>;
  stockfishRemainingUses: number;
  garboRemainingUses: number;
  garboOpening?: string;
  garboOpeningState?: OpeningChoice;
  onChangeGarboOpening?: (id: string) => void;
  stockfishMode?: StockfishOperatingMode;
  onChangeStockfishMode?: (mode: StockfishOperatingMode) => void;
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
  isRivalTurn?: boolean;
}

export const EngineCards: React.FC<EngineCardsProps> = ({
  systemsMode = false,
  rodentPanel,
  chess,
  userColor = 'w',
  recommendations,
  loadingStates,
  stockfishRemainingUses,
  garboRemainingUses,
  garboOpening = 'free',
  garboOpeningState,
  onChangeGarboOpening,
  stockfishMode = 'per_request',
  onChangeStockfishMode,
  personalEngineUnlocked = false,
  personalProgress = '0 / 10 partidas',
  maiaElo = 1100,
  onChangeMaiaElo,
  arrowFilter,
  onToggleArrow,
  onApplyRecommendationMove,
  onRequestStockfish,
  onRequestGarbo,
  isRivalTurn = false,
}) => {
  const sfRec = recommendations.stockfish;
  const garboRec = recommendations.garbo;
  const [openingPickerOpen, setOpeningPickerOpen] = useState(false);
  const garboStatusText = garboOpeningState?.notice ||
    (garboRec?.isBookMove ? 'Continuación del repertorio' : 'Cálculo independiente de Garbo');
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
              disabled={isRivalTurn}
              onClick={onRequest}
              className={`w-full py-2 px-3 rounded-lg text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-[0.99] ${
                isRivalTurn
                  ? 'bg-slate-800/50 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                  : engineKey === 'stockfish'
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>
                {isRivalTurn
                  ? `${engineKey === 'stockfish' ? 'Stockfish' : 'GarboChess'} activo (turno rival)`
                  : `Consultar ${engineKey === 'stockfish' ? 'Stockfish' : 'GarboChess'} (${remainingUses} restantes)`}
              </span>
            </button>
          </div>
        );
      }
      return (
        <div className="text-center py-3 text-xs text-slate-400">
          {chess.isGameOver()
            ? 'Partida finalizada'
            : remainingUses === 0
            ? 'Límite de usos alcanzado para esta partida'
            : isRivalTurn
            ? 'Motor activo • Analizando tablero...'
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

        {/* Destilador de Libro: Claridad total sobre si la jugada proviene de teoría estándar o de cálculo de motor */}
        {engineKey !== 'stockfish' && (rec.isBookMove ? (
          <div className="bg-amber-950/40 border border-amber-500/30 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-[10px]">
            <span className="text-amber-300 font-bold flex items-center gap-1.5">
              <span>📖</span>
              <span>Jugada de Libro ECO</span>
            </span>
            <span className="text-amber-400 font-mono text-[9px] truncate max-w-[150px] font-medium">
              {rec.bookOpeningName || 'Teoría de Apertura'}
            </span>
          </div>
        ) : (
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Cálculo Autónomo de Motor</span>
            </span>
            <span className="font-mono text-[9px] text-slate-500">Fuera de libro</span>
          </div>
        ))}

        {/* Contraste del Motor Personal frente a Stockfish (Anti-Copia / Anti-Mirroring) */}
        {engineKey === 'personal' && rec.stockfishContrast && (
          <div className={`rounded-lg px-2.5 py-1.5 border text-[10px] space-y-1 ${
            rec.stockfishContrast.isDifferentFromStockfish
              ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
              : 'bg-blue-950/40 border-blue-600/30 text-blue-200'
          }`}>
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1">
                {rec.stockfishContrast.isDifferentFromStockfish ? '⚡ Soberano / Diferenciado' : '🤝 Convergencia Táctica'}
              </span>
              <span className="text-[9px] font-mono text-slate-400">
                {rec.stockfishContrast.stockfishSan ? `SF: ${rec.stockfishContrast.stockfishSan}` : 'SF Inactivo'}
              </span>
            </div>
            <p className="text-[9.5px] leading-tight text-slate-300">
              {rec.stockfishContrast.contrastReason}
            </p>
          </div>
        )}

        <p className="text-[11px] text-slate-300 leading-snug px-0.5">
          {engineKey === 'stockfish' ? instr.tacticalIntent : rec.explanation || instr.tacticalIntent}
        </p>

        {onApplyRecommendationMove && (
          <button
            disabled={isRivalTurn}
            onClick={() => !isRivalTurn && onApplyRecommendationMove(rec.move, engineKey)}
            className={`w-full py-2 px-3 rounded-lg border font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm ${
              isRivalTurn
                ? 'bg-slate-800/40 border-slate-700/40 text-slate-500 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-600 hover:border-slate-500 text-white active:scale-[0.99]'
            }`}
          >
            <span>{isRivalTurn ? 'Esperando tu turno...' : `Mover ${instr.pieceName} a ${rec.to.toUpperCase()}`}</span>
            {!isRivalTurn && <ArrowRight className="w-3.5 h-3.5 text-sky-400" />}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-3">
      <div className={`grid grid-cols-1 ${systemsMode ? '' : 'sm:grid-cols-2'} gap-3`}>
        {/* Stockfish 19 */}
        <div className={`${systemsMode ? 'hidden' : ''} bg-slate-900/90 border border-blue-500/30 rounded-xl p-3.5 flex flex-col justify-between shadow-lg relative overflow-hidden transition-all hover:border-blue-500/60`}>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Stockfish 19</h4>
                  <p className="text-[10px] text-blue-400 font-medium">Ref. Objetiva (Máx 15s)</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {stockfishMode === 'always_active' ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-950/60 text-blue-300 border-blue-600/40">
                    Toda la partida
                  </span>
                ) : stockfishMode === 'off' ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-950/60 text-red-300 border-red-700/50">
                    Apagado
                  </span>
                ) : (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      stockfishRemainingUses > 0
                        ? 'bg-sky-950/60 text-sky-300 border-sky-600/40'
                        : 'bg-red-950/60 text-red-300 border-red-700/50'
                    }`}
                  >
                    {stockfishRemainingUses}/3 usos
                  </span>
                )}

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

            {/* Selector interactivo de Modo de Stockfish en vivo */}
            <div className="flex items-center gap-1 my-2 p-1 bg-slate-950/80 rounded-lg border border-slate-800 text-[10px]">
              <button
                type="button"
                onClick={() => onChangeStockfishMode?.('always_active')}
                className={`flex-1 py-1 px-1.5 rounded font-bold transition-all text-center ${
                  stockfishMode === 'always_active'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
                title="Stockfish activo en cada jugada de la partida"
              >
                Toda la partida
              </button>
              <button
                type="button"
                onClick={() => onChangeStockfishMode?.('per_request')}
                className={`flex-1 py-1 px-1.5 rounded font-bold transition-all text-center ${
                  stockfishMode === 'per_request'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
                title="3 consultas por partida con descuento real"
              >
                3 Usos
              </button>
              <button
                type="button"
                onClick={() => onChangeStockfishMode?.('off')}
                className={`flex-1 py-1 px-1.5 rounded font-bold transition-all text-center ${
                  stockfishMode === 'off'
                    ? 'bg-red-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
                title="Desactivar Stockfish para no interferir"
              >
                Apagado
              </button>
            </div>

            {stockfishMode === 'off' ? (
              <div className="text-center py-4 space-y-2 bg-slate-950/40 rounded-xl border border-dashed border-red-900/40 my-1">
                <div className="flex items-center justify-center gap-1.5 text-red-400 font-bold text-xs">
                  <span>🔴 Stockfish Apagado</span>
                </div>
                <p className="text-[11px] text-slate-400 px-2 leading-relaxed">
                  Has apagado Stockfish. No consume recursos ni muestra flechas en el tablero. Tu Motor Personal y Maia/Garbo operan sin interferencias.
                </p>
                {onChangeStockfishMode && (
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      onClick={() => onChangeStockfishMode('always_active')}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold transition-all"
                    >
                      Encender (Toda la partida)
                    </button>
                    <button
                      onClick={() => onChangeStockfishMode('per_request')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded text-[10px] font-bold border border-slate-700 transition-all"
                    >
                      Encender (3 Usos)
                    </button>
                  </div>
                )}
              </div>
            ) : stockfishMode === 'always_active' ? (
              renderMoveBox(
                sfRec,
                loadingStates.stockfish,
                'Calculando jugada objetiva...',
                'stockfish'
              )
            ) : (
              renderMoveBox(
                sfRec,
                loadingStates.stockfish,
                'Calculando jugada objetiva...',
                'stockfish',
                stockfishRemainingUses,
                onRequestStockfish,
                'Tiempo máx 15s'
              )
            )}
          </div>

          <div className="pt-2 mt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Evaluación: {stockfishMode === 'off' ? 'Apagado' : sfRec?.evalDisplay || 'Bajo demanda'}</span>
            <span className="font-mono text-blue-400 font-bold">
              {stockfishMode === 'always_active'
                ? 'Continuo (Toda la partida)'
                : stockfishMode === 'off'
                ? 'Motor Apagado'
                : `${stockfishRemainingUses} usos restantes`}
            </span>
          </div>
        </div>

        {/* GarboChess (Motor de Sistema Principal) */}
        <div className={`${systemsMode ? '' : 'hidden'} bg-slate-900/90 border border-emerald-500/40 rounded-xl p-3.5 flex flex-col justify-between shadow-lg relative overflow-hidden transition-all hover:border-emerald-500/70`}>
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span>GarboChess</span>
                    <span className="text-[10px] font-mono text-emerald-400 font-semibold px-1 py-0.2 rounded bg-emerald-950/60 border border-emerald-800/40">
                      Sistema
                    </span>
                  </h4>
                  <p className="text-[10px] text-emerald-400 font-medium">Motor de Sistema & Estructura</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onToggleArrow('garbo')}
                  title={arrowFilter.garbo ? 'Ocultar flecha de Garbo' : 'Mostrar flecha de Garbo'}
                  className={`p-1.5 rounded transition-colors ${
                    arrowFilter.garbo ? 'text-emerald-300 bg-emerald-950/40 border border-emerald-700/50' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {arrowFilter.garbo ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button
                  type="button"
                  onClick={() => setOpeningPickerOpen(true)}
                  title="Preferencias iniciales de Garbo"
                  className="p-1.5 text-emerald-300 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 rounded border border-slate-700 transition-colors flex items-center gap-1 text-[11px] font-bold"
                >
                  <Settings2 size={14} />
                  <span>Preferencias</span>
                </button>
              </div>
            </div>

            {/* Sistema seleccionado y estado de teoría */}
            <div className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg bg-slate-950/60 border border-slate-800 my-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-emerald-400 font-bold truncate">
                  {OPENING_PRESETS.find(p => p.id === (garboOpeningState?.activeSystem || garboOpening))?.name || (garboOpening === 'rodent-active' ? 'Rodent activo' : garboOpening === 'auto' ? 'Automática' : garboOpening === 'free' ? 'Libre' : getOpeningName(garboOpening) || 'Variante')}
                </span>
                {garboOpeningState?.detected && (
                  <span className="text-[9px] text-slate-400 font-mono truncate hidden sm:inline">
                    ({garboOpeningState.detected})
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                garboRec?.isBookMove
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-600/40'
                  : 'bg-blue-950/60 text-blue-300 border-blue-600/40'
              }`}>
                {garboRec?.isBookMove ? 'Teoría ECO' : 'Adaptación Táctica'}
              </span>
            </div>

            {/* Caja de Jugada de GarboChess */}
            {loadingStates.garbo ? (
              <div className="py-5 flex items-center justify-center gap-2 text-xs text-slate-400 animate-pulse">
                <LoaderCircle size={18} className="animate-spin text-emerald-400" />
                <span>GarboChess calculando jugada de sistema...</span>
              </div>
            ) : garboRec ? (() => {
              const instr = getDirectMoveInstruction(chess, garboRec.from, garboRec.to, garboRec.san);
              return (
                <div className="space-y-2.5 my-1">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-emerald-950/60 border border-emerald-600/40 flex items-center justify-center text-xl shadow-inner shrink-0 text-emerald-300">
                        {instr.pieceSymbol}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate">
                          {instr.actionTitle}
                        </span>
                        <span className="text-[11px] font-mono text-emerald-400 block font-semibold">
                          {instr.fromToLabel}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="text-sm font-black font-mono text-white block">
                        {garboRec.san}
                      </span>
                      <span className="text-[10px] text-emerald-300 font-bold">
                        {garboRec.evalDisplay}
                      </span>
                    </div>
                  </div>

                  {/* Explicación Pedagógica del Sistema ("Más texto") */}
                  <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-lg p-2.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-300">
                      <span>Concepto del Sistema</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {garboRec.isBookMove ? 'Repertorio Estándar' : 'Cálculo de Motor'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-200 leading-relaxed">
                      {garboRec.explanation || instr.tacticalIntent}
                    </p>
                    {garboOpeningState?.notice && (
                      <p className="text-[10px] text-emerald-400/90 pt-0.5 border-t border-emerald-900/40">
                        {garboOpeningState.notice}
                      </p>
                    )}
                  </div>

                  {/* Botón de 1-clic para jugar la jugada */}
                  <button
                    type="button"
                    disabled={isRivalTurn || chess.isGameOver()}
                    onClick={() => onApplyRecommendationMove?.(garboRec.move, 'garbo')}
                    className={`w-full py-2 px-3 rounded-lg border font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                      isRivalTurn
                        ? 'bg-slate-800/40 border-slate-700/40 text-slate-500 cursor-not-allowed'
                        : 'bg-emerald-700 hover:bg-emerald-600 border-emerald-600 hover:border-emerald-500 text-white active:scale-[0.99]'
                    }`}
                  >
                    <span>
                      {isRivalTurn
                        ? 'Esperando tu turno...'
                        : `Jugar con Garbo: ${instr.pieceName} a ${garboRec.to.toUpperCase()} (${garboRec.san})`}
                    </span>
                    {!isRivalTurn && <ArrowRight className="w-3.5 h-3.5 text-emerald-200" />}
                  </button>
                </div>
              );
            })() : (
              <div className="text-center py-4 text-xs text-slate-400">
                {chess.isGameOver() ? 'Partida finalizada' : 'GarboChess analizando posición...'}
              </div>
            )}
          </div>


        </div>
        {openingPickerOpen && (
          <OpeningPicker
            title="Preferencias iniciales de Garbo"
            preferencesOnly
            selected={garboOpening}
            userColor={userColor}
            onSelect={id => {
              onChangeGarboOpening?.(id);
            }}
            onClose={() => setOpeningPickerOpen(false)}
          />
        )}

        {rodentPanel}

        {/* Motor Personal (Identidad Propia del Jugador) */}
        {!systemsMode && (() => {
          const cleanProgress = personalProgress.replace(/\s*partidas\s*$/i, '').trim();
          return (
            <div
              className={`bg-slate-900/90 rounded-xl p-3.5 flex flex-col justify-between shadow-lg relative overflow-hidden transition-all border ${
                personalEngineUnlocked
                  ? 'border-amber-500/40 hover:border-amber-500/70'
                  : 'border-amber-500/30'
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
                      <p className="text-[10px] text-amber-400 font-medium">Modelo Jugador Propio</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        personalEngineUnlocked
                          ? 'bg-amber-950/60 text-amber-300 border-amber-600/40'
                          : 'bg-amber-950/60 text-amber-400 border-amber-800/50'
                      }`}
                    >
                      {cleanProgress} partidas
                    </span>
                    <button
                      onClick={() => onToggleArrow('personal')}
                      className={`p-1 rounded text-slate-400 hover:text-white transition-colors ${
                        arrowFilter.personal ? 'text-amber-400' : 'opacity-40'
                      }`}
                      title="Activar/desactivar flecha personal"
                    >
                      {arrowFilter.personal ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {personalEngineUnlocked ? (
                  renderMoveBox(
                    personalRec,
                    loadingStates.personal,
                    'Evaluando con tu ADN personal...',
                    'personal'
                  )
                ) : (
                  <div className="text-center py-4 space-y-1.5 my-1 bg-slate-950/40 rounded-xl border border-dashed border-amber-900/40">
                    <div className="flex items-center justify-center gap-1.5 text-amber-400 font-bold text-xs">
                      <Lock className="w-3.5 h-3.5" />
                      <span>En Calibración ({cleanProgress} partidas)</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Requiere 10 partidas para sugerir en el tablero
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2 mt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                <span className="truncate">
                  {personalEngineUnlocked
                    ? `Estilo: ${personalRec?.evalDisplay || 'Propio'}`
                    : 'Calibración en segundo plano'}
                </span>
                <span className="font-mono text-amber-400 font-bold bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40 shrink-0">
                  {personalEngineUnlocked
                    ? (parseInt(cleanProgress, 10) >= 10 ? 'Soberano (100%)' : `Calibrando (${cleanProgress})`)
                    : `${cleanProgress} partidas`}
                </span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
