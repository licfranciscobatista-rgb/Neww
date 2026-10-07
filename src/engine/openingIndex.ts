import { Chess } from 'chess.js';

export interface OpeningEntry { id: string; eco: string; name: string; pgn: string }
export const OPENING_PRESETS = [
  { id: 'london', name: 'Londres', pattern: 'London System' },
  { id: 'italian', name: 'Italiana', pattern: 'Italian Game' },
  { id: 'spanish', name: 'Española', pattern: 'Ruy Lopez' },
  { id: 'scotch', name: 'Escocesa', pattern: 'Scotch Game' },
  { id: 'sicilian', name: 'Siciliana', pattern: 'Sicilian Defense' },
  { id: 'french', name: 'Francesa', pattern: 'French Defense' },
  { id: 'caro', name: 'Caro-Kann', pattern: 'Caro-Kann Defense' },
  { id: 'queens-gambit', name: 'Gambito de Dama', pattern: "Queen's Gambit" },
  { id: 'slav', name: 'Eslava', pattern: 'Slav Defense' },
  { id: 'kings-indian', name: 'India de Rey', pattern: "King's Indian Defense" },
  { id: 'english', name: 'Inglesa', pattern: 'English Opening' },
  { id: 'reti', name: 'Réti', pattern: 'Réti Opening' },
];
export type OpeningStatus = 'book' | 'deviated' | 'complete' | 'free' | 'unavailable';
export interface OpeningChoice {
  status: OpeningStatus; detected?: string; name?: string; eco?: string; uci?: string;
  notice?: string;
  suggestedSystem?: { id: string; name: string };
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
