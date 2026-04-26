import type { Card as CardType } from '../engine/deck';

const SUIT_SYMBOLS: Record<string, string> = {
  hearts:   '♥',
  diamonds: '♦',
  clubs:    '♣',
  spades:   '♠',
};

const GOLD_SUITS = new Set(['hearts', 'diamonds']);

interface CardProps {
  card?: CardType;
  faceDown?: boolean;
  small?: boolean;
  /** 2× default size (community board) */
  board?: boolean;
}

export function Card({ card, faceDown = false, small = false, board = false }: CardProps) {
  const sizeClass = board ? 'board' : small ? 'small' : '';

  if (faceDown || !card) {
    return <div className={`playing-card face-down ${sizeClass}`} />;
  }

  const isGold     = GOLD_SUITS.has(card.suit);
  const colorClass = isGold ? 'card-red' : 'card-black';
  const suitSym    = SUIT_SYMBOLS[card.suit];

  return (
    <div className={`playing-card ${colorClass} ${sizeClass}`}>
      <span className="card-rank">{card.rank}</span>
      <span className="card-suit-center">{suitSym}</span>
      <span className="card-rank bottom">{card.rank}</span>
    </div>
  );
}
