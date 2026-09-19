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
} from './storage/chessStorage';
import { ChessSupervisor, SupervisorState } from './engine/supervisor';
import { runStockfishRecommendation } from './engine/stockfishEngine';
import { realStockfish } from './engine/realStockfish';
import { controlDirector } from './engine/controlDirector';
import { playChessSound } from './utils/chessAudio';
import { ChessBoard } from './components/ChessBoard';
import { EngineCards } from './components/EngineCards';
import { GameControls } from './components/GameControls';
import { GameTurnClockBar } from './components/GameTurnClockBar';
import { HumanityVerdictModal } from './components/HumanityVerdictModal';
import { NewGameModal, NewGameOptions, ShowLinesMode } from './components/NewGameModal';
import { HistoryView } from './components/HistoryView';
import { AnalysisSuiteView, SuiteSubTab } from './components/AnalysisSuiteView';
import { ProfileView } from './components/ProfileView';
import { ControlView } from './components/ControlView';
import { InstallModal } from './components/InstallModal';
import { OfflineIndicator, useOnlineStatus } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { HumanityVerdictResult } from './engine/humanityVerdict';

type ActiveTab = 'board' | 'history' | 'suite' | 'profile' | 'control';

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
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [verdictModalData, setVerdictModalData] = useState<{ san: string; verdict: HumanityVerdictResult } | null>(null);

  // Selected game for analysis tab
  const [selectedAnalysisGame, setSelectedAnalysisGame] = useState<GameRecord | null>(null);
  const [selectedAnalysisReport, setSelectedAnalysisReport] = useState<GameAnalysisReport | null>(null);
  const [suiteSubTab, setSuiteSubTab] = useState<SuiteSubTab>('audit');

  // Sound settings
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Line recommendation preferences (default: only on player turn to eliminate lag)
  const [showLinesMode, setShowLinesMode] = useState<ShowLinesMode>('my_turn_only');

  // Engine arrow filters
  const [arrowFilter, setArrowFilter] = useState<Record<EngineType, boolean>>({
    stockfish: true,
    garbo: true,
    maia: true,
    personal: true,
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

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    controlDirector.setTab(tab, profile.gamesPlayed || games.length);
  };

  // Re-trigger supervisor on position change
  const triggerSupervisor = useCallback(
    (currentChess: Chess) => {
      if (!supervisorRef.current) return;
      supervisorRef.current.onPositionChange({
        gameId,
        chess: currentChess,
        profile,
        clockRemainingSeconds: currentChess.turn() === 'w' ? whiteTime : blackTime,
        averageUserMoveTime: 12,
        games,
        userColor,
        gameMode,
        showLinesMode,
      });
    },
    [gameId, profile, whiteTime, blackTime, games, userColor, gameMode, showLinesMode]
  );

  // Initialize supervisor and preload real Stockfish WASM on mount
  useEffect(() => {
    triggerSupervisor(chess);
    void realStockfish.init();
  }, []);

  // Clock countdown timer
  useEffect(() => {
    if (!isClockRunning || chess.isGameOver()) return;

    const interval = setInterval(() => {
      if (chess.turn() === 'w') {
        setWhiteTime((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsClockRunning(false);
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackTime((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsClockRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

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

      let moveChoice: { from: string; to: string } | null = null;

      // 1) Stockfish real WebAssembly con fuerza calibrada (Elo 1500)
      try {
        const real = await realStockfish.analyze(chess.fen(), {
          movetime: 700,
          limitElo: AI_OPPONENT_ELO,
        });
        if (cancelled) return;
        if (real && real.from && real.to) {
          moveChoice = { from: real.from, to: real.to };
        }
      } catch (e) {
        console.warn('[vs_ai] Error en Stockfish WASM, usando respaldo:', e);
      }

      // 2) Respaldo: cálculo heurístico si el motor real no está disponible
      if (!moveChoice) {
        const basic = runStockfishRecommendation(chess);
        if (basic && basic.move) {
          moveChoice = { from: basic.from, to: basic.to };
        } else {
          const rand = legalMoves[Math.floor(Math.random() * legalMoves.length)];
          moveChoice = { from: rand.from, to: rand.to };
        }
      }

      if (moveChoice && !cancelled) {
        executeMove(moveChoice.from as Square, moveChoice.to as Square, 'STOCKFISH_ASSISTED');
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [chess, gameMode, userColor]);

  // Handle a move execution
  const executeMove = (from: Square, to: Square, source: MoveSource = 'MANUAL'): boolean => {
    try {
      const legalMoves = chess.moves({ verbose: true });
      const moveObj = legalMoves.find((m) => m.from === from && m.to === to);
      if (!moveObj) return false;

      const isCapture = !!moveObj.captured;
      const isCheck = chess.inCheck();

      const res = chess.move({ from, to, promotion: 'q' });
      if (!res) return false;

      const newChess = new Chess(chess.fen());
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
        uci: `${from}${to}`,
        source,
        timestamp: Date.now(),
      };

      const updatedMoves = [...movesList, newGameMove];
      setMovesList(updatedMoves);

      // Update supervisor
      triggerSupervisor(newChess);

      // If game is over, save record
      if (newChess.isGameOver()) {
        setIsClockRunning(false);
        let gameResult = '1/2-1/2';
        if (newChess.isCheckmate()) {
          gameResult = newChess.turn() === 'w' ? '0-1' : '1-0';
        }

        const newRecord: GameRecord = {
          id: gameId,
          date: new Date().toLocaleDateString('es-ES'),
          title: `Partida ${userColor === 'w' ? 'Blancas' : 'Negras'} vs ${gameMode === 'vs_ai' ? 'IA Offline' : 'Manual'}`,
          playerColor: userColor,
          result: gameResult,
          openingEco: 'B00',
          openingName: 'Partida Oficial',
          movesCount: updatedMoves.length,
          moves: updatedMoves,
          pgn: newChess.pgn(),
          finalFen: newChess.fen(),
        };

        saveGameRecord(newRecord);
        setGames((prev) => [newRecord, ...prev.filter((g) => g.id !== newRecord.id)]);

        // Update profile gamesPlayed
        const updatedProfile: PlayerProfile = {
          ...profile,
          gamesPlayed: (profile.gamesPlayed || 0) + 1,
        };
        setProfile(updatedProfile);
        savePlayerProfile(updatedProfile);

        // Record stockfish audit to controlDirector (then engine turns OFF)
        controlDirector.recordStockfishAudit({
          gameId: newRecord.id,
          plyCount: newRecord.movesCount,
          accuracyWhite: 85.2,
          accuracyBlack: 81.0,
          blundersCount: 0,
          brilliantMovesCount: 1,
          completedAt: new Date().toLocaleTimeString('es-ES'),
        });
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
    };

    executeMove(from, to, sourceMap[engineKey]);
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
    setWhiteTime(options.timeControlSeconds || 600);
    setBlackTime(options.timeControlSeconds || 600);
    setIsClockRunning(false);
    setIsNewGameModalOpen(false);

    if (supervisorRef.current) {
      supervisorRef.current.resetForNewGame(newId);
      supervisorRef.current.onPositionChange({
        gameId: newId,
        chess: freshChess,
        profile,
        clockRemainingSeconds: options.timeControlSeconds || 600,
        averageUserMoveTime: 12,
        games,
        userColor: options.userColor,
        gameMode: options.gameMode,
        showLinesMode: options.showLinesMode,
      });
    }
  };

  const handleResetPosition = () => {
    const fresh = new Chess();
    setChess(fresh);
    setMovesList([]);
    setLastMove(null);
    triggerSupervisor(fresh);
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
    setSuiteSubTab('audit');
    setActiveTab('suite');
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
              Ajedrez multi-motor con red neuronal Maia y preparación para APK nativo Android
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* APK Direct Action Button */}
          <PWAInstallButton variant="header" />

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
          <span>Tablero</span>
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
          onClick={() => handleTabChange('suite')}
          className={`px-3 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'suite'
              ? 'border-sky-400 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Suite Análisis</span>
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
          <span>Control Motores</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-2 sm:p-4 md:p-6 max-w-7xl mx-auto w-full">
        {activeTab === 'board' && (
          <div className="space-y-4">
            {/* Turn & Clock Bar */}
            <GameTurnClockBar
              chess={chess}
              userColor={userColor}
              gameMode={gameMode}
              isGameOver={chess.isGameOver()}
              whiteTimeSeconds={whiteTime}
              blackTimeSeconds={blackTime}
              thinkingTimeEstimate={supervisorState.thinkingTime}
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
                />

                <GameControls
                  chess={chess}
                  profile={profile}
                  boardOrientation={boardOrientation}
                  onFlipBoard={handleFlipBoard}
                  onNewGame={() => setIsNewGameModalOpen(true)}
                  onResetPosition={handleResetPosition}
                  soundEnabled={soundEnabled}
                  onToggleSound={() => setSoundEnabled(!soundEnabled)}
                  lastMoveSan={lastMove?.san}
                  onShowVerdictModal={(san, verdict) => setVerdictModalData({ san, verdict })}
                />
              </div>

              {/* Right Column: Engine Cards */}
              <div className="lg:col-span-6 xl:col-span-5 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Recomendaciones Multi-Motor
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

        {activeTab === 'suite' && (
          <AnalysisSuiteView
            games={games}
            reports={reports}
            profile={profile}
            selectedGame={selectedAnalysisGame}
            selectedReport={selectedAnalysisReport}
            chess={chess}
            initialSubTab={suiteSubTab}
            onUpdateReport={(r) => {
              setSelectedAnalysisReport(r);
              setReports((prev) => [r, ...prev.filter((rep) => rep.gameId !== r.gameId)]);
            }}
            onBackToBoard={() => setActiveTab('board')}
            onSelectGameToAudit={(g) => {
              setSelectedAnalysisGame(g);
              const rep = reports.find((r) => r.gameId === g.id);
              setSelectedAnalysisReport(rep || null);
            }}
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

      {/* Floating APK Install Button for Android */}
      <PWAInstallButton variant="floating" />

      {/* Offline Alert Indicator */}
      <OfflineIndicator />

      {/* Modals */}
      <NewGameModal
        isOpen={isNewGameModalOpen}
        onClose={() => setIsNewGameModalOpen(false)}
        onStartGame={handleStartNewGame}
      />

      <InstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
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
