import { EngineType } from '../../types/chess';

export interface EngineHealthItem {
  engine: EngineType;
  engineName: string;
  status: 'OPTIMAL' | 'MODERATE' | 'ASSISTED';
  lastExecutionMs: number;
  avgExecutionMs: number;
  interventionsCount: number;
  lastInterventionReason?: string;
  throughputMovesPerSec?: number;
  lastCheckedTime?: string;
}

export type EngineHealthMap = Record<EngineType, EngineHealthItem>;

class EngineWorkloadMonitor {
  private health: EngineHealthMap;
  private listeners: Array<(health: EngineHealthMap) => void> = [];

  constructor() {
    this.health = {
      stockfish: {
        engine: 'stockfish',
        engineName: 'Stockfish 19',
        status: 'OPTIMAL',
        lastExecutionMs: 14,
        avgExecutionMs: 16,
        interventionsCount: 0,
        throughputMovesPerSec: 62,
        lastCheckedTime: new Date().toLocaleTimeString('es-ES'),
      },
      garbo: {
        engine: 'garbo',
        engineName: 'GarboChess',
        status: 'OPTIMAL',
        lastExecutionMs: 18,
        avgExecutionMs: 20,
        interventionsCount: 0,
        throughputMovesPerSec: 50,
        lastCheckedTime: new Date().toLocaleTimeString('es-ES'),
      },
      maia: {
        engine: 'maia',
        engineName: 'Maia 3',
        status: 'OPTIMAL',
        lastExecutionMs: 15,
        avgExecutionMs: 18,
        interventionsCount: 0,
        throughputMovesPerSec: 55,
        lastCheckedTime: new Date().toLocaleTimeString('es-ES'),
      },
      personal: {
        engine: 'personal',
        engineName: 'Motor Personal',
        status: 'OPTIMAL',
        lastExecutionMs: 12,
        avgExecutionMs: 15,
        interventionsCount: 0,
        throughputMovesPerSec: 78,
        lastCheckedTime: new Date().toLocaleTimeString('es-ES'),
      },
      chessjs: {
        engine: 'chessjs',
        engineName: 'Chess.js (Árbitro & Dudosa)',
        status: 'OPTIMAL',
        lastExecutionMs: 1,
        avgExecutionMs: 2,
        interventionsCount: 0,
        throughputMovesPerSec: 450,
        lastCheckedTime: new Date().toLocaleTimeString('es-ES'),
      },
    };
  }

  public getHealth(): EngineHealthMap {
    return { ...this.health };
  }

  public recordExecution(engine: EngineType, ms: number): void {
    const item = this.health[engine];
    if (!item) return;

    item.lastExecutionMs = ms;
    item.avgExecutionMs = Math.round((item.avgExecutionMs * 4 + ms) / 5);
    item.lastCheckedTime = new Date().toLocaleTimeString('es-ES');

    if (ms > 150) {
      item.status = 'ASSISTED';
      item.interventionsCount++;
      item.lastInterventionReason = `Podada de ramas por latencia ${ms}ms`;
    } else if (ms > 70) {
      item.status = 'MODERATE';
    } else {
      item.status = 'OPTIMAL';
    }

    this.notify();
  }

  public subscribe(cb: (health: EngineHealthMap) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify(): void {
    const copy = this.getHealth();
    this.listeners.forEach((l) => l(copy));
  }
}

export const engineWorkloadMonitor = new EngineWorkloadMonitor();
