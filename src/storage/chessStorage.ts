import { PlayerProfile, GameRecord, GameAnalysisReport, PersonalKnowledgeItem } from '../types/chess';
import { HistoryAssistant } from '../engine/personalAssistants';

const PROFILE_KEY = 'jugada_offline_profile_v3';
const GAMES_KEY = 'jugada_offline_games_v3';
const REPORTS_KEY = 'jugada_offline_reports_v3';

export const DEFAULT_PROFILE: PlayerProfile = {
  name: 'Francisco',
  username: 'Francisco',
  estimatedElo: null, // STRICT RULE: No fabricated Elo without games!
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  isCalibrated: false,
  playStyle: null,
  style: {
    aggressiveness: 0,
    tacticalInclination: 0,
    patience: 0,
    isCalibrated: false,
  },
  maiaEloCalibration: 1100,
  consolidatedKnowledge: [], // STRICT RULE: No fake rules before playing!
  pendingKnowledge: [],
  maiaHistory: [],
  recurrentMistakes: [], // STRICT RULE: No fake mistakes before playing!
};

/**
 * STRICT REQUIREMENT:
 * "el perfil estimado en mi perfil y estilo debe ser unicamente basado en mis partidas no pueden dar un rendimiento sin tener partidas"
 * Computes estimated Elo, real style, and knowledge strictly from actual user games.
 */
export function computeProfileFromGames(games: GameRecord[], baseProfile: PlayerProfile): PlayerProfile {
  if (!games || games.length === 0) {
    return {
      ...baseProfile,
      estimatedElo: null,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      isCalibrated: false,
      playStyle: null,
      style: {
        aggressiveness: 0,
        tacticalInclination: 0,
        patience: 0,
        isCalibrated: false,
      },
      consolidatedKnowledge: [],
      pendingKnowledge: [],
      recurrentMistakes: [],
    };
  }

  let wins = 0;
  let losses = 0;
  let draws = 0;
  let manualMovesCount = 0;

  for (const g of games) {
    const pColor = g.playerColor || 'w';
    if (g.result === '1-0') {
      if (pColor === 'w') wins++; else losses++;
    } else if (g.result === '0-1') {
      if (pColor === 'b') wins++; else losses++;
    } else if (g.result === '1/2-1/2') {
      draws++;
    }
    const moves = g.moves || [];
    manualMovesCount += moves.filter((m) => m.source === 'MANUAL').length;
  }

  const distilled = HistoryAssistant.analyzeAndDistill(games);
  const totalGames = games.length;
  const isCalibrated = distilled.manualGamesCount >= 10;

  let estimatedElo: number | null = null;
  if (distilled.manualGamesCount > 0 && manualMovesCount > 0) {
    const totalDecided = wins + losses + draws;
    const winRate = totalDecided > 0 ? (wins * 1.0 + draws * 0.5) / totalDecided : 0.5;
    const performanceBoost = Math.round(winRate * 500);
    const activityBoost = Math.min(250, Math.round((manualMovesCount / Math.max(1, distilled.manualGamesCount)) * 4));
    estimatedElo = Math.min(2400, Math.max(500, 850 + performanceBoost + activityBoost));
  }

  const tacticalScore = distilled.aggressionScore > 0
    ? Math.min(95, Math.max(10, Math.round(distilled.aggressionScore * 1.1)))
    : 0;

  // Real learned openings from actual games
  const consolidatedKnowledge: PersonalKnowledgeItem[] = [];
  if (distilled.topOpenings && distilled.topOpenings.length > 0) {
    distilled.topOpenings.forEach((op, idx) => {
      if (op.count >= 2) {
        consolidatedKnowledge.push({
          id: `ck_open_${idx}`,
          category: 'opening_preference',
          title: `Apertura frecuente: ${op.name}`,
          description: `Has jugado esta apertura en ${op.count} ocasiones en tus partidas manuales.`,
          confidence: Math.min(95, 50 + op.count * 15),
          evidenceCount: op.count,
          status: 'CONSOLIDATED',
          classification: 'REINFORCEMENT',
          tendencyScore: Math.min(90, op.count * 20),
          contextKey: op.name.toLowerCase().replace(/\s+/g, '_'),
        });
      }
    });
  }

  return {
    ...baseProfile,
    gamesPlayed: totalGames,
    wins,
    losses,
    draws,
    estimatedElo,
    isCalibrated,
    playStyle: distilled.manualGamesCount > 0 ? {
      aggression: distilled.aggressionScore,
      tacticalSharpness: tacticalScore,
      positionalPatience: distilled.patienceScore,
      kingSafetyFocus: Math.min(95, Math.max(10, Math.round(distilled.patienceScore * 0.95))),
      endgamePreference: 50,
      timePressureControl: Math.min(95, Math.max(10, distilled.averageThinkTime * 6)),
    } : null,
    style: {
      aggressiveness: distilled.manualGamesCount > 0 ? distilled.aggressionScore : (baseProfile.style?.aggressiveness || 0),
      tacticalInclination: distilled.manualGamesCount > 0 ? tacticalScore : (baseProfile.style?.tacticalInclination || 0),
      patience: distilled.manualGamesCount > 0 ? distilled.patienceScore : (baseProfile.style?.patience || 0),
      isCalibrated,
    },
    consolidatedKnowledge,
    recurrentMistakes: baseProfile.recurrentMistakes || [],
  };
}

export function loadPlayerProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    const games = loadGameHistory();
    const base: PlayerProfile = raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : { ...DEFAULT_PROFILE };
    // Always compute strictly from actual games
    return computeProfileFromGames(games, base);
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function savePlayerProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Error saving profile', e);
  }
}

export const loadProfile = loadPlayerProfile;
export const saveProfile = savePlayerProfile;

export function resetPlayerProfile(): PlayerProfile {
  savePlayerProfile(DEFAULT_PROFILE);
  return DEFAULT_PROFILE;
}

export function loadGameHistory(): GameRecord[] {
  try {
    const raw = localStorage.getItem(GAMES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export const loadGameRecords = loadGameHistory;

export function saveGameRecord(record: GameRecord): void {
  try {
    const games = loadGameHistory();
    const updated = [record, ...games.filter((g) => g.id !== record.id)];
    localStorage.setItem(GAMES_KEY, JSON.stringify(updated.slice(0, 100)));

    // Immediately recompute and save player profile strictly from updated games
    const currentProfile = loadPlayerProfile();
    const recomputed = computeProfileFromGames(updated, currentProfile);
    savePlayerProfile(recomputed);
  } catch (e) {
    console.error('Error saving game record', e);
  }
}

export function deleteGameRecord(id: string): void {
  try {
    const games = loadGameHistory();
    const updated = games.filter((g) => g.id !== id);
    localStorage.setItem(GAMES_KEY, JSON.stringify(updated));

    // Recompute profile after deletion
    const currentProfile = loadPlayerProfile();
    const recomputed = computeProfileFromGames(updated, currentProfile);
    savePlayerProfile(recomputed);
  } catch (e) {
    console.error('Error deleting game record', e);
  }
}

export function loadAnalysisReports(): GameAnalysisReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveAnalysisReport(report: GameAnalysisReport): void {
  try {
    const reports = loadAnalysisReports();
    const updated = [report, ...reports.filter((r) => r.id !== report.id)];
    localStorage.setItem(REPORTS_KEY, JSON.stringify(updated.slice(0, 50)));
  } catch (e) {
    console.error('Error saving analysis report', e);
  }
}

export function deleteAnalysisReport(id: string): void {
  try {
    const reports = loadAnalysisReports();
    const updated = reports.filter((r) => r.id !== id);
    localStorage.setItem(REPORTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error deleting report', e);
  }
}
