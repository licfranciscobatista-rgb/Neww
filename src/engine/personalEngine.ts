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
import { lookupTheory, distillBookMove } from './theoryBook';
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

// Caché de estado del motor personal para evitar recálculos en el hilo de juego
let cachedPersonalStatus: PersonalEngineStatus | null = null;
let cachedPersonalHash = '';

export function getPersonalEngineStatus(
  profile: PlayerProfile,
  games?: GameRecord[],
  currentChess?: Chess,
  includeDNA = false
): PersonalEngineStatus {
  try {
    const storedGames = games || loadGameRecords();
    const hash = JSON.stringify([includeDNA, storedGames.map((game) => [game.id, game.result,
      game.playerColor, game.pgn, game.moves?.map((move) => [move.san, move.source, move.thinkTime])])]);

    if (!currentChess && cachedPersonalStatus && cachedPersonalHash === hash) {
      return cachedPersonalStatus;
    }

    const distilled = HistoryAssistant.analyzeAndDistill(storedGames);
    // Solo compilar DNA pesado cuando se solicite explícitamente (ej: pestaña Perfil), jamás en cada jugada
    const compiledDNA = includeDNA ? compilePersonalEngineDNA(profile, storedGames, distilled) : undefined;

    const effectiveGames = distilled.manualGamesCount;
    const requiredGames = 10;
    const isUnlocked = effectiveGames >= 1;
    const isFullyCalibrated = effectiveGames >= requiredGames;
    const progressPercent = Math.min(100, Math.round((effectiveGames / requiredGames) * 100));

    let subEngineReport: PersonalAuditReport | undefined;
    if (currentChess && isUnlocked) {
      subEngineReport = runSubEngineAudit(currentChess, distilled, storedGames);
    }

    let statusMessage = '';
    if (isFullyCalibrated) {
      statusMessage = `Perfil personal basado en ${effectiveGames} partidas con decisiones manuales. Sigue aprendiendo; la cantidad de partidas no garantiza la calidad de cada jugada.`;
    } else if (effectiveGames > 0) {
      statusMessage = `Calibración Progresiva (${effectiveGames}/${requiredGames} partidas): Aprendiendo de tu estilo activo en tiempo real (${progressPercent}% completado).`;
    } else {
      statusMessage = `Motor Personal en Espera (0/${requiredGames}): Juega tu primera partida para comenzar a calibrar tu biotipo.`;
    }

    const result: PersonalEngineStatus = {
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

    if (!currentChess) {
      cachedPersonalStatus = result;
      cachedPersonalHash = hash;
    }

    return result;
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
  timeRemainingSeconds?: number | null;
  stockfishMoveSan?: string;
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
  const { chess, profile, games, timeRemainingSeconds = null, stockfishMoveSan = undefined } = params;

  if (!chess) return null;

  try {
    const storedGames = games || loadGameRecords();
    const status = getPersonalEngineStatus(profile, storedGames);

    // REGLA ESTRICTA Y HONESTA: Si no hay al menos 10 partidas, el motor NO proyecta jugadas inventadas
    if (!status.isUnlocked) {
      return null;
    }

    const legalMoves = chess.moves({ verbose: true });
    if (!legalMoves || legalMoves.length === 0) return null;

    const distilled = status.distilledData;

    // Detección estricta de Libro vs Fuera de Libro en la posición actual
    const currentHistory = chess.history();
    const positionTheory = lookupTheory(currentHistory);
    const fenFields = chess.fen().split(' ');
    const expectedPlies = (Number(fenFields[5]) - 1) * 2 + (fenFields[1] === 'b' ? 1 : 0);
    const reliableHistory = currentHistory.length === expectedPlies &&
      (currentHistory.length > 0 || fenFields.slice(0, 4).join(' ') === new Chess().fen().split(' ').slice(0, 4).join(' '));
    const isOutOfBook = !reliableHistory || !positionTheory.isBook;

    // Ejecución de los 8 Sub-Motores autónomos
    const auditReport = runSubEngineAudit(chess, distilled, storedGames, timeRemainingSeconds);
    const verdicts = auditReport.subEngineVerdicts;
    const styleProfile = StyleAssistant.getStyleProfile(distilled);

    // 1. Filtro de vetos del Sub-Motor 4 (Blunder Shield)
    const vetoedSan = new Set(verdicts.blunder_shield.vetoMoves.map((v) => v.san));
    const graphFavored = verdicts.graph.favoredMoves;

    const scoredCandidates: Array<{
      move: any;
      score: number;
      rationale: string;
      isAuthenticPersonalMatch: boolean;
      isBookMove: boolean;
      bookOpeningName?: string;
    }> = [];

    for (const m of legalMoves) {
      if (vetoedSan.has(m.san) && legalMoves.some((candidate) => !vetoedSan.has(candidate.san))) {
        continue;
      }

      const moveDistill = distillBookMove(chess, m.san);
      const isCandidateBook = !isOutOfBook && moveDistill.isBook;

      let compositeScore = 50;
      if (m.san.includes('#')) compositeScore += 1000;
      let moveRationale = m.san.includes('#') ? 'Mate inmediato: termina la partida.' : '';
      let isAuthenticPersonalMatch = false;

      // Aporte Sub-Motor 1 (Grafo Posicional): Si el usuario ya la jugó en esta misma posición
      const inGraph = graphFavored.find((g) => g.san === m.san);
      if (inGraph) {
        compositeScore += inGraph.score * 0.45;
        if (!moveRationale) moveRationale = inGraph.rationale;
        isAuthenticPersonalMatch = true;
      }

      // Aporte Sub-Motor 2 (Estilo & Biotipo)
      const inStyle = verdicts.style.favoredMoves.find((s) => s.san === m.san);
      if (inStyle) {
        compositeScore += inStyle.score * 0.35;
        if (!moveRationale) moveRationale = inStyle.rationale;
        if (inStyle.score > 60) isAuthenticPersonalMatch = true;
      }

      // Aporte Sub-Motor 3 (Repertorio)
      const inRep = verdicts.repertoire.favoredMoves.find((r) => r.san === m.san);
      if (inRep) {
        compositeScore += inRep.score * 0.3;
        if (!moveRationale) moveRationale = inRep.rationale;
        isAuthenticPersonalMatch = true;
      }

      // Aporte de afinidad de piezas del jugador (Caballo vs Alfil vs Torre)
      const piecePref = distilled.piecePreference;
      if (m.piece === 'n' && piecePref.knightsCount >= piecePref.bishopsCount && piecePref.knightsCount > 0) {
        compositeScore += 16;
        if (!moveRationale) moveRationale = 'Preferencia por maniobras de caballo (+Caballos en tu historial).';
        isAuthenticPersonalMatch = true;
      } else if (m.piece === 'b' && piecePref.bishopsCount > piecePref.knightsCount) {
        compositeScore += 16;
        if (!moveRationale) moveRationale = 'Preferencia por diagonales de alfil (+Alfiles en tu historial).';
        isAuthenticPersonalMatch = true;
      }

      // Aporte de enroque preferido en tu biotipo
      if (m.san === 'O-O' && distilled.castlingPreference === 'kingside') {
        compositeScore += 18;
        if (!moveRationale) moveRationale = 'Enroque corto preferente en tu biotipo de partidas.';
        isAuthenticPersonalMatch = true;
      } else if (m.san === 'O-O-O' && distilled.castlingPreference === 'queenside') {
        compositeScore += 18;
        if (!moveRationale) moveRationale = 'Enroque largo preferente en tu biotipo de partidas.';
        isAuthenticPersonalMatch = true;
      }

      // Aporte Sub-Motor 6 (Táctica / Iniciativa)
      const inTactics = verdicts.tactics.favoredMoves.find((t) => t.san === m.san);
      if (inTactics && distilled.aggressionScore > 50) {
        compositeScore += inTactics.score * 0.2;
        if (!moveRationale) moveRationale = inTactics.rationale;
        isAuthenticPersonalMatch = true;
      }

      // Aporte Sub-Motor 5 (Profilaxis / Paciencia)
      const inProphy = verdicts.prophylaxis.favoredMoves.find((p) => p.san === m.san);
      if (inProphy && distilled.patienceScore > 50) {
        compositeScore += inProphy.score * 0.22;
        if (!moveRationale) moveRationale = inProphy.rationale;
        isAuthenticPersonalMatch = true;
      }

      scoredCandidates.push({
        move: m,
        score: compositeScore,
        rationale: moveRationale || (isOutOfBook
          ? `Línea posicional personalizada (${styleProfile.archetype}).`
          : `Jugada armónica de repertorio (${positionTheory.openingName}).`),
        isAuthenticPersonalMatch,
        isBookMove: isCandidateBook,
        bookOpeningName: isCandidateBook ? moveDistill.openingName : undefined,
      });
    }

    if (scoredCandidates.length === 0) return null;

    scoredCandidates.sort((a, b) => b.score - a.score);

    // Stockfish is compared only after the personal choice has been made.
    const chosen = scoredCandidates[0];
    let isDifferentFromStockfish = false;
    let contrastReason = '';

    if (stockfishMoveSan) {
      const stockfishMatchesChosen = chosen.move.san === stockfishMoveSan;

      if (isOutOfBook) {
        // POSICIÓN FUERA DE LIBRO: Diferenciación activa contra Stockfish
        if (stockfishMatchesChosen) {
          isDifferentFromStockfish = false;
          contrastReason = `Fuera de libro: la puntuacion de tu historial y estilo coincide con Stockfish en ${chosen.move.san}. Coincidir no significa copiar ni que sea una jugada forzada.`;
        } else {
          isDifferentFromStockfish = true;
          contrastReason = `⚡ Fuera de libro detectado: Elección soberana del Motor Personal (${chosen.move.san}) con identidad propia vs línea de máquina de Stockfish (${stockfishMoveSan}).`;
        }
      } else {
        // POSICIÓN EN LIBRO DE APERTURAS
        if (stockfishMatchesChosen) {
          isDifferentFromStockfish = false;
          contrastReason = `📖 Jugada de Libro ECO (${positionTheory.openingName}): Ambos convergen en la teoría universal de aperturas.`;
        } else {
          isDifferentFromStockfish = true;
          contrastReason = `📖 Repertorio Personal: Variante propia de apertura (${chosen.move.san}) vs recomendación general (${stockfishMoveSan}).`;
        }
      }
    } else {
      // Stockfish apagado o no consultado este turno
      isDifferentFromStockfish = true;
      contrastReason = isOutOfBook
        ? `🧠 Fuera de libro detectado: Decisión 100% soberana del Motor Personal (${styleProfile.archetype}) con Stockfish inactivo.`
        : `📖 Jugada teórica de apertura (${positionTheory.openingName}) según tu repertorio.`;
    }

    // Auditoría transparente de los 8 sub-motores para visualización
    const assistantVotes = Object.values(verdicts).map((v) => ({
      id: v.id,
      name: v.name,
      contribution: v.statusSummary,
      scoreEffect: `${v.score}/100`,
    }));

    const isChosenBook = !isOutOfBook && chosen.isBookMove;

    return {
      engine: 'personal',
      engineName: 'Motor Personal',
      move: `${chosen.move.from}${chosen.move.to}${chosen.move.promotion || ''}`,
      from: chosen.move.from,
      to: chosen.move.to,
      san: chosen.move.san,
      evaluation: Math.round(Math.min(100, Math.max(10, chosen.score))),
      evalDisplay: isChosenBook
        ? `Libro ECO • ${chosen.bookOpeningName || positionTheory.openingName}`
        : `ADN Propio • ${styleProfile.archetype} (${storedGames.length} part.)`,
      confidence: Math.round(Math.min(90, 35 + Math.min(10, distilled.manualGamesCount) * 4 +
        (chosen.isAuthenticPersonalMatch ? 10 : 0))),
      explanation: chosen.rationale,
      color: '#fbbf24',
      timeTakenMs: 4,
      timestamp: Date.now(),
      isBookMove: isChosenBook,
      bookOpeningName: isChosenBook ? (chosen.bookOpeningName || positionTheory.openingName) : undefined,
      assistantVotes,
      stockfishContrast: {
        isDifferentFromStockfish,
        stockfishSan: stockfishMoveSan,
        contrastReason,
      },
    };
  } catch (err) {
    console.warn('[PersonalEngine] Recuperación segura automática (Zero-Crash):', err);
    return null;
  }
}

