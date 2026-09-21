export type EngineType = 'stockfish' | 'garbo' | 'maia' | 'personal' | 'chessjs';

export type MoveSource =
  | 'MANUAL'
  | 'STOCKFISH_ASSISTED'
  | 'GARBO_ASSISTED'
  | 'MAIA_ASSISTED'
  | 'PERSONAL_ASSISTED'
  | 'CHESSJS_ASSISTED';

export interface EngineRecommendation {
  engine: EngineType;
  engineName: string;
  move: string;
  from: string;
  to: string;
  san: string;
  evaluation?: number;
  evalDisplay?: string;
  depth?: number;
  isMasterMove?: boolean;
  isBookMove?: boolean;
  bookOpeningName?: string;
  avoidPieceName?: string;
  avoidPieceSymbol?: string;
  simpleMoveText?: string;
  badIdeaSummary?: string;
  badIdeaDetail?: string;
  suggestedPieceName?: string;
  suggestedPieceSymbol?: string;
  suggestedSan?: string;
  confidence?: number;
  explanation?: string;
  color?: string;
  humanProbability?: number;
  timeTakenMs?: number;
  timestamp?: number;
  assistantVotes?: Array<{
    id: string;
    name: string;
    contribution: string;
    scoreEffect: string;
  }>;
}

export interface CandidateArrow {
  from: string;
  to: string;
  label?: string;
  san?: string;
  color?: string;
}

export interface GameMove {
  from: string;
  to: string;
  san: string;
  uci?: string;
  ply: number;
  moveNumber?: number;
  source: MoveSource;
  thinkTime?: number;
  fenBefore?: string;
  fenAfter?: string;
  clockRemainingWhite?: number;
  clockRemainingBlack?: number;
  timestamp?: number;
}

export interface DecisionEventCandidate {
  move?: string;
  san: string;
  eval: number;
}

export interface DecisionEvent {
  gameId: string;
  ply: number;
  fenBefore: string;
  selectedMove: string;
  selectedSan: string;
  moveSource: MoveSource;
  clockRemaining: number;
  thinkTime: number;
  objectiveEvalBefore: number;
  objectiveEvalAfter: number;
  decisionFreedom: number;
  theoreticalStatus: string;
  tacticalContext: string;
  phase: string;
  reasonableCandidates: DecisionEventCandidate[];
  candidateSpread: number;
  fingerprintBefore: {
    hash: string;
    phase?: string;
    materialDiff?: number;
  };
}

export interface GameRecord {
  id: string;
  date: string;
  title: string;
  whiteName?: string;
  blackName?: string;
  playerColor: 'w' | 'b';
  result: '1-0' | '0-1' | '1/2-1/2' | string;
  reason?: string;
  pgn: string;
  moves: GameMove[];
  movesCount: number;
  finalFen?: string;
  decisionEvents?: DecisionEvent[];
  stockfishUsageCount?: number;
  garboUsageCount?: number;
  openingName?: string;
  openingEco?: string;
  completedAt?: number;
}

export type KnowledgeStatus = 'NEW' | 'REINFORCEMENT' | 'CONTRADICTION' | 'REDUNDANT';

export interface PersonalKnowledgeItem {
  id: string;
  category: string;
  title: string;
  description: string;
  confidence: number;
  evidenceCount: number;
  firstSeenGameId?: string;
  lastUpdatedGameId?: string;
  status?: 'CONSOLIDATED' | 'PENDING';
  classification?: KnowledgeStatus;
  tendencyScore?: number;
  contextKey?: string;
}

export interface PlayStyle {
  aggression: number;
  tacticalSharpness: number;
  positionalPatience: number;
  kingSafetyFocus: number;
  endgamePreference: number;
  timePressureControl: number;
}

export interface RecurrentMistake {
  pattern: string;
  occurrences: number;
  advice: string;
}

export interface MaiaHistoryRecord {
  id: string;
  gameId: string;
  ply: number;
  fen: string;
  playerColor: 'w' | 'b';
  chosenMove: string;
  chosenSan: string;
  source: MoveSource;
  selfEloCalibration: number;
  timestamp?: number;
}

export interface PlayerProfile {
  name: string;
  username: string;
  estimatedElo: number | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  isCalibrated?: boolean;
  playStyle?: PlayStyle | null;
  style: {
    aggressiveness: number;
    tacticalInclination: number;
    patience: number;
    isCalibrated?: boolean;
  };
  maiaEloCalibration: number;
  consolidatedKnowledge: PersonalKnowledgeItem[];
  pendingKnowledge: PersonalKnowledgeItem[];
  maiaHistory?: MaiaHistoryRecord[];
  recurrentMistakes: RecurrentMistake[];
}

export interface ThinkingTimeEstimate {
  recommendedSeconds: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  complexityScore: number;
  reasoning: string;
}

export type MoveQuality =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

export interface MoveAnalysis {
  ply: number;
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  evalBefore: number;
  evalAfter: number;
  deltaLoss: number;
  quality: MoveQuality;
  bestMoveSan: string;
  bestMoveUci: string;
  bestMoveEval: number;
  explanation: string;
}

export interface GameAnalysisReport {
  id: string;
  gameId: string;
  title: string;
  date: string;
  playerColor: 'w' | 'b';
  whiteAccuracy: number;
  blackAccuracy: number;
  summary: string;
  movesCount: number;
  breakdown: {
    white: Record<MoveQuality, number>;
    black: Record<MoveQuality, number>;
  };
  moves: MoveAnalysis[];
  analyzedAt: number;
}
