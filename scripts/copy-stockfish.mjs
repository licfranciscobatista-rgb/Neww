// Copia el motor Stockfish (WebAssembly) del paquete npm "stockfish" a public/stockfish/,
// para que Vite lo incluya en dist/ y Capacitor lo empaquete dentro del APK.
//
// Se ejecuta tras `npm install` (postinstall) y durante el build. Nunca hace fallar la instalación:
// si algo sale mal, la app simplemente usa el cálculo básico de respaldo.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// No pisar archivos de configuración que ya existen (antes el script borraba public/stockfish/
// completo y regeneraba todos los engine.json, perdiendo cambios hechos a mano).
function writeIfMissing(file, content) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, content);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = path.join(root, 'node_modules', 'stockfish');
const outDir = path.join(root, 'public', 'stockfish');

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walk(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

// Devuelve los .js que tienen un .wasm hermano con el mismo nombre base
function candidatePairs(files) {
  const set = new Set(files);
  return files
    .filter((f) => f.endsWith('.js'))
    .filter((f) => set.has(f.replace(/\.js$/, '.wasm')))
    .filter((f) => !/asm\.js$|\.min\.js$/.test(f));
}

try {
  if (!fs.existsSync(pkgDir)) {
    console.warn('[stockfish] Paquete "stockfish" no instalado: se usará el motor básico de respaldo.');
    process.exit(0);
  }

  const pairs = candidatePairs(walk(pkgDir));
  // Preferencia: lite + un solo hilo (pequeño y sin cabeceras especiales) > un solo hilo > el resto
  const pick =
    pairs.find((f) => /lite-single/.test(path.basename(f))) ||
    pairs.find((f) => /single/.test(path.basename(f))) ||
    pairs[0];

  if (!pick) {
    console.warn('[stockfish] No se encontró una variante de un solo hilo: se usará el motor básico de respaldo.');
    console.warn('[stockfish] Archivos .js con .wasm hermano encontrados:', pairs.map((p) => path.relative(pkgDir, p)));
    process.exit(0);
  }

  const wasm = pick.replace(/\.js$/, '.wasm');
  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(pick, path.join(outDir, path.basename(pick)));
  fs.copyFileSync(wasm, path.join(outDir, path.basename(wasm)));
  writeIfMissing(
    path.join(outDir, 'engine.json'),
    JSON.stringify({ js: path.basename(pick), wasm: path.basename(wasm) }, null, 2) + '\n'
  );

  const mb = (fs.statSync(wasm).size / 1024 / 1024).toFixed(1);
  console.log(`[stockfish] Motor copiado: ${path.basename(pick)} (+ wasm de ${mb} MB) -> public/stockfish/`);

  // Asegurar json de GarboChess
  const garboDir = path.join(root, 'public', 'garbo');
  const garbochessDir = path.join(root, 'public', 'garbochess');
  const garboConfig = {
    id: 'garbo',
    name: 'GarboChess',
    version: '3.0',
    author: 'Gary Linscott',
    type: 'classical-javascript',
    description: 'Motor posicional clásico con heurística de desarrollo armónico, seguridad de rey y control de centro.',
    features: [
      'alpha-beta-pruning',
      'piece-square-tables',
      'quiescence-search',
      'positional-development-scoring',
      'center-pawn-priority'
    ],
    defaultDepth: 4,
    defaultTimeMs: 600,
    color: '#059669',
    badge: 'GB Garbo',
    weights: {
      castlingBonus: 40,
      centerControlBonus: 25,
      minorPieceDevelopmentBonus: 30,
      prematureQueenPenalty: 35,
      pawnConsolidationBonus: 15
    }
  };
  fs.mkdirSync(garboDir, { recursive: true });
  writeIfMissing(path.join(garboDir, 'engine.json'), JSON.stringify(garboConfig, null, 2) + '\n');
  fs.mkdirSync(garbochessDir, { recursive: true });
  writeIfMissing(path.join(garbochessDir, 'engine.json'), JSON.stringify(garboConfig, null, 2) + '\n');
  console.log('[garbo] Configuración engine.json lista en public/garbo/ y public/garbochess/');

  // Asegurar json de Maia Chess
  const maiaDir = path.join(root, 'public', 'maia');
  const maiaConfig = {
    id: 'maia',
    name: 'Maia Chess',
    version: '1.0',
    author: 'University of Toronto / Maia Chess Project',
    type: 'neural-network-human-prediction',
    description: 'Red neuronal entrenada sobre millones de partidas humanas para predecir jugadas según nivel Elo (1100, 1500, 1900).',
    features: [
      'human-move-prediction',
      'elo-targeted-weights',
      'blunder-rate-modeling',
      'tactical-depth-scaling',
      'capture-attraction'
    ],
    defaultElo: 1100,
    supportedElos: [1100, 1500, 1900],
    color: '#7c3aed',
    badge: 'M Maia',
    models: {
      '1100': {
        name: 'Maia 1100 (Aficionado)',
        blunderRate: 0.18,
        tacticalDepth: 1,
        description: 'Juego intuitivo con visión táctica básica y tolerancia a imprecisiones típicas de club.'
      },
      '1500': {
        name: 'Maia 1500 (Club Intermedio)',
        blunderRate: 0.08,
        tacticalDepth: 2,
        description: 'Juego sólido de club con buen desarrollo y visión de amenazas directas.'
      },
      '1900': {
        name: 'Maia 1900 (Avanzado)',
        blunderRate: 0.03,
        tacticalDepth: 3,
        description: 'Juego posicional maduro con cálculo táctico limpio y alta consistencia.'
      }
    }
  };
  fs.mkdirSync(maiaDir, { recursive: true });
  writeIfMissing(path.join(maiaDir, 'engine.json'), JSON.stringify(maiaConfig, null, 2) + '\n');
  console.log('[maia] Configuración engine.json lista en public/maia/');

  // Asegurar json del Motor Personal y sus 8 Ayudantes
  const personalDir = path.join(root, 'public', 'personal');
  const personalConfig = {
    id: 'personal',
    name: 'Motor Personal (Modelo Jugador)',
    version: '1.0',
    type: 'adaptive-distilled-clone',
    description: 'Motor adaptativo que replica tu propio estilo de juego mediante destilación de memoria y 8 ayudantes analíticos especializados.',
    calibrationThreshold: 10,
    color: '#2563eb',
    badge: 'P Personal',
    features: [
      'manual-move-distillation',
      'anti-ai-contamination-filter',
      'book-move-discrimination',
      'style-affinity-scoring',
      'tactical-risk-fingerprint'
    ],
    assistants: [
      {
        id: 'history',
        name: 'Ayudante de Historial',
        role: 'Destila y comprime la memoria de partidas manuales descartando jugadas de libro e IA (Stockfish/Garbo).',
        metric: 'Bytes destilados y ratio de compresión'
      },
      {
        id: 'style',
        name: 'Ayudante de Estilo',
        role: 'Evalúa la afinidad de jugadas candidatas frente a los patrones puros del jugador de 1.0 a 10.0.',
        metric: 'Afinidad de estilo y arquetipo'
      },
      {
        id: 'openings',
        name: 'Ayudante de Aperturas & Repertorio',
        role: 'Identifica las líneas predilectas con blancas y negras del usuario y sus tasas de victoria.',
        metric: 'Repertorio de aperturas y jugada predilecta'
      },
      {
        id: 'mistakes',
        name: 'Ayudante de Errores Recurrentes',
        role: 'Rastrea patrones de equivocaciones frecuentes (salidas de dama prematuras, rey sin enroque).',
        metric: 'Frecuencia y severidad de patrones de error'
      },
      {
        id: 'prophylaxis',
        name: 'Ayudante de Profilaxis y Paciencia',
        role: 'Mide la capacidad de maniobra, prevención de amenazas rivales y tiempo de espera antes de abrir.',
        metric: 'Puntuación de paciencia profiláctica'
      },
      {
        id: 'tactics',
        name: 'Ayudante de Táctica y Agresividad',
        role: 'Calcula el porcentaje de juego ofensivo, capturas, jaques e iniciativa directa.',
        metric: 'Densidad táctica y puntuación de agresividad'
      },
      {
        id: 'time',
        name: 'Ayudante de Tiempo y Ritmo',
        role: 'Supervisa la cadencia de segundos por jugada para alertar de decisiones precipitadas o apuros.',
        metric: 'Tiempo medio de reflexión y cadencia'
      },
      {
        id: 'endgame',
        name: 'Ayudante de Transición y Finales',
        role: 'Monitorea la efectividad en cambios de dama y transiciones a finales técnicos tras la jugada 30.',
        metric: 'Frecuencia de finales y ritmo de simplificación'
      }
    ]
  };
  fs.mkdirSync(personalDir, { recursive: true });
  writeIfMissing(path.join(personalDir, 'engine.json'), JSON.stringify(personalConfig, null, 2) + '\n');
  console.log('[personal] Configuración engine.json con los 8 ayudantes lista en public/personal/');

  // Asegurar json del Director y Subdirector de Control
  const controlDir = path.join(root, 'public', 'control');
  const directorConfig = {
    id: 'director',
    name: 'Director de Control de Motores',
    version: '1.0',
    type: 'orchestration-controller',
    description: 'Orquestador central que supervisa el ciclo de vida, asignación estricta de memoria (máx 20 MB por motor), encendido y apagado de Stockfish, Garbo, Maia y Motor Personal.',
    status: 'ONLINE',
    limits: {
      maxMemoryPerEngineMb: 20,
      idleTimeoutMs: 3000,
      auditEngineShutdownOnComplete: true
    },
    subdirector: {
      id: 'control-assistant',
      name: 'Subdirector (Asistente de Control)',
      role: 'Supervisión en tiempo real de colas rápidas, filtrado de paquetes de candidatos entre Stockfish y Garbo, y telemetría de latencias.',
      status: 'ONLINE'
    },
    modules: [
      {
        name: 'BookMovesEngine',
        status: 'ONLINE',
        role: 'Motor de jugadas de libro nativo en Chess.js con respuesta inmediata (<1ms) sin despertar motores pesados.'
      },
      {
        name: 'OpeningRegisterEngine',
        status: 'ONLINE',
        role: 'Registro y clasificación de aperturas ECO en memoria.'
      },
      {
        name: 'AuditOrchestrator',
        status: 'ONLINE',
        role: 'Ejecución de auditorías profundas con Stockfish y apagado automático para ahorro de batería.'
      },
      {
        name: 'HumanityVerificationEngine',
        status: 'ONLINE',
        role: 'Supervisión con Maia para contrastar probabilidad de juego humano y detectar anomalías.'
      }
    ]
  };
  fs.mkdirSync(controlDir, { recursive: true });
  writeIfMissing(path.join(controlDir, 'director.json'), JSON.stringify(directorConfig, null, 2) + '\n');
  console.log('[control] Configuración director.json lista en public/control/');

  // Asegurar json del Motor de Jugadas de Libro (Chess.js)
  const bookDir = path.join(root, 'public', 'book');
  const bookConfig = {
    id: 'book-moves',
    name: 'Motor de Jugadas de Libro & Aperturas (Chess.js)',
    version: '1.0',
    type: 'native-theory-book',
    description: 'Motor independiente para resolución inmediata de aperturas teóricas (<1ms) sin despertar motores pesados ni consumir batería.',
    status: 'ONLINE',
    color: '#eab308',
    badge: 'BK Libro',
    limits: {
      maxMemoryMb: 5,
      maxResponseTimeMs: 5,
      independenceLevel: 'completamente-aislado'
    },
    roles: [
      'Identificación instantánea de aperturas ECO y variantes principales',
      'Servicio de jugadas de libro al Subdirector para acelerar respuestas',
      'Filtro de exclusión para que el Ayudante de Historial descarte jugadas teóricas antes de destilar memoria del usuario',
      'Referencia para que Maia no proponga jugadas de Stockfish salvo si son jugadas de libro oficiales'
    ]
  };
  fs.mkdirSync(bookDir, { recursive: true });
  writeIfMissing(path.join(bookDir, 'engine.json'), JSON.stringify(bookConfig, null, 2) + '\n');
  console.log('[book] Configuración engine.json lista en public/book/');
} catch (err) {
  console.warn('[stockfish] No se pudo preparar el motor real:', err && err.message ? err.message : err);
  process.exit(0);
}
