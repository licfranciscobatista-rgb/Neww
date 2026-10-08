import { useEffect, useRef, useState } from 'react';
import type { Chess } from 'chess.js';
import { emptySystemsSnapshot, runSystemAssistants, type SystemsSnapshot } from '../engine/systemAssistants';
import { realRodent } from '../engine/realRodent';
import { RealStockfishManager } from '../engine/realStockfish';
import { RivalThinkingCache } from '../engine/rivalThinking';

// Separate queue from the user's Stockfish consultations and their usage counter.
const rivalStockfish = new RealStockfishManager(4);

export function useSystemsAssistants(board: Chess, color: 'w' | 'b', selected: string, gameId: string,
  enabled: boolean, mainMove: string | undefined, waiting: boolean, limit: number) {
  const [snapshot, setSnapshot] = useState<SystemsSnapshot | null>(null);
  const previous = useRef<SystemsSnapshot | null>(null);
  const thinking = useRef(new RivalThinkingCache());
  const fen = board.fen();
  useEffect(() => {
    let cancelled = false;
    thinking.current.reset(gameId);
    const empty = emptySystemsSnapshot(board, color, selected, gameId, limit, enabled);
    setSnapshot(empty);
    if (!enabled || (board.turn() === color && waiting)) return;
    const timer = setTimeout(async () => {
      const run = (refining: boolean) => runSystemAssistants(board, color, selected, mainMove,
        position => realRodent.analyze(position, 100, 'dinamico'), {
          gameId, transitionLimit: limit, previous: previous.current, cancelled: () => cancelled,
          rivalEngineName: 'Stockfish',
          rivalAnalyzer: async position => {
            if (cancelled) return null;
            const cached = thinking.current.get(gameId, position);
            if (cached && !refining) return cached;
            const result = await rivalStockfish.analyze(position, { movetime: refining && board.turn() === color ? 4000 : 2000 });
            if (cancelled || !result) return null;
            const analysis = { uci: result.uci, scoreCp: result.scoreCp || 0, mate: result.mate,
              depth: result.depth || 0, source: 'wasm' as const };
            thinking.current.put(gameId, position, analysis);
            return analysis;
          },
          onProgress: value => { if (!cancelled && !refining) setSnapshot(value); },
        }).then(value => {
          if (cancelled || !value) return;
          setSnapshot(value);
          if (value.threat) previous.current = value;
        });
      await run(false);
      // A bounded second search uses the player's thinking time without running indefinitely.
      if (!cancelled && (board.turn() !== color || mainMove)) await run(true);
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); rivalStockfish.stop(); };
  }, [fen, color, selected, gameId, enabled, mainMove, waiting, limit]);
  return snapshot?.fen === fen && snapshot.gameId === gameId && snapshot.systemId === emptySystemsSnapshot(board, color, selected, gameId, limit, false).systemId ? snapshot : null;
}
