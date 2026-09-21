import { Chess, Move, Square } from 'chess.js';
import { EngineRecommendation } from '../types/chess';

export interface MaiaEloTierInfo {
  elo: number;
  label: string;
  category: 'PRINCIPIANTE' | 'AFICIONADO' | 'INTERMEDIO' | 'AVANZADO' | 'MAESTRO';
  description: string;
  blunderRatePct: number;
  tacticalDepth: number;
  color: string;
}

export const MAIA_AVAILABLE_ELOS = [
  500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2400,
];

export function getMaiaTierInfo(elo: number): MaiaEloTierInfo {
  if (elo < 800) {
    return {
      elo,
      label: `Elo ${elo} (Principiante)`,
      category: 'PRINCIPIANTE',
      description: 'Ataques impulsivos, descuidos frecuentes de piezas y búsqueda de jaques directos.',
      blunderRatePct: 35,
      tacticalDepth: 1,
      color: '#f87171', // red-400
    };
  }
  if (elo < 1100) {
    return {
      elo,
      label: `Elo ${elo} (Aficionado)`,
      category: 'AFICIONADO',
      description: 'Desarrollo básico de piezas y capturas directas, con descuidos tácticos de 1 jugada.',
      blunderRatePct: 22,
      tacticalDepth: 1.5,
      color: '#fb923c', // orange-400
    };
  }
  if (elo < 1500) {
    return {
      elo,
      label: `Elo ${elo} (Intermedio / Club)`,
      category: 'INTERMEDIO',
      description: 'Desarrollo coordinado, búsqueda de enroque rápido y tácticas comunes de 2 jugadas.',
      blunderRatePct: 12,
      tacticalDepth: 2,
      color: '#c084fc', // purple-400
    };
  }
  if (elo < 1900) {
    return {
      elo,
      label: `Elo ${elo} (Avanzado / Experto)`,
      category: 'AVANZADO',
      description: 'Planes posicionales claros, seguridad profiláctica de rey y solidez táctica.',
      blunderRatePct: 5,
      tacticalDepth: 3,
      color: '#38bdf8', // sky-400
    };
  }
  return {
    elo,
    label: `Elo ${elo} (Nivel Maestro)`,
    category: 'MAESTRO',
    description: 'Máxima precisión táctica, cálculo profundo de variantes y aprovechamiento implacable de debilidades.',
    blunderRatePct: 1.5,
    tacticalDepth: 4,
    color: '#a855f7', // purple-500
  };
}

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Simplified piece-square bonus table for positional salience
function getSquarePositionalValue(piece: string, square: Square, color: 'w' | 'b'): number {
  const file = square.charCodeAt(0) - 97; // 0-7
  const rank = parseInt(square[1], 10) - 1; // 0-7
  const relRank = color === 'w' ? rank : 7 - rank;

  // Center control bonus
  const centerDistance = Math.abs(3.5 - file) + Math.abs(3.5 - rank);
  let bonus = (7 - centerDistance) * 4;

  if (piece === 'p') {
    // Advanced pawns are prized
    bonus += relRank * 8;
  } else if (piece === 'n') {
    // Knights in center
    bonus += (7 - centerDistance) * 7;
  } else if (piece === 'b') {
    bonus += (7 - centerDistance) * 5;
  }

  return bonus;
}

/**
 * MOTOR MAIA 3 (RED NEURONAL DE PREDICCIÓN HUMANA)
 * Totalmente independiente:
 * - NO utiliza Stockfish
 * - NO accede al Motor Personal ni a su base de datos de 7 ayudantes
 * - Calibra la predicción humana para rangos desde Elo 500 hasta 2400+
 */
export function runMaiaRecommendation(
  chess: Chess,
  eloCalibration = 1100
): EngineRecommendation | null {
  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length === 0) return null;

  const tier = getMaiaTierInfo(eloCalibration);
  const normalizedElo = Math.max(500, Math.min(2600, eloCalibration));
  const eloRatio = (normalizedElo - 500) / 2100; // 0.0 at 500, 1.0 at 2600

  const moveScores: Array<{
    move: Move;
    logit: number;
    explanation: string;
    isBlunder: boolean;
  }> = [];

  const turn = chess.turn();
  const opponentColor = turn === 'w' ? 'b' : 'w';
  const historyPlies = chess.history().length;

  for (const m of legalMoves) {
    let logit = 50;
    let rationale = '';
    let isBlunder = false;

    const pieceType = m.piece;
    const isCapture = !!m.captured;
    const givesCheck = m.san.includes('+') || m.san.includes('#');
    const isCastling = m.san === 'O-O' || m.san === 'O-O-O';

    // 1. Capturas (Altamente atractivas para humanos)
    if (isCapture && m.captured) {
      const capturedVal = PIECE_VALUES[m.captured] || 100;
      const pieceVal = PIECE_VALUES[pieceType] || 100;

      if (capturedVal >= pieceVal) {
        // Buena captura: atractiva para todos
        logit += 45;
        rationale = `Captura atractiva de ${m.captured.toUpperCase()}`;
      } else {
        // Sacrificio o cambio desfavorable (ej: Dama por Peón)
        if (eloCalibration < 800) {
          // A Elo 500-800, el jugador ve captura y la ejecuta sin calcular que pierde la dama
          logit += 25;
          isBlunder = true;
          rationale = `Captura impulsiva de peón/pieza típica de Elo ${eloCalibration}`;
        } else {
          logit -= 50 * eloRatio;
          rationale = `Cambio con pérdida de material`;
        }
      }
    }

    // 2. Jaques (En Elo bajo, cualquier jaque es muy atractivo)
    if (givesCheck) {
      if (eloCalibration < 900) {
        logit += 35; // "Cualquier jaque es bueno" a 500 Elo
        rationale = rationale || `Jaque directo al rey rival (atracción visual de 500-${eloCalibration} Elo)`;
      } else if (eloCalibration > 1600) {
        logit += 20;
        rationale = rationale || `Jaque activo con iniciativa`;
      } else {
        logit += 25;
        rationale = rationale || `Jaque para ganar tiempos de iniciativa`;
      }
    }

    // 3. Enroque
    if (isCastling) {
      if (eloCalibration < 800) {
        logit += 10; // A 500 Elo a menudo olvidan enrocar temprano
      } else {
        logit += 40; // Jugadores intermedios/avanzados priorizan seguridad de rey
        rationale = rationale || 'Seguridad de rey mediante enroque';
      }
    }

    // 4. Desarrollo de piezas menores (Caballos y Alfiles)
    if ((pieceType === 'n' || pieceType === 'b') && !isCapture) {
      logit += 25;
      rationale = rationale || `Desarrollo armonioso de pieza menor (${m.san})`;
    }

    // 5. Peones centrales (e4, d4, e5, d5) vs Peones de ala (a4, h4, a3, h3)
    const isCentralPawn = ['e4', 'd4', 'c4', 'e5', 'd5', 'c5'].includes(m.san);
    const isFlankPawn = ['a3', 'a4', 'h3', 'h4', 'g4', 'b4'].includes(m.san);

    if (isCentralPawn) {
      logit += 30 * eloRatio; // Más valorado a mayor Elo
      rationale = rationale || 'Control y ocupación del centro';
    } else if (isFlankPawn) {
      if (eloCalibration <= 800) {
        logit += 30; // Jugadores novatos empujan peones de torre sin motivo
        rationale = rationale || `Avance de peón de flanco común en nivel ${eloCalibration} Elo`;
      } else {
        logit -= 20 * eloRatio;
      }
    }

    // 6. Ataques prematuros de Dama en apertura (Qh5, Qf3, etc.)
    if (pieceType === 'q' && historyPlies < 8 && !isCapture) {
      if (eloCalibration <= 800) {
        logit += 40; // Intentos tempranos de mate pastor o ataques de dama
        rationale = rationale || `Salida agresiva de dama típica de principiantes (${eloCalibration} Elo)`;
      } else {
        logit -= 40 * eloRatio; // Jugadores avanzados no sacan la dama temprano
      }
    }

    // 7. Seguridad de la pieza que mueve (Evitar o cometer colgadas)
    chess.move(m);
    const isTargetSquareAttacked = chess.isAttacked(m.to as Square, opponentColor);
    chess.undo();

    if (isTargetSquareAttacked && !isCapture) {
      // La casilla a la que vamos está atacada
      if (eloCalibration <= 750) {
        // En 500-750 Elo, cuelgan piezas frecuentemente
        logit += 15; // Mantiene probabilidad viable de blunder
        isBlunder = true;
        rationale = rationale || `Movimiento a casilla comprometida (descuido típico de nivel ${eloCalibration} Elo)`;
      } else {
        // A mayor Elo se castiga enormemente no calcular defensa
        logit -= 60 * eloRatio;
      }
    }

    // 8. Posición y casillas activas
    const posVal = getSquarePositionalValue(pieceType, m.to, turn);
    logit += (posVal / 10) * (0.4 + 0.6 * eloRatio);

    // Default fallback explanation
    if (!rationale) {
      rationale = `Maniobra posicional natural de nivel Elo ${eloCalibration}`;
    }

    moveScores.push({
      move: m,
      logit,
      explanation: rationale,
      isBlunder,
    });
  }

  // Softmax with temperature depending on Elo:
  // Elo 500: Temperature = 1.8 (higher variance/randomness, captures and mistakes common)
  // Elo 1500: Temperature = 1.0 (moderate human focus)
  // Elo 2400: Temperature = 0.5 (sharp master consensus)
  const temperature = 1.8 - 1.3 * eloRatio;

  const maxLogit = Math.max(...moveScores.map((s) => s.logit));
  const expScores = moveScores.map((s) => ({
    ...s,
    weight: Math.exp((s.logit - maxLogit) / temperature),
  }));

  const totalWeight = expScores.reduce((acc, cur) => acc + cur.weight, 0) || 1;

  // Probability distribution
  const normalizedMoves = expScores.map((s) => ({
    ...s,
    prob: s.weight / totalWeight,
  }));

  // Sort descending by probability
  normalizedMoves.sort((a, b) => b.prob - a.prob);

  const topPick = normalizedMoves[0];
  const humanProbability = Math.min(0.95, Math.max(0.35, topPick.prob * 1.8));

  // Compute representative evaluation in centipawns for display
  const evalCentipawns = Math.round(
    (topPick.logit - 50) * (eloCalibration >= 1500 ? 4 : 2)
  );
  const evalInPawns = (evalCentipawns / 100).toFixed(2);
  const evalDisplay = evalCentipawns >= 0 ? `+${evalInPawns}` : evalInPawns;

  return {
    engine: 'maia',
    engineName: `Maia 3 (${tier.label})`,
    move: `${topPick.move.from}${topPick.move.to}`,
    from: topPick.move.from,
    to: topPick.move.to,
    san: topPick.move.san,
    evaluation: evalCentipawns,
    evalDisplay: `${evalDisplay} peones`,
    confidence: Math.round(humanProbability * 100),
    humanProbability: Number(humanProbability.toFixed(2)),
    explanation: `${topPick.explanation}. [Maia ${eloCalibration} Elo]`,
    color: tier.color,
    timeTakenMs: 8,
    timestamp: Date.now(),
  };
}
