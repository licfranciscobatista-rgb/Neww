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
import { realStockfish } from './realStockfish';
import { realGarbo, RealGarboAnalysis } from './realGarbo';
import { realMaia, RealMaiaAnalysis } from './realMaia';
import { runGarboRecommendation } from './garboEngine';
import { runMaiaRecommendation } from './maiaEngine';
import { runPersonalRecommendation, getPersonalEngineStatus } from './personalEngine';
import { runChessJsRecommendation } from './chessjsEngine';
import { controlDirector, subDirector } from './controlDirector';
import { loadGameRecords } from '../storage/chessStorage';
import { distillBookMove } from './theoryBook';

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

  public shouldSuppressArrows(fen?: string): boolean {
    if (this.lastShowLinesMode === 'none') return true;
    if (this.lastShowLinesMode === 'my_turn_only') {
      try {
        const targetFen = fen || this.state.fen;
        if (!targetFen) return false;
        const turn = new Chess(targetFen).turn();
        return turn !== this.lastUserColor;
      } catch {
        return false;
      }
    }
    return false;
  }

  public resetForNewGame(gameId: string): void {
    this.lastPositionKey = '';
    // Consulta ultra-rápida de preparación al Subdirector (<0.1ms)
    subDirector.consultReadiness();

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
        chessjs: null,
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
    showLinesMode?: 'my_turn_only' | 'both_turns' | 'none';
  }): void {
    const {
      gameId,
      chess,
      profile,
      clockRemainingSeconds,
      userColor = 'w',
      gameMode = 'vs_ai',
      showLinesMode = 'my_turn_only',
    } = params;
    this.lastProfile = profile;
    this.lastUserColor = userColor;
    this.lastShowLinesMode = showLinesMode;
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
      clockBucket,
      profile.maiaEloCalibration || 1100,
      profile.gamesPlayed || 0,
      params.games ? params.games.length : -1,
    ].join('|');
    if (positionKey === this.lastPositionKey) return;
    this.lastPositionKey = positionKey;

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
      thinkingTime,
      personalEngineUnlocked: personalStatus.isUnlocked,
      personalProgress: `${personalStatus.gamesPlayed} / 10 partidas`,
    };
    this.onStateChange(this.state);

    // Sub-Director programa la ejecución de los motores en micro-cuadro no bloqueante (Garantía 60 FPS)
    subDirector.scheduleZeroLagFrame(() => {
      if (this.state.generation !== generation || this.state.isGameOver) return;

      // 1. Run Stockfish (Recomendación principal con flechas)
      const sfStart = performance.now();
      const stockfishRec = runStockfishRecommendation(chess);
      controlDirector.watchEngineExecution('stockfish', performance.now() - sfStart);

      // 2. GarboChess: Recomendación Teórica Posicional
      const garboStart = performance.now();
      const garboRec = runGarboRecommendation(chess);
      controlDirector.watchEngineExecution('garbo', performance.now() - garboStart);

      // 3. Maia: Recomendación Teórica Humana
      const maiaStart = performance.now();
      const maiaRec = runMaiaRecommendation(
        chess,
        profile.maiaEloCalibration || 1100
      );
      controlDirector.watchEngineExecution('maia', performance.now() - maiaStart);

      // 4. Motor Personal: Disponible y adaptándose activamente (Con flechas en el tablero)
      let personalRec: EngineRecommendation | null = null;
      if (personalStatus.isUnlocked) {
        const pStart = performance.now();
        try {
          personalRec = runPersonalRecommendation({
            chess,
            profile,
            games: storedGames,
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
        if (stockfishRec && stockfishRec.move) {
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
          chessjs: chessjsRec,
        },
        loadingStates: {
          stockfish: false,
          garbo: false,
          maia: false,
          personal: false,
          chessjs: false,
        },
      };

      this.onStateChange(this.state);
    });

    // Refinar de forma asíncrona con Stockfish 19 WASM real si está operativo
    const currentFen = fen;
    const currentGen = generation;
    realStockfish
      .analyze(currentFen, { movetime: 500 })
      .then((real) => {
        if (!real || !real.from || !real.to) return;
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

    // Garbo y Maia actúan como recomendaciones teóricas directas (evaluación heurística inmediata sin workers en segundo plano)
    // para preservar al 100% la memoria RAM (3GB) y CPU en tablets.
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
    if (this.state.stockfishRemainingUses <= 0) return;

    this.state.loadingStates.stockfish = true;
    this.onStateChange({ ...this.state });

    const startTime = performance.now();
    const remaining = this.state.stockfishRemainingUses - 1;

    let rec: EngineRecommendation | null = null;
    try {
      const real = await realStockfish.analyze(chess.fen(), { movetime: 800 });
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
    };
    this.onStateChange(this.state);
  }

  public async requestGarboUse(chess: Chess): Promise<void> {
    if (this.state.garboRemainingUses <= 0) return;

    this.state.loadingStates.garbo = true;
    this.onStateChange({ ...this.state });

    const startTime = performance.now();
    const remaining = this.state.garboRemainingUses - 1;
    const generationAtRequest = this.state.generation;

    let rec: EngineRecommendation | null = null;
    try {
      const real = await realGarbo.analyze(chess.fen(), { movetime: 800 });
      if (real) rec = garboRecommendationFromReal(real, chess, 'GarboChess (a demanda)');
    } catch {
      // se usa la heurística de respaldo
    }
    if (!rec) rec = runGarboRecommendation(chess);
    const duration = performance.now() - startTime;

    controlDirector.watchEngineExecution('garbo', duration);

    // Mientras el motor pensaba se jugó otra jugada: solo se descuenta el uso, sin mostrar una flecha vieja
    if (this.state.generation !== generationAtRequest) {
      this.state = {
        ...this.state,
        garboRemainingUses: remaining,
        loadingStates: { ...this.state.loadingStates, garbo: false },
      };
      this.onStateChange(this.state);
      return;
    }

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
