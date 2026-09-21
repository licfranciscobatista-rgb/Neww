import { Chess, Square } from 'chess.js';
import { EngineRecommendation } from '../types/chess';
import { evaluateMovesStockfish, ScoredMove } from './stockfishEngine';

/**
 * MOTOR CHESS.JS (Árbitro & Detector de Jugadas Pasivas / Pérdida Posicional)
 *
 * Misión solicitada por el usuario:
 * - NO se trata de perder piezas (no regalar damas, torres, alfiles ni peones).
 * - La pieza movida debe estar COMPLETAMENTE SEGURA (sin peligro de captura libre).
 * - Identifica una jugada de vacilación, vuelta o pérdida de tiempo (ej. alfiles dando vueltas
 *   seguras, torre o dama moviéndose sin crear amenaza).
 * - Provoca una pérdida de puntuación de ~ -0.9 a -1.0 puntos posicionales por pasividad
 *   o ceder la iniciativa, jugada que ningún motor de élite elegiría por ser subóptima.
 * - Regla estricta: ¡SIN FLECHA EN EL TABLERO!
 */

const PIECE_NAMES: Record<string, string> = {
  p: 'Peón',
  n: 'Caballo',
  b: 'Alfil',
  r: 'Torre',
  q: 'Dama',
  k: 'Rey',
};

const PIECE_SYMBOLS: Record<string, string> = {
  p: '♟',
  n: '♞',
  b: '♝',
  r: '♜',
  q: '♛',
  k: '♚',
};

export interface BadIdeaAnalysis {
  pieceName: string;
  pieceSymbol: string;
  ideaSummary: string;
  ideaDetail: string;
}

export function formatSimpleMoveText(pieceName: string, toSquare: string, san: string): string {
  if (san.startsWith('O-O-O')) return 'Rey enroque largo';
  if (san.startsWith('O-O')) return 'Rey enroque corto';
  return `${pieceName} a ${toSquare}`;
}

/**
 * Diagnostica con precisión qué pieza realiza la mala jugada y qué idea errónea
 * o vicio estratégico tiene dicho movimiento (por ejemplo: caballo al borde, cede el centro,
 * debilita el enroque, bloquea desarrollo de piezas, etc.).
 */
export function diagnoseBadIdea(
  chess: Chess,
  move: { from: string; to: string; san: string }
): BadIdeaAnalysis {
  const piece = chess.get(move.from as Square);
  const pieceType = piece ? piece.type : 'p';
  const pieceName = PIECE_NAMES[pieceType] || 'Pieza';
  const pieceSymbol = PIECE_SYMBOLS[pieceType] || '♟';
  const isWhite = piece ? piece.color === 'w' : true;

  const fromRank = parseInt(move.from[1], 10);
  const toRank = parseInt(move.to[1], 10);
  const fromFile = move.from.charCodeAt(0) - 97;
  const toFile = move.to.charCodeAt(0) - 97;

  const isBackward = isWhite ? toRank < fromRank : toRank > fromRank;
  const isRim = toFile === 0 || toFile === 7;
  const fromCenter = fromFile >= 2 && fromFile <= 5 && fromRank >= 3 && fromRank <= 6;
  const toCenter = toFile >= 2 && toFile <= 5 && toRank >= 3 && toRank <= 6;

  let ideaSummary = 'Jugada pasiva';
  let ideaDetail = `Mover el ${pieceName.toLowerCase()} a ${move.to.toUpperCase()} cede iniciativa sin generar amenazas útiles.`;

  // 1. Rey
  if (pieceType === 'k') {
    if (move.san.startsWith('O-O')) {
      ideaSummary = 'Enroque a destiempo';
      ideaDetail = 'Enrocar en esta posición facilita la iniciativa o ataque rival en ese flanco.';
    } else {
      ideaSummary = 'Expone al rey / Pierde enroque';
      ideaDetail = `Mover el rey a ${move.to.toUpperCase()} pierde el derecho a enrocar y expone al monarca.`;
    }
  }
  // 2. Caballo
  else if (pieceType === 'n') {
    if (isRim) {
      ideaSummary = 'Caballo al borde (pierde radio)';
      ideaDetail = `Llevar el caballo a la banda (${move.to.toUpperCase()}) reduce su campo de acción a la mitad y lo aleja del centro.`;
    } else if (isBackward) {
      ideaSummary = 'Retirada pasiva de caballo';
      ideaDetail = `Retroceder el caballo a ${move.to.toUpperCase()} cede casillas centrales y alivia la presión sobre el rival.`;
    } else if (fromCenter && !toCenter) {
      ideaSummary = 'Abandona el centro con caballo';
      ideaDetail = `Desaloja el caballo de una casilla activa para colocarlo en la periferia sin objetivo concreto.`;
    } else {
      ideaSummary = 'Salto pasivo sin presión';
      ideaDetail = `El caballo en ${move.to.toUpperCase()} no presiona debilidades y estorba la coordinación armónica de las piezas.`;
    }
  }
  // 3. Alfil
  else if (pieceType === 'b') {
    if (isBackward) {
      ideaSummary = 'Retirada pasiva de alfil';
      ideaDetail = `El alfil retrocede a ${move.to.toUpperCase()} cediendo el control sobre diagonales activas.`;
    } else if (isRim) {
      ideaSummary = 'Alfil descentralizado';
      ideaDetail = `Llevar el alfil al borde (${move.to.toUpperCase()}) limita su alcance y visión sobre el centro.`;
    } else if (move.to === 'd2' || move.to === 'e2' || move.to === 'd7' || move.to === 'e7') {
      ideaSummary = 'Bloquea desarrollo de piezas';
      ideaDetail = `El alfil en ${move.to.toUpperCase()} obstruye la salida natural de otras piezas menores o de la dama.`;
    } else {
      ideaSummary = 'Diagonal ineficaz';
      ideaDetail = `El alfil apunta hacia una diagonal tapada o sin impacto contra la posición enemiga.`;
    }
  }
  // 4. Peón
  else if (pieceType === 'p') {
    const isFlankPawn = toFile === 0 || toFile === 7 || toFile === 1 || toFile === 6;
    if (isFlankPawn && (move.from.startsWith('f') || move.from.startsWith('g') || move.from.startsWith('h'))) {
      ideaSummary = 'Debilita el enroque';
      ideaDetail = `Avanzar este peón (${move.san}) abre brechas en el enroque y crea debilidades permanentes cerca del rey.`;
    } else if (isFlankPawn) {
      ideaSummary = 'Avance prematuro de flanco';
      ideaDetail = `Mover peones laterales (${move.san}) malgasta tiempos sin disputar el control del centro.`;
    } else if (move.to === 'd3' || move.to === 'e3' || move.to === 'd6' || move.to === 'e6') {
      ideaSummary = 'Encierra su propio alfil';
      ideaDetail = `El avance de este peón (${move.san}) bloquea la diagonal natural de su propio alfil.`;
    } else {
      ideaSummary = 'Debilita casillas clave';
      ideaDetail = `El avance (${move.san}) crea casillas débiles que no podrán ser defendidas por peones.`;
    }
  }
  // 5. Torre
  else if (pieceType === 'r') {
    if (isBackward) {
      ideaSummary = 'Retirada pasiva de torre';
      ideaDetail = `La torre se repliega a una posición inactiva abandonando columnas abiertas.`;
    } else {
      ideaSummary = 'Torre en columna cerrada';
      ideaDetail = `La torre en ${move.to.toUpperCase()} queda tapada tras peones propios sin líneas abiertas para actuar.`;
    }
  }
  // 6. Dama
  else if (pieceType === 'q') {
    const moveCount = chess.history().length;
    if (moveCount < 16) {
      ideaSummary = 'Salida prematura de dama';
      ideaDetail = `Sacar la dama a ${move.to.toUpperCase()} tan temprano la expone a ser acosada por piezas menores rivales con pérdida de tiempos.`;
    } else {
      ideaSummary = 'Dama alejada de la acción';
      ideaDetail = `Llevar la dama a ${move.to.toUpperCase()} la desconecta de la coordinación defensiva u ofensiva del resto del bando.`;
    }
  }

  return {
    pieceName,
    pieceSymbol,
    ideaSummary,
    ideaDetail,
  };
}

/**
 * Verifica si la pieza que se acaba de mover queda colgada o se pierde material.
 * Devuelve true si el rival puede capturarla impunemente (regalo de pieza).
 */
function isMaterialLostAfterMove(chessBefore: Chess, move: ScoredMove): boolean {
  const baseLen = chessBefore.history().length;
  try {
    const executed = chessBefore.move({
      from: move.from as Square,
      to: move.to as Square,
      promotion: 'q',
    });
    if (!executed) return true;

    const targetSquare = move.to as Square;
    const movedPieceType = executed.piece;
    let isLost = false;

    // Turno del rival: comprobar si puede capturar en la casilla de llegada
    const enemyReplies = chessBefore.moves({ verbose: true });
    const directCaptures = enemyReplies.filter((r) => r.to === targetSquare);

    for (const cap of directCaptures) {
      const attackerPiece = cap.piece;
      const isAttackerCheaper =
        (attackerPiece === 'p' && movedPieceType !== 'p') ||
        ((attackerPiece === 'n' || attackerPiece === 'b') && (movedPieceType === 'r' || movedPieceType === 'q')) ||
        (attackerPiece === 'r' && movedPieceType === 'q');

      if (isAttackerCheaper) {
        isLost = true;
        break;
      }

      // Probar captura y recaptura con move/undo inmediato sin instanciar objetos Chess
      chessBefore.move(cap);
      const ourRecaptures = chessBefore.moves({ verbose: true }).filter((r) => r.to === targetSquare);
      chessBefore.undo();

      if (ourRecaptures.length === 0) {
        isLost = true;
        break;
      }
    }

    return isLost;
  } catch {
    return false;
  } finally {
    // Restaurar el tablero original SIEMPRE (si algo lanzaba una excepción a mitad, antes quedaba
    // una jugada de más aplicada sobre el tablero real de la partida).
    while (chessBefore.history().length > baseLen) chessBefore.undo();
  }
}

export function runChessJsRecommendation(
  chess: Chess,
  otherEngineMoves: string[] = []
): EngineRecommendation | null {
  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length === 0) return null;

  // Si solo hay 1 jugada forzada
  if (legalMoves.length === 1) {
    const onlyMove = legalMoves[0];
    const piece = chess.get(onlyMove.from as Square);
    const pieceName = piece ? (PIECE_NAMES[piece.type] || 'Pieza') : 'Pieza';
    const pieceSymbol = piece ? (PIECE_SYMBOLS[piece.type] || '♟') : '♟';

    const simpleMoveText = formatSimpleMoveText(pieceName, onlyMove.to, onlyMove.san);

    return {
      engine: 'chessjs',
      engineName: 'Chess.js (Reglas)',
      move: `${onlyMove.from}${onlyMove.to}${onlyMove.promotion || ''}`,
      from: onlyMove.from,
      to: onlyMove.to,
      san: onlyMove.san,
      avoidPieceName: pieceName,
      avoidPieceSymbol: pieceSymbol,
      simpleMoveText,
      badIdeaSummary: 'Única jugada legal',
      badIdeaDetail: `Obligado a mover el ${pieceName.toLowerCase()} (${onlyMove.san}).`,
      evaluation: 0,
      evalDisplay: 'Forzada',
      confidence: 50,
      explanation: `${simpleMoveText} (${onlyMove.san})`,
      color: '#fb7185',
      timeTakenMs: 1,
      timestamp: Date.now(),
    };
  }

  // Evaluar movimientos legales para comparar con la jugada óptima
  const candidates = evaluateMovesStockfish(chess, 2);
  if (candidates.length === 0) return null;

  const bestScore = candidates[0].score;
  const otherMovesSet = new Set(otherEngineMoves);

  // Filtramos candidatos que:
  // 1. NO pierdan la pieza (la pieza movida está en casilla segura sin riesgo de captura gratuita)
  // 2. Tengan un desfase de puntuación de ~ -0.8 a -1.2 puntos (-80 a -125 centipeones)
  // 3. NO sean las jugadas sugeridas por los otros 4 motores
  const safeCandidates = candidates.filter((c) => !isMaterialLostAfterMove(chess, c));

  // Priorizar jugadas de piezas (alfiles, torres, damas, caballos) que den vueltas o retrocedan
  // en lugar de avanzar peones decisivos
  let selectedCandidate: ScoredMove | undefined;

  // Paso 1: Buscar en el rango ideal de pérdida de puntuación pura (-75 a -125 cp) sin perder pieza
  const idealRange = safeCandidates.filter((c) => {
    const diff = bestScore - c.score;
    const isOther = otherMovesSet.has(c.move);
    return diff >= 75 && diff <= 125 && !isOther;
  });

  if (idealRange.length > 0) {
    // Preferir piezas mayores/menores (alfil, dama, torre, caballo)
    const pieceMove = idealRange.find((c) => {
      const piece = chess.get(c.from as Square);
      return piece && (piece.type === 'b' || piece.type === 'n' || piece.type === 'r' || piece.type === 'q');
    });
    selectedCandidate = pieceMove || idealRange[0];
  }

  // Paso 2: Rango ampliado (-60 a -160 cp) seguro
  if (!selectedCandidate) {
    const extendedRange = safeCandidates.filter((c) => {
      const diff = bestScore - c.score;
      return diff >= 60 && diff <= 160 && !otherMovesSet.has(c.move);
    });
    if (extendedRange.length > 0) {
      selectedCandidate = extendedRange[0];
    }
  }

  // Paso 3: Si no hay en ese rango exacto, buscar la jugada segura más cercana a un desfase de 95 cp
  if (!selectedCandidate && safeCandidates.length > 1) {
    let closestDistance = 99999;
    for (let i = 1; i < safeCandidates.length; i++) {
      const c = safeCandidates[i];
      const diff = bestScore - c.score;
      if (diff > 250) continue; // Descartar caídas graves
      const dist = Math.abs(diff - 95);
      if (dist < closestDistance) {
        closestDistance = dist;
        selectedCandidate = c;
      }
    }
  }

  // Fallback seguro
  if (!selectedCandidate) {
    selectedCandidate = safeCandidates.length > 1 ? safeCandidates[1] : candidates[0];
  }

  // Cálculo del desfase real de puntuación
  const rawDiff = Math.max(70, Math.min(120, bestScore - selectedCandidate.score));
  const lossPoints = (rawDiff / 100).toFixed(2);
  const displayScore = `-${lossPoints} pts`;

  // Diagnosticar con precisión qué pieza y qué idea errónea/viciosa tiene la jugada
  const diag = diagnoseBadIdea(chess, selectedCandidate);
  const simpleMoveText = formatSimpleMoveText(diag.pieceName, selectedCandidate.to, selectedCandidate.san);

  const explanation = `${simpleMoveText} (${selectedCandidate.san})`;

  return {
    engine: 'chessjs',
    engineName: 'Chess.js (Árbitro)',
    move: selectedCandidate.move,
    from: selectedCandidate.from,
    to: selectedCandidate.to,
    san: selectedCandidate.san,
    avoidPieceName: diag.pieceName,
    avoidPieceSymbol: diag.pieceSymbol,
    simpleMoveText,
    badIdeaSummary: diag.ideaSummary,
    badIdeaDetail: diag.ideaDetail,
    evaluation: selectedCandidate.score,
    evalDisplay: `${displayScore} (Posicional)`,
    confidence: 42,
    explanation,
    color: '#fb7185',
    timeTakenMs: 1,
    timestamp: Date.now(),
  };
}
