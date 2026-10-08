import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

type Goal = [Square, PieceSymbol];

export interface SystemMilestone {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending';
  targetSquare?: string;
}

export interface SystemDetails {
  name: string;
  color: Color;
  goals: Goal[];
  essential: PieceSymbol;
  pawnStructureTitle: string;
  pawnStructureTip: string;
  strategicGuidelines: string[];
  keySquares: string[];
  milestones: Array<{
    id: string;
    title: string;
    description: string;
    check: (b: Chess) => 'completed' | 'in_progress' | 'pending';
  }>;
}

export const SYSTEM_DETAILS_MAP: Record<string, SystemDetails> = {
  london: {
    name: 'Sistema Londres',
    color: 'w',
    goals: [['d4', 'p'], ['e3', 'p'], ['c3', 'p'], ['f4', 'b'], ['g3', 'b'], ['f3', 'n'], ['d2', 'n']],
    essential: 'b',
    pawnStructureTitle: 'Tridente Central Sólido (c3-d4-e3)',
    pawnStructureTip: 'Construye la pirámide de peones con d4, c3 y e3. Si las negras rompen con c5, sostén d4 con c3. Tu alfil de casillas negras debe salir a f4 antes de jugar e3.',
    strategicGuidelines: [
      'Alfil a f4 en la jugada 2 o 3 para evitar que quede atrapado tras el peón de e3.',
      'Si el rival juega ...Ad6 buscando cambio, retira el alfil a g3 para abrir la columna h en caso de captura.',
      'Instala un caballo en e5 como puesto avanzado dominante apoyado por el peón de d4.',
      'Enroque corto oportuno con desarrollo armónico de Cf3 y Cd2 o Ca3.',
    ],
    keySquares: ['f4', 'e5', 'd4', 'c3', 'g3'],
    milestones: [
      {
        id: 'bishop_f4',
        title: 'Alfil activo en f4',
        description: 'Desarrolla el alfil de casillas negras a f4 antes de cerrar con e3.',
        check: b => (b.get('f4')?.type === 'b' || b.get('g3')?.type === 'b' ? 'completed' : b.get('c1')?.type === 'b' ? 'pending' : 'in_progress'),
      },
      {
        id: 'pawn_triangle',
        title: 'Triángulo de peones c3-d4-e3',
        description: 'Estructura piramidal para blindar el centro contra rupturas ...c5.',
        check: b => (b.get('d4')?.type === 'p' && b.get('e3')?.type === 'p' && b.get('c3')?.type === 'p' ? 'completed' : b.get('d4')?.type === 'p' ? 'in_progress' : 'pending'),
      },
      {
        id: 'knight_f3',
        title: 'Caballo en f3 & Puesto e5',
        description: 'Control de la casilla central clave e5 para dominar el medio juego.',
        check: b => (b.get('e5')?.type === 'n' ? 'completed' : b.get('f3')?.type === 'n' ? 'in_progress' : 'pending'),
      },
      {
        id: 'safe_castle',
        title: 'Enroque corto y seguridad',
        description: 'Asegura el rey en g1 y conecta las torres para la fase de medio juego.',
        check: b => (b.get('g1')?.type === 'k' ? 'completed' : 'pending'),
      },
    ],
  },
  italian: {
    name: 'Apertura Italiana (Giuoco Piano)',
    color: 'w',
    goals: [['e4', 'p'], ['c4', 'b'], ['f3', 'n'], ['d3', 'p']],
    essential: 'b',
    pawnStructureTitle: 'Centro Clásico (e4 sostenido con d3 o c3-d4)',
    pawnStructureTip: 'Apunta con el alfil hacia f7, el punto más vulnerable de las negras. Decide entre Giuoco Pianissimo (d3) para juego maniobrado o c3-d4 para ocupar el centro completo.',
    strategicGuidelines: [
      'Alfil a c4 apuntando a la debilidad natural f7.',
      'Control central con Cf3 y e4, preparando la ruptura d4 o consolidación con d3.',
      'Clavada o presión sobre el flanco de rey negro con Ag5.',
      'Enroque corto rápido y maniobra clásica del caballo Cb1-d2-f1-g3.',
    ],
    keySquares: ['c4', 'f7', 'e4', 'd4', 'f3'],
    milestones: [
      {
        id: 'bishop_c4',
        title: 'Alfil en c4 (Diagonal f7)',
        description: 'Presiona el punto débil nativo del rey negro en f7.',
        check: b => (b.get('c4')?.type === 'b' ? 'completed' : 'pending'),
      },
      {
        id: 'center_control',
        title: 'Dominio Central e4/d3',
        description: 'Sólida base de peones en casillas centrales con e4 y d3.',
        check: b => (b.get('e4')?.type === 'p' && b.get('d3')?.type === 'p' ? 'completed' : 'in_progress'),
      },
      {
        id: 'knight_develop',
        title: 'Caballo en f3 activo',
        description: 'Presiona e5 y prepara el enroque corto.',
        check: b => (b.get('f3')?.type === 'n' ? 'completed' : 'pending'),
      },
      {
        id: 'castle',
        title: 'Enroque y maniobra Cd2-f1-g3',
        description: 'Rey seguro y traslado de piezas hacia el flanco de ataque.',
        check: b => (b.get('g1')?.type === 'k' ? 'completed' : 'pending'),
      },
    ],
  },
  spanish: {
    name: 'Apertura Española (Ruy López)',
    color: 'w',
    goals: [['e4', 'p'], ['b5', 'b'], ['f3', 'n']],
    essential: 'b',
    pawnStructureTitle: 'Tensión Central Prolongada (c3-d4 y e4)',
    pawnStructureTip: 'El alfil en b5 ejerce presión indirecta sobre el defensor del peón e5 (el caballo de c6). Mantén el alfil vivo en b3 o c2 ante el avance ...a6 y ...b5.',
    strategicGuidelines: [
      'Presionar la columna e y el peón e5 del rival.',
      'Reciclar el alfil español a b3 o c2 para mantenerlo apuntando al enroque.',
      'Preparar la ruptura central d4 apoyada por c3.',
      'Maniobra de caballo Cb1-d2-f1-g3.',
    ],
    keySquares: ['b5', 'b3', 'e4', 'd4', 'c3'],
    milestones: [
      {
        id: 'ruy_bishop',
        title: 'Alfil Español en b5',
        description: 'Inmoviliza o cuestiona el caballo defensor en c6.',
        check: b => (b.get('b5')?.type === 'b' || b.get('b3')?.type === 'b' || b.get('c2')?.type === 'b' ? 'completed' : 'pending'),
      },
      {
        id: 'prep_d4',
        title: 'Preparación de c3 y d4',
        description: 'Construir un gran centro de peones.',
        check: b => (b.get('c3')?.type === 'p' && b.get('d4')?.type === 'p' ? 'completed' : b.get('c3')?.type === 'p' ? 'in_progress' : 'pending'),
      },
      {
        id: 'spanish_castle',
        title: 'Enroque corto y torre en e1',
        description: 'Poner la torre blanca en e1 para presionar el peón central.',
        check: b => (b.get('e1')?.type === 'r' ? 'completed' : b.get('g1')?.type === 'k' ? 'in_progress' : 'pending'),
      },
    ],
  },
  'queens-gambit': {
    name: 'Gambito de Dama',
    color: 'w',
    goals: [['d4', 'p'], ['c4', 'p'], ['c3', 'n']],
    essential: 'p',
    pawnStructureTitle: 'Presión Lateral sobre d5 (c4 vs d5)',
    pawnStructureTip: 'Ofreces el peón c4 para desviar el peón central negro de d5 y dominar el centro con e4.',
    strategicGuidelines: [
      'Presión sobre d5 con Cc3 y c4.',
      'Desarrollo del alfil de casillas negras a g5 o f4.',
      'Ocupación central con e4 si el negro cede el centro.',
    ],
    keySquares: ['d4', 'c4', 'c3', 'e4'],
    milestones: [
      {
        id: 'gambit_pawn',
        title: 'Presión con c4 y d4',
        description: 'Desafía el centro negro de inmediato.',
        check: b => (b.get('c4')?.type === 'p' && b.get('d4')?.type === 'p' ? 'completed' : 'pending'),
      },
      {
        id: 'knight_c3',
        title: 'Caballo en c3 aumentando tensión',
        description: 'Añade un segundo atacante sobre la casilla d5.',
        check: b => (b.get('c3')?.type === 'n' ? 'completed' : 'pending'),
      },
    ],
  },
  'kings-indian': {
    name: 'Defensa India de Rey',
    color: 'b',
    goals: [['g7', 'b'], ['f6', 'n'], ['d6', 'p']],
    essential: 'b',
    pawnStructureTitle: 'Fianchetto y Cadena de Peones (d6-e5 o c5)',
    pawnStructureTip: 'Cede temporalmente el centro para contraatacar con el alfil de g7 y la ruptura ...e5 o ...c5.',
    strategicGuidelines: [
      'Fianchetto rápido con g6 y Ag7.',
      'Enroque corto seguro en la jugada 4.',
      'Ruptura central temática ...e5 o ...c5 para dinamitar el centro blanco.',
      'Ataque en masa en el flanco de rey con ...f5.',
    ],
    keySquares: ['g7', 'f6', 'e5', 'f5'],
    milestones: [
      {
        id: 'fianchetto_kid',
        title: 'Alfil del Dragón en g7',
        description: 'El cañón de la diagonal larga apuntando hacia el centro.',
        check: b => (b.get('g7')?.type === 'b' ? 'completed' : 'pending'),
      },
      {
        id: 'kid_break',
        title: 'Ruptura ...e5 o ...c5',
        description: 'Abre el juego y activa todas las piezas negras.',
        check: b => (b.get('e5')?.type === 'p' || b.get('c5')?.type === 'p' ? 'completed' : 'in_progress'),
      },
    ],
  },
  sicilian: {
    name: 'Defensa Siciliana',
    color: 'b',
    goals: [['c5', 'p'], ['d6', 'p'], ['c6', 'n']],
    essential: 'p',
    pawnStructureTitle: 'Desequilibrio Asimétrico (c5 vs d4)',
    pawnStructureTip: 'Cambia el peón lateral c por el peón central d de las blancas para obtener superioridad de peones en el centro y columna c semiabierta.',
    strategicGuidelines: [
      'Presión sobre la columna c con la torre o dama.',
      'Juego activo de piezas sin miedo a la asimetría.',
      'Ruptura liberadora central con ...d5 cuando sea posible.',
    ],
    keySquares: ['c5', 'c6', 'd5', 'c4'],
    milestones: [
      {
        id: 'sicilian_c5',
        title: 'Presión inicial c5',
        description: 'Lucha asimétrica por el control de la casilla d4.',
        check: b => (b.get('c5')?.type === 'p' ? 'completed' : 'pending'),
      },
      {
        id: 'open_c_file',
        title: 'Columna c semiabierta',
        description: 'Aprovechar la columna c para contrajuego activo.',
        check: b => (!b.get('c5') && !b.get('c7') ? 'completed' : 'in_progress'),
      },
    ],
  },
  caro: {
    name: 'Defensa Caro-Kann',
    color: 'b',
    goals: [['c6', 'p'], ['d5', 'p'], ['f5', 'b']],
    essential: 'b',
    pawnStructureTitle: 'Estructura Sólida de Roca (...c6-...d5)',
    pawnStructureTip: 'Prepara ...d5 con ...c6 para contestar a 1.e4. La gran ventaja sobre la Francesa es que tu alfil de casillas blancas sale a f5 o g4 antes de cerrar la cadena con ...e6.',
    strategicGuidelines: [
      'Juega 1...c6 y 2...d5 cuestionando de inmediato el centro blanco.',
      'Desarrolla el alfil de casillas blancas a f5 antes de jugar ...e6.',
      'Enroque corto sólido y presión sobre el peón blanco retrasado.',
      'Ruptura temática ...c5 en el momento oportuno para abrir juego en el flanco de dama.',
    ],
    keySquares: ['c6', 'd5', 'f5', 'c5', 'e6'],
    milestones: [
      {
        id: 'caro_base',
        title: 'Base c6 y cuña d5',
        description: 'Construye la sólida cuña de peones contra el peón e4.',
        check: b => (b.get('c6')?.type === 'p' && b.get('d5')?.type === 'p' ? 'completed' : b.get('c6')?.type === 'p' ? 'in_progress' : 'pending'),
      },
      {
        id: 'caro_bishop',
        title: 'Alfil libre en f5/g4',
        description: 'Saca el alfil de casillas blancas antes de jugar ...e6.',
        check: b => (b.get('f5')?.type === 'b' || b.get('g4')?.type === 'b' ? 'completed' : b.get('c8')?.type === 'b' ? 'pending' : 'in_progress'),
      },
      {
        id: 'caro_solid',
        title: 'Triángulo sólido ...e6',
        description: 'Cierra la defensa con el alfil ya fuera de la cadena.',
        check: b => (b.get('e6')?.type === 'p' ? 'completed' : 'pending'),
      },
    ],
  },
  french: {
    name: 'Defensa Francesa',
    color: 'b',
    goals: [['e6', 'p'], ['d5', 'p'], ['c5', 'p']],
    essential: 'p',
    pawnStructureTitle: 'Cadena Central Cerrada (...e6-...d5)',
    pawnStructureTip: 'Apoya el avance central ...d5 con ...e6. Contrataca la base de la cadena blanca en d4 con la ruptura temática ...c5 y presión sobre d4 con ...Cc6 y ...Db6.',
    strategicGuidelines: [
      'Ruptura inmediata ...c5 para socavar la base del centro blanco.',
      'Presión sobre d4 con Cc6, Db6 y eventualmente Cge7-f5.',
      'Atención a tu alfil de casillas blancas (bloqueado en c8): busca reciclarlo por d7-e8-h5 o cambiarlo con ...b6 y ...Aa6.',
      'Enroque seguro y ruptura secundaria ...f6 si las blancas avanzan e5.',
    ],
    keySquares: ['e6', 'd5', 'c5', 'b6', 'f6'],
    milestones: [
      {
        id: 'french_center',
        title: 'Cuña ...e6 y ...d5',
        description: 'Fija el centro blanco y desafía el peón de e4.',
        check: b => (b.get('e6')?.type === 'p' && b.get('d5')?.type === 'p' ? 'completed' : b.get('e6')?.type === 'p' ? 'in_progress' : 'pending'),
      },
      {
        id: 'french_c5',
        title: 'Ruptura ...c5 en la base',
        description: 'Socava el soporte de peones de las blancas en d4.',
        check: b => (b.get('c5')?.type === 'p' || !b.get('c7') ? 'completed' : 'pending'),
      },
      {
        id: 'french_pressure',
        title: 'Presión Cc6 y Db6',
        description: 'Añade atacantes sobre el peón blanco d4.',
        check: b => (b.get('c6')?.type === 'n' ? 'completed' : 'pending'),
      },
    ],
  },
  slav: {
    name: 'Defensa Eslava',
    color: 'b',
    goals: [['d5', 'p'], ['c6', 'p'], ['f6', 'n'], ['f5', 'b']],
    essential: 'b',
    pawnStructureTitle: 'Muro Sólido (...c6-...d5 contra 1.d4)',
    pawnStructureTip: 'Responde al Gambito de Dama sosteniendo d5 con ...c6 en lugar de ...e6, manteniendo abierta la diagonal del alfil de casillas blancas para salir a f5.',
    strategicGuidelines: [
      'Sostener d5 con ...c6 sin encerrar el alfil de casillas blancas.',
      'Desarrollar el alfil a f5 antes de jugar ...e6.',
      'Contestar a la presión blanca en el centro con un juego posicional armónico.',
      'Enroque corto y eventual ruptura liberadora ...c5 o ...e5.',
    ],
    keySquares: ['c6', 'd5', 'f5', 'f6', 'e6'],
    milestones: [
      {
        id: 'slav_wall',
        title: 'Muro c6 y d5',
        description: 'Sostiene el centro sin ceder espacio al Gambito.',
        check: b => (b.get('c6')?.type === 'p' && b.get('d5')?.type === 'p' ? 'completed' : 'pending'),
      },
      {
        id: 'slav_bishop',
        title: 'Alfil libre en f5',
        description: 'Desarrolla el alfil de c8 antes de cerrar con ...e6.',
        check: b => (b.get('f5')?.type === 'b' ? 'completed' : 'pending'),
      },
    ],
  },
  scotch: {
    name: 'Apertura Escocesa',
    color: 'w',
    goals: [['e4', 'p'], ['d4', 'p'], ['f3', 'n']],
    essential: 'p',
    pawnStructureTitle: 'Apertura Rápida de Líneas Centrales',
    pawnStructureTip: 'Rompe con 3.d4 de inmediato tras 1.e4 e5 2.Cf3 Cc6 para abrir el centro y activar ambos alfiles sin perder tiempo.',
    strategicGuidelines: [
      'Ruptura directa d4 en la jugada 3 para ganar espacio central.',
      'Retomar en d4 con Cxd4 y buscar ventaja de desarrollo.',
      'Activar el alfil de rey a c4 o e2 según la respuesta rival.',
    ],
    keySquares: ['d4', 'e4', 'f3', 'c4'],
    milestones: [
      {
        id: 'scotch_break',
        title: 'Ruptura central d4',
        description: 'Abre el juego en plena jugada 3.',
        check: b => (b.get('d4')?.type === 'p' || b.get('d4')?.type === 'n' ? 'completed' : 'pending'),
      },
    ],
  },
  english: {
    name: 'Apertura Inglesa',
    color: 'w',
    goals: [['c4', 'p'], ['c3', 'n'], ['g3', 'p'], ['g2', 'b']],
    essential: 'b',
    pawnStructureTitle: 'Control Central Asimétrico (c4 y Ag2)',
    pawnStructureTip: 'Controla la casilla central d5 desde el flanco con 1.c4 y complementa con el fianchetto g3-Ag2 para ejercer presión en la gran diagonal.',
    strategicGuidelines: [
      'Control remoto de la casilla central d5 con el peón c4.',
      'Fianchetto con g3 y Ag2 apuntando a la diagonal larga.',
      'Expansión en el flanco de dama con b4 y Tb1.',
    ],
    keySquares: ['c4', 'd5', 'g2', 'c3'],
    milestones: [
      {
        id: 'english_c4',
        title: 'Peón en c4 dominando d5',
        description: 'Establece la presión sobre el centro desde el flanco.',
        check: b => (b.get('c4')?.type === 'p' ? 'completed' : 'pending'),
      },
      {
        id: 'english_fianchetto',
        title: 'Fianchetto de Rey en g2',
        description: 'Alfil en la diagonal mayor.',
        check: b => (b.get('g2')?.type === 'b' ? 'completed' : 'pending'),
      },
    ],
  },
  reti: {
    name: 'Apertura Réti',
    color: 'w',
    goals: [['f3', 'n'], ['c4', 'p'], ['g3', 'p'], ['g2', 'b']],
    essential: 'b',
    pawnStructureTitle: 'Estrategia Hipermoderna Flexible',
    pawnStructureTip: 'Empieza con 1.Cf3 sin comprometer peones centrales de inmediato. Invita al rival a ocupar el centro para luego minarlo con c4 y el alfil de g2.',
    strategicGuidelines: [
      'Desarrollo rápido de caballos y alfil por fianchetto.',
      'Minar el centro rival con c4 y d3/d4 flexible.',
      'Seguridad del rey garantizada con enroque muy temprano.',
    ],
    keySquares: ['f3', 'c4', 'g2', 'e5'],
    milestones: [
      {
        id: 'reti_knight',
        title: 'Caballo en f3 flexible',
        description: 'Control inicial sin mover peones centrales.',
        check: b => (b.get('f3')?.type === 'n' ? 'completed' : 'pending'),
      },
    ],
  },
};

const DEFAULT_DETAILS: SystemDetails = {
  name: 'Sistema Estratégico',
  color: 'w',
  goals: [['d4', 'p'], ['e4', 'p'], ['f3', 'n']],
  essential: 'p',
  pawnStructureTitle: 'Control Central Armónico',
  pawnStructureTip: 'Prioriza el desarrollo de piezas menores, el control del centro con peones y la seguridad del rey mediante el enroque.',
  strategicGuidelines: [
    'Controla al menos dos casillas centrales (d4, e4, d5, e5).',
    'Desarrolla caballos antes que alfiles.',
    'No muevas la misma pieza dos veces en la apertura sin motivo táctico.',
    'Enroca antes de la jugada 10.',
  ],
  keySquares: ['d4', 'e4', 'f3', 'c3'],
  milestones: [
    {
      id: 'center_dev',
      title: 'Ocupación Central',
      description: 'Control de las casillas centrales con peones.',
      check: b => (b.get('d4') || b.get('e4') || b.get('d5') || b.get('e5') ? 'completed' : 'pending'),
    },
    {
      id: 'pieces_active',
      title: 'Desarrollo de Menores',
      description: 'Caballos y alfiles en casillas activas.',
      check: b => {
        const knights = ['f3', 'c3', 'f6', 'c6'].some(sq => b.get(sq as Square)?.type === 'n');
        return knights ? 'completed' : 'pending';
      },
    },
    {
      id: 'king_castle',
      title: 'Seguridad del Rey',
      description: 'Enroque realizado y rey protegido.',
      check: b => (b.get('g1') || b.get('g8') || b.get('c1') || b.get('c8') ? 'completed' : 'pending'),
    },
  ],
};

export function getSystemAnalysis(board: Chess, systemId: string) {
  const details = SYSTEM_DETAILS_MAP[systemId] || DEFAULT_DETAILS;
  const ownBoard = new Chess(board.fen());
  for (const piece of board.board().flat()) {
    if (piece && piece.color !== details.color) ownBoard.remove(piece.square);
  }
  const milestones: SystemMilestone[] = details.milestones.map(m => ({
    id: m.id,
    title: m.title,
    description: m.description,
    status: m.check(ownBoard),
  }));

  return {
    systemId,
    systemName: details.name,
    pawnStructureTitle: details.pawnStructureTitle,
    pawnStructureTip: details.pawnStructureTip,
    strategicGuidelines: details.strategicGuidelines,
    keySquares: details.keySquares,
    milestones,
  };
}

export function lostSystemObjective(board: Chess, system: string): boolean {
  const details = SYSTEM_DETAILS_MAP[system];
  if (!details) return false;
  const pieces = board.board().flat().filter(piece => piece?.color === details.color);
  if (details.essential === 'b') {
    const bishopGoal = details.goals.find(([, type]) => type === 'b');
    if (!bishopGoal) return false;
    const parity = (bishopGoal[0].charCodeAt(0) + Number(bishopGoal[0][1])) % 2;
    return !pieces.some(piece => piece?.type === 'b' && (piece.square.charCodeAt(0) + Number(piece.square[1])) % 2 === parity);
  }
  return !pieces.some(piece => piece?.type === details.essential);
}

export function systemInterference(board: Chess, system: string, move: { from: string; to: string; promotion?: string }): string | null {
  const details = SYSTEM_DETAILS_MAP[system];
  if (!details || board.turn() === details.color) return null;
  const after = new Chess(board.fen());
  let played;
  try { played = after.move(move); } catch { return null; }
  const capturedGoal = details.goals.find(([square, type]) => square === played.to && board.get(square)?.color === details.color && board.get(square)?.type === type);
  if (capturedGoal && played.captured) return `captura una pieza del esquema en ${played.to}; hay que reconstruir ese objetivo.`;
  for (const [square, type] of details.goals) {
    if (after.get(square)?.color !== details.color || after.get(square)?.type !== type) continue;
    const beforeAttackers = board.attackers(square, played.color);
    const addedPressure = after.attackers(square, played.color).some(attacker => !beforeAttackers.includes(attacker));
    if (addedPressure) return `crea presión sobre ${square}, un objetivo del sistema; protege o reubica esa pieza para conservar el plan.`;
  }
  return null;
}

