import { Chess } from 'chess.js';
import { GameAnalysisReport, GameMove, MoveAnalysis, MoveQuality } from '../types/chess';
import { evaluateMovesStockfish } from './stockfishEngine';
import { lookupTheory } from './theoryBook';
import { saveAnalysisReport } from '../storage/chessStorage';

export async function analyzeFullGame(
  gameId: string,
  title: string,
  date: string,
  playerColor: 'w' | 'b',
  moves: GameMove[],
  onProgress?: (current: number, total: number, percent: number) => void
): Promise<GameAnalysisReport> {
  const chess = new Chess();
  const analyzedMoves: MoveAnalysis[] = [];
  const totalMoves = moves.length;

  const breakdown = {
    white: {
      brilliant: 0,
      great: 0,
      best: 0,
      excellent: 0,
      good: 0,
      book: 0,
      inaccuracy: 0,
      mistake: 0,
      blunder: 0,
    } as Record<MoveQuality, number>,
    black: {
      brilliant: 0,
      great: 0,
      best: 0,
      excellent: 0,
      good: 0,
      book: 0,
      inaccuracy: 0,
      mistake: 0,
      blunder: 0,
    } as Record<MoveQuality, number>,
  };

  let prevEval = 20; // Slight white opening advantage

  for (let i = 0; i < totalMoves; i++) {
    const move = moves[i];
    const fenBefore = chess.fen();
    const isWhite = i % 2 === 0;
    const colorKey = isWhite ? 'white' : 'black';

    // Check if book move
    const movesSoFar = moves.slice(0, i + 1).map((m) => m.san);
    const theory = lookupTheory(movesSoFar);

    const candidates = evaluateMovesStockfish(chess, 2);
    const bestCand = candidates[0] || { san: move.san, score: prevEval, move: `${move.from}${move.to}` };

    chess.move({ from: move.from, to: move.to, promotion: 'q' });
    const fenAfter = chess.fen();

    const afterCandidates = evaluateMovesStockfish(chess, 2);
    const currentEval = afterCandidates[0] ? -afterCandidates[0].score : prevEval;

    // Delta loss in centipawns
    const deltaLoss = Math.max(0, (bestCand.score || 0) - currentEval);

    // Classify quality
    let quality: MoveQuality = 'good';
    let explanation = `Movimiento sólido que mantiene la estructura y actividad posicional.`;

    if (theory.isBook) {
      quality = 'book';
      explanation = `Jugada de libro teórico (${theory.openingName}).`;
    } else if (deltaLoss <= 15 && (move.san.includes('x') || move.san.includes('+'))) {
      quality = 'best';
      explanation = `La mejor alternativa táctica de la posición segun cálculo objetivo.`;
    } else if (deltaLoss <= 25) {
      quality = 'excellent';
      explanation = `Excelente jugada posicional con mínimas desviaciones de la línea óptima.`;
    } else if (deltaLoss <= 65) {
      quality = 'good';
      explanation = `Buena decisión, conserva el equilibrio y control de casillas.`;
    } else if (deltaLoss <= 140) {
      quality = 'inaccuracy';
      explanation = `Imprecisión posicional: concede ligera iniciativa al rival.`;
    } else if (deltaLoss <= 280) {
      quality = 'mistake';
      explanation = `Error táctico notable que deteriora la ventaja en ${ (deltaLoss / 100).toFixed(2) } peones.`;
    } else {
      quality = 'blunder';
      explanation = `Error grave (Blunder): pérdida crítica de material o posición ganadora.`;
    }

    breakdown[colorKey][quality]++;

    analyzedMoves.push({
      ply: i + 1,
      moveNumber: Math.floor(i / 2) + 1,
      color: isWhite ? 'w' : 'b',
      san: move.san,
      uci: move.uci || `${move.from}${move.to}`,
      fenBefore,
      fenAfter,
      evalBefore: prevEval,
      evalAfter: currentEval,
      deltaLoss,
      quality,
      bestMoveSan: bestCand.san,
      bestMoveUci: bestCand.move,
      bestMoveEval: bestCand.score,
      explanation,
    });

    prevEval = currentEval;

    if (onProgress && i % 3 === 0) {
      onProgress(i + 1, totalMoves, Math.round(((i + 1) / totalMoves) * 100));
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Calculate Accuracy
  const calcAcc = (color: 'white' | 'black') => {
    const total = Object.values(breakdown[color]).reduce((a, b) => a + b, 0);
    if (total === 0) return 85;
    const errors = breakdown[color].blunder * 30 + breakdown[color].mistake * 15 + breakdown[color].inaccuracy * 6;
    return Math.max(45, Math.min(99, Math.round(98 - errors / total)));
  };

  const whiteAccuracy = calcAcc('white');
  const blackAccuracy = calcAcc('black');

  const report: GameAnalysisReport = {
    id: `report_${gameId}_${Date.now()}`,
    gameId,
    title,
    date,
    playerColor,
    whiteAccuracy,
    blackAccuracy,
    summary: `Precisión global: Blancas ${whiteAccuracy}% vs Negras ${blackAccuracy}%. Partida con ${breakdown.white.blunder + breakdown.black.blunder} errores graves totales.`,
    movesCount: totalMoves,
    breakdown,
    moves: analyzedMoves,
    analyzedAt: Date.now(),
  };

  saveAnalysisReport(report);
  return report;
}
