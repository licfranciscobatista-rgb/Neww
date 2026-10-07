import { OpeningIndex, type OpeningEntry } from './openingIndex';

const ready = (async () => {
  const response = await fetch('/openings/catalogue.json');
  if (!response.ok) throw new Error('Opening catalogue unavailable');
  const entries: OpeningEntry[] = await response.json();
  const index = new OpeningIndex(entries);
  for (let i = 0; i < entries.length; i++) {
    index.add(i);
    if (i % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  const catalogue = new Map<string, { id: string; eco: string; name: string }>();
  entries.forEach(({ id, eco, name }) => {
    if (!catalogue.has(`${eco}:${name}`)) catalogue.set(`${eco}:${name}`, { id, eco, name });
  });
  self.postMessage({ type: 'ready', catalogue: [...catalogue.values()] });
  return index;
})();
ready.catch(() => self.postMessage({ type: 'error' }));
self.onmessage = async ({ data }) => {
  try {
    const index = await ready;
    self.postMessage({ id: data.id, result: index.choose(data.fen, data.selected, data.history) });
  } catch { self.postMessage({ id: data.id, result: { status: 'unavailable' } }); }
};
