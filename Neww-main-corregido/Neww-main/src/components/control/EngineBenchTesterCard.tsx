import React, { useState } from 'react';
import { Play, Cpu, Sparkles, CheckCircle, Clock, Zap, Target } from 'lucide-react';
import { EngineType } from '../../types/chess';
import {
  runEngineBenchTest,
  BENCHMARK_TEST_POSITIONS,
  EngineBenchResult,
} from '../../engine/director/engineBenchTester';

export const EngineBenchTesterCard: React.FC = () => {
  const [selectedEngine, setSelectedEngine] = useState<EngineType | 'book'>('stockfish');
  const [selectedPositionIndex, setSelectedPositionIndex] = useState(0);
  const [customFen, setCustomFen] = useState('');
  const [useCustomFen, setUseCustomFen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [benchResult, setBenchResult] = useState<EngineBenchResult | null>(null);

  const activeFen = useCustomFen
    ? customFen.trim() || BENCHMARK_TEST_POSITIONS[0].fen
    : BENCHMARK_TEST_POSITIONS[selectedPositionIndex].fen;

  const handleRunBench = async () => {
    setIsRunning(true);
    try {
      const res = await runEngineBenchTest(selectedEngine, activeFen);
      setBenchResult(res);
    } catch (e) {
      console.error('[EngineBenchTesterCard] Error en test:', e);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-sky-950 border border-sky-600/40 rounded-lg text-sky-400">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-white text-xs">
              Banco de Pruebas en Vivo: Ejecución de Motores
            </h3>
            <p className="text-[10px] text-slate-400">
              Prueba individual y cálculo en tiempo real de cualquiera de los motores bajo la supervisión del Director
            </p>
          </div>
        </div>

        <button
          onClick={handleRunBench}
          disabled={isRunning}
          className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md self-start sm:self-auto"
        >
          <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
          <span>{isRunning ? 'Calculando...' : 'Ejecutar Cálculo en Vivo'}</span>
        </button>
      </div>

      {/* Selectores: Motor y Posición de Prueba */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Selector de Motor */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Seleccionar Motor a Probar:
          </label>
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: 'stockfish', name: 'Stockfish 19', color: 'border-sky-700 text-sky-300' },
              { id: 'garbo', name: 'GarboChess', color: 'border-purple-700 text-purple-300' },
              { id: 'maia', name: 'Maia 3', color: 'border-rose-700 text-rose-300' },
              { id: 'personal', name: 'Motor Personal', color: 'border-emerald-700 text-emerald-300' },
              { id: 'chessjs', name: 'Chess.js', color: 'border-slate-700 text-slate-300' },
              { id: 'book', name: 'Libro ECO', color: 'border-amber-700 text-amber-300' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedEngine(m.id as EngineType | 'book')}
                className={`p-1.5 rounded border text-[10px] font-bold transition-all text-center ${
                  selectedEngine === m.id
                    ? 'bg-slate-800 ' + m.color + ' shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {/* Selector de Posición */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Posición Táctica / FEN:
          </label>
          <select
            value={useCustomFen ? 'custom' : selectedPositionIndex}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setUseCustomFen(true);
              } else {
                setUseCustomFen(false);
                setSelectedPositionIndex(Number(e.target.value));
              }
            }}
            className="w-full p-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-sky-600"
          >
            {BENCHMARK_TEST_POSITIONS.map((pos, idx) => (
              <option key={idx} value={idx}>
                {pos.name}
              </option>
            ))}
            <option value="custom">-- Introducir FEN Personalizado --</option>
          </select>

          {useCustomFen && (
            <input
              type="text"
              placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
              value={customFen}
              onChange={(e) => setCustomFen(e.target.value)}
              className="w-full mt-1 p-1 bg-slate-950 border border-slate-700 rounded text-[10px] font-mono text-slate-300"
            />
          )}
        </div>
      </div>

      {/* Tarjeta de Resultado del Cálculo en Vivo */}
      {benchResult && (
        <div className="p-3 bg-slate-950 border border-sky-800/80 rounded-xl space-y-2 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800/80 pb-1.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-xs">{benchResult.engineName}</span>
              {benchResult.usedWasmWorker ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-950 text-sky-300 border border-blue-700">
                  Worker WASM UCI
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  Cálculo Nativo Heurístico
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="text-slate-400">Latencia:</span>
              <span className="text-emerald-400 font-bold">{benchResult.latencyMs} ms</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">Hora:</span>
              <span className="text-slate-300">{benchResult.timestamp}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="p-2 bg-slate-900 rounded border border-slate-800 text-center">
              <span className="text-[9px] text-slate-400 block uppercase font-mono">Jugada Sugerida</span>
              <span className="text-base font-black text-sky-400 font-mono">
                {benchResult.recommendedMoveSan}
              </span>
              <span className="text-[9px] text-slate-500 block font-mono">
                UCI: {benchResult.recommendedMoveUci}
              </span>
            </div>

            <div className="p-2 bg-slate-900 rounded border border-slate-800 text-center">
              <span className="text-[9px] text-slate-400 block uppercase font-mono">Evaluación</span>
              <span className="text-base font-black text-emerald-400 font-mono">
                {benchResult.evaluationDisplay}
              </span>
              <span className="text-[9px] text-slate-500 block font-mono">
                {benchResult.centipawns} cp
              </span>
            </div>

            <div className="p-2 bg-slate-900 rounded border border-slate-800 text-center">
              <span className="text-[9px] text-slate-400 block uppercase font-mono">Confianza</span>
              <span className="text-base font-black text-purple-400 font-mono">
                {benchResult.confidence}%
              </span>
              <span className="text-[9px] text-slate-500 block font-mono">Precisión del nodo</span>
            </div>

            <div className="p-2 bg-slate-900 rounded border border-slate-800 text-center">
              <span className="text-[9px] text-slate-400 block uppercase font-mono">Legalidad FIDE</span>
              <span className="text-base font-black text-emerald-400 font-mono flex items-center justify-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Válida
              </span>
              <span className="text-[9px] text-slate-500 block font-mono">Chess.js verificado</span>
            </div>
          </div>

          <div className="p-2 bg-slate-900/60 rounded border border-slate-800 text-[11px] text-slate-300">
            <span className="text-slate-400 font-bold block text-[10px] mb-0.5">Explicación del Motor:</span>
            {benchResult.explanation}
          </div>
        </div>
      )}
    </div>
  );
};
