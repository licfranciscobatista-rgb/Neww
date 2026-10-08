import { Chess } from 'chess.js';
import { OPENING_PRESETS, type OpeningChoice } from './openingIndex';
import { realRodent, type RodentAnalysis, evaluateRodentFallback } from './realRodent';
import { SYSTEM_DETAILS_MAP } from './systemObjectives';
import { planSystem, systemGoalScore, type SystemPlan, type SystemAnalyzer } from './systemsCoordinator';
import { systemReply } from './systemReply';

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
  systemPlan?: SystemPlan;
  source?: 'wasm' | 'fallback';
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
  garboMove?: { uci?: string; san?: string },
  cancelled = () => false
): Promise<RodentRecommendation | null> {
  if (board.isGameOver()) return null;
  const fen = board.fen();

  // Análisis rápido del motor
  const systemPlan = await planSystem(board, selectedSystem,
    position => realRodent.analyze(position, 100, personality), { alternativeTo: garboMove?.uci, cancelled });
  if (!systemPlan) return null;
  const analysis = { uci: systemPlan.move, scoreCp: systemPlan.scoreCp, depth: systemPlan.depth, source: systemPlan.source };

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

  if (systemPlan.gain <= 0) {
    systemRole = 'tactica_sistema';
    contrastWithGarbo = isSameAsGarbo ? `Ambos motores coinciden en ${san}. ${systemPlan.reason}`
      : `Alternativa temporal ${san}. ${systemPlan.reason}`;
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
    depth: analysis.depth,
    personality,
    planTitle,
    explanation: systemPlan.reason,
    tacticalIntent: systemPlan.reason,
    systemName,
    systemRole,
    contrastWithGarbo,
    isAlternativeToGarbo,
    systemPlan,
    source: analysis.source === 'wasm' ? 'wasm' : analysis.source === 'fallback' ? 'fallback' : undefined,
  };
}

/**
 * Detecta la amenaza o respuesta más peligrosa del rival en la posición actual.
 */
export async function getLiveRivalThreat(board: Chess, selectedSystem = 'london', userColor: 'w' | 'b' = board.turn(), plannedMove?: string): Promise<RivalThreatInfo | null> {
  if (board.isGameOver()) return null;
  if (board.turn() === userColor && !plannedMove) return null;
  const result = await systemReply(board, board.turn() === userColor ? plannedMove || null : null,
    fen => realRodent.analyze(fen, 100, 'agresivo'), selectedSystem);
  if (!result?.arrow) return null;
  return { uci: result.arrow.from + result.arrow.to, from: result.arrow.from, to: result.arrow.to,
    san: result.text.match(/(?:respuesta|rival) (\S+):/)?.[1] || '', threatLevel: 'media',
    explanation: result.text, prophylaxisTip: 'Comprueba esta respuesta antes de seguir el plan.' };
}

export async function proposeSaferSystem(board: Chess, current: SystemPlan, analyze: SystemAnalyzer,
  cancelled = () => false): Promise<SystemProposal | null> {
  if (!current.changeNeeded || current.source !== 'wasm' || current.fen !== board.fen() || board.isGameOver()) return null;
  const presets = OPENING_PRESETS.filter(p => p.color === board.turn() && p.id !== current.systemId)
    .sort((a, b) => systemGoalScore(board, b.id) - systemGoalScore(board, a.id)).slice(0, 3);
  const proposals: SystemProposal[] = [];
  for (const preset of presets) {
    if (cancelled()) return null;
    const plan = await planSystem(board, preset.id, analyze, { cancelled });
    if (!plan || plan.source !== 'wasm' || plan.status === 'unrecoverable' || plan.gain <= 0 ||
      plan.scoreCp < (current.status === 'unrecoverable' ? current.scoreCp - 15 : (current.systemScore ?? current.scoreCp) + 100) ||
      plan.scoreCp < current.rootScore - 70) continue;
    proposals.push({ id: preset.id, sourceSystem: current.systemId, name: preset.name, fen: board.fen(),
      move: plan.move, san: plan.san, scoreCp: plan.scoreCp, comparisonCp: plan.scoreCp - current.scoreCp,
      reason: current.status === 'unrecoverable' ? 'El esquema perdió una pieza esencial. Esta estructura alternativa es alcanzable sin añadir una pérdida comprobada.' : 'Estructura alcanzable y continuación comprobada; evita una pérdida frente a insistir en el esquema actual.' });
  }
  return proposals.sort((a, b) => b.scoreCp - a.scoreCp)[0] || null;
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

