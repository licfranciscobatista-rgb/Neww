import type { SystemEngineResult } from './systemsCoordinator';

// Exact FEN and game identity prevent a hypothetical reply leaking onto another board.
export class RivalThinkingCache {
  private game = '';
  private entries = new Map<string, SystemEngineResult>();

  reset(game: string) {
    if (this.game !== game) {
      this.game = game;
      this.entries.clear();
    }
  }

  get(game: string, fen: string) {
    return this.game === game ? this.entries.get(fen) : undefined;
  }

  put(game: string, fen: string, result: SystemEngineResult) {
    if (this.game !== game || result.source !== 'wasm') return;
    this.entries.set(fen, result);
    if (this.entries.size > 8) this.entries.delete(this.entries.keys().next().value!);
  }
}
