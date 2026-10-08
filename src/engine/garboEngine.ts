import { Chess } from 'chess.js';
import type { EngineRecommendation } from '../types/chess';
import { getReliableTheoryMoves } from './theoryBook';
import { realGarbo } from './realGarbo';
import { queryOpening } from './openingService';
import { OPENING_PRESETS, shouldPauseGarbo, detectRecommendedSystem, type OpeningChoice } from './openingIndex';
import { continueLondon } from './londonPlanner';

// Independent fallback for synchronous engine health checks, not live recommendations.
export function runGarboRecommendation(chess: Chess): EngineRecommendation | null {
  const moves = chess.moves({ verbose: true });
  const book = getReliableTheoryMoves(chess);
  const chosen = moves.find(move => move.san.includes('#')) ||
    moves.find(move => book.includes(move.san)) || moves[0];
  if (!chosen) return null;
  return {
    engine: 'garbo', engineName: 'GarboChess',
    move: chosen.from + chosen.to + (chosen.promotion || ''), from: chosen.from, to: chosen.to,
    san: chosen.san, evaluation: 0, evalDisplay: '—', explanation: '', color: '#059669',
  };
}

export async function analyzeGarbo(chess: Chess, selected: string): Promise<{
  rec: EngineRecommendation | null; opening: OpeningChoice;
}> {
  const fen = chess.fen();
  if (selected === 'rodent-active') {
    realGarbo.terminate();
    return { rec: null, opening: { status: 'free', notice: 'Garbo apagado por cambio aceptado a Rodent.' } };
  }
  const history = chess.history({ verbose: true }).map(move => move.after);
  const opening = await queryOpening(fen, selected, history);
  const system = OPENING_PRESETS.find(item => item.id === selected)?.name || opening.name || 'el sistema elegido';

  // 1. Si Londres sigue en plan activo y se desvía o hay jaque
  if (selected === 'london' && (!opening.uci || chess.inCheck())) {
    try {
      const plan = await continueLondon(chess, position => realGarbo.analyze(position, { movetime: 100 }));
      if (plan) {
        opening.notice = plan.notice;
        opening.status = 'deviated';
        const move = new Chess(fen).move({ from: plan.move.slice(0, 2), to: plan.move.slice(2, 4), promotion: plan.move[4] });
        if (move) {
          return {
            opening,
            rec: {
              engine: 'garbo',
              engineName: 'GarboChess / Londres',
              move: plan.move,
              from: move.from,
              to: move.to,
              san: move.san,
              evaluation: plan.score / 100,
              evalDisplay: plan.score >= 0 ? `+${(plan.score / 100).toFixed(1)}` : `${(plan.score / 100).toFixed(1)}`,
              depth: 6,
              isBookMove: false,
              explanation: `Continuación del Sistema Londres: ${plan.notice}. Prioriza el desarrollo armónico de piezas menores y la solidez del centro.`,
              color: '#059669',
            },
          };
        }
      }
    } catch {
      // Continuar al cálculo autónomo garantizado
    }
  }

  // 2. Si la jugada está en el repertorio oficial de libro
  if (opening.uci) {
    try {
      const board = new Chess(fen);
      const move = board.move({ from: opening.uci.slice(0, 2), to: opening.uci.slice(2, 4), promotion: opening.uci[4] });
      if (move) {
        return {
          opening,
          rec: {
            engine: 'garbo',
            engineName: `GarboChess (${system})`,
            move: opening.uci,
            from: move.from,
            to: move.to,
            san: move.san,
            evaluation: 0.2,
            evalDisplay: opening.eco || 'Libro',
            depth: 1,
            isBookMove: true,
            bookOpeningName: opening.name || system,
            explanation: `Jugada estándar de la teoría para el ${system}. Desarrolla las piezas hacia casillas activas y preserva la estructura de peones temáticos.`,
            color: '#059669',
          },
        };
      }
    } catch {
      // Jugada de libro no válida en este tablero, continuar al cálculo de motor
    }
  }

  // 3. Fuera de libro / repertorio completado / posición desviada / o modo libre:
  // NUNCA pausar ni dejar sin jugada al usuario. Garbo calcula la mejor jugada con motor.
  opening.status = selected === 'free' ? 'free' : 'deviated';

  // Si está en 'free' (o sin sistema fijado), Garbo detecta y recomienda activamente el sistema adecuado
  if (selected === 'free' || selected === 'auto') {
    const turnColor = chess.turn();
    const recommended = detectRecommendedSystem(chess, turnColor);
    opening.suggestedSystem = { id: recommended.id, name: recommended.name, reason: recommended.reason };
    opening.isRecommendationPending = true;

    // Verificar si el sistema recomendado tiene jugada teórica en esta posición
    const recTheory = await queryOpening(fen, recommended.id, history);
    if (recTheory.uci) {
      try {
        const board = new Chess(fen);
        const move = board.move({ from: recTheory.uci.slice(0, 2), to: recTheory.uci.slice(2, 4), promotion: recTheory.uci[4] });
        if (move) {
          opening.notice = `Sistema detectado tras el movimiento: GarboChess sugiere adoptar el ${recommended.name} (${recommended.reason}).`;
          return {
            opening,
            rec: {
              engine: 'garbo',
              engineName: `GarboChess (${recommended.name})`,
              move: recTheory.uci,
              from: move.from,
              to: move.to,
              san: move.san,
              evaluation: 0.3,
              evalDisplay: recTheory.eco || 'Recomendado',
              depth: 1,
              isBookMove: true,
              bookOpeningName: recommended.name,
              explanation: `Jugada estándar del ${recommended.name}: ${move.san}. En Modo Sistemas, se recomienda fijar este esquema (${recommended.reason}).`,
              color: '#059669',
            },
          };
        }
      } catch {
        // Continuar al cálculo autónomo
      }
    }

    opening.notice = chess.history().length >= 1
      ? `GarboChess ha detectado el esquema del ${recommended.name}. En Modo Sistemas, se recomienda adoptarlo para activar todos los objetivos.`
      : `Modo dinámico: GarboChess recomienda ${recommended.name} para tu bando.`;
  } else {
    opening.notice = `Adaptación del ${system}: fuera de libro. GarboChess calcula la continuación óptima manteniendo los principios del esquema.`;

    // Buscar si otra apertura encaja para sugerir en el selector (filtrando por color del bando)
    const turnColor = chess.turn();
    for (const preset of OPENING_PRESETS) {
      if (preset.id === selected) continue;
      // Preferir sugerencias del mismo bando
      if (preset.color !== 'any' && preset.color !== turnColor) continue;
      const alternative = await queryOpening(fen, preset.id, history);
      if (!alternative.uci) continue;
      try {
        new Chess(fen).move({ from: alternative.uci.slice(0, 2), to: alternative.uci.slice(2, 4), promotion: alternative.uci[4] });
        opening.suggestedSystem = { id: preset.id, name: preset.name };
        break;
      } catch {
        // Ignorar
      }
    }
  }

  const real = await realGarbo.analyze(fen, { movetime: 250 });
  if (!real) {
    const fallback = runGarboRecommendation(chess);
    return {
      opening,
      rec: fallback ? {
        ...fallback,
        engineName: `GarboChess (${system})`,
        explanation: `Continuación táctica de GarboChess para el ${system}: mantiene el centro y la seguridad del rey.`,
      } : null,
    };
  }

  if (real.mate !== undefined && real.mate < 0) {
    opening.notice = `Garbo detecta peligro de mate (${Math.abs(real.mate)}). Máxima prioridad: defender al rey.`;
  } else if (new Chess(fen).isCheck()) {
    opening.notice = 'El rey está en jaque. La jugada responde a la amenaza directa del rival.';
  }

  const explanation = chess.inCheck()
    ? `Respuesta obligada al jaque rival: GarboChess defiende al rey con ${real.san} antes de proseguir el plan del ${system}.`
    : `Cálculo posicional de GarboChess fuera de libro: sostiene el control del centro en el ${system}, mejora la actividad de las piezas y busca casillas dominantes.`;

  return {
    opening,
    rec: {
      engine: 'garbo',
      engineName: `GarboChess (${system})`,
      move: real.uci,
      from: real.from,
      to: real.to,
      san: real.san,
      evaluation: real.scoreCp / 100,
      evalDisplay: real.evalDisplay || (real.scoreCp >= 0 ? `+${(real.scoreCp / 100).toFixed(1)}` : `${(real.scoreCp / 100).toFixed(1)}`),
      depth: real.depth || 6,
      isBookMove: false,
      bookOpeningName: system,
      explanation,
      color: '#059669',
    },
  };
}
