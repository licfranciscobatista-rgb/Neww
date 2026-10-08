import { Chess } from 'chess.js';

export interface OpeningEntry { id: string; eco: string; name: string; pgn: string }
export interface OpeningPreset {
  id: string;
  name: string;
  pattern: string;
  color: 'w' | 'b' | 'any';
  description?: string;
}

export const OPENING_PRESETS: OpeningPreset[] = [
  // Sistemas y aperturas de Blancas
  { id: 'london', name: 'Sistema Londres', pattern: 'London System', color: 'w', description: 'Esquema sólido universal con d4, Af4, e3 y c3' },
  { id: 'italian', name: 'Apertura Italiana', pattern: 'Italian Game', color: 'w', description: 'Juego abierto clásico con 1.e4 e5 2.Cf3 Cc6 3.Ac4' },
  { id: 'spanish', name: 'Apertura Española', pattern: 'Ruy Lopez', color: 'w', description: 'Presión temática sobre el caballo de c6 con 3.Ab5' },
  { id: 'queens-gambit', name: 'Gambito de Dama', pattern: "Queen's Gambit", color: 'w', description: 'Lucha inmediata por el dominio central con 1.d4 d5 2.c4' },
  { id: 'scotch', name: 'Apertura Escocesa', pattern: 'Scotch Game', color: 'w', description: 'Ruptura rápida en el centro con 1.e4 e5 2.Cf3 Cc6 3.d4' },
  { id: 'english', name: 'Apertura Inglesa', pattern: 'English Opening', color: 'w', description: 'Control de la casilla d5 desde el flanco con 1.c4' },
  { id: 'reti', name: 'Apertura Réti', pattern: 'Réti Opening', color: 'w', description: 'Estrategia hipermoderna con 1.Cf3 d5 2.c4' },

  // Sistemas y defensas de Negras
  { id: 'sicilian', name: 'Defensa Siciliana', pattern: 'Sicilian Defense', color: 'b', description: 'Contrajuego asimétrico y dinámico contra 1.e4 con ...c5' },
  { id: 'caro', name: 'Defensa Caro-Kann', pattern: 'Caro-Kann Defense', color: 'b', description: 'Estructura sólida de roca con 1.e4 c6 y ...d5' },
  { id: 'french', name: 'Defensa Francesa', pattern: 'French Defense', color: 'b', description: 'Cadena de peones y contraataque sobre d4 con ...e6' },
  { id: 'kings-indian', name: 'Defensa India de Rey', pattern: "King's Indian Defense", color: 'b', description: 'Fianchetto ...g6-...Ag7 y ruptura central temática ...e5' },
  { id: 'slav', name: 'Defensa Eslava', pattern: 'Slav Defense', color: 'b', description: 'Solidez granítica contra 1.d4 d5 2.c4 sosteniendo con ...c6' },
];

export const DEFAULT_WHITE_SYSTEM = 'london';
export const DEFAULT_BLACK_SYSTEM = 'kings-indian';

export function getDefaultSystemForColor(color: 'w' | 'b'): string {
  return color === 'w' ? DEFAULT_WHITE_SYSTEM : DEFAULT_BLACK_SYSTEM;
}

export function isSystemCompatibleWithColor(systemId: string, color: 'w' | 'b'): boolean {
  if (systemId === 'free' || systemId === 'auto') return true;
  const preset = OPENING_PRESETS.find(p => p.id === systemId);
  if (!preset || preset.color === 'any') return true;
  return preset.color === color;
}
export type OpeningStatus = 'book' | 'deviated' | 'complete' | 'free' | 'unavailable';
export interface OpeningChoice {
  status: OpeningStatus;
  detected?: string;
  name?: string;
  eco?: string;
  uci?: string;
  notice?: string;
  suggestedSystem?: { id: string; name: string; reason?: string };
  isRecommendationPending?: boolean;
}

export function detectRecommendedSystem(
  chess: Chess,
  userColor: 'w' | 'b' = 'w'
): { id: string; name: string; reason: string } {
  const history = chess.history();
  const firstWhite = history[0];
  const firstBlack = history[1];

  // 1. Si no hay jugadas aún en el tablero
  if (history.length === 0) {
    if (userColor === 'w') {
      return { id: 'london', name: 'Sistema Londres', reason: 'Esquema predeterminado sólido universal para Blancas.' };
    }
    return { id: 'kings-indian', name: 'Defensa India de Rey', reason: 'Esquema predeterminado dinámico y universal para Negras.' };
  }

  // 2. Recomendación para Blancas (userColor === 'w')
  if (userColor === 'w') {
    if (firstWhite === 'd4') {
      if (history.includes('c4')) {
        return { id: 'queens-gambit', name: 'Gambito de Dama', reason: 'Apertura iniciada con 1.d4 y c4 luchando activamente por el centro.' };
      }
      return { id: 'london', name: 'Sistema Londres', reason: 'Apertura de peón dama 1.d4 ideal para estructurar el Sistema Londres.' };
    }
    if (firstWhite === 'e4') {
      if (history.some(m => m.includes('Bc4') || m.includes('Ac4'))) {
        return { id: 'italian', name: 'Apertura Italiana', reason: 'Desarrollo clásico del alfil a c4 atacando f7.' };
      }
      if (history.some(m => m.includes('Bb5') || m.includes('Ab5'))) {
        return { id: 'spanish', name: 'Apertura Española', reason: 'Presión temática de la Ruy Lopez sobre el caballo de c6.' };
      }
      if (history.length >= 3 && history.slice(2).includes('d4')) {
        return { id: 'scotch', name: 'Apertura Escocesa', reason: 'Ruptura central dinámica temprana con d4.' };
      }
      return { id: 'italian', name: 'Apertura Italiana', reason: 'Apertura abierta iniciada con 1.e4 con rápido desarrollo armónico.' };
    }
    if (firstWhite === 'c4') {
      return { id: 'english', name: 'Apertura Inglesa', reason: 'Apertura de flanco iniciada con 1.c4 controlando d5.' };
    }
    if (firstWhite === 'Nf3' || firstWhite === 'Cf3') {
      return { id: 'reti', name: 'Apertura Réti', reason: 'Esquema hipermoderno iniciado con 1.Cf3.' };
    }
    return { id: 'london', name: 'Sistema Londres', reason: 'Sistema universal más sólido para el bando de Blancas.' };
  }

  // 3. Recomendación para Negras (userColor === 'b')
  if (firstWhite === 'e4') {
    if (firstBlack === 'c5' || history.includes('c5')) {
      return { id: 'sicilian', name: 'Defensa Siciliana', reason: 'Respuesta asimétrica 1...c5 contra 1.e4 para buscar contrajuego.' };
    }
    if (firstBlack === 'c6' || history.includes('c6')) {
      return { id: 'caro', name: 'Defensa Caro-Kann', reason: 'Estructura sólida de roca con 1...c6 preparando ...d5.' };
    }
    if (firstBlack === 'e6' || history.includes('e6')) {
      return { id: 'french', name: 'Defensa Francesa', reason: 'Cadena de peones y contraataque con 1...e6 preparando ...d5.' };
    }
    return { id: 'sicilian', name: 'Defensa Siciliana', reason: 'Principal defensa agresiva y temática contra 1.e4.' };
  }

  if (firstWhite === 'd4') {
    if (firstBlack === 'c6' || (history.includes('c6') && history.includes('d5'))) {
      return { id: 'slav', name: 'Defensa Eslava', reason: 'Estructura de muro sólido con ...c6 y ...d5 contra el peón dama.' };
    }
    if (firstBlack === 'Nf6' || firstBlack === 'Cf6' || history.includes('g6')) {
      return { id: 'kings-indian', name: 'Defensa India de Rey', reason: 'Fianchetto ...g6-...Ag7 y ruptura central temática contra 1.d4.' };
    }
    return { id: 'kings-indian', name: 'Defensa India de Rey', reason: 'Defensa flexible y universal para Negras contra 1.d4.' };
  }

  if (firstWhite === 'c4' || firstWhite === 'Nf3' || firstWhite === 'Cf3') {
    return { id: 'kings-indian', name: 'Defensa India de Rey', reason: 'Estructura de Indias adaptable y elástica contra aperturas de flanco.' };
  }

  return { id: 'kings-indian', name: 'Defensa India de Rey', reason: 'Esquema universal sólido para Negras.' };
}
export function shouldPauseGarbo(selected: string, opening: OpeningChoice): boolean {
  return selected !== 'free' && selected !== 'auto' && !opening.uci;
}
export function openingPositionKey(fen: string): string { return fen.split(' ').slice(0, 4).join(' '); }

export class OpeningIndex {
  private positions = new Map<string, Map<string, Set<number>>>();
  private endings = new Map<string, number[]>();
  public readonly entries: OpeningEntry[];
  constructor(entries: OpeningEntry[]) { this.entries = entries; }

  add(index: number): void {
    const board = new Chess();
    board.loadPgn(this.entries[index].pgn);
    for (const move of board.history({ verbose: true })) {
      const key = openingPositionKey(move.before);
      let continuations = this.positions.get(key);
      if (!continuations) { continuations = new Map(); this.positions.set(key, continuations); }
      const uci = move.from + move.to + (move.promotion || '');
      let ids = continuations.get(uci);
      if (!ids) { ids = new Set(); continuations.set(uci, ids); }
      ids.add(index);
    }
    const key = openingPositionKey(board.fen());
    this.endings.set(key, [...(this.endings.get(key) || []), index]);
  }

  choose(fen: string, selected: string, history: string[] = []): OpeningChoice {
    const key = openingPositionKey(fen);
    const preset = OPENING_PRESETS.find(p => p.id === selected);
    const selectedEntry = this.entries.find(entry => entry.id === selected);
    const matches = (i: number) => selected === 'auto' ||
      (preset ? this.entries[i].name.includes(preset.pattern) : selectedEntry &&
        this.entries[i].name === selectedEntry.name && this.entries[i].eco === selectedEntry.eco);
    let detected: string | undefined;
    for (const position of [...history, fen]) {
      const named = this.endings.get(openingPositionKey(position));
      if (named?.length) detected = this.entries[named[0]].name;
    }
    if (selected === 'free') return { status: 'free', detected };
    const moves = this.positions.get(key);
    const candidates: Array<{ uci: string; ids: number[] }> = [];
    for (const [uci, ids] of moves || []) {
      const matching = [...ids].filter(matches);
      if (matching.length) candidates.push({ uci, ids: matching });
    }
    candidates.sort((a, b) => b.ids.length - a.ids.length || a.uci.localeCompare(b.uci));
    if (candidates.length) {
      const choice = candidates[0];
      const opening = this.entries[choice.ids.reduce((best, id) =>
        this.entries[id].pgn.length < this.entries[best].pgn.length ? id : best, choice.ids[0])];
      return { status: 'book', uci: choice.uci, name: opening.name, eco: opening.eco, detected };
    }
    const finished = [...history, fen].some(position =>
      this.endings.get(openingPositionKey(position))?.some(matches));
    return { status: selected === 'auto' ? 'free' : finished ? 'complete' : 'deviated', detected };
  }
}
