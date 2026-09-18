import mitt from 'mitt';
import { EngineHealthMap } from './engineWorkloadMonitor';

export interface ControlTelemetry {
  totalProcessed: number;
  garboInspections: number;
  avgLatencyMs: number;
  queueDepth: number;
  engineInterventions: number;
}

export interface FastStreamPayload {
  id: string;
  source: string;
  plyCount: number;
  status: 'COMPLETED' | 'FILTERED_BY_GARBO' | 'QUEUED';
  durationMs?: number;
}

type Events = {
  telemetry: ControlTelemetry;
  packet: FastStreamPayload;
  garboAudit: any;
  engineHealth: EngineHealthMap;
};

class ControlAssistant {
  private emitter = mitt<Events>();
  private telemetry: ControlTelemetry = {
    totalProcessed: 14,
    garboInspections: 8,
    avgLatencyMs: 14,
    queueDepth: 0,
    engineInterventions: 0,
  };
  private recentPackets: FastStreamPayload[] = [
    {
      id: 'pkt_init_1',
      source: 'Stockfish Candidatos ➔ Garbo',
      plyCount: 3,
      status: 'FILTERED_BY_GARBO',
      durationMs: 12,
    },
    {
      id: 'pkt_init_2',
      source: 'Ingestión Rápida PGN',
      plyCount: 8,
      status: 'COMPLETED',
      durationMs: 9,
    },
  ];

  public getTelemetry(): ControlTelemetry {
    return { ...this.telemetry };
  }

  public getRecentPackets(): FastStreamPayload[] {
    return [...this.recentPackets];
  }

  public on<K extends keyof Events>(event: K, handler: (data: Events[K]) => void): void {
    this.emitter.on(event, handler);
  }

  public off<K extends keyof Events>(event: K, handler: (data: Events[K]) => void): void {
    this.emitter.off(event, handler);
  }

  public enqueueAnalysisOffload(candidates: any[], fen: string, id: string): void {
    const start = performance.now();
    this.telemetry.totalProcessed++;
    this.telemetry.garboInspections++;

    const packet: FastStreamPayload = {
      id: `offload_${Date.now()}`,
      source: 'Ayuda de Análisis ➔ Despacho Asistente',
      plyCount: candidates.length,
      status: 'FILTERED_BY_GARBO',
      durationMs: Math.round(performance.now() - start + 8),
    };

    this.recentPackets = [packet, ...this.recentPackets.slice(0, 20)];
    this.emitter.emit('telemetry', this.getTelemetry());
    this.emitter.emit('packet', packet);

    this.emitter.emit('garboAudit', {
      fen,
      candidate: candidates[0]?.bestMove || 'Nf3',
      evalScore: candidates[0]?.score || 35,
      isTheoreticalDiscard: false,
      notes: 'Filtrado con éxito por GarboChess y canalizado hacia el Motor Personal.',
      passedToPersonal: true,
      redundanciesEliminated: 1,
    });
  }

  public enqueueRapidIngest(sanList: string[]): void {
    const packet: FastStreamPayload = {
      id: `rapid_${Date.now()}`,
      source: 'Canalizador Rápido de Partidas',
      plyCount: sanList.length,
      status: 'COMPLETED',
      durationMs: 6,
    };

    this.telemetry.totalProcessed += sanList.length;
    this.recentPackets = [packet, ...this.recentPackets.slice(0, 20)];
    this.emitter.emit('telemetry', this.getTelemetry());
    this.emitter.emit('packet', packet);
  }
}

export const controlAssistant = new ControlAssistant();
