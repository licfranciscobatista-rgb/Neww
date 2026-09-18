import { Chess } from 'chess.js';

export interface PositionFingerprint {
  hash: string;
  phase: 'opening' | 'middlegame' | 'endgame';
  materialDiff: number;
  kingSafetyWhite: number;
  kingSafetyBlack: number;
}

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export function calculatePositionFingerprint(chess: Chess): PositionFingerprint {
  const board = chess.board();
  let whiteMat = 0;
  let blackMat = 0;
  let totalPiecesExcludingPawns = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p) {
        const val = PIECE_VALUES[p.type] || 0;
        if (p.color === 'w') whiteMat += val;
        else blackMat += val;

        if (p.type !== 'p' && p.type !== 'k') {
          totalPiecesExcludingPawns++;
        }
      }
    }
  }

  const plyCount = chess.history().length;
  let phase: 'opening' | 'middlegame' | 'endgame' = 'middlegame';
  if (plyCount <= 16 && totalPiecesExcludingPawns >= 12) {
    phase = 'opening';
  } else if (totalPiecesExcludingPawns <= 6 || (whiteMat <= 13 && blackMat <= 13)) {
    phase = 'endgame';
  }

  // Basic king safety calculation
  let kingSafetyWhite = 85;
  let kingSafetyBlack = 85;

  // Reduced safety if in check
  if (chess.inCheck()) {
    if (chess.turn() === 'w') kingSafetyWhite -= 30;
    else kingSafetyBlack -= 30;
  }

  const simpleHash = chess
    .fen()
    .split(' ')
    .slice(0, 3)
    .join('_')
    .replace(/[\/\s]/g, '');

  return {
    hash: simpleHash,
    phase,
    materialDiff: whiteMat - blackMat,
    kingSafetyWhite: Math.max(20, Math.min(100, kingSafetyWhite)),
    kingSafetyBlack: Math.max(20, Math.min(100, kingSafetyBlack)),
  };
}
