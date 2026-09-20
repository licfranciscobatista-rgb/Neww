import type { Chess } from 'chess.js';

export interface TheoryEntry {
  eco: string;
  name: string;
  moves: string[];
}

export const THEORY_BOOK: TheoryEntry[] = [
  // Aperturas de Rey
  { eco: 'B00', name: 'Apertura de Peón de Rey', moves: ['e4'] },
  { eco: 'C20', name: 'Apertura Abierta', moves: ['e4', 'e5'] },
  { eco: 'C42', name: 'Defensa Petrov', moves: ['e4', 'e5', 'Nf3', 'Nf6'] },
  { eco: 'C44', name: 'Apertura Escocesa', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'] },
  { eco: 'C45', name: 'Escocesa: Cuatro Caballos', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6'] },
  { eco: 'C50', name: 'Giuoco Piano / Apertura Italiana', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'] },
  { eco: 'C53', name: 'Italiana: Giuoco Piano Principal', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3'] },
  { eco: 'C55', name: 'Italiana: Defensa de los Dos Caballos', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3'] },
  { eco: 'C60', name: 'Apertura Española (Ruy López)', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },
  { eco: 'C65', name: 'Ruy López: Defensa Berlinesa', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6', 'O-O'] },
  { eco: 'C78', name: 'Ruy López: Variante Abierta', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O'] },
  { eco: 'B20', name: 'Defensa Siciliana', moves: ['e4', 'c5'] },
  { eco: 'B27', name: 'Siciliana Abierta', moves: ['e4', 'c5', 'Nf3'] },
  { eco: 'B90', name: 'Siciliana: Variante Najdorf', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Be3'] },
  { eco: 'B70', name: 'Siciliana: Variante del Dragón', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6', 'Be3'] },
  { eco: 'B30', name: 'Siciliana Rossolimo / Moscú', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'Bb5'] },
  { eco: 'C00', name: 'Defensa Francesa', moves: ['e4', 'e6'] },
  { eco: 'C02', name: 'Francesa: Variante del Avance', moves: ['e4', 'e6', 'd4', 'd5', 'e5'] },
  { eco: 'C10', name: 'Francesa: Variante Clásica', moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6'] },
  { eco: 'C05', name: 'Francesa: Tarrasch', moves: ['e4', 'e6', 'd4', 'd5', 'Nd2', 'Nf6'] },
  { eco: 'B10', name: 'Defensa Caro-Kann', moves: ['e4', 'c6'] },
  { eco: 'B12', name: 'Caro-Kann: Variante del Avance', moves: ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5'] },
  { eco: 'B15', name: 'Caro-Kann: Variante Principal', moves: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4'] },
  { eco: 'B01', name: 'Defensa Escandinava', moves: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3'] },
  { eco: 'B07', name: 'Defensa Pirc', moves: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6'] },
  
  // Aperturas de Dama y Cerradas
  { eco: 'D00', name: 'Apertura de Peón de Dama', moves: ['d4'] },
  { eco: 'D02', name: 'Sistema Londres', moves: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4'] },
  { eco: 'D06', name: 'Gambito de Dama', moves: ['d4', 'd5', 'c4'] },
  { eco: 'D20', name: 'Gambito de Dama Aceptado', moves: ['d4', 'd5', 'c4', 'dxc4', 'Nf3'] },
  { eco: 'D30', name: 'Gambito de Dama Declinado', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Nf3'] },
  { eco: 'D10', name: 'Defensa Eslava', moves: ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6'] },
  { eco: 'E60', name: 'Defensa India de Rey', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6'] },
  { eco: 'E20', name: 'Defensa Nimzoindia', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'] },
  { eco: 'E00', name: 'Apertura Catalana', moves: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2'] },
  { eco: 'A04', name: 'Apertura Réti', moves: ['Nf3', 'd5', 'c4'] },
  { eco: 'A10', name: 'Apertura Inglesa', moves: ['c4', 'e5', 'Nc3'] },
];

export function lookupTheory(sanMoves: string[]): {
  openingName: string;
  eco: string;
  isBook: boolean;
} {
  if (!sanMoves || sanMoves.length === 0) {
    return { openingName: 'Posición Inicial', eco: 'A00', isBook: true };
  }

  let bestMatch: TheoryEntry | null = null;
  let maxLen = 0;

  for (const entry of THEORY_BOOK) {
    if (entry.moves.length <= sanMoves.length) {
      const matches = entry.moves.every((m, idx) => m === sanMoves[idx]);
      if (matches && entry.moves.length > maxLen) {
        bestMatch = entry;
        maxLen = entry.moves.length;
      }
    }
  }

  // La partida sigue "en libro" si es el inicio (o la totalidad) de alguna línea conocida.
  // Antes solo contaba si coincidía EXACTAMENTE con una entrada: 1.e4 e5 2.Nf3 salía "fuera de libro"
  // aunque getNextTheoryMoves ofrece continuaciones para esa misma posición.
  const prefixEntry = THEORY_BOOK.find(
    (entry) => entry.moves.length >= sanMoves.length && sanMoves.every((m, idx) => entry.moves[idx] === m)
  );

  if (bestMatch) {
    return {
      openingName: bestMatch.name,
      eco: bestMatch.eco,
      isBook: !!prefixEntry,
    };
  }

  if (prefixEntry) {
    return { openingName: prefixEntry.name, eco: prefixEntry.eco, isBook: true };
  }

  return {
    openingName: 'Partida Abierta / Variante Personal',
    eco: 'A00',
    isBook: false,
  };
}

/**
 * Obtiene las siguientes jugadas teóricas conocidas a partir del historial de movimientos.
 */
export function getNextTheoryMoves(sanMoves: string[]): string[] {
  const currentLen = sanMoves.length;
  const nextMoves = new Set<string>();

  for (const entry of THEORY_BOOK) {
    if (entry.moves.length > currentLen) {
      const matchesPrefix = sanMoves.every((m, idx) => entry.moves[idx] === m);
      if (matchesPrefix) {
        nextMoves.add(entry.moves[currentLen]);
      }
    }
  }

  return Array.from(nextMoves);
}

/**
 * Continuaciones de libro para el tablero REAL, solo si su historial es fiable.
 *
 * El libro trabaja con la lista de jugadas. Si el tablero se creó desde un FEN (partida cargada,
 * copia sin historial…) la lista está vacía y el libro creería estar en la jugada 1: recomendaría
 * e4/d4/c4/Nf3 en cualquier posición, incluso pasando por alto un mate en 1. Aquí se comprueba que
 * el número de jugadas del historial coincide con el que indica el propio FEN antes de usar el libro.
 */
export function getReliableTheoryMoves(chess: Chess): string[] {
  const history = chess.history();
  const fields = chess.fen().split(' ');
  const fullmove = parseInt(fields[5], 10);
  if (!Number.isFinite(fullmove)) return [];
  const expectedPlies = (fullmove - 1) * 2 + (fields[1] === 'b' ? 1 : 0);
  if (history.length !== expectedPlies) return [];
  return getNextTheoryMoves(history);
}
