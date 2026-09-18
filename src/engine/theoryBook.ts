export interface TheoryEntry {
  eco: string;
  name: string;
  moves: string[];
}

const THEORY_BOOK: TheoryEntry[] = [
  { eco: 'B00', name: 'Apertura de Peón de Rey', moves: ['e4'] },
  { eco: 'C20', name: 'Apertura Abierta', moves: ['e4', 'e5'] },
  { eco: 'C42', name: 'Defensa Petrov', moves: ['e4', 'e5', 'Nf3', 'Nf6'] },
  { eco: 'C44', name: 'Apertura Escocesa', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'] },
  { eco: 'C50', name: 'Giuoco Piano / Apertura Italiana', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'] },
  { eco: 'C53', name: 'Italiana: Giuoco Piano', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'] },
  { eco: 'C60', name: 'Apertura Española (Ruy López)', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },
  { eco: 'C65', name: 'Ruy López: Defensa Berlinesa', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'] },
  { eco: 'B20', name: 'Defensa Siciliana', moves: ['e4', 'c5'] },
  { eco: 'B27', name: 'Siciliana Abierta', moves: ['e4', 'c5', 'Nf3'] },
  { eco: 'B90', name: 'Siciliana: Variante Najdorf', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'] },
  { eco: 'B70', name: 'Siciliana: Variante del Dragón', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6'] },
  { eco: 'C00', name: 'Defensa Francesa', moves: ['e4', 'e6'] },
  { eco: 'C02', name: 'Francesa: Variante del Avance', moves: ['e4', 'e6', 'd4', 'd5', 'e5'] },
  { eco: 'B10', name: 'Defensa Caro-Kann', moves: ['e4', 'c6'] },
  { eco: 'B12', name: 'Caro-Kann: Variante del Avance', moves: ['e4', 'c6', 'd4', 'd5', 'e5'] },
  { eco: 'B01', name: 'Defensa Escandinava', moves: ['e4', 'd5'] },
  { eco: 'B07', name: 'Defensa Pirc', moves: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6'] },
  { eco: 'D00', name: 'Apertura de Peón de Dama', moves: ['d4'] },
  { eco: 'D02', name: 'Sistema Londres', moves: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4'] },
  { eco: 'D06', name: 'Gambito de Dama', moves: ['d4', 'd5', 'c4'] },
  { eco: 'D20', name: 'Gambito de Dama Aceptado', moves: ['d4', 'd5', 'c4', 'dxc4'] },
  { eco: 'D30', name: 'Gambito de Dama Declinado', moves: ['d4', 'd5', 'c4', 'e6'] },
  { eco: 'D10', name: 'Defensa Eslava', moves: ['d4', 'd5', 'c4', 'c6'] },
  { eco: 'E60', name: 'Defensa India de Rey', moves: ['d4', 'Nf6', 'c4', 'g6'] },
  { eco: 'E20', name: 'Defensa Nimzoindia', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'] },
  { eco: 'A04', name: 'Apertura Réti', moves: ['Nf3'] },
  { eco: 'A10', name: 'Apertura Inglesa', moves: ['c4'] },
];

export function lookupTheory(sanMoves: string[]): {
  openingName: string;
  eco: string;
  isBook: boolean;
} {
  if (!sanMoves || sanMoves.length === 0) {
    return { openingName: 'Posición Inicial', eco: 'A00', isBook: true };
  }

  // Find longest matching prefix
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

  if (bestMatch) {
    return {
      openingName: bestMatch.name,
      eco: bestMatch.eco,
      isBook: maxLen >= sanMoves.length,
    };
  }

  return {
    openingName: 'Partida Abierta / Variante Personal',
    eco: 'A00',
    isBook: false,
  };
}
