import { Chess } from 'chess.js';
import { GameRecord, MoveSource } from '../types/chess';
import { lookupTheory } from './theoryBook';

export interface DistilledMoveData {
  san: string;
  from: string;
  to: string;
  ply: number;
  gameId: string;
  thinkTimeSeconds: number;
  fenBefore: string;
  isOpening: boolean;
  isCapture: boolean;
  isCheck: boolean;
  isProphylactic: boolean;
  piece: string;
}

export interface DistilledUserData {
  totalGamesAnalyzed: number;
  manualGamesCount: number;
  rawPgnBytes: number;
  distilledBytes: number;
  userMoves: DistilledMoveData[];
  discardedIaMovesCount: number;
  discardedBookMovesCount: number;
  topOpenings: Array<{ name: string; count: number; wins: number }>;
  averageThinkTime: number;
  aggressionScore: number;
  patienceScore: number;
  checksCount: number;
  capturesCount: number;
  queenMovesCount: number;
  endgameMovesCount: number;
}

/**
 * 1. AYUDANTE DE HISTORIAL
 * Sistema de filtrado y destilación estricta.
 * Analiza el historial, discrimina jugadas de libro y jugadas asistidas con IA (Stockfish, Garbo, etc.).
 * Descarta jugadas no manuales, comprimiendo la memoria pura del jugador a ~10 KB.
 */
export class HistoryAssistant {
  public static analyzeAndDistill(games: GameRecord[]): DistilledUserData {
    let rawBytes = 0;
    let distilledBytes = 0;
    let discardedIaCount = 0;
    let discardedBookCount = 0;
    const userMoves: DistilledMoveData[] = [];
    const openingStats = new Map<string, { count: number; wins: number }>();
    let manualGamesCount = 0;
    let totalThinkTime = 0;
    let captureMovesCount = 0;
    let checkMovesCount = 0;
    let quietMovesCount = 0;
    let queenMovesCount = 0;
    let endgameMovesCount = 0;

    for (const game of games) {
      const pgnLength = (game.pgn || '').length;
      rawBytes += Math.max(pgnLength, (game.moves?.length || 0) * 120);

      const moves = game.moves || [];
      const hasManualMoves = moves.some((m) => m.source === 'MANUAL');
      if (hasManualMoves || moves.length > 0) {
        manualGamesCount++;
      }

      const isWin = (game.playerColor === 'w' && game.result === '1-0') ||
                    (game.playerColor === 'b' && game.result === '0-1');

      const tempChess = new Chess();
      for (let i = 0; i < moves.length; i++) {
        const m = moves[i];
        const isUserTurn = (i % 2 === 0 && game.playerColor === 'w') || (i % 2 === 1 && game.playerColor === 'b');

        // Check if move was assisted by AI buttons
        const isIaAssisted = m.source && m.source !== 'MANUAL';
        if (isIaAssisted) {
          discardedIaCount++;
          try {
            tempChess.move(m.san || { from: m.from, to: m.to });
          } catch {
            // ignore
          }
          continue;
        }

        // Check if move is purely theoretical book move
        const historySoFar = tempChess.history();
        const theory = lookupTheory(historySoFar);
        if (theory.isBook && i < 8) {
          discardedBookCount++;
          try {
            tempChess.move(m.san || { from: m.from, to: m.to });
          } catch {
            // ignore
          }
          continue;
        }

        // Only register user's own manual moves
        if (isUserTurn) {
          const san = m.san || '';
          const isCapture = san.includes('x');
          const isCheck = san.includes('+');
          const isProphylactic = ['h3', 'a3', 'h6', 'a6', 'Kh1', 'Kh8', 'g3', 'g6'].some((s) => san.startsWith(s));
          const piece = san.startsWith('N') ? 'N' : san.startsWith('B') ? 'B' : san.startsWith('R') ? 'R' : san.startsWith('Q') ? 'Q' : san.startsWith('K') ? 'K' : 'P';

          if (isCapture) captureMovesCount++;
          if (isCheck) checkMovesCount++;
          if (!isCapture && !isCheck) quietMovesCount++;
          if (piece === 'Q') queenMovesCount++;
          if (i >= 30) endgameMovesCount++;

          const think = m.thinkTime || 12;
          totalThinkTime += think;

          const moveObj: DistilledMoveData = {
            san,
            from: m.from,
            to: m.to,
            ply: m.ply || i + 1,
            gameId: game.id,
            thinkTimeSeconds: think,
            fenBefore: tempChess.fen(),
            isOpening: i < 14,
            isCapture,
            isCheck,
            isProphylactic,
            piece,
          };

          userMoves.push(moveObj);
          distilledBytes += 48; // ~48 bytes per pure distilled move
        }

        try {
          tempChess.move(m.san || { from: m.from, to: m.to });
        } catch {
          // ignore
        }
      }

      if (game.openingName) {
        const cur = openingStats.get(game.openingName) || { count: 0, wins: 0 };
        cur.count += 1;
        if (isWin) cur.wins += 1;
        openingStats.set(game.openingName, cur);
      }
    }

    const topOpenings = Array.from(openingStats.entries())
      .map(([name, data]) => ({ name, count: data.count, wins: data.wins }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const totalUserMoves = userMoves.length;
    const avgThink = totalUserMoves > 0 ? Math.round(totalThinkTime / totalUserMoves) : 0;
    const aggression = totalUserMoves > 0 ? Math.round(((captureMovesCount + checkMovesCount) / totalUserMoves) * 100) : 0;
    const patience = totalUserMoves > 0 ? Math.round((quietMovesCount / totalUserMoves) * 100) : 0;

    return {
      totalGamesAnalyzed: games.length,
      manualGamesCount,
      rawPgnBytes: rawBytes,
      distilledBytes,
      userMoves,
      discardedIaMovesCount: discardedIaCount,
      discardedBookMovesCount: discardedBookCount,
      topOpenings,
      averageThinkTime: avgThink,
      aggressionScore: Math.min(95, Math.max(0, aggression)),
      patienceScore: Math.min(95, Math.max(0, patience)),
      checksCount: checkMovesCount,
      capturesCount: captureMovesCount,
      queenMovesCount,
      endgameMovesCount,
    };
  }
}

/**
 * 2. AYUDANTE DE ESTILO
 * Evalúa jugadas candidatas frente a los datos puros destilados por el Ayudante de Historial
 * y calcula la afinidad de estilo de 1.0 a 10.0.
 */
export class StyleAssistant {
  public static scoreMove(
    chess: Chess,
    moveSan: string,
    from: string,
    to: string,
    distilled: DistilledUserData
  ): { score: number; explanation: string } {
    if (distilled.manualGamesCount < 10 || distilled.userMoves.length === 0) {
      return { score: 5.0, explanation: 'Calibración insuficiente (<10 partidas del jugador).' };
    }

    let score = 6.0;
    const isCapture = moveSan.includes('x');
    const isCheck = moveSan.includes('+');
    const isAdvance = ['e4', 'd4', 'c4', 'f4', 'e5', 'd5'].includes(to);

    if ((isCapture || isCheck) && distilled.aggressionScore > 50) {
      score += 2.0;
    } else if (!isCapture && !isCheck && distilled.patienceScore > 50) {
      score += 1.8;
    }

    const currentPly = chess.history().length + 1;
    const matchHistory = distilled.userMoves.find(
      (m) => m.san === moveSan && Math.abs(m.ply - currentPly) <= 4
    );

    if (matchHistory) {
      score += 2.2;
      return {
        score: Math.min(10, Number(score.toFixed(1))),
        explanation: `Afinidad 10/10: Has elegido ${moveSan} en posiciones análogas en tus partidas.`,
      };
    }

    if (isAdvance) {
      score += 1.0;
    }

    return {
      score: Math.min(9.8, Math.max(1.0, Number(score.toFixed(1)))),
      explanation: `Puntuación de estilo ${score.toFixed(1)}/10 basada en tus patrones de juego reales.`,
    };
  }

  public static getStyleProfile(distilled: DistilledUserData): {
    archetype: string;
    description: string;
    aggressiveness: number;
    patience: number;
  } {
    if (distilled.manualGamesCount === 0) {
      return {
        archetype: 'Sin calibrar',
        description: 'Requiere jugar partidas manuales para medir tus preferencias de juego.',
        aggressiveness: 0,
        patience: 0,
      };
    }

    const agg = distilled.aggressionScore;
    const pat = distilled.patienceScore;

    let archetype = 'Equilibrado Dinámico';
    let description = 'Alternancia entre juego activo de piezas y maniobras posicionales.';

    if (agg >= 60) {
      archetype = 'Atacante Agresivo';
      description = 'Búsqueda constante de rupturas, capturas y presión directa sobre el rey.';
    } else if (pat >= 65) {
      archetype = 'Sólido Posicional';
      description = 'Preferencia por el control territorial, profilaxis y consolidación de estructuras.';
    }

    return {
      archetype,
      description,
      aggressiveness: agg,
      patience: pat,
    };
  }
}

/**
 * 3. AYUDANTE DE APERTURAS & REPERTORIO
 * Aísla las jugadas de apertura del usuario y detecta sus líneas predilectas con blancas y negras.
 */
export class OpeningRepertoireAssistant {
  public static getRepertoireSummary(distilled: DistilledUserData): {
    hasData: boolean;
    topList: Array<{ name: string; count: number; winRatePct: number }>;
    favoriteMoveWhite: string;
    favoriteMoveBlack: string;
  } {
    if (distilled.manualGamesCount === 0 || distilled.topOpenings.length === 0) {
      return {
        hasData: false,
        topList: [],
        favoriteMoveWhite: '—',
        favoriteMoveBlack: '—',
      };
    }

    const topList = distilled.topOpenings.map((op) => ({
      name: op.name,
      count: op.count,
      winRatePct: op.count > 0 ? Math.round((op.wins / op.count) * 100) : 0,
    }));

    const firstWhiteMoves = distilled.userMoves.filter((m) => m.ply === 1);
    const firstBlackMoves = distilled.userMoves.filter((m) => m.ply === 2);

    const favWhite = firstWhiteMoves.length > 0 ? firstWhiteMoves[0].san : 'e4 / d4';
    const favBlack = firstBlackMoves.length > 0 ? firstBlackMoves[0].san : 'c5 / e5';

    return {
      hasData: true,
      topList,
      favoriteMoveWhite: favWhite,
      favoriteMoveBlack: favBlack,
    };
  }
}

/**
 * 4. AYUDANTE DE ERRORES RECURRENTES
 * Identifica patrones de despiste o jugadas apresuradas bajo tensión en las partidas del jugador.
 */
export class MistakeTrackerAssistant {
  public static checkRecurrentRisk(chess: Chess, moveSan: string): string | null {
    if (chess.inCheck() && moveSan.includes('K')) {
      return 'Alerta recurrente: Mover el rey en lugar de cubrir suele debilitar la estructura del enroque.';
    }
    return null;
  }

  public static getTrackedMistakes(distilled: DistilledUserData): Array<{
    pattern: string;
    frequency: number;
    severity: 'Alta' | 'Media' | 'Baja';
    advice: string;
  }> {
    if (distilled.manualGamesCount === 0) {
      return [];
    }

    const results: Array<{ pattern: string; frequency: number; severity: 'Alta' | 'Media' | 'Baja'; advice: string }> = [];

    // Check premature queen sorties
    const earlyQueenMoves = distilled.userMoves.filter((m) => m.piece === 'Q' && m.ply < 8);
    if (earlyQueenMoves.length >= 2) {
      results.push({
        pattern: 'Salidas prematuras de Dama antes de desarrollar piezas menores',
        frequency: earlyQueenMoves.length,
        severity: 'Media',
        advice: 'Desarrolla primero caballos y alfiles para no perder tiempos de dama.',
      });
    }

    // Check hasty king walks
    const kingMovesUnderPressure = distilled.userMoves.filter((m) => m.piece === 'K' && m.ply < 24 && !m.san.includes('O-O'));
    if (kingMovesUnderPressure.length >= 2) {
      results.push({
        pattern: 'Desplazamiento del Rey perdiendo el enroque bajo presión',
        frequency: kingMovesUnderPressure.length,
        severity: 'Alta',
        advice: 'Prioriza interponer piezas o neutralizar la clavada antes de mover el rey.',
      });
    }

    return results;
  }
}

/**
 * 5. AYUDANTE DE PROFILAXIS Y PACIENCIA
 * Mide la tendencia del usuario a maniobrar, asegurar el rey y prevenir amenazas rivales.
 */
export class ProphylaxisPatienceAssistant {
  public static calculateSummary(distilled: DistilledUserData): {
    score: number;
    quietMovesCount: number;
    prophylacticMovesCount: number;
    evaluation: string;
  } {
    if (distilled.manualGamesCount === 0) {
      return {
        score: 0,
        quietMovesCount: 0,
        prophylacticMovesCount: 0,
        evaluation: 'Sin partidas para evaluar paciencia profiláctica.',
      };
    }

    const prophyMoves = distilled.userMoves.filter((m) => m.isProphylactic).length;
    const quietMoves = distilled.userMoves.filter((m) => !m.isCapture && !m.isCheck).length;

    let evaluation = 'Moderada capacidad de espera antes de abrir la posición.';
    if (distilled.patienceScore >= 65) {
      evaluation = 'Alta resiliencia: Maniobras pacientes y excelente resguardo defensivo.';
    } else if (distilled.patienceScore <= 35) {
      evaluation = 'Baja paciencia: Tendencia a forzar el contacto directo con prontitud.';
    }

    return {
      score: distilled.patienceScore,
      quietMovesCount: quietMoves,
      prophylacticMovesCount: prophyMoves,
      evaluation,
    };
  }
}

/**
 * 6. AYUDANTE DE TÁCTICA Y AGRESIVIDAD
 * Mide el porcentaje de juego ofensivo, jaques, capturas e iniciativa directa.
 */
export class TacticsAggressionAssistant {
  public static calculateSummary(distilled: DistilledUserData): {
    score: number;
    checksCount: number;
    capturesCount: number;
    tacticalDensityPct: number;
    evaluation: string;
  } {
    if (distilled.manualGamesCount === 0) {
      return {
        score: 0,
        checksCount: 0,
        capturesCount: 0,
        tacticalDensityPct: 0,
        evaluation: 'Sin partidas para medir agresividad táctica.',
      };
    }

    const total = Math.max(1, distilled.userMoves.length);
    const tacticalMoves = distilled.checksCount + distilled.capturesCount;
    const tacticalDensityPct = Math.round((tacticalMoves / total) * 100);

    let evaluation = 'Equilibrio estándar entre cálculo táctico y juego de desarrollo.';
    if (distilled.aggressionScore >= 60) {
      evaluation = 'Alta agresividad: Fuerte inclinación hacia golpes tácticos e iniciativa.';
    } else if (distilled.aggressionScore <= 35) {
      evaluation = 'Perfil cauto: Evita complicaciones agudas hasta consolidar ventajas.';
    }

    return {
      score: distilled.aggressionScore,
      checksCount: distilled.checksCount,
      capturesCount: distilled.capturesCount,
      tacticalDensityPct,
      evaluation,
    };
  }
}

/**
 * 7. AYUDANTE DE GESTIÓN DEL TIEMPO Y RITMO
 * Analiza el ritmo medio de toma de decisiones del usuario y previene apuros de reloj.
 */
export class TimePaceAssistant {
  public static calculateSummary(distilled: DistilledUserData): {
    averageSeconds: number;
    cadenceCategory: string;
    timePressureAlert: boolean;
    recommendation: string;
  } {
    if (distilled.manualGamesCount === 0) {
      return {
        averageSeconds: 0,
        cadenceCategory: 'Sin datos',
        timePressureAlert: false,
        recommendation: 'Juega partidas para registrar tus cadencias de pensamiento.',
      };
    }

    const avg = distilled.averageThinkTime;
    let cadenceCategory = 'Pausado / Reflexivo';
    let recommendation = 'Buen ritmo de análisis. Mantén el foco en posiciones críticas.';
    let timePressureAlert = false;

    if (avg < 5) {
      cadenceCategory = 'Ultra Rápido / Impulsivo';
      recommendation = 'Atención: Estás jugando con demasiada prisa. Dedica al menos 8-12s en decisiones clave.';
      timePressureAlert = true;
    } else if (avg > 25) {
      cadenceCategory = 'Muy Lento / Profundo';
      recommendation = 'Precaución con apuros de tiempo en fases tardías.';
      timePressureAlert = true;
    }

    return {
      averageSeconds: avg,
      cadenceCategory,
      timePressureAlert,
      recommendation,
    };
  }
}

/**
 * 8. AYUDANTE DE TRANSICIÓN Y FINALES
 * Mide la tendencia a simplificar damas y la eficacia en finales de piezas.
 */
export class EndgameTransitionAssistant {
  public static calculateSummary(distilled: DistilledUserData): {
    endgameMovesCount: number;
    endgameExperienceRating: string;
    queenTradeFrequency: string;
    advice: string;
  } {
    if (distilled.manualGamesCount === 0) {
      return {
        endgameMovesCount: 0,
        endgameExperienceRating: 'Sin partidas',
        queenTradeFrequency: '—',
        advice: 'Se medirá la capacidad en finales al alcanzar jugadas 30+ en partidas.',
      };
    }

    let rating = 'Frecuente llegada a finales';
    if (distilled.endgameMovesCount < 10) {
      rating = 'Partidas resueltas en medio juego';
    }

    return {
      endgameMovesCount: distilled.endgameMovesCount,
      endgameExperienceRating: rating,
      queenTradeFrequency: distilled.queenMovesCount > 0 ? 'Equilibrada' : 'Temprana',
      advice: 'Activar el rey hacia el centro en cuanto desaparezcan las damas.',
    };
  }
}

export interface AssistantsFullDashboard {
  distilled: DistilledUserData;
  history: {
    totalGames: number;
    manualGames: number;
    distilledBytes: number;
    rawPgnBytes: number;
    compressionPct: number;
    discardedIa: number;
    discardedBook: number;
    isCalibrated: boolean;
  };
  style: ReturnType<typeof StyleAssistant.getStyleProfile>;
  openings: ReturnType<typeof OpeningRepertoireAssistant.getRepertoireSummary>;
  mistakes: ReturnType<typeof MistakeTrackerAssistant.getTrackedMistakes>;
  patience: ReturnType<typeof ProphylaxisPatienceAssistant.calculateSummary>;
  tactics: ReturnType<typeof TacticsAggressionAssistant.calculateSummary>;
  time: ReturnType<typeof TimePaceAssistant.calculateSummary>;
  endgame: ReturnType<typeof EndgameTransitionAssistant.calculateSummary>;
}

export function computeAssistantsDashboard(games: GameRecord[]): AssistantsFullDashboard {
  const distilled = HistoryAssistant.analyzeAndDistill(games);
  const compressionPct = distilled.rawPgnBytes > 0
    ? Math.round(((distilled.rawPgnBytes - distilled.distilledBytes) / distilled.rawPgnBytes) * 100)
    : 0;

  return {
    distilled,
    history: {
      totalGames: distilled.totalGamesAnalyzed,
      manualGames: distilled.manualGamesCount,
      distilledBytes: distilled.distilledBytes,
      rawPgnBytes: distilled.rawPgnBytes,
      compressionPct: Math.max(0, compressionPct),
      discardedIa: distilled.discardedIaMovesCount,
      discardedBook: distilled.discardedBookMovesCount,
      isCalibrated: distilled.manualGamesCount >= 10,
    },
    style: StyleAssistant.getStyleProfile(distilled),
    openings: OpeningRepertoireAssistant.getRepertoireSummary(distilled),
    mistakes: MistakeTrackerAssistant.getTrackedMistakes(distilled),
    patience: ProphylaxisPatienceAssistant.calculateSummary(distilled),
    tactics: TacticsAggressionAssistant.calculateSummary(distilled),
    time: TimePaceAssistant.calculateSummary(distilled),
    endgame: EndgameTransitionAssistant.calculateSummary(distilled),
  };
}
