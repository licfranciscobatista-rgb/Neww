import { Chess, Square } from 'chess.js';

export interface MoveInstruction {
  pieceName: string;
  pieceSymbol: string;
  actionTitle: string;
  fromToLabel: string;
  shortSan: string;
  tacticalIntent: string;
}

const PIECE_NAMES: Record<string, string> = {
  p: 'Peón',
  n: 'Caballo',
  b: 'Alfil',
  r: 'Torre',
  q: 'Dama',
  k: 'Rey',
};

const PIECE_ICONS: Record<string, string> = {
  p: '♟',
  n: '♞',
  b: '♝',
  r: '♜',
  q: '♛',
  k: '♚',
};

export function getDirectMoveInstruction(
  chess: Chess,
  from: string,
  to: string,
  san: string
): MoveInstruction {
  const piece = chess.get(from as Square);
  const targetPiece = chess.get(to as Square);
  const type = piece ? piece.type.toLowerCase() : 'p';
  const pieceName = PIECE_NAMES[type] || 'Pieza';
  const pieceSymbol = PIECE_ICONS[type] || '♟';
  const fromToLabel = `${from.toUpperCase()} ➔ ${to.toUpperCase()}`;

  let actionTitle = `Mover ${pieceName} a ${to.toUpperCase()}`;
  let tacticalIntent = `Control de la casilla ${to.toUpperCase()} y activación posicional.`;

  if (san.startsWith('O-O-O')) {
    actionTitle = 'Enroque Largo (Reina)';
    tacticalIntent = 'Protege al rey y conecta las torres hacia el centro.';
  } else if (san.startsWith('O-O')) {
    actionTitle = 'Enroque Corto (Rey)';
    tacticalIntent = 'Pone al rey en seguridad y activa la torre en la columna f.';
  } else if (targetPiece || san.includes('x')) {
    const targetName = targetPiece ? PIECE_NAMES[targetPiece.type.toLowerCase()] : 'pieza';
    actionTitle = `Capturar ${targetName} en ${to.toUpperCase()}`;
    tacticalIntent = `Gana material o elimina una pieza clave en ${to.toUpperCase()}.`;
  } else if (type === 'n') {
    tacticalIntent = `Maniobra de caballo centralizando presión sobre ${to.toUpperCase()}.`;
  } else if (type === 'b') {
    tacticalIntent = `Dominio de la diagonal y presión a larga distancia hacia ${to.toUpperCase()}.`;
  } else if (type === 'r') {
    tacticalIntent = `Ocupación de columna abierta o semiabierta en ${to.toUpperCase()}.`;
  } else if (type === 'q') {
    tacticalIntent = `Coordinación de ataque y máxima actividad de dama en ${to.toUpperCase()}.`;
  } else if (type === 'p') {
    tacticalIntent = `Avance de peón ganando espacio central y restringiendo al rival.`;
  }

  if (san.includes('+')) {
    actionTitle += ' ¡Jaque!';
    tacticalIntent = `Amenaza directa al rey rival obligando a responder.`;
  } else if (san.includes('#')) {
    actionTitle += ' ¡Jaque Mate!';
    tacticalIntent = `Victoria definitiva por jaque mate.`;
  }

  return {
    pieceName,
    pieceSymbol,
    actionTitle,
    fromToLabel,
    shortSan: san,
    tacticalIntent,
  };
}
