import React, { useState } from 'react';
import { Chess } from 'chess.js';
import {
  FileText,
  Play,
  Trash2,
  Download,
  Upload,
  Trophy,
  Calendar,
  Layers,
  Search,
  CheckCircle,
  BarChart3,
} from 'lucide-react';
import { GameRecord } from '../types/chess';
import { saveGameRecord, deleteGameRecord } from '../storage/chessStorage';

interface HistoryViewProps {
  games: GameRecord[];
  onLoadGame: (game: GameRecord) => void;
  onAnalyzeGame: (game: GameRecord) => void;
  onRefreshGames: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  games,
  onLoadGame,
  onAnalyzeGame,
  onRefreshGames,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [pgnInput, setPgnInput] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const filteredGames = games.filter((g) => {
    const text = `${g.title} ${g.openingName || ''} ${g.openingEco || ''} ${g.result}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  const handleExportPgn = (game: GameRecord) => {
    const blob = new Blob([game.pgn], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${game.title.replace(/\s+/g, '_')}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Seguro que deseas eliminar esta partida del historial local?')) {
      deleteGameRecord(id);
      onRefreshGames();
    }
  };

  const handleImportPgn = () => {
    if (!pgnInput.trim()) return;

    try {
      const chess = new Chess();
      chess.loadPgn(pgnInput.trim());

      const history = chess.history({ verbose: true });
      if (history.length === 0) {
        setImportStatus('Aviso: El PGN no contiene jugadas válidas.');
        return;
      }
      const newGame: GameRecord = {
        id: `imported_${Date.now()}`,
        date: new Date().toLocaleDateString('es-ES'),
        title: chess.header().Event || 'Partida Importada PGN',
        playerColor: 'w',
        result: chess.header().Result || '*',
        openingEco: chess.header().ECO || 'B00',
        openingName: chess.header().Opening || 'Apertura Importada',
        movesCount: history.length,
        moves: history.map((m, idx) => ({
          ply: idx + 1,
          moveNumber: Math.floor(idx / 2) + 1,
          san: m.san,
          from: m.from,
          to: m.to,
          uci: `${m.from}${m.to}`,
          source: 'MANUAL',
          timestamp: Date.now(),
        })),
        pgn: pgnInput.trim(),
        finalFen: chess.fen(),
      };

      saveGameRecord(newGame);
      setPgnInput('');
      setShowImport(false);
      setImportStatus('¡Partida importada con éxito!');
      onRefreshGames();
      setTimeout(() => setImportStatus(null), 3000);
    } catch (e: any) {
      setImportStatus(`Error al procesar PGN: ${e.message || 'Formato incorrecto'}`);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto p-2 sm:p-4 text-xs text-slate-200">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-400" />
            Historial de Partidas Guardadas
          </h2>
          <p className="text-xs text-slate-400">
            {games.length} {games.length === 1 ? 'partida registrada' : 'partidas registradas'} en tu base de datos local
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(!showImport)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span>Importar PGN</span>
          </button>
        </div>
      </div>

      {importStatus && (
        <div className="p-3 bg-sky-950 border border-sky-600 rounded-xl text-sky-200 font-medium">
          {importStatus}
        </div>
      )}

      {showImport && (
        <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl space-y-3">
          <h3 className="font-bold text-white text-xs">Pegar Notación PGN</h3>
          <textarea
            value={pgnInput}
            onChange={(e) => setPgnInput(e.target.value)}
            placeholder="[Event &quot;Partida amistosa&quot;]&#10;1. e4 e5 2. Nf3 Nc6 3. Bc4..."
            className="w-full h-28 bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-xs text-slate-200 focus:outline-none focus:border-sky-500"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setShowImport(false)}
              className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleImportPgn}
              className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold"
            >
              Guardar en Base Local
            </button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por apertura, evento o resultado..."
          className="w-full pl-9 pr-4 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-sky-500"
        />
      </div>

      {filteredGames.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
          <FileText className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="font-medium text-slate-400">No hay partidas registradas aún</p>
          <p className="text-[11px] text-slate-500">
            Juega partidas en el tablero o importa PGN para construir tu histórico y entrenar tu motor personal.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredGames.map((game) => (
            <div
              key={game.id}
              className="p-3.5 bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between flex-wrap gap-3 transition-all shadow-sm"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white text-xs truncate">{game.title}</span>
                  {(() => {
                    const isDraw = game.result === '1/2-1/2';
                    const isWin =
                      (game.playerColor === 'w' && game.result === '1-0') ||
                      (game.playerColor === 'b' && game.result === '0-1');
                    const isLoss =
                      (game.playerColor === 'w' && game.result === '0-1') ||
                      (game.playerColor === 'b' && game.result === '1-0');

                    if (isDraw) {
                      return (
                        <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border bg-sky-500/20 text-sky-300 border-sky-500/40 flex items-center gap-1">
                          <span>🤝 Empate</span>
                          <span>(½ - ½)</span>
                        </span>
                      );
                    }
                    if (isWin) {
                      return (
                        <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border bg-emerald-500/20 text-emerald-300 border-emerald-500/40 flex items-center gap-1">
                          <span>🏆 Victoria</span>
                          <span>({game.result})</span>
                        </span>
                      );
                    }
                    if (isLoss) {
                      return (
                        <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border bg-rose-500/20 text-rose-300 border-rose-500/40 flex items-center gap-1">
                          <span>🏳️ Derrota</span>
                          <span>({game.result})</span>
                        </span>
                      );
                    }
                    return (
                      <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border bg-slate-800 text-slate-300 border-slate-700">
                        {game.result}
                      </span>
                    );
                  })()}
                  {game.reason && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-300 text-[10px] border border-slate-700">
                      {game.reason}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 font-medium">
                    {game.playerColor === 'w' ? '♔ Blancas' : '♚ Negras'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    {game.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-slate-500" />
                    {game.movesCount} jugadas
                  </span>
                  {game.openingName && (
                    <span className="text-sky-400 font-medium">
                      {game.openingEco ? `[${game.openingEco}] ` : ''}{game.openingName}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onLoadGame(game)}
                  className="px-2.5 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-600/40 rounded-lg font-bold flex items-center gap-1 transition-colors text-[11px]"
                  title="Cargar y reproducir en el tablero"
                >
                  <Play className="w-3.5 h-3.5 fill-sky-300" />
                  <span>Jugar / Ver</span>
                </button>

                <button
                  onClick={() => onAnalyzeGame(game)}
                  className="px-2.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-600/40 rounded-lg font-bold flex items-center gap-1 transition-colors text-[11px]"
                  title="Ver métricas y rendimiento en Control"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Métricas</span>
                </button>

                <button
                  onClick={() => handleExportPgn(game)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors"
                  title="Descargar archivo PGN"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleDelete(game.id)}
                  className="p-1.5 bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 border border-slate-700 rounded-lg transition-colors"
                  title="Eliminar partida"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
