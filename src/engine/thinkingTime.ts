import { Chess } from 'chess.js';
import { GameRecord, ThinkingTimeEstimate } from '../types/chess';

export function estimateThinkingTime(chess: Chess, games: GameRecord[], remaining: number): ThinkingTimeEstimate {
  const legal = chess.moves({ verbose: true });
  const complexityScore = legal.length === 1 ? 1 : chess.inCheck() ? 8 : legal.some(m => m.captured) ? 6 : legal.length > 30 ? 7 : 4;
  const samples: number[] = [];
  for (const game of games.slice(-50)) for (const move of game.moves || []) {
    if (move.source !== 'MANUAL' || !move.fenBefore || !move.timingMeasured || move.fenBefore.split(' ')[1] !== game.playerColor) continue;
    if (typeof move.thinkTime === 'number' && Number.isFinite(move.thinkTime) && move.thinkTime >= 0.2 && move.thinkTime <= 300) samples.push(move.thinkTime);
  }
  samples.sort((a, b) => a - b);
  const learned = samples.length >= 5;
  const middle = Math.floor(samples.length / 2);
  const baseline = learned ? (samples.length % 2 ? samples[middle] : (samples[middle - 1] + samples[middle]) / 2) : 12;
  let seconds = Math.max(1, Math.min(90, baseline * complexityScore / 5));
  if (remaining >= 0) seconds = Math.min(seconds, Math.max(0, remaining / (remaining < 30 ? 15 : 30)));
  const recommendedSeconds = Math.round(seconds * 10) / 10;
  return {
    recommendedSeconds,
    complexityScore,
    urgency: remaining >= 0 && remaining < 60 ? 'critical' : chess.inCheck() ? 'high' : complexityScore <= 2 ? 'low' : 'medium',
    basis: learned ? 'Tu ritmo' : 'Estimación',
    sampleCount: samples.length,
    reasoning: `${learned ? `Mediana de ${samples.length} tiempos manuales medidos` : 'Sin suficientes tiempos medidos: orientación heurística'}; ajustada por opciones legales, jaque y reloj. No certifica juego humano ni exige esperar.`,
  };
}
