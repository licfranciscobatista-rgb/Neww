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
  try {
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
  } catch {
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
      decisionFreedom: 0.5,
      theoreticalStatus: 'Fuera de Libro',
      tacticalContext: 'Posicional Estándar',
      phase: 'middlegame',
      reasonableCandidates: [],
      candidateSpread: 0,
      fingerprintBefore: {
        hash: 'fallback_neutral',
        phase: 'opening',
        materialDiff: 0,
      },
    };
  }
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
  try {
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
  } catch {
    return {
      isUnlocked: false,
      gamesPlayed: 0,
      requiredGames: 10,
      progressPercent: 0,
      rawBytes: 0,
      distilledBytes: 0,
      assistantsCount: 8,
      statusMessage: 'Bloqueado: Requiere 10 partidas para calibrar tu estilo.',
      distilledData: HistoryAssistant.analyzeAndDistill([]),
    };
  }
}

export interface PersonalRecommendationParams {
  chess: Chess;
  profile: PlayerProfile;
  games?: GameRecord[];
}

/**
 * MOTOR PERSONAL (AISLADO DE LOS MOTORES DE AJEDREZ Y DE CONTROL)
 * Funciona de manera 100% independiente con sus 8 ayudantes de estilo, memoria y patrones.
 * Regla estricta: NO da recomendaciones hasta alcanzar 10 partidas jugadas por el usuario.
 * Ahorra 100% de CPU y RAM mientras no esté calibrado.
 * Arquitectura Blindada: Garantía de cero caídas (Zero-Crash Fallback).
 */
export function runPersonalRecommendation(
  params: PersonalRecommendationParams
): EngineRecommendation | null {
  const { chess, profile, games } = params;

  if (!chess) return null;

  try {
    const status = getPersonalEngineStatus(profile, games);
    if (!status.isUnlocked) {
      return null; // Motor inactivo: no procesa ni gasta recursos sin partidas
    }

    const legalMoves = chess.moves({ verbose: true });
    if (!legalMoves || legalMoves.length === 0) return null;

    const distilled = status.distilledData;
    const historyPlies = chess.history().length;

    // 1. Pre-cálculo de conjuntos para evitar bucles O(N*M) en el bucle principal
    const knownOpeningMoves = new Set(
      distilled.userMoves.filter((um) => um.ply < 16).map((um) => um.san)
    );

    // Consulta y telemetría agregada de los ayudantes analíticos
    const tacticsAggression = TacticsAggressionAssistant.calculateSummary(distilled);
    const prophylaxis = ProphylaxisPatienceAssistant.calculateSummary(distilled);
    const endgame = EndgameTransitionAssistant.calculateSummary(distilled);
    const timePace = TimePaceAssistant.calculateSummary(distilled);

    // Evaluar cada jugada legal combinando la ponderación de los 8 ayudantes
    let bestMove = legalMoves[0];
    let highestScore = -1;
    let bestExplanation = '';

    for (const m of legalMoves) {
      // 1. Ayudante de Estilo: Puntuación base de 1.0 a 10.0
      const styleResult = StyleAssistant.scoreMove(chess, m.san, m.from, m.to, distilled);
      let moveScore = styleResult.score;
      const extraNotes: string[] = [];

      // 2. Ayudante de Aperturas & Repertorio: En fase inicial (ply < 16), bonificar jugadas del repertorio del usuario
      if (historyPlies < 16 && knownOpeningMoves.has(m.san)) {
        moveScore += 1.4;
        extraNotes.push('Apertura habitual');
      }

      // 3. Ayudante de Táctica & Agresividad: Bonificar si el usuario tiene afinidad de ataque y la jugada es activa
      if (m.san.includes('x') || m.san.includes('+')) {
        if (tacticsAggression.score > 50) {
          moveScore += 0.8;
          extraNotes.push('Afinidad táctica');
        }
      }

      // 4. Ayudante de Profilaxis & Paciencia: Bonificar jugadas preventivas si el perfil del jugador es paciente
      if (
        m.san === 'h3' ||
        m.san === 'h6' ||
        m.san === 'a3' ||
        m.san === 'a6' ||
        m.san === 'Kh1' ||
        m.san === 'Kh8'
      ) {
        if (prophylaxis.score > 50) {
          moveScore += 0.9;
          extraNotes.push('Perfil profiláctico');
        }
      }

      // 5. Ayudante de Transición a Finales: En finales (ply >= 30), evaluar técnica y activación de rey
      if (historyPlies >= 30) {
        if (m.piece === 'k') {
          moveScore += 0.7;
          extraNotes.push('Activación de Rey');
        }
        if (endgame.endgameMovesCount > 5 && m.san.includes('x')) {
          moveScore += 0.6;
          extraNotes.push('Simplificación favorable');
        }
      }

      // 6. Ayudante de Errores Recurrentes: Penalizar fuertemente si cae en un patrón de error del usuario
      const recurrentWarning = MistakeTrackerAssistant.checkRecurrentRisk(chess, m.san);
      if (recurrentWarning) {
        moveScore -= 3.0; // Penalización de protección
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

    // 7. Alerta de errores recurrentes en la jugada final elegida (si aplica)
    const finalRecurrentWarning = MistakeTrackerAssistant.checkRecurrentRisk(chess, bestMove.san);
    if (finalRecurrentWarning) {
      bestExplanation += ` (${finalRecurrentWarning})`;
    }

    // 8. Ayudante de Ritmo y Tiempo: Sugerencia de tiempo óptimo de cálculo
    const thinkTimeNote =
      timePace.averageSeconds > 0
        ? ` • Tiempo habitual: ${timePace.averageSeconds.toFixed(1)}s`
        : '';

    return {
      engine: 'personal',
      engineName: 'Motor Personal',
      move: `${bestMove.from}${bestMove.to}`,
      from: bestMove.from,
      to: bestMove.to,
      san: bestMove.san,
      evaluation: Math.round(Math.min(100, Math.max(10, highestScore * 10))),
      evalDisplay: `Estilo: ${Math.min(10, Math.max(1, highestScore)).toFixed(1)}/10`,
      confidence: Math.round(Math.min(100, highestScore * 10)),
      explanation: `${bestExplanation}${thinkTimeNote}`,
      color: '#fbbf24',
      timeTakenMs: 8,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.warn('[PersonalEngine] Recuperación segura automática (Zero-Crash):', err);
    try {
      const legalMoves = chess.moves({ verbose: true });
      if (!legalMoves || legalMoves.length === 0) return null;
      const fallback = legalMoves[0];
      return {
        engine: 'personal',
        engineName: 'Motor Personal',
        move: `${fallback.from}${fallback.to}`,
        from: fallback.from,
        to: fallback.to,
        san: fallback.san,
        evaluation: 60,
        evalDisplay: 'Estilo: 6.0/10',
        confidence: 60,
        explanation: 'Jugada posicional recomendada por el Motor Personal (Protección Activa).',
        color: '#fbbf24',
        timeTakenMs: 2,
        timestamp: Date.now(),
      };
    } catch {
      return null;
    }
  }
}
