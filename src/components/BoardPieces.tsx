import React, { useRef } from 'react';
import { Chess } from 'chess.js';

interface Placement { id: number; color: string; type: string; square: string }

export function BoardPieces({ chess, orientation }: { chess: Chess; orientation: 'w' | 'b' }) {
  const previous = useRef<Placement[]>([]);
  const sequence = useRef(0);
  const occupied = chess.board().flat().filter(piece => piece !== null);
  const available = [...previous.current];
  const remaining = occupied.filter(piece => !available.some(old => old.square === piece.square && old.color === piece.color && old.type === piece.type));
  const placed: Placement[] = occupied.filter(piece => !remaining.includes(piece)).map(piece => {
    const index = available.findIndex(old => old.square === piece.square && old.color === piece.color && old.type === piece.type);
    return available.splice(index, 1)[0];
  });
  for (const piece of remaining) {
    const index = available.findIndex(old => old.color === piece.color && old.type === piece.type);
    const id = index >= 0 ? available.splice(index, 1)[0].id : ++sequence.current;
    placed.push({ id, color: piece.color, type: piece.type, square: piece.square });
  }
  previous.current = placed;
  return <div className="absolute inset-0 pointer-events-none z-20" aria-label="Piezas del tablero">
    {placed.map(piece => {
      const file = piece.square.charCodeAt(0) - 97;
      const rank = Number(piece.square[1]) - 1;
      return <img key={piece.id} data-piece-id={piece.id} data-square={piece.square} src={`/pieces/neo/${piece.color}${piece.type}.png`}
        alt={`${piece.color === 'w' ? 'Blanca' : 'Negra'} ${piece.type}`} draggable={false}
        className="absolute object-contain select-none transition-[left,top] duration-200 ease-out motion-reduce:transition-none"
        style={{ width: '12.5%', height: '12.5%', left: `${(orientation === 'w' ? file : 7 - file) * 12.5}%`, top: `${(orientation === 'w' ? 7 - rank : rank) * 12.5}%` }} />;
    })}
  </div>;
}
