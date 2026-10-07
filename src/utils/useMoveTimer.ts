import { useEffect, useRef } from 'react';

export function useMoveTimer(position: string, enabled: boolean): () => number {
  const timer = useRef({ elapsed: 0, since: performance.now(), running: false });
  useEffect(() => {
    timer.current = { elapsed: 0, since: performance.now(), running: enabled && document.visibilityState === 'visible' };
  }, [position]);
  useEffect(() => {
    const update = () => {
      const now = performance.now();
      if (timer.current.running) timer.current.elapsed += now - timer.current.since;
      timer.current.since = now;
      timer.current.running = enabled && document.visibilityState === 'visible';
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => { document.removeEventListener('visibilitychange', update); };
  }, [enabled]);
  return () => (timer.current.elapsed + (timer.current.running ? performance.now() - timer.current.since : 0)) / 1000;
}
