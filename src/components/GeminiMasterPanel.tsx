import React, { useState } from 'react';
import { Chess } from 'chess.js';
import {
  Sparkles,
  Send,
  BookOpen,
  HelpCircle,
  ExternalLink,
  Bot,
  Brain,
  ShieldCheck,
} from 'lucide-react';
import { requestGeminiAnalysis, GeminiAnalysisResult } from '../engine/geminiMasterService';

interface GeminiMasterPanelProps {
  chess: Chess;
}

export const GeminiMasterPanel: React.FC<GeminiMasterPanelProps> = ({ chess }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeminiAnalysisResult | null>(null);
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<string[]>([]);

  const handleConsultMaster = async (customQ?: string) => {
    setLoading(true);
    try {
      const movesHistory = chess.history();
      const res = await requestGeminiAnalysis({
        fen: chess.fen(),
        pgn: chess.pgn(),
        history: movesHistory,
        question: customQ || question || undefined,
        mode: 'position',
      });
      setResult(res);
      if (customQ || question) {
        setQuestion('');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-2 sm:p-4 space-y-4 text-xs text-slate-200">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Asesor Gran Maestro de Ajedrez
          </h2>
          <p className="text-xs text-slate-400">
            Consultoría posicional profunda, planes estratégicos y explicaciones conceptuales
          </p>
        </div>

        <button
          disabled={loading}
          onClick={() => handleConsultMaster()}
          className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          <span>{loading ? 'Consultando al Maestro...' : 'Analizar Posición Actual'}</span>
        </button>
      </div>

      {/* Suggested quick questions */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-slate-400 text-[11px] shrink-0 font-medium">Preguntas sugeridas:</span>
        {[
          '¿Cuál es el mejor plan a mediano plazo para mi bando?',
          '¿Cómo debo aprovechar la estructura de peones en este centro?',
          '¿Qué debilidad táctica debo vigilar en mi rey?',
        ].map((q) => (
          <button
            key={q}
            onClick={() => handleConsultMaster(q)}
            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-lg text-[11px] whitespace-nowrap transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Custom Question Bar */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleConsultMaster()}
          placeholder="Escribe una duda específica sobre la posición..."
          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
        />
        <button
          disabled={loading || !question.trim()}
          onClick={() => handleConsultMaster()}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl font-bold flex items-center gap-1.5 transition-colors disabled:opacity-30"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Preguntar</span>
        </button>
      </div>

      {loading && (
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-3">
          <div className="w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-300 font-medium">El Gran Maestro está evaluando las dinámicas de la posición...</p>
        </div>
      )}

      {result && !loading && (
        <div className="p-4 sm:p-6 bg-slate-900 border border-slate-700 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Brain className="w-4 h-4" />
              </div>
              <span className="font-bold text-white text-sm">Dictamen Estratégico</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              FEN: {chess.fen().slice(0, 22)}...
            </span>
          </div>

          <div className="space-y-3 text-slate-300 leading-relaxed whitespace-pre-line text-xs bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            {result.analysis}
          </div>

          {result.sources && result.sources.length > 0 && (
            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-300">Fuentes consultadas:</span>
              {result.sources.map((s, idx) => (
                <a
                  key={idx}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline flex items-center gap-1"
                >
                  <span>{s.title}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {!result && !loading && (
        <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
          <Bot className="w-8 h-8 text-amber-500/60 mx-auto" />
          <h3 className="font-bold text-white">Consulta táctica y estratégica en cualquier momento</h3>
          <p className="text-slate-400 text-[11px] max-w-md mx-auto">
            Pulsa el botón de arriba para recibir un diagnóstico del estado de la partida, planes recomendados a mediano plazo y referencias maestras.
          </p>
        </div>
      )}
    </div>
  );
};
