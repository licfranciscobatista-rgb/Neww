import { Chess } from 'chess.js';
import {
  CandidateArrow,
  EngineRecommendation,
  EngineType,
  PlayerProfile,
  ThinkingTimeEstimate,
  GameRecord,
  StockfishOperatingMode,
} from '../types/chess';
import { evaluateMovesStockfish, runStockfishRecommendation } from './stockfishEngine';
import { realStockfish } from './realStockfish';
import { realGarbo, RealGarboAnalysis } from './realGarbo';
import { realMaia, RealMaiaAnalysis } from './realMaia';
import { analyzeGarbo } from './garboEngine';
import type { OpeningChoice } from './openingIndex';
import { runMaiaRecommendation } from './maiaEngine';
import { getMaiaSentinelRecommendation } from './maiaSentinel';
import { runPersonalRecommendation, getPersonalEngineStatus } from './personalEngine';
import { runChessJsRecommendation } from './chessjsEngine';
import { controlDirector, subDirector } from './controlDirector';
import { loadGameRecords } from '../storage/chessStorage';
import { distillBookMove } from './theoryBook';
import { estimateThinkingTime } from './thinkingTime';

export interface SupervisorState {
  gameId: string;
  positionId: string;
  generation: number;
  fen: string;
  isGameOver: boolean;
  stockfishMode: StockfishOperatingMode;
  stockfishRemainingUses: number;
  garboRemainingUses: number;
  garboOpening?: string;
  garboOpeningState?: OpeningChoice;
  stockfishRequestedThisTurn: boolean;
  garboRequestedThisTurn: boolean;
  recommendations: Record<EngineType, EngineRecommendation | null>;
  candidateArrows: CandidateArrow[];
  loadingStates: Record<EngineType, boolean>;
  thinkingTime: ThinkingTimeEstimate | null;
  agreements: Array<{ move: string; san: string; engines: EngineType[] }>;
  personalEngineUnlocked: boolean;
  personalProgress: string;
}

/** Convierte el análisis del GarboChess real en una recomendación para la interfaz. */
function garboRecommendationFromReal(
  real: RealGarboAnalysis,
  chess?: Chess,
  explanationPrefix = 'GarboChess'
): EngineRecommendation {
  const book = chess ? distillBookMove(chess, real.san) : { isBook: false, openingName: '', explanation: '' };
  return {
    engine: 'garbo',
    engineName: book.isBook ? 'Libro ECO / Garbo' : 'GarboChess (JS real)',
    move: real.uci,
    san: real.san,
    from: real.from,
    to: real.to,
    evaluation: real.scoreCp / 100,
    evalDisplay: real.evalDisplay,
    depth: real.depth,
    isBookMove: book.isBook,
    bookOpeningName: book.isBook ? book.openingName : undefined,
    explanation: book.isBook
      ? book.explanation
      : `${explanationPrefix} (prof. ${real.depth}): ${real.san}. ${real.pv ? 'Línea: ' + real.pv.slice(0, 30) : ''}`,
    color: '#059669',
  };
}

/** Convierte el análisis del Maia 3 real en una recomendación para la interfaz. */
function maiaRecommendationFromReal(real: RealMaiaAnalysis): EngineRecommendation {
  const pct = (v: number) => Math.round(v * 100);
  const alternatives = real.candidates
    .slice(1, 4)
    .map((c) => `${c.san} ${pct(c.prob)}%`)
    .join(', ');
  return {
    engine: 'maia',
    engineName: 'Maia 3 (red neuronal real)',
    move: real.uci,
    san: real.san,
    from: real.from,
    to: real.to,
    evaluation: pct(real.win - real.loss),
    evalDisplay: `Gana ${pct(real.win)}% · Tablas ${pct(real.draw)}% · Pierde ${pct(real.loss)}%`,
    confidence: pct(real.probability),
    humanProbability: Number(real.probability.toFixed(2)),
    explanation:
      `Maia 3 (Elo ${real.selfElo}): ${pct(real.probability)}% de los jugadores de este nivel eligen ${real.san}.` +
      (alternatives ? ` Otras: ${alternatives}.` : ''),
    color: '#7c3aed',
    timeTakenMs: real.ms,
    timestamp: Date.now(),
  };
}

const isMaiaArrow = (a: CandidateArrow) => !!a.label && a.label.startsWith('M •');

const isGarboArrow = (a: CandidateArrow) => !!a.label && (a.label.startsWith('GB') || a.label.startsWith('GarboChess'));

export class ChessSupervisor {
  private state: SupervisorState;
  private onStateChange: (state: SupervisorState) => void;
  private lastProfile: PlayerProfile | null = null;
  private lastPositionKey = '';
  private lastUserColor: 'w' | 'b' = 'w';
  private lastShowLinesMode: 'my_turn_only' | 'both_turns' | 'none' = 'my_turn_only';
  private lastSystemsMode = false;
  private stockfishRequestSerial = 0;

  constructor(onStateChange: (state: SupervisorState) => void) {
    this.onStateChange = onStateChange;
    const savedOpening = typeof localStorage !== 'undefined' ? localStorage.getItem('jugada_garbo_opening') || 'free' : 'free';
    const initialMode: StockfishOperatingMode =
      typeof localStorage !== 'undefined'
        ? (localStorage.getItem('jugada_sf_mode') as StockfishOperatingMode) || 'per_request'
        : 'per_request';

    this.state = {
      gameId: '',
      positionId: '',
      generation: 0,
      fen: '',
      isGameOver: false,
      stockfishMode: initialMode,
      stockfishRemainingUses: 3,
      garboRemainingUses: 5,
      garboOpening: savedOpening === 'rodent-active' ? 'london' : savedOpening,
      stockfishRequestedThisTurn: false,
      garboRequestedThisTurn: false,
      recommendations: {
        stockfish: null,
        garbo: null,
        maia: null,
        personal: null,
        chessjs: null,
      },
      candidateArrows: [],
      loadingStates: {
        stockfish: false,
        garbo: false,
        maia: false,
        personal: false,
        chessjs: false,
      },
      thinkingTime: null,
      agreements: [],
      personalEngineUnlocked: false,
      personalProgress: '0 / 10 partidas',
    };
  }

  public getState(): SupervisorState {
    return this.state;
  }

  public setGarboOpening(selected: string, chess: Chess): void {
    if (selected !== 'rodent-active' && typeof localStorage !== 'undefined') localStorage.setItem('jugada_garbo_opening', selected);
    this.state.garboOpening = selected;
    this.state.recommendations.garbo = null;
    this.state.garboOpeningState = undefined;
    this.state.candidateArrows = this.state.candidateArrows.filter(a => !isGarboArrow(a));
    this.state.loadingStates.garbo = true;
    this.onStateChange({ ...this.state });
    void this.updateGarbo(chess, this.state.generation, selected);
  }

  private async updateGarbo(chess: Chess, generation: number, selected: string): Promise<void> {
    const fen = chess.fen();
    try {
      const result = await analyzeGarbo(chess, selected);
      if (this.state.generation !== generation || this.state.garboOpening !== selected ||
          this.state.fen !== fen || this.state.isGameOver) return;
      const arrows = this.state.candidateArrows.filter(a => !isGarboArrow(a));
      if (result.rec && !this.shouldSuppressArrows(fen)) arrows.push({
        from: result.rec.from, to: result.rec.to, label: `GB • ${result.rec.evalDisplay}`,
        san: result.rec.san, color: '#059669',
      });
      const recommendations = { ...this.state.recommendations, garbo: result.rec };
      this.state = { ...this.state, recommendations, candidateArrows: arrows,
        garboOpeningState: result.opening, loadingStates: { ...this.state.loadingStates, garbo: false },
        agreements: this.computeAgreements(recommendations) };
      this.onStateChange({ ...this.state });
    } catch {
      if (this.state.generation !== generation || this.state.garboOpening !== selected) return;
      this.state.recommendations = { ...this.state.recommendations, garbo: null };
      this.state.candidateArrows = this.state.candidateArrows.filter(a => !isGarboArrow(a));
      this.state.loadingStates.garbo = false;
      this.state.garboOpeningState = { status: 'unavailable', notice: 'Garbo en pausa: no se pudo verificar la posición.' };
      this.onStateChange({ ...this.state });
    }
  }

  public setStockfishMode(mode: StockfishOperatingMode, chess?: Chess): void {
    this.stockfishRequestSerial++;
    this.state.loadingStates = { ...this.state.loadingStates, stockfish: false };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('jugada_sf_mode', mode);
    }

    if (mode === 'off') {
      realStockfish.stop();
      this.state = {
        ...this.state,
        stockfishMode: 'off',
        stockfishRequestedThisTurn: false,
        recommendations: {
          ...this.state.recommendations,
          stockfish: null,
        },
        candidateArrows: this.state.candidateArrows.filter((a) => !a.label?.startsWith('SF')),
      };
      this.onStateChange({ ...this.state });
      return;
    }

    if (mode === 'always_active') {
      let sfRec: EngineRecommendation | null = null;
      if (chess && !chess.isGameOver()) {
        const sfStart = performance.now();
        sfRec = runStockfishRecommendation(chess);
        controlDirector.watchEngineExecution('stockfish', performance.now() - sfStart);
      }
      const arrows = [...this.state.candidateArrows.filter((a) => !a.label?.startsWith('SF'))];
      if (sfRec && sfRec.move) {
        arrows.push({
          from: sfRec.from,
          to: sfRec.to,
          label: `SF • ${sfRec.evalDisplay}`,
          san: sfRec.san,
          color: '#2563eb',
        });
      }
      this.state = {
        ...this.state,
        stockfishMode: 'always_active',
        stockfishRequestedThisTurn: true,
        recommendations: {
          ...this.state.recommendations,
          stockfish: sfRec,
        },
        candidateArrows: arrows,
      };
      this.onStateChange({ ...this.state });
      return;
    }

    // per_request: limpiar flecha automática y esperar consulta con descuento real de usos
    this.state = {
      ...this.state,
      stockfishMode: 'per_request',
      stockfishRequestedThisTurn: false,
      recommendations: {
        ...this.state.recommendations,
        stockfish: null,
      },
      candidateArrows: this.state.candidateArrows.filter((a) => !a.label?.startsWith('SF')),
    };
    this.onStateChange({ ...this.state });
  }

  public deductStockfishUse(): void {
    if (this.state.stockfishMode !== 'per_request') return;
    const remaining = Math.max(0, this.state.stockfishRemainingUses - 1);
    this.state = {
      ...this.state,
      stockfishRemainingUses: remaining,
    };
    this.onStateChange({ ...this.state });
  }

  public shouldSuppressArrows(fen?: string): boolean {
    if (this.lastShowLinesMode === 'none') return true;
    if (this.lastShowLinesMode === 'my_turn_only') {
      const targetFen = fen || this.state.fen;
      if (!targetFen) return false;
      const turn = targetFen.split(' ')[1] || 'w';
      return turn !== this.lastUserColor;
    }
    return false;
  }

  public resetForNewGame(gameId: string): void {
    this.stockfishRequestSerial++;
    this.lastPositionKey = '';
    // Consulta ultra-rápida de preparación al Subdirector (<0.1ms)
    subDirector.consultReadiness();

    this.state = {
      ...this.state,
      gameId,
      positionId: `${gameId}_0`,
      generation: this.state.generation + 1,
      isGameOver: false,
      stockfishRemainingUses: 3, // REINICIADO A 3 USOS PARA LA NUEVA PARTIDA
      garboRemainingUses: 5,
      stockfishRequestedThisTurn: false,
      garboRequestedThisTurn: false,
      recommendations: {
        stockfish: null,
        garbo: null,
        maia: null,
        personal: null,
        chessjs: null,
      },
      candidateArrows: [],
      agreements: [],
      thinkingTime: null,
      loadingStates: { stockfish: false, garbo: false, maia: false, personal: false, chessjs: false },
    };
    this.onStateChange(this.state);
  }

  public onPositionChange(params: {
    gameId: string;
    chess: Chess;
    profile: PlayerProfile;
    clockRemainingSeconds: number;
    averageUserMoveTime: number;
    games?: GameRecord[];
    userColor?: 'w' | 'b';
    gameMode?: 'vs_ai' | 'manual_board';
    showLinesMode?: 'my_turn_only' | 'both_turns' | 'none';
    systemsMode?: boolean;
  }): void {
    const {
      gameId,
      chess,
      profile,
      clockRemainingSeconds,
      userColor = 'w',
      gameMode = 'vs_ai',
      showLinesMode = 'my_turn_only',
      systemsMode = false,
    } = params;
    this.lastProfile = profile;
    this.lastUserColor = userColor;
    this.lastShowLinesMode = showLinesMode;
    this.lastSystemsMode = systemsMode;
    const fen = chess.fen();

    // Deduplicación: onPositionChange se dispara desde varios sitios (jugada, efecto de React, reloj).
    // Si nada relevante cambió, no se recalculan los 5 motores ni se lanza otra búsqueda de Stockfish.
    const clockBucket = clockRemainingSeconds > 0 && clockRemainingSeconds < 60 ? 'low' : 'ok';
    const positionKey = [
      gameId,
      fen,
      userColor,
      gameMode,
      showLinesMode,
      systemsMode ? 'sys' : 'main',
      clockBucket,
      profile.maiaEloCalibration || 1100,
      profile.gamesPlayed || 0,
      params.games ? params.games.length : -1,
    ].join('|');
    if (positionKey === this.lastPositionKey) return;
    this.lastPositionKey = positionKey;

    const storedGames = params.games || loadGameRecords();

    if (chess.isGameOver()) {
      const finalPersonalStatus = getPersonalEngineStatus(profile, storedGames);
      this.state = {
        ...this.state,
        generation: this.state.generation + 1,
        fen,
        isGameOver: true,
        personalEngineUnlocked: finalPersonalStatus.isUnlocked,
        personalProgress: `${finalPersonalStatus.gamesPlayed} / 10 partidas`,
        candidateArrows: [],
        agreements: [],
        loadingStates: { stockfish: false, garbo: false, maia: false, personal: false, chessjs: false },
        garboOpeningState: undefined,
        thinkingTime: null,
        stockfishRequestedThisTurn: false,
        garboRequestedThisTurn: false,
        recommendations: {
          stockfish: null,
          garbo: null,
          maia: null,
          personal: null,
          chessjs: null,
        },
      };
      this.onStateChange(this.state);
      return;
    }

    // Los motores se mantienen SIEMPRE activos en segundo plano para evitar retrasos
    // al volver al turno del jugador. Sin embargo, las flechas se ocultan en el turno rival
    // para no saturar el tablero ni causar distracción.
    const shouldSuppressArrows = this.shouldSuppressArrows(fen);

    const generation = this.state.generation + 1;
    const positionId = `${gameId}_${generation}`;

    // Compute Thinking Time
    const thinkingTime = estimateThinkingTime(chess, storedGames, clockRemainingSeconds);

    // Optimización crítica para tablet de 3GB:
    // Si las flechas deben suprimirse (ej. turno del rival en modo solo mi turno, o líneas desactivadas),
    // NO calcular motores pesados ni lanzar Stockfish WASM en el turno del rival.
    if (shouldSuppressArrows) {
      this.state = {
        ...this.state,
        gameId,
        positionId,
        generation,
        fen,
        isGameOver: false,
        candidateArrows: [],
        recommendations: { stockfish: null, garbo: null, maia: null, personal: null, chessjs: null },
        loadingStates: { stockfish: false, garbo: false, maia: false, personal: false, chessjs: false },
        thinkingTime: null,
      };
      this.onStateChange(this.state);
      return;
    }

    // Check personal engine status (Desbloqueado desde partida 0)
    const personalStatus = getPersonalEngineStatus(profile, storedGames);

    // Emisión inmediata de estado base para que el tablero pinte a 60 FPS sin esperar a los motores
    this.state = {
      ...this.state,
      gameId,
      positionId,
      generation,
      fen,
      isGameOver: false,
      stockfishRequestedThisTurn: false,
      thinkingTime,
      personalEngineUnlocked: personalStatus.isUnlocked,
      personalProgress: `${personalStatus.gamesPlayed} / 10 partidas`,
    };
    this.onStateChange(this.state);

    // Sub-Director programa la ejecución de los motores en micro-cuadro no bloqueante (Garantía 60 FPS)
    subDirector.scheduleZeroLagFrame(() => {
      if (this.state.generation !== generation || this.state.isGameOver) return;

      // 1. Run Stockfish según el modo elegido por el usuario ('always_active' | 'per_request' | 'off')
      let stockfishRec: EngineRecommendation | null = null;
      if (this.state.stockfishMode === 'always_active') {
        const sfStart = performance.now();
        stockfishRec = runStockfishRecommendation(chess);
        controlDirector.watchEngineExecution('stockfish', performance.now() - sfStart);
      } else if (this.state.stockfishMode === 'per_request' && this.state.stockfishRequestedThisTurn) {
        stockfishRec = this.state.recommendations.stockfish;
      } else {
        // En modo 'per_request' (esperando que el usuario consulte) o 'off': null
        stockfishRec = null;
      }

      // 2. GarboChess: Recomendación Teórica Posicional
      const garboStart = performance.now();
      const garboRec = null as EngineRecommendation | null;
      controlDirector.watchEngineExecution('garbo', performance.now() - garboStart);

      // 3. Maia:
      // En Modo Sistemas: Centinela de Avisos (Mates, Tablas y Jugadas Malas / Colgadas)
      // En Modo Principal: Recomendación Teórica Humana original según Elo calibrado
      const maiaStart = performance.now();
      const maiaRec = this.lastSystemsMode
        ? getMaiaSentinelRecommendation(chess, this.lastUserColor || 'w')
        : runMaiaRecommendation(chess, profile.maiaEloCalibration || 1100);
      controlDirector.watchEngineExecution('maia', performance.now() - maiaStart);

      // 4. Motor Personal: Disponible y adaptándose activamente con detección anti-copia de Stockfish
      let personalRec: EngineRecommendation | null = null;
      if (personalStatus.isUnlocked) {
        const pStart = performance.now();
        try {
          personalRec = runPersonalRecommendation({
            chess,
            profile,
            games: storedGames,
            stockfishMoveSan: stockfishRec?.san,
          });
        } catch (pErr) {
          console.warn('[Supervisor] Fallback seguro en Motor Personal:', pErr);
          personalRec = null;
        }
        controlDirector.watchEngineExecution('personal', performance.now() - pStart);
      }

      // 5. Chess.js: Detección inteligente de jugada dudosa/pasiva para evitar
      let chessjsRec: EngineRecommendation | null = null;
      try {
        const cjsStart = performance.now();
        const otherMoves = [
          stockfishRec?.move,
          garboRec?.move,
          maiaRec?.move,
          personalRec?.move,
        ].filter(Boolean) as string[];
        chessjsRec = runChessJsRecommendation(new Chess(chess.fen()), otherMoves);
        controlDirector.watchEngineExecution('chessjs', performance.now() - cjsStart);
      } catch (err) {
        console.warn('[Supervisor] Fallback seguro en Chess.js:', err);
      }

      // Compute candidate arrows for active engines
      const arrows: CandidateArrow[] = [];

      if (!shouldSuppressArrows) {
        if (this.state.stockfishMode !== 'off' && stockfishRec && stockfishRec.move) {
          arrows.push({
            from: stockfishRec.from,
            to: stockfishRec.to,
            label: `SF • ${stockfishRec.evalDisplay}`,
            san: stockfishRec.san,
            color: '#2563eb',
          });
        }

        if (maiaRec && maiaRec.move) {
          arrows.push({
            from: maiaRec.from,
            to: maiaRec.to,
            label: this.lastSystemsMode
              ? `Aviso • ${maiaRec.san || maiaRec.evalDisplay}`
              : `M • ${Math.round((maiaRec.humanProbability || 0.5) * 100)}% humana`,
            san: maiaRec.san,
            color: this.lastSystemsMode ? (maiaRec.color || '#a855f7') : '#7c3aed',
          });
        }

        if (personalRec && personalRec.move && personalStatus.isUnlocked) {
          arrows.push({
            from: personalRec.from,
            to: personalRec.to,
            label: `MP • ${personalRec.evalDisplay}`,
            san: personalRec.san,
            color: '#d97706',
          });
        }

        if (chessjsRec && chessjsRec.move) {
          const moveText =
            chessjsRec.simpleMoveText ||
            `${chessjsRec.avoidPieceName || 'Pieza'} a ${chessjsRec.to || chessjsRec.san}`;
          arrows.push({
            from: chessjsRec.from,
            to: chessjsRec.to,
            label: `⚠️ ${moveText}`,
            san: chessjsRec.san,
            color: '#fb7185',
          });
        }
      }

      // Compute Agreements
      const moveEngineMap = new Map<string, { san: string; engines: EngineType[] }>();
      const allRecs: Array<{ engine: EngineType; rec: EngineRecommendation | null }> = [
        { engine: 'stockfish', rec: this.state.stockfishMode === 'off' ? null : stockfishRec },
        { engine: 'garbo', rec: garboRec },
        { engine: 'maia', rec: maiaRec },
        { engine: 'personal', rec: personalRec },
      ];

      for (const item of allRecs) {
        if (item.rec && item.rec.move) {
          const existing = moveEngineMap.get(item.rec.move);
          if (existing) {
            existing.engines.push(item.engine);
          } else {
            moveEngineMap.set(item.rec.move, { san: item.rec.san, engines: [item.engine] });
          }
        }
      }

      const agreements = Array.from(moveEngineMap.entries())
        .filter(([_, data]) => data.engines.length > 1)
        .map(([move, data]) => ({
          move,
          san: data.san,
          engines: data.engines,
        }));

      this.state = {
        ...this.state,
        gameId,
        positionId,
        generation,
        fen,
        isGameOver: false,
        stockfishRequestedThisTurn: false,
        garboRequestedThisTurn: false,
        thinkingTime,
        candidateArrows: arrows,
        agreements,
        personalEngineUnlocked: personalStatus.isUnlocked,
        personalProgress: `${personalStatus.gamesPlayed} / 10 partidas`,
        recommendations: {
          stockfish: stockfishRec,
          garbo: garboRec,
          maia: maiaRec,
          personal: personalRec,
          chessjs: chessjsRec,
        },
        loadingStates: {
          stockfish: false,
          garbo: true,
          maia: false,
          personal: false,
          chessjs: false,
        },
      };

      this.onStateChange(this.state);
      void this.updateGarbo(chess, generation, this.state.garboOpening || 'auto');
      void this.refineMaiaWithRealEngine(fen, generation, profile.maiaEloCalibration || 1100);
    });

    // Refinar de forma asíncrona con Stockfish 19 WASM real solo en el turno del jugador (180ms)
    // para jamás saturar la cola del motor ni robar recursos si la IA está por responder
    const isPlayerTurn = chess.turn() === userColor;
    if (this.state.stockfishMode === 'always_active' && isPlayerTurn && realStockfish.isReady()) {
      const currentFen = fen;
      const currentGen = generation;
      realStockfish
        .analyze(currentFen, { movetime: 180 })
        .then((real) => {
        if (!real || !real.from || !real.to) return;
        if (this.state.stockfishMode !== 'always_active') return;
        if (this.state.generation !== currentGen || this.state.isGameOver) return;

        const refinedStockfishRec: EngineRecommendation = {
          engine: 'stockfish',
          engineName: 'Stockfish 19 WASM',
          move: real.uci,
          san: real.san,
          from: real.from,
          to: real.to,
          evaluation: real.scoreCp !== undefined ? real.scoreCp / 100 : 0,
          evalDisplay: real.evalDisplay,
          depth: real.depth || 12,
          explanation: `Stockfish 19 WASM (prof. ${real.depth || 12}): ${real.san}. ${real.pv ? 'Línea: ' + real.pv.slice(0, 24) : ''}`,
          isMasterMove: true,
        };

        const shouldSuppress = this.shouldSuppressArrows(currentFen);
        let newArrows: CandidateArrow[] = [];
        if (!shouldSuppress) {
          newArrows = this.state.candidateArrows.filter((a) => !a.label?.startsWith('SF'));
          newArrows.unshift({
            from: refinedStockfishRec.from,
            to: refinedStockfishRec.to,
            label: `SF • ${refinedStockfishRec.evalDisplay}`,
            san: refinedStockfishRec.san,
            color: '#2563eb',
          });
        }

        const newRecs = {
          ...this.state.recommendations,
          stockfish: refinedStockfishRec,
        };

        const moveMap = new Map<string, { san: string; engines: EngineType[] }>();
        const recList: Array<{ engine: EngineType; rec: EngineRecommendation | null }> = [
          { engine: 'stockfish', rec: refinedStockfishRec },
          { engine: 'garbo', rec: this.state.recommendations.garbo },
          { engine: 'maia', rec: this.state.recommendations.maia },
          { engine: 'personal', rec: this.state.recommendations.personal },
        ];
        for (const item of recList) {
          if (item.rec && item.rec.move) {
            const ex = moveMap.get(item.rec.move);
            if (ex) {
              ex.engines.push(item.engine);
            } else {
              moveMap.set(item.rec.move, { san: item.rec.san, engines: [item.engine] });
            }
          }
        }
        const newAgreements = Array.from(moveMap.entries())
          .filter(([_, d]) => d.engines.length > 1)
          .map(([m, d]) => ({ move: m, san: d.san, engines: d.engines }));

        this.state = {
          ...this.state,
          recommendations: newRecs,
          candidateArrows: newArrows,
          agreements: newAgreements,
        };
        this.onStateChange(this.state);
      })
      .catch(() => {});
    }

  }

  private computeAgreements(
    recs: SupervisorState['recommendations']
  ): Array<{ move: string; san: string; engines: EngineType[] }> {
    const moveMap = new Map<string, { san: string; engines: EngineType[] }>();
    const list: Array<[EngineType, EngineRecommendation | null]> = [
      ['stockfish', recs.stockfish],
      ['garbo', recs.garbo],
      ['maia', recs.maia],
      ['personal', recs.personal],
    ];
    for (const [engine, rec] of list) {
      if (!rec || !rec.move) continue;
      const existing = moveMap.get(rec.move);
      if (existing) existing.engines.push(engine);
      else moveMap.set(rec.move, { san: rec.san, engines: [engine] });
    }
    return Array.from(moveMap.entries())
      .filter(([, d]) => d.engines.length > 1)
      .map(([move, d]) => ({ move, san: d.san, engines: d.engines }));
  }

  private async refineMaiaWithRealEngine(fen: string, generation: number, elo: number): Promise<void> {
    try {
      const real = await realMaia.analyze(fen, { selfElo: elo });
      if (!real) return;
      if (this.state.generation !== generation || this.state.isGameOver) return;

      const rec = maiaRecommendationFromReal(real);
      const shouldSuppress = this.shouldSuppressArrows(fen);
      let arrows: CandidateArrow[] = [];
      if (!shouldSuppress) {
        const arrow: CandidateArrow = {
          from: rec.from,
          to: rec.to,
          label: `M • ${Math.round((rec.humanProbability || 0) * 100)}% humana`,
          san: rec.san,
          color: '#7c3aed',
        };

        arrows = [...this.state.candidateArrows];
        const idx = arrows.findIndex(isMaiaArrow);
        if (idx >= 0) arrows[idx] = arrow;
        else arrows.push(arrow);
      }

      const recommendations = { ...this.state.recommendations, maia: rec };
      this.state = {
        ...this.state,
        recommendations,
        candidateArrows: arrows,
        agreements: this.computeAgreements(recommendations),
      };
      this.onStateChange(this.state);
    } catch {
      // Se conserva la simulación heurística de respaldo
    }
  }

  private async refineGarboWithRealEngine(fen: string, generation: number): Promise<void> {
    try {
      const real = await realGarbo.analyze(fen, { movetime: 400 });
      if (!real) return;
      // La posición cambió mientras se pensaba: el resultado ya no sirve
      if (this.state.generation !== generation || this.state.isGameOver) return;

      const rec = garboRecommendationFromReal(real, new Chess(fen));
      const shouldSuppress = this.shouldSuppressArrows(fen);
      let arrows: CandidateArrow[] = [];
      if (!shouldSuppress) {
        const arrow: CandidateArrow = {
          from: rec.from,
          to: rec.to,
          label: `GB • ${rec.evalDisplay}`,
          san: rec.san,
          color: '#059669',
        };

        // La flecha se reemplaza en su sitio para no alterar el orden de dibujo de las demás
        arrows = [...this.state.candidateArrows];
        const idx = arrows.findIndex(isGarboArrow);
        if (idx >= 0) arrows[idx] = arrow;
        else arrows.push(arrow);
      }

      const recommendations = { ...this.state.recommendations, garbo: rec };
      this.state = {
        ...this.state,
        recommendations,
        candidateArrows: arrows,
        agreements: this.computeAgreements(recommendations),
      };
      this.onStateChange(this.state);
    } catch {
      // Se conserva la recomendación posicional de respaldo
    }
  }

  public async requestStockfishUse(chess: Chess): Promise<void> {
    if (this.state.stockfishMode === 'off') return;
    if (this.state.loadingStates.stockfish || this.state.isGameOver) return;
    if (this.state.stockfishMode === 'per_request' && this.state.stockfishRemainingUses <= 0) return;

    const requestGeneration = this.state.generation;
    const requestSerial = ++this.stockfishRequestSerial;
    const requestFen = chess.fen();
    const requestMode = this.state.stockfishMode;
    this.state.loadingStates.stockfish = true;
    this.onStateChange({ ...this.state });

    const startTime = performance.now();
    const remaining =
      this.state.stockfishMode === 'per_request'
        ? Math.max(0, this.state.stockfishRemainingUses - 1)
        : this.state.stockfishRemainingUses;

    this.state.stockfishRemainingUses = remaining;
    this.onStateChange({ ...this.state });

    let rec: EngineRecommendation | null = null;
    try {
      const real = await realStockfish.analyze(requestFen, { movetime: 800 });
      if (real && real.from && real.to) {
        rec = {
          engine: 'stockfish',
          engineName: 'Stockfish 19 WASM',
          move: real.uci,
          san: real.san,
          from: real.from,
          to: real.to,
          evaluation: real.scoreCp !== undefined ? real.scoreCp / 100 : 0,
          evalDisplay: real.evalDisplay,
          depth: real.depth || 12,
          explanation: `Stockfish 19 WASM (profundidad ${real.depth || 12}): ${real.san}. ${real.pv ? 'Línea: ' + real.pv.slice(0, 30) : ''}`,
          isMasterMove: true,
        };
      }
    } catch {
      // fallback
    }

    if (this.stockfishRequestSerial !== requestSerial || this.state.generation !== requestGeneration || this.state.stockfishMode !== requestMode || chess.fen() !== requestFen) {
      return;
    }

    if (!rec) {
      rec = runStockfishRecommendation(chess);
    }
    const duration = performance.now() - startTime;
    controlDirector.watchEngineExecution('stockfish', duration);

    // Add arrow if not already present
    const updatedArrows = [...this.state.candidateArrows.filter((a) => !a.label?.startsWith('SF'))];
    if (rec && rec.move) {
      updatedArrows.push({
        from: rec.from,
        to: rec.to,
        label: `SF • ${rec.evalDisplay}`,
        san: rec.san,
        color: '#2563eb',
      });
    }

    this.state = {
      ...this.state,
      stockfishRemainingUses: remaining,
      stockfishRequestedThisTurn: true,
      candidateArrows: updatedArrows,
      recommendations: {
        ...this.state.recommendations,
        stockfish: rec,
      },
      loadingStates: {
        ...this.state.loadingStates,
        stockfish: false,
      },
      agreements: this.computeAgreements({
        ...this.state.recommendations,
        stockfish: rec,
      }),
    };
    this.onStateChange(this.state);
  }

  public async requestGarboUse(chess: Chess): Promise<void> {
    if (this.state.loadingStates.garbo || this.state.isGameOver) return;
    this.state.loadingStates.garbo = true;
    this.onStateChange({ ...this.state });
    await this.updateGarbo(chess, this.state.generation, this.state.garboOpening || 'auto');
  }
}

