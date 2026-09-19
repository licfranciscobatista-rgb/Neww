// Copia el motor Stockfish (WebAssembly) del paquete npm "stockfish" a public/stockfish/,
// para que Vite lo incluya en dist/ y Capacitor lo empaquete dentro del APK.
//
// Se ejecuta tras `npm install` (postinstall) y durante el build. Nunca hace fallar la instalación:
// si algo sale mal, la app simplemente usa el cálculo básico de respaldo.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(pick, path.join(outDir, path.basename(pick)));
  fs.copyFileSync(wasm, path.join(outDir, path.basename(wasm)));
  fs.writeFileSync(
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
  fs.writeFileSync(path.join(garboDir, 'engine.json'), JSON.stringify(garboConfig, null, 2) + '\n');
  fs.mkdirSync(garbochessDir, { recursive: true });
  fs.writeFileSync(path.join(garbochessDir, 'engine.json'), JSON.stringify(garboConfig, null, 2) + '\n');
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
  fs.writeFileSync(path.join(maiaDir, 'engine.json'), JSON.stringify(maiaConfig, null, 2) + '\n');
  console.log('[maia] Configuración engine.json lista en public/maia/');
} catch (err) {
  console.warn('[stockfish] No se pudo preparar el motor real:', err && err.message ? err.message : err);
  process.exit(0);
}
