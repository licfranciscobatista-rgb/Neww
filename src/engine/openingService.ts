import type { OpeningChoice } from './openingIndex';
export type CatalogueItem = { id: string; eco: string; name: string };
export function getOpeningName(id: string): string | undefined { return catalogue.find(item => item.id === id)?.name; }
let worker: Worker | null = null;
let sequence = 0;
let catalogue: CatalogueItem[] = [];
let failed = false;
const pending = new Map<number, (choice: OpeningChoice) => void>();
const subscribers = new Set<(items: CatalogueItem[]) => void>();
function init(): void {
  if (worker || typeof Worker === 'undefined') return;
  worker = new Worker(new URL('./openingWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.type === 'ready') {
      catalogue = data.catalogue;
      subscribers.forEach(callback => callback(catalogue));
    } else if (data.type === 'error') {
      failed = true;
      pending.forEach(resolve => resolve({ status: 'unavailable' })); pending.clear();
    } else { pending.get(data.id)?.(data.result); pending.delete(data.id); }
  };
  worker.onerror = () => { failed = true; pending.forEach(resolve => resolve({ status: 'unavailable' })); pending.clear(); };
}
export function subscribeOpeningCatalogue(callback: (items: CatalogueItem[]) => void): () => void {
  subscribers.add(callback); init(); callback(catalogue);
  return () => { subscribers.delete(callback); };
}
export function queryOpening(fen: string, selected: string, history: string[]): Promise<OpeningChoice> {
  init();
  if (!worker || failed) return Promise.resolve({ status: 'unavailable' });
  const id = ++sequence;
  return new Promise(resolve => {
    const timer = setTimeout(() => { pending.delete(id); resolve({ status: 'unavailable' }); }, 90000);
    pending.set(id, result => { clearTimeout(timer); resolve(result); });
    worker!.postMessage({ id, fen, selected, history });
  });
}
