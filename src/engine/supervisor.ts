import { Chess } from 'chess.js';
import {
  CandidateArrow,
  EngineRecommendation,
  EngineType,
  PlayerProfile,
  ThinkingTimeEstimate,
  GameRecord,
} from '../types/chess';
import { evaluateMovesStockfish, runStockfishRecommendation } from './stockfishEngine';
import { runGarboRecommendation } from './garboEngine';
import { runMaiaRecommendation } from './maiaEngine';
import { runPersonalRecommendation, getPersonalEngineStatus } from './personalEngine';
import { controlDirector } from './controlDirector';
import { loadGameRecords } from '../storage/chessStorage';

export interface SupervisorState {
  gameId: string;
  positionId: string;
  generation: number;
  fen: string;
  isGameOver: boolean;
  stockfishRemainingUses: number;
  garboRemainingUses: number;
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

export class ChessSupervisor {
  private state: SupervisorState;
  private onStateChange: (state: SupervisorState) => void;
  private lastProfile: PlayerProfile | null = null;

  constructor(onStateChange: (state: SupervisorState) => void) {
    this.onStateChange = onStateChange;
    this.state = {
      gameId: '',
      positionId: '',
      generation: 0,
      fen: '',
      isGameOver: false,
      stockfishRemainingUses: 3,
      garboRemainingUses: 5,
      stockfishRequestedThisTurn: false,
      garboRequestedThisTurn: false,
      recommendations: {
        stockfish: null,
        garbo: null,
        maia: null,
        personal: null,
      },
      candidateArrows: [],
      loadingStates: {
        stockfish: false,
        garbo: false,
        maia: false,
        personal: false,
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

  public resetForNewGame(gameId: string): void {
    this.state = {
      ...this.state,
      gameId,
      positionId: `${gameId}_0`,
      generation: 0,
      isGameOver: false,
      stockfishRemainingUses: 3,
      garboRemainingUses: 5,
      stockfishRequestedThisTurn: false,
      garboRequestedThisTurn: false,
      recommendations: {
        stockfish: null,
        garbo: null,
        maia: null,
        personal: null,
      },
      candidateArrows: [],
      agreements: [],
      thinkingTime: null,
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
  }): void {
    const { gameId, chess, profile, clockRemainingSeconds, userColor = 'w', gameMode = 'vs_ai' } = params;
    this.lastProfile = profile;
    const fen = chess.fen();
    const storedGames = params.games || loadGameRecords();

    if (chess.isGameOver()) {
      this.state = {
        ...this.state,
        fen,
        isGameOver: true,
        candidateArrows: [],
        thinkingTime: null,
        stockfishRequestedThisTurn: false,
        garboRequestedThisTurn: false,
        recommendations: {
          stockfish: null,
          garbo: null,
          maia: null,
          personal: null,
        },
      };
      this.onStateChange(this.state);
      return;
    }

    // RIVAL'S TURN CHECK: In vs_ai mode, if it's the opponent's turn, DO NOT calculate or display engine lines
    const isRivalTurn = gameMode === 'vs_ai' && chess.turn() !== userColor;
    if (isRivalTurn) {
      this.state = {
        ...this.state,
        fen,
        isGameOver: false,
        candidateArrows: [],
        thinkingTime: null,
        stockfishRequestedThisTurn: false,
        garboRequestedThisTurn: false,
        recommendations: {
          stockfish: null,
          garbo: null,
          maia: null,
          personal: null,
        },
        agreements: [],
      };
      this.onStateChange(this.state);
      return;
    }

    const generation = this.state.generation + 1;
    const positionId = `${gameId}_${generation}`;

    // Compute Thinking Time
    const legalMoves = chess.moves({ verbose: true });
    let complexityScore = 4;
    let urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium';

    if (chess.inCheck()) {
      complexityScore = 8;
      urgency = 'high';
    } else if (legalMoves.some((m) => m.captured)) {
      complexityScore = 6;
      urgency = 'medium';
    } else if (legalMoves.length > 30) {
      complexityScore = 7;
      urgency = 'medium';
    } else if (clockRemainingSeconds < 60 && clockRemainingSeconds > 0) {
      urgency = 'critical';
    }

    const recommendedSeconds = Math.max(
      3,
      Math.min(45, Math.round((complexityScore / 5) * (clockRemainingSeconds > 0 ? clockRemainingSeconds / 40 : 15)))
    );

    const thinkingTime: ThinkingTimeEstimate = {
      recommendedSeconds,
      urgency,
      complexityScore,
      reasoning:
        complexityScore > 7
          ? 'Posición táctica compleja con amenazas activas: calcula variantes forzadas.'
          : complexityScore > 5
          ? 'Tensión de piezas en el centro: evalúa cambios favorables antes de definir.'
          : 'Fase de maniobra posicional: desarrolla armoniosamente.',
    };

    // Check personal engine status (STRICT 10 GAMES RULE)
    const personalStatus = getPersonalEngineStatus(profile, storedGames);

    // 1. Run Stockfish
    const sfStart = performance.now();
    const stockfishRec = runStockfishRecommendation(chess);
    controlDirector.watchEngineExecution('stockfish', performance.now() - sfStart);

    // 2. Run GarboChess
    const garboStart = performance.now();
    const garboRec = runGarboRecommendation(chess);
    controlDirector.watchEngineExecution('garbo', performance.now() - garboStart);

    // 3. Run Maia (Human neural model, calibrated from 500 to 2400 Elo)
    const maiaStart = performance.now();
    const maiaRec = runMaiaRecommendation(
      chess,
      profile.maiaEloCalibration || 1100
    );
    controlDirector.watchEngineExecution('maia', performance.now() - maiaStart);

    // 4. Motor Personal: ONLY if >= 10 games played by user!
    let personalRec: EngineRecommendation | null = null;
    if (personalStatus.isUnlocked) {
      const pStart = performance.now();
      personalRec = runPersonalRecommendation({
        chess,
        profile,
        games: storedGames,
      });
      controlDirector.watchEngineExecution('personal', performance.now() - pStart);
    }

    // Compute candidate arrows for active engines
    const arrows: CandidateArrow[] = [];

    if (stockfishRec && stockfishRec.move) {
      arrows.push({
        from: stockfishRec.from,
        to: stockfishRec.to,
        label: `SF • ${stockfishRec.evalDisplay}`,
        san: stockfishRec.san,
        color: '#2563eb',
      });
    }

    if (garboRec && garboRec.move) {
      arrows.push({
        from: garboRec.from,
        to: garboRec.to,
        label: `GB • ${garboRec.evalDisplay}`,
        san: garboRec.san,
        color: '#059669',
      });
    }

    if (maiaRec && maiaRec.move) {
      arrows.push({
        from: maiaRec.from,
        to: maiaRec.to,
        label: `M • ${Math.round((maiaRec.humanProbability || 0.5) * 100)}% humana`,
        san: maiaRec.san,
        color: '#7c3aed',
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

    // Compute Agreements
    const moveEngineMap = new Map<string, { san: string; engines: EngineType[] }>();
    const allRecs: Array<{ engine: EngineType; rec: EngineRecommendation | null }> = [
      { engine: 'stockfish', rec: stockfishRec },
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
      },
      loadingStates: {
        stockfish: false,
        garbo: false,
        maia: false,
        personal: false,
      },
    };

    this.onStateChange(this.state);
  }

  public requestStockfishUse(chess: Chess): void {
    if (this.state.stockfishRemainingUses <= 0) return;

    this.state.loadingStates.stockfish = true;
    this.onStateChange({ ...this.state });

    const startTime = performance.now();
    const remaining = this.state.stockfishRemainingUses - 1;
    const rec = runStockfishRecommendation(chess);
    const duration = performance.now() - startTime;

    controlDirector.watchEngineExecution('stockfish', duration);

    // Add arrow if not already present
    const updatedArrows = [...this.state.candidateArrows];
    if (rec && rec.move && !updatedArrows.some((a) => a.from === rec.from && a.to === rec.to)) {
      updatedArrows.push({
        from: rec.from,
        to: rec.to,
        label: `Stockfish (${rec.evalDisplay})`,
        san: rec.san,
        color: '#38bdf8',
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
    };
    this.onStateChange(this.state);
  }

  public requestGarboUse(chess: Chess): void {
    if (this.state.garboRemainingUses <= 0) return;

    this.state.loadingStates.garbo = true;
    this.onStateChange({ ...this.state });

    const startTime = performance.now();
    const remaining = this.state.garboRemainingUses - 1;
    const rec = runGarboRecommendation(chess);
    const duration = performance.now() - startTime;

    controlDirector.watchEngineExecution('garbo', duration);

    // Add arrow if not already present
    const updatedArrows = [...this.state.candidateArrows];
    if (rec && rec.move && !updatedArrows.some((a) => a.from === rec.from && a.to === rec.to)) {
      updatedArrows.push({
        from: rec.from,
        to: rec.to,
        label: `GarboChess (${rec.evalDisplay})`,
        san: rec.san,
        color: '#34d399',
      });
    }

    this.state = {
      ...this.state,
      garboRemainingUses: remaining,
      garboRequestedThisTurn: true,
      candidateArrows: updatedArrows,
      recommendations: {
        ...this.state.recommendations,
        garbo: rec,
      },
      loadingStates: {
        ...this.state.loadingStates,
        garbo: false,
      },
    };
    this.onStateChange(this.state);
  }
}
