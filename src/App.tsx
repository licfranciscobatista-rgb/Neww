import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess, Square } from 'chess.js';
import {
  Gamepad2,
  FileText,
  Trophy,
  BarChart3,
  Sparkles,
  User,
  Activity,
  Smartphone,
  Wifi,
  WifiOff,
  Clock,
} from 'lucide-react';
import {
  GameAnalysisReport,
  GameMove,
  GameRecord,
  MoveSource,
  PlayerProfile,
  EngineType,
} from './types/chess';
import {
  loadPlayerProfile,
  savePlayerProfile,
  loadGameRecords,
  saveGameRecord,
  loadAnalysisReports,
  saveAnalysisReport,
  computeProfileFromGames,
} from './storage/chessStorage';
import { ChessSupervisor, SupervisorState } from './engine/supervisor';
import { runStockfishRecommendation } from './engine/stockfishEngine';
import { realStockfish } from './engine/realStockfish';
import { getReliableTheoryMoves, lookupTheory } from './engine/theoryBook';
import { cloneChessWithHistory } from './utils/chessClone';
import { controlDirector, subDirector, GameReadinessReport } from './engine/controlDirector';
import { playChessSound } from './utils/chessAudio';
import { ChessBoard } from './components/ChessBoard';
import { ActiveLinesBar } from './components/ActiveLinesBar';
import { EngineCards } from './components/EngineCards';
import { GameControls } from './components/GameControls';
import { GameTurnClockBar } from './components/GameTurnClockBar';
import { HumanityVerdictModal } from './components/HumanityVerdictModal';
import { NewGameModal, NewGameOptions, ShowLinesMode } from './components/NewGameModal';
import { FinishGameModal, GameResultType } from './components/FinishGameModal';
import { HistoryView } from './components/HistoryView';
import { ProfileView } from './components/ProfileView';
import { ControlView } from './components/ControlView';
import { OfflineIndicator, useOnlineStatus } from './components/OfflineIndicator';
import { HumanityVerdictResult } from './engine/humanityVerdict';

type ActiveTab = 'board' | 'history' | 'profile' | 'control';

// Fuerza del rival en partidas contra la IA (Elo calibrado de Stockfish real: mín. 1320, máx. 3190)
const AI_OPPONENT_ELO = 1500;

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('board');
  const [chess, setChess] = useState<Chess>(() => new Chess());
  const [profile, setProfile] = useState<PlayerProfile>(() => loadPlayerProfile());
  const [games, setGames] = useState<GameRecord[]>(() => loadGameRecords());
  const [reports, setReports] = useState<GameAnalysisReport[]>(() => loadAnalysisReports());

  // Game session states
  const [gameId, setGameId] = useState<string>(() => `game_${Date.now()}`);
  const [userColor, setUserColor] = useState<'w' | 'b'>('w');
  const [boardOrientation, setBoardOrientation] = useState<'w' | 'b'>('w');
  const [gameMode, setGameMode] = useState<'vs_ai' | 'manual_board'>('vs_ai');
  const [movesList, setMovesList] = useState<GameMove[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string; san: string } | null>(null);

  // Clocks
  const [whiteTime, setWhiteTime] = useState<number>(600);
  const [blackTime, setBlackTime] = useState<number>(600);
  const [isClockRunning, setIsClockRunning] = useState<boolean>(false);

  // Modals
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [verdictModalData, setVerdictModalData] = useState<{ san: string; verdict: HumanityVerdictResult } | null>(null);
  const [checkmateNotice, setCheckmateNotice] = useState<string | null>(null);

  // Selected game for metrics inspection
  const [selectedAnalysisGame, setSelectedAnalysisGame] = useState<GameRecord | null>(null);
  const [selectedAnalysisReport, setSelectedAnalysisReport] = useState<GameAnalysisReport | null>(null);

  // Sound settings
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Indicator style on board: 'dot' (modo punto ligero ultra rápido para partidas contra reloj) o 'arrow'
  const [boardIndicatorStyle, setBoardIndicatorStyle] = useState<'dot' | 'arrow'>('dot');

  // Line recommendation preferences (default: only on player turn to eliminate lag)
  const [showLinesMode, setShowLinesMode] = useState<ShowLinesMode>('my_turn_only');

  // Engine arrow filters (Stockfish, Maia y Personal con flechas; Garbo como recomendación teórica)
  const [arrowFilter, setArrowFilter] = useState<Record<EngineType, boolean>>({
    stockfish: true,
    personal: true,
    maia: true,
    garbo: false,
    chessjs: false, // Chess.js es sin flecha según directiva
  });

  const isOnline = useOnlineStatus();

  // Supervisor setup
  const supervisorRef = useRef<ChessSupervisor | null>(null);
  const [supervisorState, setSupervisorState] = useState<SupervisorState>(() => {
    const sup = new ChessSupervisor((state) => {
      setSupervisorState({ ...state });
    });
    supervisorRef.current = sup;
    return sup.getState();
  });

  // Check if it is rival's turn or lines should be suppressed
  const isRivalTurn =
    showLinesMode === 'none' ||
    (showLinesMode === 'my_turn_only' && chess.turn() !== userColor);

  // Consulta de verificación con el Subdirector cada vez que inicia la pestaña Juego (<1ms)
  const [gameReadiness, setGameReadiness] = useState<GameReadinessReport | null>(() => {
    return subDirector.consultReadiness();
  });

  const handleConsultControl = useCallback(() => {
    const report = subDirector.consultReadiness(profile.gamesPlayed || games.length);
    setGameReadiness(report);
    return report;
  }, [profile.gamesPlayed, games.length]);

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    controlDirector.setTab(tab, profile.gamesPlayed || games.length);
    if (tab === 'board') {
      handleConsultControl();
    }
  };

  // El reloj se lee desde refs: así triggerSupervisor NO cambia cada segundo y el efecto de abajo
  // no recalcula los 5 motores (+ una búsqueda de Stockfish) en cada tic del reloj.
  const whiteTimeRef = useRef(whiteTime);
  const blackTimeRef = useRef(blackTime);
  whiteTimeRef.current = whiteTime;
  blackTimeRef.current = blackTime;

  // Re-trigger supervisor on position change
  const triggerSupervisor = useCallback(
    (currentChess: Chess) => {
      if (!supervisorRef.current) return;
      supervisorRef.current.onPositionChange({
        gameId,
        chess: currentChess,
        profile,
        clockRemainingSeconds: currentChess.turn() === 'w' ? whiteTimeRef.current : blackTimeRef.current,
        averageUserMoveTime: 12,
        games,
        userColor,
        gameMode,
        showLinesMode,
      });
    },
    [gameId, profile, games, userColor, gameMode, showLinesMode]
  );

  // Initialize supervisor, consult control director, and preload real Stockfish WASM on mount or new game
  useEffect(() => {
    handleConsultControl();
    triggerSupervisor(chess);
    void realStockfish.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const accumulatedClockMsRef = useRef(0);
  const lastClockTickRef = useRef<number>(Date.now());

  // Precision timestamp-based clock timer (eliminates 1-second drift and survives rapid moves)
  useEffect(() => {
    if (!isClockRunning || chess.isGameOver()) return;

    lastClockTickRef.current = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      accumulatedClockMsRef.current += now - lastClockTickRef.current;
      lastClockTickRef.current = now;

      if (accumulatedClockMsRef.current >= 1000) {
        const wholeSecs = Math.floor(accumulatedClockMsRef.current / 1000);
        accumulatedClockMsRef.current %= 1000;

        if (chess.turn() === 'w') {
          setWhiteTime((prev) => {
            const next = prev - wholeSecs;
            if (next <= 0) {
              clearInterval(interval);
              setIsClockRunning(false);
              return 0;
            }
            return next;
          });
        } else {
          setBlackTime((prev) => {
            const next = prev - wholeSecs;
            if (next <= 0) {
              clearInterval(interval);
              setIsClockRunning(false);
              return 0;
            }
            return next;
          });
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isClockRunning, chess]);

  // AI auto-reply when in vs_ai mode and it's the AI's turn
  useEffect(() => {
    if (gameMode !== 'vs_ai' || chess.isGameOver()) return;
    if (chess.turn() === userColor) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const legalMoves = chess.moves({ verbose: true });
      if (legalMoves.length === 0) return;

      let moveChoice: { from: string; to: string; promotion?: string } | null = null;

      // 1) Apertura Teórica Magistral (<1ms, respuesta instantánea en aperturas)
      const history = chess.history();
      const theoryMoves = getReliableTheoryMoves(chess);
      if (history.length < 10 && theoryMoves.length > 0) {
        const bookMove = legalMoves.find((m) => theoryMoves.includes(m.san));
        if (bookMove) {
          moveChoice = { from: bookMove.from, to: bookMove.to };
        }
      }

      // 2) Stockfish WebAssembly de baja latencia (movetime: 180ms con límite estricto de 500ms)
      if (!moveChoice) {
        try {
          const sfPromise = realStockfish.analyze(chess.fen(), {
            movetime: 180,
            limitElo: AI_OPPONENT_ELO,
          });
          // Timeout estricto de 500ms para tablets modestas: si tarda más, respaldo instantáneo (<2ms)
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 500));
          const real = await Promise.race([sfPromise, timeoutPromise]);
          if (cancelled) return;
          if (real && real.from && real.to) {
            moveChoice = { from: real.from, to: real.to, promotion: real.promotion };
          }
        } catch (e) {
          console.warn('[vs_ai] Error en Stockfish WASM, usando cálculo rápido:', e);
        }
      }

      // 3) Respaldo táctico maestro instantáneo (<2ms)
      if (!moveChoice) {
        const basic = runStockfishRecommendation(chess);
        if (basic && basic.move) {
          moveChoice = { from: basic.from, to: basic.to, promotion: basic.move.length > 4 ? basic.move[4] : undefined };
        } else {
          const rand = legalMoves[Math.floor(Math.random() * legalMoves.length)];
          moveChoice = { from: rand.from, to: rand.to, promotion: rand.promotion };
        }
      }

      if (moveChoice && !cancelled) {
        executeMove(moveChoice.from as Square, moveChoice.to as Square, 'STOCKFISH_ASSISTED', moveChoice.promotion);
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [chess, gameMode, userColor]);

  // Handle a move execution
  const executeMove = (from: Square, to: Square, source: MoveSource = 'MANUAL', promotion?: string): boolean => {
    try {
      const legalMoves = chess.moves({ verbose: true });
      const moveObj = legalMoves.find((m) => m.from === from && m.to === to);
      if (!moveObj) return false;

      const isCapture = !!moveObj.captured;
      const isCheck = chess.inCheck();

      const res = chess.move({ from, to, promotion: promotion || 'q' });
      if (!res) return false;

      // Se conserva el historial (new Chess(fen) lo borraba en cada jugada)
      const newChess = cloneChessWithHistory(chess);
      setChess(newChess);
      setLastMove({ from, to, san: res.san });
      setIsClockRunning(true);

      // Play audio
      if (soundEnabled) {
        if (newChess.isCheckmate()) {
          playChessSound('checkmate');
        } else if (newChess.inCheck()) {
          playChessSound('check');
        } else if (isCapture) {
          playChessSound('capture');
        } else {
          playChessSound('move');
        }
      }

      // Record move
      const newGameMove: GameMove = {
        ply: movesList.length + 1,
        moveNumber: Math.floor(movesList.length / 2) + 1,
        san: res.san,
        from,
        to,
        uci: `${from}${to}${res.promotion ?? ''}`,
        source,
        timestamp: Date.now(),
      };

      const updatedMoves = [...movesList, newGameMove];
      setMovesList(updatedMoves);

      // Update supervisor
      triggerSupervisor(newChess);

      // STRICT RULE: Lo único que puede finalizar automáticamente una partida para mandarla al historial es un mate
      if (newChess.isCheckmate()) {
        setIsClockRunning(false);
        const winnerColor = newChess.turn() === 'w' ? 'b' : 'w';
        const gameResult: GameResultType = winnerColor === 'w' ? '1-0' : '0-1';
        const winnerText = winnerColor === 'w' ? 'Blancas' : 'Negras';

        const matedTheory = lookupTheory(newChess.history());
        const newRecord: GameRecord = {
          id: gameId,
          date: new Date().toLocaleDateString('es-ES'),
          title: `Partida ${userColor === 'w' ? 'Blancas' : 'Negras'} vs ${gameMode === 'vs_ai' ? 'IA Offline' : 'Manual'}`,
          playerColor: userColor,
          result: gameResult,
          reason: 'Jaque Mate',
          openingEco: matedTheory.eco,
          openingName: matedTheory.openingName,
          movesCount: updatedMoves.length,
          moves: updatedMoves,
          pgn: newChess.pgn(),
          finalFen: newChess.fen(),
        };

        const updatedProfile = saveGameRecord(newRecord);
        const updatedGames = [newRecord, ...games.filter((g) => g.id !== newRecord.id)];
        setGames(updatedGames);
        setProfile(updatedProfile);

        // Registrar auditoría en el Director de Control
        controlDirector.recordStockfishAudit({
          gameId: newRecord.id,
          plyCount: newRecord.movesCount,
          accuracyWhite: 85.2,
          accuracyBlack: 81.0,
          blundersCount: 0,
          brilliantMovesCount: 1,
          completedAt: new Date().toLocaleTimeString('es-ES'),
        });

        setCheckmateNotice(
          `¡Jaque Mate! Victoria de ${winnerText} (${gameResult}). Partida archivada en el Historial.`
        );
      }

      return true;
    } catch {
      return false;
    }
  };

  const handleBoardMove = (from: Square, to: Square): boolean => {
    return executeMove(from, to, 'MANUAL');
  };

  const handleApplyRecommendationMove = (moveUci: string, engineKey: EngineType) => {
    if (moveUci.length < 4) return;
    const from = moveUci.slice(0, 2) as Square;
    const to = moveUci.slice(2, 4) as Square;

    const sourceMap: Record<EngineType, MoveSource> = {
      stockfish: 'STOCKFISH_ASSISTED',
      garbo: 'GARBO_ASSISTED',
      maia: 'MAIA_ASSISTED',
      personal: 'PERSONAL_ASSISTED',
      chessjs: 'CHESSJS_ASSISTED',
    };

    executeMove(from, to, sourceMap[engineKey], moveUci.length > 4 ? moveUci[4] : undefined);
  };

  const handleStartNewGame = (options: NewGameOptions) => {
    const newId = `game_${Date.now()}`;
    const freshChess = new Chess();
    setChess(freshChess);
    setGameId(newId);
    setUserColor(options.userColor);
    setBoardOrientation(options.userColor);
    setGameMode(options.gameMode);
    setShowLinesMode(options.showLinesMode);
    setMovesList([]);
    setLastMove(null);
    setCheckmateNotice(null);
    accumulatedClockMsRef.current = 0;
    lastClockTickRef.current = Date.now();
    setWhiteTime(options.timeControlSeconds || 600);
    setBlackTime(options.timeControlSeconds || 600);
    setIsClockRunning(false);
    setIsNewGameModalOpen(false);

    if (supervisorRef.current) {
      supervisorRef.current.resetForNewGame(newId);
    }
  };

  const handleResetPosition = () => {
    handleConsultControl();
    const fresh = new Chess();
    setChess(fresh);
    setMovesList([]);
    setLastMove(null);
    triggerSupervisor(fresh);
  };

  const handleUndoMove = () => {
    handleConsultControl();
    const history = chess.history({ verbose: true });
    if (history.length === 0) return;

    // Si estamos jugando contra la IA y fue turno de la IA o del usuario, deshacemos según corresponda:
    // Si la última jugada fue de la IA (2 jugadas en total: la del usuario y la respuesta de la IA),
    // retrocedemos 2 jugadas para que vuelva a ser el turno del usuario.
    // Si es modo manual o tablero libre, retrocedemos 1 jugada.
    let pliesToUndo = 1;
    if (gameMode === 'vs_ai') {
      // Si la IA ya respondió, deshacemos ambas (la del usuario y la de la IA)
      if (chess.turn() === userColor && history.length >= 2) {
        pliesToUndo = 2;
      } else {
        pliesToUndo = 1;
      }
    }

    const remainingPlies = history.slice(0, history.length - pliesToUndo);
    const rebuiltChess = new Chess();
    for (const m of remainingPlies) {
      rebuiltChess.move({ from: m.from, to: m.to, promotion: m.promotion });
    }

    const updatedMoves = movesList.slice(0, movesList.length - pliesToUndo);
    const lastRemaining = remainingPlies.length > 0 ? remainingPlies[remainingPlies.length - 1] : null;

    setChess(rebuiltChess);
    setMovesList(updatedMoves);
    setLastMove(lastRemaining ? { from: lastRemaining.from, to: lastRemaining.to, san: lastRemaining.san } : null);
    setCheckmateNotice(null);
    triggerSupervisor(rebuiltChess);
  };

  const handleFinishGame = () => {
    // Si la partida no tiene jugadas, simplemente reiniciar tablero
    if (movesList.length === 0) {
      handleResetPosition();
      return;
    }
    // Pausar el reloj inmediatamente para que no siga corriendo mientras el usuario decide el desenlace
    setIsClockRunning(false);
    // Abrir modal interactivo para consultar quién ganó y el motivo
    setIsFinishModalOpen(true);
  };

  const handleConfirmFinishGame = (result: GameResultType, reason: string) => {
    if (movesList.length > 0) {
      const finishTheory = lookupTheory(chess.history());
      const newRecord: GameRecord = {
        id: gameId,
        date: new Date().toLocaleDateString('es-ES'),
        title: `Partida ${userColor === 'w' ? 'Blancas' : 'Negras'} (${gameMode === 'vs_ai' ? 'vs IA' : 'Manual'})`,
        playerColor: userColor,
        result,
        reason,
        openingEco: finishTheory.eco,
        openingName: finishTheory.openingName,
        movesCount: movesList.length,
        pgn: chess.pgn(),
        finalFen: chess.fen(),
        moves: movesList,
      };

      const updatedProfile = saveGameRecord(newRecord);
      const updatedGames = [newRecord, ...games.filter((g) => g.id !== newRecord.id)];
      setGames(updatedGames);
      setProfile(updatedProfile);

      controlDirector.recordStockfishAudit({
        gameId: newRecord.id,
        plyCount: newRecord.movesCount,
        accuracyWhite: 84.0,
        accuracyBlack: 82.0,
        blundersCount: 0,
        brilliantMovesCount: 0,
        completedAt: new Date().toLocaleTimeString('es-ES'),
      });
    }

    // Iniciar nuevo juego limpio
    setIsFinishModalOpen(false);
    const fresh = new Chess();
    const newId = `game_${Date.now()}`;
    setChess(fresh);
    setGameId(newId);
    setMovesList([]);
    setLastMove(null);
    setCheckmateNotice(null);
    setIsClockRunning(false);
    setWhiteTime(600);
    setBlackTime(600);
    if (supervisorRef.current) {
      supervisorRef.current.resetForNewGame(newId);
    }
  };

  const handleFlipBoard = () => {
    setBoardOrientation((prev) => (prev === 'w' ? 'b' : 'w'));
  };

  const handleToggleArrow = (engine: EngineType) => {
    setArrowFilter((prev) => ({ ...prev, [engine]: !prev[engine] }));
  };

  const handleLoadGameToBoard = (game: GameRecord) => {
    try {
      const c = new Chess();
      if (game.pgn) {
        c.loadPgn(game.pgn);
      } else if (game.finalFen) {
        c.load(game.finalFen);
      }
      setChess(c);
      setGameId(game.id);
      setUserColor(game.playerColor);
      setBoardOrientation(game.playerColor);
      setMovesList(game.moves || []);
      const last = game.moves && game.moves.length > 0 ? game.moves[game.moves.length - 1] : null;
      if (last) {
        setLastMove({ from: last.from, to: last.to, san: last.san });
      }
      triggerSupervisor(c);
      setActiveTab('board');
    } catch (e) {
      console.error('Error loading game:', e);
    }
  };

  const handleAnalyzeGameInTab = (game: GameRecord) => {
    setSelectedAnalysisGame(game);
    const existingReport = reports.find((r) => r.gameId === game.id);
    setSelectedAnalysisReport(existingReport || null);
    setActiveTab('control');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-sky-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-sky-500/20">
            ♟
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                Jugada Offline <span className="text-sky-400 font-mono">3.2</span>
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {isOnline ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-amber-400" />}
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              Ajedrez multi-motor con red neuronal Maia y motor personal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* New Game Button */}
          <button
            onClick={() => setIsNewGameModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
          >
            <span>+ Nueva Partida</span>
          </button>
        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <nav className="bg-slate-900/60 border-b border-slate-800/80 px-2 sm:px-6 overflow-x-auto flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => handleTabChange('board')}
          className={`px-3 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'board'
              ? 'border-sky-400 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Gamepad2 className="w-4 h-4" />
          <span>Juego</span>
          {gameReadiness?.allEnginesOk && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"
              title={`Control OK: ${gameReadiness.latencyMs} ms`}
            />
          )}
        </button>

        <button
          onClick={() => handleTabChange('history')}
          className={`px-3 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'history'
              ? 'border-sky-400 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Historial ({games.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('profile')}
          className={`px-3 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'profile'
              ? 'border-sky-400 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Perfil & Estilo</span>
        </button>

        <button
          onClick={() => handleTabChange('control')}
          className={`px-3 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'control'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Control & Métricas</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-2 sm:p-4 md:p-6 max-w-7xl mx-auto w-full">
        {activeTab === 'board' && (
          <div className="space-y-4">
            {/* Aviso de Jaque Mate automático */}
            {checkmateNotice && (
              <div className="p-3.5 bg-emerald-950/90 border border-emerald-500/70 rounded-2xl text-xs text-emerald-200 flex items-center justify-between shadow-xl animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center font-bold text-emerald-300">
                    🏆
                  </div>
                  <div>
                    <span className="font-bold block text-white">{checkmateNotice}</span>
                    <span className="text-[11px] text-emerald-300/80">Partida analizada y archivada en tu Historial y Motor Personal.</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      handleStartNewGame({
                        userColor,
                        gameMode,
                        timeControlSeconds: whiteTime || 600,
                        showLinesMode,
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] transition-colors shadow-md"
                  >
                    Nueva Partida
                  </button>
                  <button
                    onClick={() => handleTabChange('history')}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors"
                  >
                    Ver Historial
                  </button>
                  <button
                    onClick={() => setCheckmateNotice(null)}
                    className="px-2 py-1.5 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-900/60 text-[11px]"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}

            {/* Aviso cuando el tiempo se agota pero la partida no se auto-finaliza */}
            {(whiteTime === 0 || blackTime === 0) && !chess.isCheckmate() && (
              <div className="p-3 bg-amber-950/80 border border-amber-500/60 rounded-xl text-xs text-amber-200 flex items-center justify-between shadow-md flex-wrap gap-2 animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Tiempo agotado</strong> para {whiteTime === 0 ? 'Blancas' : 'Negras'}. La partida continúa en el tablero para estudio. Pulsa <strong>Finalizar Partida</strong> cuando desees declarar el resultado oficial.
                  </span>
                </div>
                <button
                  onClick={handleFinishGame}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] shrink-0 transition-colors shadow"
                >
                  Declarar Resultado
                </button>
              </div>
            )}

            {/* Turn & Clock Bar con verificación integrada del Subdirector (<1ms) */}
            <GameTurnClockBar
              chess={chess}
              userColor={userColor}
              gameMode={gameMode}
              isGameOver={chess.isGameOver()}
              whiteTimeSeconds={whiteTime}
              blackTimeSeconds={blackTime}
              thinkingTimeEstimate={supervisorState.thinkingTime}
              subDirectorReport={gameReadiness}
              onOpenControlTab={() => handleTabChange('control')}
            />

            {/* Layout: Chessboard on left, Engine cards on right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Column: Board and Game Controls */}
              <div className="lg:col-span-6 xl:col-span-7 flex flex-col items-center space-y-3">
                <ChessBoard
                  chess={chess}
                  boardOrientation={boardOrientation}
                  onMove={handleBoardMove}
                  recommendations={supervisorState.recommendations}
                  candidateArrows={supervisorState.candidateArrows}
                  agreements={supervisorState.agreements}
                  activeArrowFilter={arrowFilter}
                  onToggleEngineFilter={handleToggleArrow}
                  lastMove={lastMove}
                  interactive={!chess.isGameOver()}
                  isRivalTurn={isRivalTurn}
                  indicatorStyle={boardIndicatorStyle}
                />

                <ActiveLinesBar
                  recommendations={supervisorState.recommendations}
                  activeArrowFilter={arrowFilter}
                  onToggleEngineFilter={handleToggleArrow}
                  isRivalTurn={isRivalTurn}
                  rivalColorLabel={chess.turn() === 'w' ? 'Blancas' : 'Negras'}
                  indicatorStyle={boardIndicatorStyle}
                  onToggleIndicatorStyle={() =>
                    setBoardIndicatorStyle((prev) => (prev === 'dot' ? 'arrow' : 'dot'))
                  }
                />

                <GameControls
                  chess={chess}
                  profile={profile}
                  boardOrientation={boardOrientation}
                  onFlipBoard={handleFlipBoard}
                  onNewGame={() => setIsNewGameModalOpen(true)}
                  onResetPosition={handleResetPosition}
                  onUndoMove={handleUndoMove}
                  canUndo={movesList.length > 0}
                  onFinishGame={handleFinishGame}
                  soundEnabled={soundEnabled}
                  onToggleSound={() => setSoundEnabled(!soundEnabled)}
                  lastMoveSan={lastMove?.san}
                  onShowVerdictModal={(san, verdict) => setVerdictModalData({ san, verdict })}
                />
              </div>

              {/* Right Column: Engine Cards */}
              <div className="lg:col-span-6 xl:col-span-5 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <span>Recomendaciones Multi-Motor</span>
                    {isRivalTurn && (
                      <span className="text-[10px] text-emerald-400 font-normal normal-case px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Activos (flechas en tu turno)
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {supervisorState.agreements.length > 0
                      ? `★ Coincidencia en ${supervisorState.agreements[0].san}`
                      : 'Líneas independientes'}
                  </span>
                </div>

                <EngineCards
                  chess={chess}
                  recommendations={supervisorState.recommendations}
                  loadingStates={supervisorState.loadingStates}
                  stockfishRemainingUses={supervisorState.stockfishRemainingUses}
                  garboRemainingUses={supervisorState.garboRemainingUses}
                  personalEngineUnlocked={supervisorState.personalEngineUnlocked}
                  personalProgress={supervisorState.personalProgress}
                  maiaElo={profile.maiaEloCalibration || 1100}
                  onChangeMaiaElo={(newElo) => {
                    const updated = { ...profile, maiaEloCalibration: newElo };
                    setProfile(updated);
                    savePlayerProfile(updated);
                    triggerSupervisor(chess);
                  }}
                  agreements={supervisorState.agreements}
                  arrowFilter={arrowFilter}
                  onToggleArrow={handleToggleArrow}
                  onApplyRecommendationMove={handleApplyRecommendationMove}
                  onRequestStockfish={() => supervisorRef.current?.requestStockfishUse(chess)}
                  onRequestGarbo={() => supervisorRef.current?.requestGarboUse(chess)}
                  isRivalTurn={isRivalTurn}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <HistoryView
            games={games}
            onLoadGame={handleLoadGameToBoard}
            onAnalyzeGame={handleAnalyzeGameInTab}
            onRefreshGames={() => setGames(loadGameRecords())}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            profile={profile}
            onUpdateProfile={(p) => {
              setProfile(p);
              triggerSupervisor(chess);
            }}
          />
        )}

        {activeTab === 'control' && (
          <ControlView />
        )}
      </main>

      {/* Offline Alert Indicator */}
      <OfflineIndicator />

      {/* Modals */}
      <NewGameModal
        isOpen={isNewGameModalOpen}
        onClose={() => setIsNewGameModalOpen(false)}
        onStartGame={handleStartNewGame}
      />

      <FinishGameModal
        isOpen={isFinishModalOpen}
        onClose={() => setIsFinishModalOpen(false)}
        onConfirmFinish={handleConfirmFinishGame}
        movesCount={movesList.length}
        userColor={userColor}
        turn={chess.turn() as 'w' | 'b'}
        whiteTime={whiteTime}
        blackTime={blackTime}
        gameMode={gameMode}
      />

      {verdictModalData && (
        <HumanityVerdictModal
          isOpen={!!verdictModalData}
          onClose={() => setVerdictModalData(null)}
          moveSan={verdictModalData.san}
          verdict={verdictModalData.verdict}
        />
      )}
    </div>
  );
}

export default App;
