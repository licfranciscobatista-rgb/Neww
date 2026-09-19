export interface DirectorConfigJson {
  id: string;
  name: string;
  version: string;
  type: string;
  authority: string;
  status: string;
  executivePolicies: {
    strictProcessIsolation: boolean;
    maxTotalRamCeilingMb: number;
    maxMemoryPerEngineMb: Record<string, number>;
    idleTimeoutMs: number;
    autoHibernateInactiveEngines: boolean;
    auditEngineShutdownOnComplete: boolean;
    uiFrameTargetFps: number;
    priorityExecutionMode: string;
  };
  subdirectorInterface: {
    id: string;
    name: string;
    role: string;
    status: string;
    channel: string;
    commandsHandled: string[];
  };
  executiveCommands: Array<{
    id: string;
    label: string;
    description: string;
    risk: 'NONE' | 'LOW' | 'HIGH';
  }>;
  registeredEngines: Array<{
    id: string;
    name: string;
    role: string;
    color: string;
  }>;
}

export interface SubDirectorConfigJson {
  id: string;
  name: string;
  version: string;
  role: string;
  status: string;
  guardrails: {
    stockfishTimeoutMs: number;
    garboTimeoutMs: number;
    maiaTimeoutMs: number;
    personalTimeoutMs: number;
    maxFrameBudgetMs: number;
    targetFps: number;
    autoCutoffEnabled: boolean;
  };
  candidateFilter: {
    engineComparisonEnabled: boolean;
    tacticalBlunderToleranceCp: number;
    minConfidencePercentage: number;
    arbitrationStrategy: string;
  };
  telemetryPipeline: {
    sampleIntervalMs: number;
    fpsRollingWindow: number;
    healthCheckFrequencySeconds: number;
    heartbeatActive: boolean;
  };
}

export interface EnginesRegistryJson {
  version: string;
  lastUpdated: string;
  enginesCount: number;
  engines: Array<{
    id: string;
    name: string;
    category: string;
    type: string;
    protocol: string;
    memoryQuotaMb: number;
    defaultTimeoutMs: number;
    maxDepth: number;
    targetElo: number;
    role: string;
    isPrimary: boolean;
    arrowColor: string;
    status: string;
  }>;
}

export interface ControlModulesJson {
  version: string;
  system: string;
  modules: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    allocatedRamMb?: number;
    status: string;
    activeGuards: string[];
  }>;
}

export interface AuditPolicyJson {
  version: string;
  policyName: string;
  author: string;
  enforcementLevel: string;
  centipawnThresholds: Record<string, { label: string; maxCpLoss?: number; minCpLoss?: number }>;
  stockfishAuditLimits: {
    maxPliesPerBatch: number;
    movetimePerPlyMs: number;
    threads: number;
    hashMb: number;
    autoShutdownOnComplete: boolean;
  };
}

export interface EcoDatabaseJson {
  version: string;
  database: string;
  openingsCount: number;
  records: Array<{
    eco: string;
    name: string;
    moves: string;
    fen: string;
  }>;
}

export interface EndgameTablesJson {
  version: string;
  database: string;
  principlesCount: number;
  principles: Array<{
    id: string;
    name: string;
    description: string;
    winningSide: string;
    difficulty: string;
  }>;
}

export type ControlJsonFileKey =
  | 'director.json'
  | 'subdirector.json'
  | 'engines.json'
  | 'modules.json'
  | 'audit-policy.json'
  | 'database-eco.json'
  | 'endgame-tables.json';

class ControlConfigLoader {
  private cache: Map<string, unknown> = new Map();

  public async loadJson<T>(filename: ControlJsonFileKey): Promise<T> {
    if (this.cache.has(filename)) {
      return this.cache.get(filename) as T;
    }

    try {
      const res = await fetch(`/control/${filename}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} al cargar /control/${filename}`);
      }
      const data = (await res.json()) as T;
      this.cache.set(filename, data);
      return data;
    } catch (e) {
      console.warn(`[ControlConfigLoader] Carga diferida de ${filename}, usando fallback:`, e);
      return this.getFallbackJson(filename) as T;
    }
  }

  public getFallbackJson(filename: ControlJsonFileKey): unknown {
    switch (filename) {
      case 'director.json':
        return {
          id: 'director',
          name: 'Director General de Control',
          version: '2.5.0',
          status: 'ONLINE',
          executivePolicies: { priorityExecutionMode: 'BALANCED_60FPS', maxTotalRamCeilingMb: 100 },
        };
      case 'subdirector.json':
        return {
          id: 'subdirector',
          name: 'Sub-Director Técnico',
          version: '2.0',
          status: 'OPERATIONAL',
          guardrails: { stockfishTimeoutMs: 15000, targetFps: 60 },
        };
      case 'engines.json':
        return {
          version: '2.1.0',
          enginesCount: 7,
          engines: [],
        };
      default:
        return { version: '1.0', status: 'ONLINE' };
    }
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

export const controlConfigLoader = new ControlConfigLoader();
