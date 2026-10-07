import { Chess, Color, PieceSymbol, Square, validateFen } from 'chess.js';

export type SetupBoard = Record<string, { color: Color; type: PieceSymbol }>;

export function setupBoardFromFen(fen: string): SetupBoard {
  const chess = new Chess(fen);
  const result: SetupBoard = {};
  for (const row of chess.board()) for (const piece of row) {
    if (piece) result[piece.square] = { color: piece.color, type: piece.type };
  }
  return result;
}

export function buildSetupFen(board: SetupBoard, turn: Color, rights: string, ep: string, halfmove = 0, fullmove = 1): string {
  const ranks: string[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = '';
    let empty = 0;
    for (const file of 'abcdefgh') {
      const piece = board[`${file}${rank}`];
      if (!piece) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += piece.color === 'w' ? piece.type.toUpperCase() : piece.type;
    }
    if (empty) row += empty;
    ranks.push(row);
  }
  return `${ranks.join('/')} ${turn} ${rights || '-'} ${ep} ${halfmove} ${fullmove}`;
}

export function validateSetupPosition(fen: string): string | null {
  const valid = validateFen(fen);
  if (!valid.ok) return 'Posición inválida: debe haber un rey por bando y ningún peón en la primera o última fila.';
  const chess = new Chess(fen);
  for (const color of ['w', 'b'] as Color[]) {
    const pieces = chess.board().flat().filter(p => p?.color === color);
    if (pieces.length > 16 || pieces.filter(p => p?.type === 'p').length > 8) return 'Hay demasiadas piezas o peones de un bando.';
  }
  const [, turn, rights, ep] = fen.split(' ');
  for (const right of rights === '-' ? '' : rights) {
    const white = right === right.toUpperCase();
    const rank = white ? '1' : '8';
    const color = white ? 'w' : 'b';
    const king = chess.get(`e${rank}` as Square);
    const rook = chess.get(`${right.toLowerCase() === 'k' ? 'h' : 'a'}${rank}` as Square);
    if (king?.type !== 'k' || king.color !== color || rook?.type !== 'r' || rook.color !== color) return 'El enroque seleccionado requiere el rey y la torre en sus casillas iniciales.';
  }
  const opponent = new Chess(fen.replace(` ${turn} `, ` ${turn === 'w' ? 'b' : 'w'} `).replace(` ${ep} `, ' - '));
  if (opponent.inCheck()) return 'El rey del bando que acaba de mover no puede quedar en jaque. Revisa las piezas o el turno.';
  if (ep !== '-') {
    const pawnSquare = `${ep[0]}${turn === 'w' ? '5' : '4'}` as Square;
    const origin = `${ep[0]}${turn === 'w' ? '7' : '2'}` as Square;
    const pawn = chess.get(pawnSquare);
    if (chess.get(ep as Square) || chess.get(origin) || pawn?.type !== 'p' || pawn.color === turn) return 'La captura al paso no coincide con el último avance doble de un peón.';
  }
  return null;
}
