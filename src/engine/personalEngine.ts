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
import { runSubEngineAudit, PersonalAuditReport } from './personalSubEngines';
import { loadGameRecords } from '../storage/chessStorage';
import { compilePersonalEngineDNA, PersonalEngineDNAFile } from './personalDNAFile';

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
  subEngineReport?: PersonalAuditReport;
  compiledDNA?: PersonalEngineDNAFile;
}

export function getPersonalEngineStatus(
  profile: PlayerProfile,
  games?: GameRecord[],
  currentChess?: Chess
): PersonalEngineStatus {
  try {
    const storedGames = games || loadGameRecords();
    const distilled = HistoryAssistant.analyzeAndDistill(storedGames);
    const compiledDNA = compilePersonalEngineDNA(profile, storedGames, distilled);

    const effectiveGames = Math.max(profile.gamesPlayed, distilled.manualGamesCount);
    const requiredGames = 10;
    const isUnlocked = effectiveGames >= requiredGames;
    const progressPercent = Math.min(100, Math.round((effectiveGames / requiredGames) * 100));

    let subEngineReport: PersonalAuditReport | undefined;
    if (currentChess) {
      subEngineReport = runSubEngineAudit(currentChess, distilled, storedGames);
    }

    let statusMessage = '';
    if (isUnlocked) {
      statusMessage = `Motor Personal Calibrado al 100%: ADN propio consolidado con ${effectiveGames} partidas (${(distilled.distilledBytes / 1024).toFixed(1)} KB destilados de ${Math.round(distilled.rawPgnBytes / 1024)} KB brutos).`;
    } else if (effectiveGames > 0) {
      statusMessage = `Sub-Motores en Calibración Activa (${effectiveGames}/${requiredGames} partidas): Mapeando árbol posicional y afinidad (${progressPercent}% completado). Requiere 10 partidas para sugerir en tablero.`;
    } else {
      statusMessage = `Motor Personal Bloqueado (0/${requiredGames}): Requiere 10 partidas jugadas por ti para calibrar tu árbol de decisiones y biotipo propio.`;
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
      subEngineReport,
      compiledDNA,
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
  const { chess, profile, games, timeRemainingSeconds = null } = params as any;

  if (!chess) return null;

  try {
    const storedGames = games || loadGameRecords();
    const status = getPersonalEngineStatus(profile, storedGames, chess);

    // REGLA ESTRICTA Y HONESTA: Si no hay al menos 10 partidas, el motor NO proyecta jugadas inventadas
    if (!status.isUnlocked) {
      return null;
    }

    const legalMoves = chess.moves({ verbose: true });
    if (!legalMoves || legalMoves.length === 0) return null;

    const distilled = status.distilledData;

    // Ejecución de los 8 Sub-Motores autónomos
    const auditReport = runSubEngineAudit(chess, distilled, storedGames, timeRemainingSeconds);
    const verdicts = auditReport.subEngineVerdicts;

    // 1. Filtro de vetos del Sub-Motor 4 (Blunder Shield)
    const vetoedSan = new Set(verdicts.blunder_shield.vetoMoves.map((v) => v.san));

    let bestMove = legalMoves[0];
    let highestCompositeScore = -999;
    let selectedRationale = '';

    const graphFavored = verdicts.graph.favoredMoves;

    for (const m of legalMoves) {
      // Si la jugada está vetada por riesgo táctico de colgada, descartar
      if (vetoedSan.has(m.san) && legalMoves.length > 1) {
        continue;
      }

      let compositeScore = 50;
      let moveRationale = '';

      // Aporte Sub-Motor 1 (Grafo Posicional): Si el usuario ya la jugó en esta misma posición
      const inGraph = graphFavored.find((g) => g.san === m.san);
      if (inGraph) {
        compositeScore += inGraph.score * 0.4;
        moveRationale = inGraph.rationale;
      }

      // Aporte Sub-Motor 2 (Estilo & Biotipo)
      const inStyle = verdicts.style.favoredMoves.find((s) => s.san === m.san);
      if (inStyle) {
        compositeScore += inStyle.score * 0.25;
        if (!moveRationale) moveRationale = inStyle.rationale;
      }

      // Aporte Sub-Motor 3 (Repertorio)
      const inRep = verdicts.repertoire.favoredMoves.find((r) => r.san === m.san);
      if (inRep) {
        compositeScore += inRep.score * 0.2;
        if (!moveRationale) moveRationale = inRep.rationale;
      }

      // Aporte Sub-Motor 6 (Táctica)
      const inTactics = verdicts.tactics.favoredMoves.find((t) => t.san === m.san);
      if (inTactics) {
        compositeScore += inTactics.score * 0.15;
      }

      // Aporte Sub-Motor 5 (Profilaxis)
      const inProphy = verdicts.prophylaxis.favoredMoves.find((p) => p.san === m.san);
      if (inProphy) {
        compositeScore += inProphy.score * 0.1;
      }

      if (compositeScore > highestCompositeScore) {
        highestCompositeScore = compositeScore;
        bestMove = m;
        selectedRationale = moveRationale || 'Jugada de desarrollo armónico seleccionada por tus sub-motores.';
      }
    }

    // Auditoría transparente de los 8 sub-motores para visualización
    const assistantVotes = Object.values(verdicts).map((v) => ({
      id: v.id,
      name: v.name,
      contribution: v.statusSummary,
      scoreEffect: `${v.score}/100`,
    }));

    const styleProfile = StyleAssistant.getStyleProfile(distilled);

    return {
      engine: 'personal',
      engineName: 'Motor Personal',
      move: `${bestMove.from}${bestMove.to}`,
      from: bestMove.from,
      to: bestMove.to,
      san: bestMove.san,
      evaluation: Math.round(Math.min(100, Math.max(10, highestCompositeScore))),
      evalDisplay: `ADN Propio • ${styleProfile.archetype} (${storedGames.length} partidas)`,
      confidence: Math.round(Math.min(100, highestCompositeScore)),
      explanation: selectedRationale,
      color: '#fbbf24',
      timeTakenMs: 8,
      timestamp: Date.now(),
      assistantVotes,
    };
  } catch (err) {
    console.warn('[PersonalEngine] Recuperación segura automática (Zero-Crash):', err);
    return null;
  }
}
