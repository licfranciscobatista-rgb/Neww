import { Chess } from 'chess.js';

/**
 * Crea una copia NUEVA del tablero conservando el historial de jugadas.
 *
 * `new Chess(fen)` empieza sin historial, y eso rompía: el libro de aperturas, la detección de
 * repetición de posiciones, las penalizaciones de apertura de Garbo/Maia, el motor personal,
 * el botón "Inspeccionar humanidad" y el PGN guardado al dar mate.
 */
export function cloneChessWithHistory(source: Chess): Chess {
  try {
    const copy = new Chess();
    for (const m of source.history({ verbose: true })) {
      copy.move({ from: m.from, to: m.to, promotion: m.promotion });
    }
    // Solo se acepta si la copia quedó idéntica (p. ej. la partida no arrancó desde otro FEN).
    if (copy.fen() === source.fen()) return copy;
  } catch {
    // Se cae al respaldo por FEN.
  }
  return new Chess(source.fen());
}
