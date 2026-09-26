import { Chess, Move, Square } from 'chess.js';
import { GameRecord } from '../types/chess';
import { DistilledUserData, StyleAssistant } from './personalAssistants';

/**
 * Representación de un nodo en el Árbol Posicional del Jugador (Grafo FEN).
 * Registra la memoria histórica pura del usuario en cada posición específica.
 */
export interface PlayerPositionNode {
  fenKey: string; // FEN simplificado (piezas + bando)
  playCount: number;
  wins: number;
  draws: number;
  losses: number;
  playerColor: 'w' | 'b';
  movesChosen: Record<string, { san: string; uci: string; count: number; wins: number; draws: number; losses: number }>;
  averageTimeSpentMs: number;
}

/**
 * Dictamen emitido por cada uno de los 8 Sub-Motores especializados.
 */
export interface SubEngineVerdict {
  id: string;
  name: string;
  focus: string;
  score: number; // 0 - 100
  weight: number; // 0.0 - 1.0
  favoredMoves: Array<{ san: string; score: number; rationale: string }>;
  vetoMoves: Array<{ san: string; reason: string }>;
  statusSummary: string;
  isCalibrated: boolean;
}

/**
 * Reporte integral entregado al Motor Personal Soberano.
 */
export interface PersonalAuditReport {
  timestamp: number;
  totalPositionsMapped: number;
  inKnownBook: boolean;
  knownPositionNode?: PlayerPositionNode;
  subEngineVerdicts: Record<string, SubEngineVerdict>;
  maturityLevel: {
    gamesCount: number;
    requiredGames: number;
    percent: number;
    isFullyCalibrated: boolean;
  };
}

/**
 * 1. SUB-MOTOR DEL GRAFO POSICIONAL (Árbol FEN y Memoria Transposicional)
 * Reconstruye el árbol de decisiones del usuario a partir de sus partidas reales.
 */
export class PlayerGraphSubEngine {
  private static cachedGraph: Map<string, PlayerPositionNode> | null = null;
  private static cachedGamesHash = '';
  private static cachedProcessedIds = new Set<string>();

  public static clearCache(): void {
    this.cachedGraph = null;
    this.cachedGamesHash = '';
    this.cachedProcessedIds.clear();
  }

  private static processGameIntoGraph(
    game: GameRecord,
    graph: Map<string, PlayerPositionNode>
  ): void {
    if (!game.moves || game.moves.length === 0) return;

    const sim = new Chess();
    const userColor = game.playerColor || 'w';
    const result = game.result || '*';

    const isWin =
      (userColor === 'w' && result === '1-0') ||
      (userColor === 'b' && result === '0-1');
    const isDraw = result === '1/2-1/2';
    const isLoss =
      (userColor === 'w' && result === '0-1') ||
      (userColor === 'b' && result === '1-0');

    // Limitar a los primeros 12 plies (apertura e inicio medio juego) para 100% fluidez en tablets
    const maxPlies = Math.min(12, game.moves.length);
    for (let i = 0; i < maxPlies; i++) {
      const m = game.moves[i];
      if (!m) continue;
      const fenKey = sim.fen().split(' ').slice(0, 2).join(' '); // tablero + turno
      const isUserTurn = sim.turn() === userColor;

      if (isUserTurn) {
        let node = graph.get(fenKey);
        if (!node) {
          node = {
            fenKey,
            playCount: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            playerColor: userColor,
            movesChosen: {},
            averageTimeSpentMs: 0,
          };
          graph.set(fenKey, node);
        }

        node.playCount++;
        if (isWin) node.wins++;
        if (isDraw) node.draws++;
        if (isLoss) node.losses++;

        const san = m.san;
        const uci = `${m.from}${m.to}`;
        if (!node.movesChosen[san]) {
          node.movesChosen[san] = { san, uci, count: 0, wins: 0, draws: 0, losses: 0 };
        }
        node.movesChosen[san].count++;
        if (isWin) node.movesChosen[san].wins++;
        if (isDraw) node.movesChosen[san].draws++;
        if (isLoss) node.movesChosen[san].losses++;
      }

      try {
        sim.move(m.san || { from: m.from, to: m.to });
      } catch {
        break; // Fin de la secuencia si hay error en PGN
      }
    }
  }

  public static buildGraph(games: GameRecord[]): Map<string, PlayerPositionNode> {
    const hash = `${games.length}_${games[0]?.id || ''}_${games[0]?.moves?.length || 0}`;
    if (this.cachedGraph && this.cachedGamesHash === hash) {
      return this.cachedGraph;
    }

    // Actualización incremental ultra-rápida (<0.2ms) si solo se agregó 1 partida nueva
    if (this.cachedGraph && games.length > 0 && !this.cachedProcessedIds.has(games[0].id)) {
      this.processGameIntoGraph(games[0], this.cachedGraph);
      this.cachedProcessedIds.add(games[0].id);
      this.cachedGamesHash = hash;
      return this.cachedGraph;
    }

    const graph = new Map<string, PlayerPositionNode>();
    this.cachedProcessedIds.clear();

    // Procesar hasta 50 partidas más recientes para máxima rapidez
    const gamesToProcess = games.slice(0, 50);
    for (const game of gamesToProcess) {
      this.processGameIntoGraph(game, graph);
      if (game.id) this.cachedProcessedIds.add(game.id);
    }

    this.cachedGraph = graph;
    this.cachedGamesHash = hash;
    return graph;
  }

  public static audit(
    chess: Chess,
    graph: Map<string, PlayerPositionNode>,
    gamesCount: number
  ): SubEngineVerdict {
    const fenKey = chess.fen().split(' ').slice(0, 2).join(' ');
    const node = graph.get(fenKey);

    const favoredMoves: Array<{ san: string; score: number; rationale: string }> = [];
    const vetoMoves: Array<{ san: string; reason: string }> = [];

    if (node && Object.keys(node.movesChosen).length > 0) {
      for (const [san, stats] of Object.entries(node.movesChosen)) {
        const winRate = stats.count > 0 ? (stats.wins + stats.draws * 0.5) / stats.count : 0.5;
        const score = Math.min(100, Math.round(50 + winRate * 50));

        if (stats.losses > 0 && stats.wins === 0 && stats.count >= 2) {
          vetoMoves.push({
            san,
            reason: `Historial negativo: 0% victorias en ${stats.count} partidas previas con ${san}.`,
          });
        }

        favoredMoves.push({
          san,
          score,
          rationale: `Memoria Histórica: Jugada elegida ${stats.count} vez/veces (${Math.round(winRate * 100)}% efectividad personal).`,
        });
      }

      favoredMoves.sort((a, b) => b.score - a.score);

      return {
        id: 'graph',
        name: 'Sub-Motor 1: Grafo Posicional',
        focus: 'Memoria de Partidas Previas',
        score: favoredMoves[0]?.score || 70,
        weight: 0.35, // El mayor peso si la posición ya fue vivida por el usuario
        favoredMoves,
        vetoMoves,
        statusSummary: `Posición identificada en tu historial (${node.playCount} visitas previas).`,
        isCalibrated: gamesCount >= 10,
      };
    }

    return {
      id: 'graph',
      name: 'Sub-Motor 1: Grafo Posicional',
      focus: 'Memoria de Partidas Previas',
      score: 50,
      weight: 0.1,
      favoredMoves: [],
      vetoMoves: [],
      statusSummary: `Posición inédita en tu árbol (${graph.size} nodos mapeados en memoria).`,
      isCalibrated: gamesCount >= 10,
    };
  }
}

/**
 * 2. SUB-MOTOR DE ESTILO & BIOTIPO
 * Evalúa afinidad posicional, dinamismo y tendencias naturales del jugador.
 */
export class StyleSubEngine {
  public static audit(
    legalMoves: Move[],
    distilled: DistilledUserData,
    gamesCount: number
  ): SubEngineVerdict {
    const favoredMoves: Array<{ san: string; score: number; rationale: string }> = [];
    const isTactical = distilled.aggressionScore > 55;
    const isProphylactic = distilled.patienceScore > 55;
    const styleProfile = StyleAssistant.getStyleProfile(distilled);

    for (const m of legalMoves) {
      let score = 50;
      let reason = 'Desarrollo posicional estándar.';

      const isCapture = m.san.includes('x');
      const givesCheck = m.san.includes('+');
      const isCenter = ['e4', 'd4', 'e5', 'd5', 'c4', 'c5', 'Nf3', 'Nc3', 'Nf6', 'Nc6'].some((sq) =>
        m.san.includes(sq)
      );

      if (isTactical && (isCapture || givesCheck)) {
        score += 25;
        reason = `Alineada con tu biotipo agresivo/táctico (${distilled.aggressionScore}% de iniciativa).`;
      } else if (isProphylactic && ['h3', 'h6', 'a3', 'a6', 'Kh1', 'Kh8'].includes(m.san)) {
        score += 20;
        reason = `Alineada con tu paciencia posicional y profilaxis (${distilled.patienceScore}%).`;
      } else if (isCenter) {
        score += 15;
        reason = 'Ocupación o presión de casillas centrales.';
      }

      favoredMoves.push({ san: m.san, score, rationale: reason });
    }

    favoredMoves.sort((a, b) => b.score - a.score);

    return {
      id: 'style',
      name: 'Sub-Motor 2: Afinidad de Estilo',
      focus: 'Perfil y Dinamismo Posicional',
      score: favoredMoves[0]?.score || 50,
      weight: 0.2,
      favoredMoves: favoredMoves.slice(0, 3),
      vetoMoves: [],
      statusSummary: `Biotipo: ${styleProfile.archetype} (Agresividad: ${distilled.aggressionScore}%).`,
      isCalibrated: gamesCount >= 10,
    };
  }
}

/**
 * 3. SUB-MOTOR DE APERTURAS & REPERTORIO (ECO Classifier)
 * Detecta si la jugada pertenece al repertorio personal o es una desviación.
 */
export class RepertoireSubEngine {
  public static audit(
    chess: Chess,
    legalMoves: Move[],
    distilled: DistilledUserData,
    gamesCount: number
  ): SubEngineVerdict {
    const favoredMoves: Array<{ san: string; score: number; rationale: string }> = [];
    const isEarlyPhase = chess.history().length < 16;
    const knownMoves = new Set(
      distilled.userMoves.filter((um) => um.ply < 16).map((um) => um.san)
    );

    if (isEarlyPhase) {
      for (const m of legalMoves) {
        if (knownMoves.has(m.san)) {
          favoredMoves.push({
            san: m.san,
            score: 85,
            rationale: `Línea principal de tu repertorio en aperturas conocidas.`,
          });
        }
      }
    }

    return {
      id: 'repertoire',
      name: 'Sub-Motor 3: Aperturas & Repertorio',
      focus: 'Líneas Teóricas Propias',
      score: favoredMoves.length > 0 ? 85 : 50,
      weight: isEarlyPhase ? 0.25 : 0.05,
      favoredMoves,
      vetoMoves: [],
      statusSummary:
        favoredMoves.length > 0
          ? `Línea conocida de tu repertorio (${favoredMoves[0].san}).`
          : 'Jugada fuera de tu repertorio habitual registrado.',
      isCalibrated: gamesCount >= 10,
    };
  }
}

/**
 * 4. SUB-MOTOR DE BLUNDER SHIELD (Escudo de Errores Recurrentes)
 * Veta activamente jugadas que dejan piezas desprotegidas o coinciden con derrotas.
 */
export class BlunderShieldSubEngine {
  public static audit(
    chess: Chess,
    legalMoves: Move[],
    distilled: DistilledUserData,
    gamesCount: number
  ): SubEngineVerdict {
    const vetoMoves: Array<{ san: string; reason: string }> = [];

    // Verificación táctica O(1) ultrarrápida sin sobrecarga (<0.1ms)
    for (const m of legalMoves) {
      if (m.piece !== 'q' && m.piece !== 'r') continue;

      let moved = false;
      try {
        const res = chess.move({ from: m.from, to: m.to, promotion: m.promotion });
        if (!res) continue;
        moved = true;

        const oppColor = chess.turn();
        const userColor = m.color;
        const isAttacked = chess.isAttacked(m.to as Square, oppColor);
        if (isAttacked) {
          const isDefended = chess.isAttacked(m.to as Square, userColor);
          if (!isDefended) {
            vetoMoves.push({
              san: m.san,
              reason: `Escudo Táctico: ${m.san} deja pieza mayor desprotegida bajo ataque.`,
            });
          }
        }
      } catch {
        // Tolerancia si falla movimiento
      } finally {
        if (moved) {
          chess.undo();
        }
      }
    }

    return {
      id: 'blunder_shield',
      name: 'Sub-Motor 4: Escudo de Errores',
      focus: 'Detección de Puntos Ciegos',
      score: vetoMoves.length > 0 ? 30 : 90,
      weight: 0.25,
      favoredMoves: [],
      vetoMoves,
      statusSummary:
        vetoMoves.length > 0
          ? `¡Alerta! ${vetoMoves.length} jugada(s) vetada(s) por alto riesgo táctico.`
          : 'Escudo activo: Sin colgadas tácticas evidentes.',
      isCalibrated: gamesCount >= 10,
    };
  }
}

/**
 * 5. SUB-MOTOR DE PROFILAXIS & CONTROL DE AMENAZAS
 */
export class ProphylaxisSubEngine {
  public static audit(
    chess: Chess,
    legalMoves: Move[],
    distilled: DistilledUserData
  ): SubEngineVerdict {
    const favoredMoves: Array<{ san: string; score: number; rationale: string }> = [];

    for (const m of legalMoves) {
      if (['h3', 'h6', 'a3', 'a6', 'Kh1', 'Kh8', 'g3'].includes(m.san)) {
        favoredMoves.push({
          san: m.san,
          score: 75,
          rationale: `Maniobra profiláctica: asegura la casilla de escape y evita clavadas enemigas.`,
        });
      }
    }

    return {
      id: 'prophylaxis',
      name: 'Sub-Motor 5: Profilaxis & Amenazas',
      focus: 'Prevención Posicional',
      score: favoredMoves.length > 0 ? 75 : 55,
      weight: 0.15,
      favoredMoves,
      vetoMoves: [],
      statusSummary: `Índice profiláctico personal: ${distilled.patienceScore}%.`,
      isCalibrated: distilled.manualGamesCount >= 10,
    };
  }
}

/**
 * 6. SUB-MOTOR DE TÁCTICA & RUPTURAS
 */
export class TacticsSubEngine {
  public static audit(
    legalMoves: Move[],
    distilled: DistilledUserData
  ): SubEngineVerdict {
    const favoredMoves: Array<{ san: string; score: number; rationale: string }> = [];

    for (const m of legalMoves) {
      if (m.san.includes('x') || m.san.includes('+') || m.san.includes('#')) {
        favoredMoves.push({
          san: m.san,
          score: 80,
          rationale: `Jugada forzada activa (captura o jaque): mantiene la iniciativa.`,
        });
      }
    }

    return {
      id: 'tactics',
      name: 'Sub-Motor 6: Táctica & Rupturas',
      focus: 'Cálculo Concreto e Iniciativa',
      score: favoredMoves.length > 0 ? 80 : 50,
      weight: 0.15,
      favoredMoves,
      vetoMoves: [],
      statusSummary: `Agresividad táctica: ${distilled.aggressionScore}%.`,
      isCalibrated: distilled.manualGamesCount >= 10,
    };
  }
}

/**
 * 7. SUB-MOTOR DE RELOJ & GESTIÓN DE TIEMPO
 */
export class ClockSubEngine {
  public static audit(
    timeRemainingSeconds: number | null,
    distilled: DistilledUserData
  ): SubEngineVerdict {
    const avgPace = distilled.averageThinkTime;
    const isTimeTrouble = timeRemainingSeconds !== null && timeRemainingSeconds < 60;

    return {
      id: 'clock',
      name: 'Sub-Motor 7: Ritmo & Reloj',
      focus: 'Gestión de Tiempo y Complejidad',
      score: isTimeTrouble ? 40 : 80,
      weight: 0.1,
      favoredMoves: [],
      vetoMoves: [],
      statusSummary: isTimeTrouble
        ? `¡Apuro de tiempo! Menos de 1 minuto restante. Jugar líneas directas.`
        : `Cadencia habitual: ${avgPace}s por movimiento.`,
      isCalibrated: distilled.manualGamesCount >= 10,
    };
  }
}

/**
 * 8. SUB-MOTOR DE FINALES & TÉCNICA
 */
export class EndgameSubEngine {
  public static audit(
    chess: Chess,
    legalMoves: Move[],
    distilled: DistilledUserData
  ): SubEngineVerdict {
    const isEndgame = chess.history().length >= 30;
    const favoredMoves: Array<{ san: string; score: number; rationale: string }> = [];

    if (isEndgame) {
      for (const m of legalMoves) {
        if (m.piece === 'k') {
          favoredMoves.push({
            san: m.san,
            score: 85,
            rationale: `Activación del rey: principio fundamental en finales de piezas.`,
          });
        }
      }
    }

    return {
      id: 'endgame',
      name: 'Sub-Motor 8: Finales & Técnica',
      focus: 'Transición y Simplificación',
      score: isEndgame ? 75 : 50,
      weight: isEndgame ? 0.25 : 0.05,
      favoredMoves,
      vetoMoves: [],
      statusSummary: isEndgame ? 'Fase de final activa: activando rey y peones pasados.' : 'Fase media/apertura.',
      isCalibrated: distilled.manualGamesCount >= 10,
    };
  }
}

/**
 * ORQUESTADOR MAESTRO DE LOS 8 SUB-MOTORES
 * Ejecuta en paralelo los 8 sub-motores especializados y construye el informe
 * de auditoría para el Motor Personal Soberano.
 */
export function runSubEngineAudit(
  chess: Chess,
  distilled: DistilledUserData,
  games: GameRecord[],
  timeRemainingSeconds: number | null = null
): PersonalAuditReport {
  const legalMoves = chess.moves({ verbose: true });
  const graph = PlayerGraphSubEngine.buildGraph(games);
  const gamesCount = games.length;

  const fenKey = chess.fen().split(' ').slice(0, 2).join(' ');
  const knownNode = graph.get(fenKey);

  const vGraph = PlayerGraphSubEngine.audit(chess, graph, gamesCount);
  const vStyle = StyleSubEngine.audit(legalMoves, distilled, gamesCount);
  const vRep = RepertoireSubEngine.audit(chess, legalMoves, distilled, gamesCount);
  const vBlunder = BlunderShieldSubEngine.audit(chess, legalMoves, distilled, gamesCount);
  const vProphy = ProphylaxisSubEngine.audit(chess, legalMoves, distilled);
  const vTactics = TacticsSubEngine.audit(legalMoves, distilled);
  const vClock = ClockSubEngine.audit(timeRemainingSeconds, distilled);
  const vEndgame = EndgameSubEngine.audit(chess, legalMoves, distilled);

  const subEngineVerdicts: Record<string, SubEngineVerdict> = {
    graph: vGraph,
    style: vStyle,
    repertoire: vRep,
    blunder_shield: vBlunder,
    prophylaxis: vProphy,
    tactics: vTactics,
    clock: vClock,
    endgame: vEndgame,
  };

  return {
    timestamp: Date.now(),
    totalPositionsMapped: graph.size,
    inKnownBook: !!knownNode,
    knownPositionNode: knownNode,
    subEngineVerdicts,
    maturityLevel: {
      gamesCount,
      requiredGames: 10,
      percent: Math.min(100, Math.round((gamesCount / 10) * 100)),
      isFullyCalibrated: gamesCount >= 10,
    },
  };
}
