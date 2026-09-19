import React, { useState } from 'react';
import { Chess, Square } from 'chess.js';
import { CandidateArrow, EngineRecommendation, EngineType } from '../types/chess';

interface ChessBoardProps {
  chess: Chess;
  boardOrientation: 'w' | 'b';
  onMove: (from: Square, to: Square) => boolean;
  recommendations: Record<EngineType, EngineRecommendation | null>;
  candidateArrows?: CandidateArrow[];
  agreements: { move: string; san: string; engines: EngineType[] }[];
  activeArrowFilter?: Record<EngineType, boolean>;
  onToggleEngineFilter?: (engine: EngineType) => void;
  lastMove?: { from: string; to: string } | null;
  interactive?: boolean;
  isRivalTurn?: boolean;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const PIECE_SYMBOLS: Record<string, string> = {
  p: '♟',
  n: '♞',
  b: '♝',
  r: '♜',
  q: '♛',
  k: '♚',
  P: '♙',
  N: '♘',
  B: '♗',
  R: '♖',
  Q: '♕',
  K: '♔',
};

export const ENGINE_COLORS: Record<
  EngineType,
  { stroke: string; fill: string; label: string; text: string; badgeBorder: string; badgeBg: string }
> = {
  stockfish: {
    stroke: '#2563eb', // Royal Blue
    fill: '#3b82f6',
    label: 'SF',
    text: 'Stockfish',
    badgeBorder: '#60a5fa',
    badgeBg: '#1e3a8a',
  },
  garbo: {
    stroke: '#059669', // Emerald Green
    fill: '#10b981',
    label: 'GB',
    text: 'Garbo',
    badgeBorder: '#34d399',
    badgeBg: '#064e3b',
  },
  maia: {
    stroke: '#7c3aed', // Purple / Violet
    fill: '#8b5cf6',
    label: 'M',
    text: 'Maia',
    badgeBorder: '#a78bfa',
    badgeBg: '#4c1d95',
  },
  personal: {
    stroke: '#d97706', // Amber Gold
    fill: '#f59e0b',
    label: 'MP',
    text: 'Personal',
    badgeBorder: '#fbbf24',
    badgeBg: '#78350f',
  },
};

export const ChessBoard: React.FC<ChessBoardProps> = ({
  chess,
  boardOrientation,
  onMove,
  recommendations,
  candidateArrows = [],
  agreements,
  activeArrowFilter = { stockfish: true, garbo: true, maia: true, personal: true },
  onToggleEngineFilter,
  lastMove,
  interactive = true,
  isRivalTurn = false,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  React.useEffect(() => {
    setSelectedSquare(null);
  }, [chess]);

  const displayFiles = boardOrientation === 'w' ? FILES : [...FILES].reverse();
  const displayRanks = boardOrientation === 'w' ? RANKS : [...RANKS].reverse();

  const legalMovesForSelected = React.useMemo(() => {
    if (!selectedSquare || !interactive) return [];
    return chess
      .moves({ square: selectedSquare, verbose: true })
      .map((m) => m.to as Square);
  }, [chess, selectedSquare, interactive]);

  const kingInCheckSquare = React.useMemo(() => {
    if (!chess.inCheck()) return null;
    const turn = chess.turn();
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'k' && p.color === turn) {
          const file = FILES[c];
          const rank = RANKS[r];
          return `${file}${rank}` as Square;
        }
      }
    }
    return null;
  }, [chess]);

  const handleSquareClick = (square: Square) => {
    if (!interactive) return;

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      const isLegal = legalMovesForSelected.includes(square);
      if (isLegal) {
        const success = onMove(selectedSquare, square);
        if (success) {
          setSelectedSquare(null);
          return;
        }
      }

      const piece = chess.get(square);
      if (piece && piece.color === chess.turn()) {
        setSelectedSquare(square);
        return;
      }

      setSelectedSquare(null);
    } else {
      const piece = chess.get(square);
      if (piece && piece.color === chess.turn()) {
        setSelectedSquare(square);
      }
    }
  };

  const getSquareCoordinates = (square: string) => {
    const file = square[0];
    const rank = square[1];
    const fileIndex = displayFiles.indexOf(file);
    const rankIndex = displayRanks.indexOf(rank);
    if (fileIndex === -1 || rankIndex === -1) return { x: 0, y: 0 };
    return {
      x: fileIndex * 100 + 50,
      y: rankIndex * 100 + 50,
    };
  };

  interface ArrowRenderItem {
    from: string;
    to: string;
    engines: EngineType[];
  }

  // Pure engine recommendation mapping: NO artificial fallback filler lines
  // Suppressed completely during rival's turn to prevent lag and unnecessary lines
  const moveEngineMap: ArrowRenderItem[] = React.useMemo(() => {
    if (isRivalTurn) return [];

    const list: ArrowRenderItem[] = [];
    const moveKeyMap = new Map<string, ArrowRenderItem>();
    const engineOrder: EngineType[] = ['stockfish', 'garbo', 'maia', 'personal'];

    for (const eng of engineOrder) {
      if (!activeArrowFilter[eng]) continue;
      const rec = recommendations[eng];
      if (rec && rec.from && rec.to) {
        const key = `${rec.from}-${rec.to}`;
        const existing = moveKeyMap.get(key);
        if (existing) {
          if (!existing.engines.includes(eng)) {
            existing.engines.push(eng);
          }
        } else {
          const item: ArrowRenderItem = { from: rec.from, to: rec.to, engines: [eng] };
          moveKeyMap.set(key, item);
          list.push(item);
        }
      }
    }

    return list;
  }, [recommendations, activeArrowFilter, isRivalTurn]);

  return (
    <div className="w-full max-w-[540px] flex flex-col gap-2">
      {/* Engine Status & Legend Bar */}
      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs shadow-sm">
        {isRivalTurn ? (
          <div className="flex items-center gap-2 text-slate-400 font-medium w-full justify-center">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400/80 animate-pulse" />
            <span className="text-[11px]">
              Turno rival ({chess.turn() === 'w' ? 'Blancas' : 'Negras'}) • Motores en reposo (0 lag)
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full flex-wrap gap-1.5">
            <span className="text-[11px] font-bold text-slate-300">
              Líneas activas:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['stockfish', 'garbo', 'maia', 'personal'] as EngineType[]).map((eng) => {
                const conf = ENGINE_COLORS[eng];
                const isActive = activeArrowFilter[eng];
                const hasMove = !!recommendations[eng]?.move;
                return (
                  <button
                    key={eng}
                    type="button"
                    onClick={() => onToggleEngineFilter && onToggleEngineFilter(eng)}
                    title={`Alternar flecha de ${conf.text}`}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all ${
                      isActive
                        ? 'border-opacity-100 shadow-sm'
                        : 'opacity-40 grayscale border-slate-700 bg-slate-800/60 text-slate-400'
                    }`}
                    style={{
                      backgroundColor: isActive ? conf.badgeBg : undefined,
                      borderColor: isActive ? conf.badgeBorder : undefined,
                      color: isActive ? '#ffffff' : undefined,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: conf.stroke }}
                    />
                    <span>{conf.label}</span>
                    <span className="hidden sm:inline text-[10px] font-medium opacity-90">
                      {conf.text}
                    </span>
                    {hasMove && (
                      <span className="text-[10px] opacity-80 font-normal">
                        ({recommendations[eng]?.san})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Board square */}
      <div className="relative w-full aspect-square select-none rounded-xl overflow-hidden shadow-2xl border-4 border-stone-800 bg-stone-900">
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {displayRanks.map((rank, rankIndex) =>
          displayFiles.map((file, fileIndex) => {
            const square = `${file}${rank}` as Square;
            const isLight = (fileIndex + rankIndex) % 2 === 0;
            const piece = chess.get(square);
            const isSelected = selectedSquare === square;
            const isLegalTarget = legalMovesForSelected.includes(square);
            const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);
            const isCheck = kingInCheckSquare === square;

            return (
              <div
                key={square}
                id={`square-${square}`}
                onClick={() => handleSquareClick(square)}
                className={`relative flex items-center justify-center cursor-pointer transition-colors duration-150 ${
                  isLight ? 'bg-[#eeeed2]' : 'bg-[#769656]'
                } ${isLastMove ? 'after:absolute after:inset-0 after:bg-yellow-400/35' : ''} ${
                  isSelected ? 'after:absolute after:inset-0 after:bg-blue-500/40 after:ring-4 after:ring-blue-400' : ''
                } ${isCheck ? 'after:absolute after:inset-0 after:bg-red-500/50 after:animate-pulse' : ''}`}
              >
                {fileIndex === 0 && (
                  <span
                    className={`absolute top-0.5 left-1 text-[10px] font-bold pointer-events-none ${
                      isLight ? 'text-[#769656]' : 'text-[#eeeed2]'
                    }`}
                  >
                    {rank}
                  </span>
                )}
                {rankIndex === 7 && (
                  <span
                    className={`absolute bottom-0.5 right-1 text-[10px] font-bold pointer-events-none ${
                      isLight ? 'text-[#769656]' : 'text-[#eeeed2]'
                    }`}
                  >
                    {file}
                  </span>
                )}

                {isLegalTarget && (
                  <div
                    className={`absolute z-10 pointer-events-none ${
                      piece
                        ? 'w-full h-full border-4 border-blue-500/70 rounded-full scale-90'
                        : 'w-4 h-4 rounded-full bg-blue-600/60 shadow-md'
                    }`}
                  />
                )}

                {piece && (
                  <span
                    className={`relative z-20 text-3xl sm:text-4xl md:text-5xl font-serif select-none transition-transform duration-100 hover:scale-105 ${
                      piece.color === 'w'
                        ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]'
                        : 'text-stone-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.4)]'
                    }`}
                  >
                    {piece.color === 'w'
                      ? PIECE_SYMBOLS[piece.type.toUpperCase()]
                      : PIECE_SYMBOLS[piece.type.toLowerCase()]}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-30"
        viewBox="0 0 800 800"
      >
        <defs>
          <marker
            id="arrow-stockfish"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#2563eb" />
          </marker>
          <marker
            id="arrow-sf"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#2563eb" />
          </marker>
          <marker
            id="arrow-garbo"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#059669" />
          </marker>
          <marker
            id="arrow-maia"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#7c3aed" />
          </marker>
          <marker
            id="arrow-personal"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#d97706" />
          </marker>
          <marker
            id="arrow-multi"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#0284c7" />
          </marker>
        </defs>

        {moveEngineMap.map((group, idx) => {
          const start = getSquareCoordinates(group.from);
          const end = getSquareCoordinates(group.to);
          const isMultiple = group.engines.length > 1;

          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          if (length === 0) return null;

          const shortenEnd = 24;
          const targetX = end.x - (dx / length) * shortenEnd;
          const targetY = end.y - (dy / length) * shortenEnd;

          const primaryEngine = group.engines[0];
          const primaryColor = ENGINE_COLORS[primaryEngine];
          const markerId = isMultiple ? 'arrow-multi' : `arrow-${primaryEngine}`;
          const strokeColor = isMultiple ? '#0284c7' : primaryColor.stroke;
          const fillColor = isMultiple ? '#0284c7' : primaryColor.fill;

          // Compute pill badge coordinates with edge guards
          const pillWidth = 58;
          const totalBadgesWidth = group.engines.length * (pillWidth + 4);
          const badgeBaseX = targetX > 680 ? targetX - totalBadgesWidth - 8 : targetX + 6;
          const badgeBaseY = targetY < 70 ? targetY + 22 : targetY - 12;

          return (
            <g key={`arrow-${group.from}-${group.to}-${idx}`}>
              {/* Destination square highlight ring */}
              <circle
                cx={end.x}
                cy={end.y}
                r="36"
                fill={fillColor}
                fillOpacity="0.18"
                stroke={strokeColor}
                strokeWidth={isMultiple ? '3' : '2'}
                strokeDasharray={isMultiple ? '4 2' : 'none'}
              />

              {/* Arrow starting point dot */}
              <circle
                cx={start.x}
                cy={start.y}
                r="10"
                fill={strokeColor}
                fillOpacity="0.8"
              />

              {/* Arrow line */}
              <line
                x1={start.x}
                y1={start.y}
                x2={targetX}
                y2={targetY}
                stroke={strokeColor}
                strokeWidth={isMultiple ? 7 : 5}
                strokeLinecap="round"
                strokeOpacity={0.92}
                markerEnd={`url(#${markerId})`}
              />

              {/* Distinct High-Contrast Badges for each engine on this move */}
              <g transform={`translate(${badgeBaseX}, ${badgeBaseY})`}>
                {group.engines.map((eng, eIdx) => {
                  const conf = ENGINE_COLORS[eng];
                  const xOffset = eIdx * (pillWidth + 4);
                  return (
                    <g key={eng} transform={`translate(${xOffset}, 0)`}>
                      <rect
                        x="0"
                        y="-11"
                        width={pillWidth}
                        height="22"
                        rx="11"
                        fill={conf.badgeBg}
                        fillOpacity="0.96"
                        stroke={conf.badgeBorder}
                        strokeWidth="1.5"
                      />
                      <circle cx="11" cy="0" r="6.5" fill={conf.stroke} />
                      <text
                        x="11"
                        y="3"
                        textAnchor="middle"
                        fontSize="7.5"
                        fontWeight="bold"
                        fill="#ffffff"
                      >
                        {conf.label}
                      </text>
                      <text
                        x="21"
                        y="3.5"
                        textAnchor="start"
                        fontSize="8"
                        fontWeight="bold"
                        fill="#ffffff"
                      >
                        {conf.text}
                      </text>
                    </g>
                  );
                })}
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  </div>
  );
};
