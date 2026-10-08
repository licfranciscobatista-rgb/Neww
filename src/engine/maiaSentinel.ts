import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';
import type { EngineRecommendation } from '../types/chess';

export interface MaiaSentinelAlert {
  type: 'mate' | 'mate_threat' | 'draw' | 'draw_risk' | 'blunder_risk' | 'blunder_punish' | 'safe' | 'waiting';
  severity: 'critical' | 'danger' | 'warning' | 'opportunity' | 'safe';
  badgeTitle: string;
  detail: string;
  move?: {
    from: string;
    to: string;
    san: string;
  };
}

const PIECE_NAMES: Record<string, string> = {
  p: 'Peón',
  n: 'Caballo',
  b: 'Alfil',
  r: 'Torre',
  q: 'Dama',
  k: 'Rey',
};

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

/**
 * Cambia el turno en un FEN de forma segura para simular amenazas del rival
 */
function switchFenTurn(fen: string): string | null {
  const parts = fen.split(' ');
  if (parts.length < 2) return null;
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  // Reset en-passant square if turn is flipped artificially
  parts[3] = '-';
  return parts.join(' ');
}

function profitableCaptures(board: Chess, color: Color) {
  try {
    const fen = board.turn() === color ? board.fen() : switchFenTurn(board.fen());
    if (!fen) return [];
    const copy = new Chess(fen);
    return copy.moves({ verbose: true }).filter(m => {
      if (!m.captured || m.captured === 'k') return false;
      const next = new Chess(fen); next.move(m);
      const recapture = next.moves({ verbose: true }).some(reply => reply.to === m.to && reply.captured);
      return !recapture || PIECE_VALUES[m.captured] > PIECE_VALUES[m.piece];
    });
  } catch { return []; }
}

/**
 * Analiza la posición desde la perspectiva del centinela de Maia para avisos críticos:
 * - Mates (disponibles o amenazas del rival)
 * - Tablas (por repetición, ahogado, material insuficiente o regla de 50 jugadas)
 * - Jugadas malas / Colgadas (piezas propias o rivales en peligro inmediato)
 */
export function evaluateMaiaSentinel(chess: Chess, userColor: 'w' | 'b'): MaiaSentinelAlert {
  if (chess.isGameOver()) {
    if (chess.isCheckmate()) {
      return {
        type: 'mate',
        severity: 'critical',
        badgeTitle: 'Jaque Mate',
        detail: 'Partida finalizada por jaque mate.',
      };
    }
    if (chess.isStalemate()) {
      return {
        type: 'draw',
        severity: 'warning',
        badgeTitle: 'Rey Ahogado (Tablas)',
        detail: 'Partida en tablas: el bando con el turno no tiene movimientos legales y su rey no está en jaque.',
      };
    }
    if (chess.isThreefoldRepetition()) {
      return {
        type: 'draw',
        severity: 'warning',
        badgeTitle: 'Tablas por Repetición',
        detail: 'La misma posición exacta se ha repetido tres veces en la partida.',
      };
    }
    if (chess.isInsufficientMaterial()) {
      return {
        type: 'draw',
        severity: 'warning',
        badgeTitle: 'Material Insuficiente',
        detail: 'Ningún bando cuenta con piezas suficientes para dar mate. Tablas reglamentarias.',
      };
    }
    return {
      type: 'draw',
      severity: 'warning',
      badgeTitle: 'Tablas decretadas',
      detail: 'La partida ha concluido en tablas.',
    };
  }

  if (chess.turn() !== userColor) return { type: 'waiting', severity: 'safe', badgeTitle: 'Turno rival', detail: 'Los avisos propios se actualizan cuando te corresponde mover.' };
  const turn = userColor;
  const oppColor: Color = turn === 'w' ? 'b' : 'w';
  const rivalCaptures = profitableCaptures(chess, oppColor);
  const ownCaptures = profitableCaptures(chess, userColor);
  const legalMoves = chess.moves({ verbose: true });

  // =========================================================================
  // 1. MATE INMEDIATO A FAVOR (Victoria en 1 jugada)
  // =========================================================================
  const mateInOne = legalMoves.find((m) => m.san.includes('#'));
  if (mateInOne) {
    return {
      type: 'mate',
      severity: 'critical',
      badgeTitle: `⚡ ¡Mate en 1 con ${mateInOne.san}!`,
      detail: `Tienes jaque mate inmediato ejecutando ${mateInOne.san}. ¡Ganas la partida ahora!`,
      move: {
        from: mateInOne.from,
        to: mateInOne.to,
        san: mateInOne.san,
      },
    };
  }

  // =========================================================================
  // 2. AMENAZA DE MATE INMEDIATO DEL RIVAL
  // Si no estamos en jaque, simulamos si el rival tendría mate en 1 en su próximo turno
  // =========================================================================
  if (!chess.inCheck()) {
    try {
      const oppTurnFen = switchFenTurn(chess.fen());
      if (oppTurnFen) {
        const oppSim = new Chess(oppTurnFen);
        const oppMoves = oppSim.moves({ verbose: true });
        const oppMate = oppMoves.find((m) => m.san.includes('#'));
        if (oppMate) {
          return {
            type: 'mate_threat',
            severity: 'danger',
            badgeTitle: `⚠️ ¡Amenaza de Mate rival (${oppMate.san})!`,
            detail: `El rival tiene amenaza de jaque mate en 1 con ${oppMate.san} si no defiendes tu rey.`,
            move: {
              from: oppMate.from,
              to: oppMate.to,
              san: oppMate.san,
            },
          };
        }
      }
    } catch {
      // Ignorar si el FEN alternativo no es válido (ej. rey en jaque previo)
    }
  }

  // =========================================================================
  // 3. AVISOS DE TABLAS Y RIESGO DE AHOGADO
  // =========================================================================
  // Regla de 50 jugadas próxima
  const fenParts = chess.fen().split(' ');
  const halfmoveClock = parseInt(fenParts[4] || '0', 10);
  if (halfmoveClock >= 80) {
    const movesLeft = Math.max(1, 50 - Math.floor(halfmoveClock / 2));
    return {
      type: 'draw_risk',
      severity: 'warning',
      badgeTitle: `⚖️ Aviso: Tablas en ${movesLeft} jugadas`,
      detail: `Han pasado ${Math.floor(halfmoveClock / 2)} jugadas sin capturas ni peones. Quedan ${movesLeft} para tablas automáticas.`,
    };
  }

  // Alerta de Ahogado Inadvertido:
  // Si el jugador tiene clara ventaja y algún movimiento ahoga al rival accidentalmente
  for (const m of legalMoves) {
    try {
      const testChess = new Chess(chess.fen());
      testChess.move(m);
      if (testChess.isStalemate()) {
        return {
          type: 'draw_risk',
          severity: 'warning',
          badgeTitle: `⚖️ ¡Cuidado! ${m.san} causa Ahogado`,
          detail: `Mover ${m.san} deja al rival sin jugadas legales pero sin jaque, regalando tablas por ahogado.`,
          move: {
            from: m.from,
            to: m.to,
            san: m.san,
          },
        };
      }
    } catch {
      // Movimiento no válido
    }
  }

  // =========================================================================
  // 4. JUGADAS MALAS & PIEZAS COLGADAS (BLUNDERS)
  // =========================================================================
  const board = chess.board();

  // 4A. Colgada propia grave: Pieza propia atacada y sin suficiente defensa
  const hangingFriendlyPieces: Array<{
    sq: Square;
    piece: PieceSymbol;
    val: number;
    attacker: Square;
  }> = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== turn) continue;
      // El rey no se evalúa como colgada común (está cubierto por jaques)
      if (p.type === 'k') continue;

      const sq = `${String.fromCharCode(97 + c)}${8 - r}` as Square;
      const attackers = rivalCaptures.filter(m => m.to === sq).map(m => m.from);
      if (attackers.length === 0) continue;

      const defenders = chess.attackers(sq, turn);

      // Si hay más atacantes que defensores, o si está completamente indefensa
      if (attackers.length > 0) {
        hangingFriendlyPieces.push({
          sq,
          piece: p.type,
          val: PIECE_VALUES[p.type] || 100,
          attacker: attackers[0] as Square,
        });
      }
    }
  }

  if (hangingFriendlyPieces.length > 0) {
    // Priorizar la pieza de mayor valor en peligro (Dama > Torre > Alfil/Caballo > Peón)
    hangingFriendlyPieces.sort((a, b) => b.val - a.val);
    const topHanging = hangingFriendlyPieces[0];
    const pieceLabel = PIECE_NAMES[topHanging.piece] || 'Pieza';

    return {
      type: 'blunder_risk',
      severity: 'danger',
      badgeTitle: `🚨 ¡${pieceLabel} colgada en ${topHanging.sq.toUpperCase()}!`,
      detail: `Tu ${pieceLabel.toLowerCase()} en ${topHanging.sq.toUpperCase()} está atacada y sin defensa suficiente. ¡Muévela o defiéndela!`,
      move: {
        from: topHanging.attacker,
        to: topHanging.sq,
        san: `${topHanging.sq.toUpperCase()}`,
      },
    };
  }

  // 4B. Colgada del rival para castigar: Pieza del oponente indefensa atacada por nosotros
  const opponentHangingPieces: Array<{
    sq: Square;
    piece: PieceSymbol;
    val: number;
    ourAttacker: Square;
  }> = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== oppColor) continue;
      if (p.type === 'k') continue;

      const sq = `${String.fromCharCode(97 + c)}${8 - r}` as Square;
      const ourAttackers = ownCaptures.filter(m => m.to === sq).map(m => m.from);
      if (ourAttackers.length === 0) continue;

      const oppDefenders = chess.attackers(sq, oppColor);

      if (ourAttackers.length > 0) {
        opponentHangingPieces.push({
          sq,
          piece: p.type,
          val: PIECE_VALUES[p.type] || 100,
          ourAttacker: ourAttackers[0] as Square,
        });
      }
    }
  }

  if (opponentHangingPieces.length > 0) {
    opponentHangingPieces.sort((a, b) => b.val - a.val);
    const topOppHanging = opponentHangingPieces[0];
    const oppPieceLabel = PIECE_NAMES[topOppHanging.piece] || 'Pieza';

    return {
      type: 'blunder_punish',
      severity: 'opportunity',
      badgeTitle: `💥 ¡Colgada rival: ${oppPieceLabel} en ${topOppHanging.sq.toUpperCase()}!`,
      detail: `${oppPieceLabel} rival en ${topOppHanging.sq.toUpperCase()} está indefensa. Tienes captura favorable.`,
      move: {
        from: topOppHanging.ourAttacker,
        to: topOppHanging.sq,
        san: `x${topOppHanging.sq.toUpperCase()}`,
      },
    };
  }

  // =========================================================================
  // 5. POSICIÓN ESTABLE (SIN PELIGRO CRÍTICO NI COLGADAS)
  // =========================================================================
  return {
    type: 'safe',
    severity: 'safe',
    badgeTitle: 'Sin avisos inmediatos',
    detail: 'La revisión limitada no encontró mate en una, capturas rentables inmediatas ni ahogado; no certifica que la posición sea segura.',
  };
}

/**
 * Convierte el aviso del centinela en una EngineRecommendation para integrarse con la UI y las flechas
 */
export function getMaiaSentinelRecommendation(chess: Chess, userColor: 'w' | 'b'): EngineRecommendation {
  const alert = evaluateMaiaSentinel(chess, userColor);

  return {
    engine: 'maia',
    engineName: 'Maia (Centinela de Avisos)',
    move: alert.move ? `${alert.move.from}${alert.move.to}` : '',
    from: alert.move?.from || '',
    to: alert.move?.to || '',
    san: alert.move?.san || '',
    evalDisplay: alert.badgeTitle,
    explanation: alert.detail,
    confidence: alert.severity === 'safe' ? 50 : 75,
    color:
      alert.severity === 'critical' || alert.severity === 'danger'
        ? '#ef4444' // red-500
        : alert.severity === 'warning'
        ? '#f59e0b' // amber-500
        : alert.severity === 'opportunity'
        ? '#10b981' // emerald-500
        : '#8b5cf6', // purple-500
    timestamp: Date.now(),
  };
}
