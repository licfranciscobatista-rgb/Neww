import { Chess } from 'chess.js';
import {
  DecisionEvent,
  EngineRecommendation,
  MoveSource,
  PersonalKnowledgeItem,
  PlayerProfile,
  GameRecord,
} from '../types/chess';
import { calculatePositionFingerprint } from './fingerprint';
import { lookupTheory } from './theoryBook';
import {
  HistoryAssistant,
  StyleAssistant,
  OpeningRepertoireAssistant,
  MistakeTrackerAssistant,
  ProphylaxisPatienceAssistant,
  TacticsAggressionAssistant,
  TimePaceAssistant,
  EndgameTransitionAssistant,
  DistilledUserData,
} from './personalAssistants';
import { loadGameRecords } from '../storage/chessStorage';

export interface CreateDecisionEventParams {
  gameId: string;
  ply: number;
  chessBefore: Chess;
  selectedUci: string;
  selectedSan: string;
  moveSource: MoveSource;
  clockRemaining: number;
  thinkTime: number;
  objectiveEvalBefore: number;
  objectiveEvalAfter: number;
  candidates: Array<{ move: string; san: string; eval: number }>;
}

export function createDecisionEvent(params: CreateDecisionEventParams): DecisionEvent {
  const theory = lookupTheory(params.chessBefore.history());
  const fp = calculatePositionFingerprint(params.chessBefore);

  const topEval = params.candidates[0]?.eval || 0;
  const reasonableCandidates = params.candidates.filter(
    (c) => Math.abs(topEval - c.eval) <= 120
  );

  const spread =
    params.candidates.length > 1
      ? Math.abs(params.candidates[0].eval - params.candidates[params.candidates.length - 1].eval)
      : 0;

  const freedom = Math.min(1, Math.max(0.1, reasonableCandidates.length * 0.25));

  let tacticalContext = 'Posicional Estándar';
  if (params.chessBefore.inCheck()) {
    tacticalContext = 'Respuesta a Jaque';
  } else if (params.candidates.some((c) => c.san.includes('x'))) {
    tacticalContext = 'Tensión de Capturas';
  }

  return {
    gameId: params.gameId,
    ply: params.ply,
    fenBefore: params.chessBefore.fen(),
    selectedMove: params.selectedUci,
    selectedSan: params.selectedSan,
    moveSource: params.moveSource,
    clockRemaining: params.clockRemaining,
    thinkTime: params.thinkTime,
    objectiveEvalBefore: params.objectiveEvalBefore,
    objectiveEvalAfter: params.objectiveEvalAfter,
    decisionFreedom: Number(freedom.toFixed(2)),
    theoreticalStatus: theory.isBook ? 'Teoría de Libro' : 'Fuera de Libro',
    tacticalContext,
    phase: fp.phase,
    reasonableCandidates: reasonableCandidates.map((c) => ({
      san: c.san,
      eval: c.eval,
      move: c.move,
    })),
    candidateSpread: spread,
    fingerprintBefore: fp,
  };
}

export interface DistillKnowledgeParams {
  gameId: string;
  playerColor: 'w' | 'b';
  decisionEvents: DecisionEvent[];
  existingConsolidated: PersonalKnowledgeItem[];
  existingPending: PersonalKnowledgeItem[];
}

export function distillPostGameKnowledge(params: DistillKnowledgeParams): PersonalKnowledgeItem[] {
  const newPending: PersonalKnowledgeItem[] = [];
  const manualEvents = params.decisionEvents.filter((de) => de.moveSource === 'MANUAL');

  if (manualEvents.length >= 5) {
    const avgThink = Math.round(
      manualEvents.reduce((acc, cur) => acc + cur.thinkTime, 0) / manualEvents.length
    );

    newPending.push({
      id: `pending_${Date.now()}_pace`,
      category: 'pace_rhythm',
      title: `Ritmo de pensamiento promedio (~${avgThink}s)`,
      description: `Tiempo medio de reflexión calculado en decisiones manuales durante la partida.`,
      confidence: 80,
      evidenceCount: manualEvents.length,
      firstSeenGameId: params.gameId,
      lastUpdatedGameId: params.gameId,
      status: 'PENDING',
      classification: 'NEW',
      tendencyScore: 60,
      contextKey: 'thinking_speed',
    });
  }

  return newPending;
}

export function consolidatePendingKnowledge(
  consolidated: PersonalKnowledgeItem[],
  pending: PersonalKnowledgeItem[]
): { consolidated: PersonalKnowledgeItem[]; pending: PersonalKnowledgeItem[] } {
  if (pending.length === 0) {
    return { consolidated, pending: [] };
  }

  const promoted: PersonalKnowledgeItem[] = pending.map((p) => ({
    ...p,
    status: 'CONSOLIDATED' as const,
  }));

  return {
    consolidated: [...consolidated, ...promoted],
    pending: [],
  };
}

export interface PersonalEngineStatus {
  isUnlocked: boolean;
  gamesPlayed: number;
  requiredGames: number;
  progressPercent: number;
  rawBytes: number;
  distilledBytes: number;
  assistantsCount: number;
  statusMessage: string;
  distilledData: DistilledUserData;
}

export function getPersonalEngineStatus(
  profile: PlayerProfile,
  games?: GameRecord[]
): PersonalEngineStatus {
  const storedGames = games || loadGameRecords();
  const distilled = HistoryAssistant.analyzeAndDistill(storedGames);

  const effectiveGames = Math.max(profile.gamesPlayed, distilled.manualGamesCount);
  const requiredGames = 10;
  const isUnlocked = effectiveGames >= requiredGames;
  const progressPercent = Math.min(100, Math.round((effectiveGames / requiredGames) * 100));

  let statusMessage = '';
  if (isUnlocked) {
    statusMessage = `Motor Desbloqueado: Calibrado con ${effectiveGames} partidas (${(distilled.distilledBytes / 1024).toFixed(1)} KB destilados de ${Math.round(distilled.rawPgnBytes / 1024)} KB brutos).`;
  } else {
    statusMessage = `Bloqueado: Requiere al menos ${requiredGames} partidas jugadas por ti para calibrar tu ADN de juego (Llevas ${effectiveGames}/${requiredGames}). Faltan ${requiredGames - effectiveGames} partidas.`;
  }

  return {
    isUnlocked,
    gamesPlayed: effectiveGames,
    requiredGames,
    progressPercent,
    rawBytes: distilled.rawPgnBytes,
    distilledBytes: distilled.distilledBytes,
    assistantsCount: 8,
    statusMessage,
    distilledData: distilled,
  };
}

export interface PersonalRecommendationParams {
  chess: Chess;
  profile: PlayerProfile;
  games?: GameRecord[];
}

/**
 * MOTOR PERSONAL (AISLADO DE LOS MOTORES DE AJEDREZ Y DE CONTROL)
 * Funciona de manera 100% independiente con sus 8 ayudantes de estilo, memoria y patrones.
 * Regla estricta: NO da recomendaciones hasta alcanzar 10 partidas jugadas manualmente por el usuario.
 */
export function runPersonalRecommendation(
  params: PersonalRecommendationParams
): EngineRecommendation | null {
  const { chess, profile, games } = params;

  // STRICT RULE: Require at least 10 games played by user
  const status = getPersonalEngineStatus(profile, games);
  if (!status.isUnlocked) {
    return null; // NO recommendation allowed before 10 games
  }

  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length === 0) return null;

  const distilled = status.distilledData;
  const historyPlies = chess.history().length;

  // 1. Telemetría agregada de los 8 ayudantes
  const repertoire = OpeningRepertoireAssistant.getRepertoireSummary(distilled);
  const tacticsAggression = TacticsAggressionAssistant.calculateSummary(distilled);
  const prophylaxis = ProphylaxisPatienceAssistant.calculateSummary(distilled);
  const endgame = EndgameTransitionAssistant.calculateSummary(distilled);
  const timePace = TimePaceAssistant.calculateSummary(distilled);

  // Evaluate each legal move combining the 8 specialized assistants
  let bestMove = legalMoves[0];
  let highestScore = -1;
  let bestExplanation = '';

  for (const m of legalMoves) {
    // Base style score (1.0 to 10.0) from StyleAssistant
    const styleResult = StyleAssistant.scoreMove(chess, m.san, m.from, m.to, distilled);
    let moveScore = styleResult.score;
    let extraNotes: string[] = [];

    // Ayudante de Aperturas (Repertoire): En fase inicial (ply < 16), bonificar líneas de repertorio del usuario
    if (historyPlies < 16 && repertoire.topList.length > 0) {
      const isKnownMove = distilled.userMoves.some((um) => um.san === m.san && um.ply < 16);
      if (isKnownMove) {
        moveScore += 1.2;
        extraNotes.push('Apertura habitual');
      }
    }

    // Ayudante de Táctica & Agresividad: Si el usuario es agresivo y la jugada es captura o jaque
    if (m.san.includes('x') || m.san.includes('+')) {
      if (tacticsAggression.score > 50) {
        moveScore += 0.8;
        extraNotes.push('Afinidad táctica');
      }
    }

    // Ayudante de Profilaxis & Paciencia: Si el usuario es profiláctico y la jugada es preventiva o consolida
    if (m.san === 'h3' || m.san === 'h6' || m.san === 'a3' || m.san === 'a6' || m.san === 'Kh1' || m.san === 'Kh8') {
      if (prophylaxis.score > 50) {
        moveScore += 0.9;
        extraNotes.push('Perfil profiláctico');
      }
    }

    // Ayudante de Transición a Finales: En finales (ply >= 30), evaluar técnica y actividad de rey
    if (historyPlies >= 30) {
      if (m.piece === 'k') {
        moveScore += 0.6;
        extraNotes.push('Activación de Rey');
      }
      if (endgame.endgameMovesCount > 5 && m.san.includes('x')) {
        moveScore += 0.5;
        extraNotes.push('Simplificación a final favorable');
      }
    }

    // Ayudante de Errores Recurrentes: Penalizar fuertemente si cae en patrón de blunder previo
    const recurrentWarning = MistakeTrackerAssistant.checkRecurrentRisk(chess, m.san);
    if (recurrentWarning) {
      moveScore -= 3.0; // Penalización severa para proteger al usuario
    }

    if (moveScore > highestScore) {
      highestScore = moveScore;
      bestMove = m;
      bestExplanation = styleResult.explanation;
      if (extraNotes.length > 0) {
        bestExplanation += ` [${extraNotes.join(', ')}]`;
      }
    }
  }

  // Comprobar riesgo final en la mejor jugada
  const finalRecurrentWarning = MistakeTrackerAssistant.checkRecurrentRisk(chess, bestMove.san);
  if (finalRecurrentWarning) {
    bestExplanation += ` (${finalRecurrentWarning})`;
  }

  // Ayudante de Ritmo y Tiempo: Sugerencia de tiempo óptimo de cálculo
  const thinkTimeNote = timePace.averageSeconds > 0 ? ` • Tiempo habitual: ${timePace.averageSeconds.toFixed(1)}s` : '';

  return {
    engine: 'personal',
    engineName: 'Motor Personal',
    move: `${bestMove.from}${bestMove.to}`,
    from: bestMove.from,
    to: bestMove.to,
    san: bestMove.san,
    evaluation: Math.round(Math.min(100, Math.max(10, highestScore * 10))),
    evalDisplay: `Estilo: ${Math.min(10, highestScore).toFixed(1)}/10`,
    confidence: Math.round(Math.min(100, highestScore * 10)),
    explanation: `${bestExplanation}${thinkTimeNote}`,
    color: '#fbbf24',
    timeTakenMs: 12,
    timestamp: Date.now(),
  };
}
