import { Chess } from 'chess.js';
import { OPENING_PRESETS, type OpeningChoice } from './openingIndex';
import { realRodent, type RodentAnalysis, evaluateRodentFallback } from './realRodent';
import { SYSTEM_DETAILS_MAP } from './systemObjectives';

export interface RodentRecommendation {
  uci: string;
  from: string;
  to: string;
  san: string;
  piece: string;
  scoreCp: number;
  evalDisplay: string;
  depth: number;
  personality: 'agresivo' | 'solido' | 'dinamico';
  planTitle: string;
  explanation: string;
  tacticalIntent: string;
  systemName?: string;
  systemRole?: 'variante_alternativa' | 'consenso_sistema' | 'tactica_sistema';
  contrastWithGarbo?: string;
  isAlternativeToGarbo?: boolean;
}

export interface RivalThreatInfo {
  uci: string;
  from: string;
  to: string;
  san: string;
  threatLevel: 'alta' | 'media' | 'baja';
  explanation: string;
  prophylaxisTip: string;
}

export interface SystemProposal {
  id: string;
  sourceSystem: string;
  name: string;
  fen: string;
  move: string;
  san: string;
  scoreCp: number;
  comparisonCp: number;
  reason: string;
}

export type AnalyzeRodent = (fen: string) => Promise<RodentAnalysis | null>;
export type QuerySystem = (fen: string, id: string, history: string[]) => Promise<OpeningChoice>;

const PIECE_NAMES: Record<string, string> = {
  p: 'Peón',
  n: 'Caballo',
  b: 'Alfil',
  r: 'Torre',
  q: 'Dama',
  k: 'Rey',
};

/**
 * Obtiene la recomendación activa e independiente de Rodent IV para el turno actual del jugador.
 * Incluye explicación pedagógica profunda ("más texto") solicitada por el cliente.
 */
export async function getLiveRodentRecommendation(
  board: Chess,
  personality: 'agresivo' | 'solido' | 'dinamico' = 'dinamico',
  selectedSystem = 'london',
  garboMove?: { uci?: string; san?: string }
): Promise<RodentRecommendation | null> {
  if (board.isGameOver()) return null;
  const fen = board.fen();

  // Análisis rápido del motor
  const analysis = await realRodent.analyze(fen, 180, personality) || evaluateRodentFallback(fen, personality);
  if (!analysis) return null;

  const copy = new Chess(fen);
  let moveObj;
  try {
    moveObj = copy.move({
      from: analysis.uci.slice(0, 2),
      to: analysis.uci.slice(2, 4),
      promotion: analysis.uci[4],
    });
  } catch {
    const legal = copy.moves({ verbose: true });
    if (legal.length === 0) return null;
    moveObj = legal[0];
  }
  if (!moveObj) return null;

  const uci = `${moveObj.from}${moveObj.to}${moveObj.promotion || ''}`;
  const san = moveObj.san;
  const pieceName = PIECE_NAMES[moveObj.piece] || 'Pieza';
  const systemMeta = SYSTEM_DETAILS_MAP[selectedSystem];
  const systemName = systemMeta?.name || 'Sistema Estratégico';

  // Determinar rol con respecto a Garbo en el mismo sistema:
  // ¿Propone una variante alternativa del mismo sistema o coincide en consenso?
  const isSameAsGarbo = !!garboMove?.uci && garboMove.uci === uci;
  const isAlternativeToGarbo = !isSameAsGarbo && !!garboMove?.san;
  let systemRole: 'variante_alternativa' | 'consenso_sistema' | 'tactica_sistema' = 'tactica_sistema';
  let contrastWithGarbo = '';

  if (isSameAsGarbo) {
    systemRole = 'consenso_sistema';
    contrastWithGarbo = `Línea de Consenso: Rodent y Garbo coinciden en jugar ${san} como la jugada más precisa para el ${systemName}.`;
  } else if (garboMove?.san) {
    const isSystemSquare = systemMeta?.goals?.some(([sq]) => sq === moveObj.to) ||
      systemMeta?.keySquares?.includes(moveObj.to) ||
      san.includes('O-O');
    if (isSystemSquare) {
      systemRole = 'variante_alternativa';
      contrastWithGarbo = `Variante alternativa en el ${systemName}: Garbo propone ${garboMove.san}, mientras Rodent elige ${san} (${personality}) como plan paralelo en el mismo esquema.`;
    } else {
      systemRole = 'tactica_sistema';
      contrastWithGarbo = `Contrajuego táctico: Frente a ${garboMove.san} de Garbo, Rodent busca dinamismo directo con ${san}.`;
    }
  }

  // Generar título del plan y explicación rica según la personalidad de Rodent
  let planTitle = '';
  let explanation = '';
  let tacticalIntent = '';

  if (moveObj.captured) {
    planTitle = isAlternativeToGarbo
      ? `Variante de Captura: ${pieceName} x ${moveObj.to.toUpperCase()}`
      : `Captura táctica: ${pieceName} x ${moveObj.to.toUpperCase()}`;
    tacticalIntent = `Elimina la pieza rival en ${moveObj.to} para ganar material o despejar líneas.`;
    explanation = personality === 'agresivo'
      ? `Rodent IV (Estilo Agresivo) busca de inmediato la captura en ${moveObj.to} para romper la coordinación del rival y acelerar la iniciativa en el flanco débil.`
      : `Rodent IV aprovecha la pieza colgada o el cambio favorable en ${moveObj.to}, consolidando la estructura sin asumir riesgos innecesarios.`;
  } else if (copy.inCheck()) {
    planTitle = `Jaque incisivo con ${pieceName} a ${moveObj.to.toUpperCase()}`;
    tacticalIntent = `Obliga al rey rival a reaccionar y descoordina sus defensas.`;
    explanation = `Rodent IV detecta una debilidad en el rey rival. Con este jaque ${san}, se interrumpe el plan del oponente forzando concesiones de casillas.`;
  } else if (san.includes('O-O')) {
    planTitle = 'Enroque: Rey a buen resguardo y Torre activa';
    tacticalIntent = 'Pone al monarca en seguridad y conecta las torres en la primera fila.';
    explanation = `Paso fundamental en el ${systemName}: el enroque conecta las torres y asegura el flanco de rey antes de comenzar la batalla por las columnas centrales.`;
  } else if (['n', 'b'].includes(moveObj.piece) && ['1', '8'].includes(moveObj.from[1])) {
    planTitle = isAlternativeToGarbo
      ? `Variante de Desarrollo: ${pieceName} a ${moveObj.to.toUpperCase()}`
      : `Desarrollo de ${pieceName} a ${moveObj.to.toUpperCase()}`;
    tacticalIntent = `Despliega pieza menor hacia el centro activo.`;
    explanation = `Rodent IV activa el ${pieceName} hacia ${moveObj.to.toUpperCase()}. En el ${systemName}, el desarrollo rápido permite disputar el control de casillas clave y apoyar la cadena de peones.`;
  } else {
    planTitle = isAlternativeToGarbo
      ? `Alternativa Táctica: ${pieceName} a ${moveObj.to.toUpperCase()}`
      : `Maniobra posicional: ${pieceName} a ${moveObj.to.toUpperCase()}`;
    tacticalIntent = `Mejora la casilla de destino y presiona el centro.`;
    explanation = personality === 'agresivo'
      ? `Enfoque ofensivo de Rodent: prepara la ruptura temática hacia el flanco contrario para abrir líneas directas de ataque.`
      : personality === 'solido'
      ? `Enfoque posicional sólido: refuerza la estructura, vigila posibles infiltraciones rivales y sostiene las casillas críticas del ${systemName}.`
      : `Enfoque dinámico: equilibra la actividad de piezas con la profilaxis táctica, manteniendo al rival bajo presión constante.`;
  }

  const scoreCp = analysis.scoreCp;
  const pawns = (scoreCp / 100).toFixed(1);
  const evalDisplay = scoreCp > 0 ? `+${pawns}` : pawns;

  return {
    uci,
    from: moveObj.from,
    to: moveObj.to,
    san,
    piece: pieceName,
    scoreCp,
    evalDisplay,
    depth: analysis.depth || 6,
    personality,
    planTitle,
    explanation,
    tacticalIntent,
    systemName,
    systemRole,
    contrastWithGarbo,
    isAlternativeToGarbo,
  };
}

/**
 * Detecta la amenaza o respuesta más peligrosa del rival en la posición actual.
 */
export async function getLiveRivalThreat(board: Chess, selectedSystem = 'london'): Promise<RivalThreatInfo | null> {
  if (board.isGameOver()) return null;

  const legalMoves = board.moves({ verbose: true });
  if (legalMoves.length === 0) return null;

  // Analizar las réplicas del rival simulando una jugada
  // Evaluamos las jugadas del bando contrario
  const fen = board.fen();
  const testBoard = new Chess(fen);
  // Cambiamos turno artificialmente para ver qué jugaría el rival si fuera su turno ahora mismo
  // (Análisis de amenaza estática / Null-move threat)
  const tokens = fen.split(' ');
  const rivalTurn = tokens[1] === 'w' ? 'b' : 'w';
  tokens[1] = rivalTurn;
  // Ajustar en passant si es inválido
  tokens[3] = '-';
  const rivalFen = tokens.join(' ');

  try {
    const rivalBoard = new Chess(rivalFen);
    const rivalAnalysis = await realRodent.analyze(rivalFen, 120, 'agresivo') || evaluateRodentFallback(rivalFen, 'agresivo');
    if (!rivalAnalysis) return null;

    let threatMove;
    try {
      threatMove = rivalBoard.move({
        from: rivalAnalysis.uci.slice(0, 2),
        to: rivalAnalysis.uci.slice(2, 4),
        promotion: rivalAnalysis.uci[4],
      });
    } catch {
      const rm = rivalBoard.moves({ verbose: true });
      threatMove = rm.find(m => m.captured) || rm[0];
    }
    if (!threatMove) return null;

    const from = threatMove.from;
    const to = threatMove.to;
    const san = threatMove.san;
    const uci = `${from}${to}${threatMove.promotion || ''}`;

    let threatLevel: 'alta' | 'media' | 'baja' = 'media';
    let explanation = '';
    let prophylaxisTip = '';

    if (threatMove.captured) {
      threatLevel = 'alta';
      explanation = `El rival busca capturar tu pieza en ${to.toUpperCase()} con ${san}.`;
      prophylaxisTip = `Defiende la casilla ${to.toUpperCase()} o retira la pieza amenazada antes de que el rival consolide la ventaja.`;
    } else if (rivalBoard.inCheck()) {
      threatLevel = 'alta';
      explanation = `Amenaza de jaque directo con ${san} que descolocaría a tu rey.`;
      prophylaxisTip = `Anticípate cerrando la diagonal o columna de ataque con un desarrollo profiláctico.`;
    } else if (['c5', 'e5', 'd5', 'c4', 'e4', 'd4'].includes(to)) {
      threatLevel = 'media';
      explanation = `El rival planea la ruptura central ${san} para desafiar tu estructura en el ${selectedSystem}.`;
      prophylaxisTip = `Sostén el centro con peones de apoyo y mantén las piezas menores coordinadas.`;
    } else {
      threatLevel = 'baja';
      explanation = `Posible maniobra de reagrupamiento rival con ${san}.`;
      prophylaxisTip = `Continúa desarrollando tu plan estratégico sin descuidar el equilibrio de casillas débiles.`;
    }

    return {
      uci,
      from,
      to,
      san,
      threatLevel,
      explanation,
      prophylaxisTip,
    };
  } catch {
    return null;
  }
}

async function evaluateMove(board: Chess, uci: string, analyze: AnalyzeRodent): Promise<number | null> {
  const next = new Chess(board.fen());
  try {
    next.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return null;
  }
  if (next.isCheckmate()) return 100000;
  if (next.isDraw()) return 0;
  const reply = await analyze(next.fen());
  if (!reply || (reply.mate !== undefined && reply.mate > 0)) return null;
  return -reply.scoreCp;
}

export async function proposeSystem(
  board: Chess,
  selected: string,
  currentMove: string | undefined,
  analyze: AnalyzeRodent,
  query: QuerySystem,
  cancelled = () => false
): Promise<SystemProposal | null> {
  if (board.isGameOver() || selected === 'free' || selected === 'rodent-active') return null;
  const fen = board.fen();
  const history = board.history({ verbose: true }).map(move => move.after);
  const root = await analyze(fen);
  if (!root || root.mate !== undefined || cancelled()) return null;
  const currentScore = currentMove ? await evaluateMove(board, currentMove, analyze) : null;
  if (cancelled() || (currentMove && currentScore === null)) return null;
  const baseline = currentScore ?? root.scoreCp;
  const candidates: SystemProposal[] = [];
  const evaluated = new Map<string, number | null>();

  for (const preset of OPENING_PRESETS) {
    if (cancelled()) return null;
    if (preset.id === selected) continue;
    const opening = await query(fen, preset.id, history);
    if (!opening.uci || opening.uci === currentMove) continue;
    if (!evaluated.has(opening.uci)) {
      if (evaluated.size >= 4) break;
      evaluated.set(opening.uci, await evaluateMove(board, opening.uci, analyze));
    }
    const score = evaluated.get(opening.uci);
    if (score === null || score === undefined || score < baseline - 15) continue;
    const copy = new Chess(fen);
    const move = copy.move({ from: opening.uci.slice(0, 2), to: opening.uci.slice(2, 4), promotion: opening.uci[4] });
    candidates.push({
      id: preset.id,
      sourceSystem: selected,
      name: preset.name,
      fen,
      move: opening.uci,
      san: move.san,
      scoreCp: score,
      comparisonCp: score - baseline,
      reason: `Continuación reconocida de ${preset.name}; Rodent comparó la respuesta rival. Alternativa de evaluación sólida para el esquema.`,
    });
  }
  return candidates.sort((a, b) => b.scoreCp - a.scoreCp)[0] || null;
}

export async function followSystem(
  board: Chess,
  selected: string,
  analyze: AnalyzeRodent,
  query: QuerySystem
): Promise<{ move: string; san: string; text: string } | null> {
  if (board.isGameOver()) return null;
  const root = await analyze(board.fen());
  if (!root) return null;
  const opening = await query(board.fen(), selected, board.history({ verbose: true }).map(move => move.after));
  let uci = root.uci;
  let inSystem = false;
  if (opening.uci) {
    const score = await evaluateMove(board, opening.uci, analyze);
    if (score !== null && score >= root.scoreCp - 30 && root.mate === undefined) {
      uci = opening.uci;
      inSystem = true;
    }
  }
  const copy = new Chess(board.fen());
  const move = copy.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return {
    move: uci,
    san: move.san,
    text: inSystem ? 'Continuación del sistema verificada por Rodent.' : 'Fuera del repertorio: Rodent atiende la posición con criterio posicional.',
  };
}

