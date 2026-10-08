import { OPENING_PRESETS, isSystemCompatibleWithColor } from './openingIndex';

export interface SystemPreferences { white: string; black: string; transitionMoves: number }
const KEY = 'chess.system-preferences.v1';
export const DEFAULT_SYSTEM_PREFERENCES: SystemPreferences = { white: 'london', black: 'kings-indian', transitionMoves: 7 };

export function validateSystemPreferences(value: Partial<SystemPreferences> = {}): SystemPreferences {
  const valid = (id: string | undefined, color: 'w' | 'b') => id &&
    (id === 'free' || OPENING_PRESETS.some(p => p.id === id)) && isSystemCompatibleWithColor(id, color);
  return {
    white: valid(value.white, 'w') ? value.white! : 'london',
    black: valid(value.black, 'b') ? value.black! : 'kings-indian',
    transitionMoves: Number.isInteger(value.transitionMoves) ? Math.max(3, Math.min(12, value.transitionMoves!)) : 7,
  };
}
export function loadSystemPreferences(): SystemPreferences {
  try { return validateSystemPreferences(JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch { return { ...DEFAULT_SYSTEM_PREFERENCES }; }
}
export function saveSystemPreferences(preferences: SystemPreferences): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(validateSystemPreferences(preferences))); return true; }
  catch { return false; }
}
export function favoriteForColor(preferences: SystemPreferences, color: 'w' | 'b'): string {
  return color === 'w' ? preferences.white : preferences.black;
}
// The FEN fullmove counter also closes the window for games imported without history.
export function canTransitionSystem(fen: string, limit = 7): boolean {
  const fields = fen.split(' ');
  const fullmove = Number(fields[5]);
  return Number.isInteger(fullmove) && fullmove >= 1 && fullmove <= limit;
}
