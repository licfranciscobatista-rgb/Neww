import type { GameRecord } from '../types/chess';

export interface HistoryFilters {
  search: string;
  color: string;
  result: string;
  date: string;
}

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function matchesHistoryFilters(game: GameRecord, filters: HistoryFilters): boolean {
  const win = game.playerColor === 'w' ? '1-0' : '0-1';
  const loss = game.playerColor === 'w' ? '0-1' : '1-0';
  const result = game.result === win ? 'win' : game.result === loss ? 'loss' : game.result === '1/2-1/2' ? 'draw' : 'unfinished';
  return (!filters.color || game.playerColor === filters.color)
    && (!filters.result || result === filters.result)
    && (!filters.date || game.date === filters.date)
    && normalize(`${game.title} ${game.openingName || ''} ${game.openingEco || ''} ${game.result} ${game.date}`).includes(normalize(filters.search));
}
