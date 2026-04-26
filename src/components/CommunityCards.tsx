import type { Card as CardType } from '../engine/deck';
import type { GamePhase, ShowdownResult } from '../engine/game';
import { Card } from './Card';

interface CommunityCardsProps {
  cards: CardType[];
  phase: GamePhase;
  winners: ShowdownResult[];
  players: Array<{ id: string; name: string }>;
}

const HAND_CATEGORY_NAMES: Record<number, string> = {
  0: 'HIGH CARD',
  1: 'ONE PAIR',
  2: 'TWO PAIR',
  3: 'THREE OF A KIND',
  4: 'STRAIGHT',
  5: 'FLUSH',
  6: 'FULL HOUSE',
  7: 'FOUR OF A KIND',
  8: 'STRAIGHT FLUSH',
};

/**
 * Board cards on the table background (no window chrome; pot is in InfoPanel).
 */
export function CommunityCards({ cards, phase, winners, players }: CommunityCardsProps) {
  const showWinner = phase === 'handComplete' && winners.length > 0;
  const topWinner = winners[0];

  return (
    <div className="community-cards">
      <div className="community-board-cards">
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i} card={cards[i]} faceDown={!cards[i]} board />
        ))}
      </div>

      {showWinner && topWinner && (
        <div
          className="community-winner-box"
          style={{
            borderStyle: 'solid',
            borderWidth: 'var(--bevel-outer)',
            borderColor: 'rgb(88, 50, 143) rgb(160, 120, 200) rgb(160, 120, 200) rgb(88, 50, 143)',
            background: 'rgba(153, 85, 216, 0.75)',
            padding: '12px 16px',
            textAlign: 'center',
            maxWidth: '100%',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 16,
              color: '#1eb39e',
              marginBottom: 4,
              letterSpacing: 4,
            }}
          >
            ★ WINNER ★
          </div>
          <div
            className="community-winner-box__names"
            style={{
              fontSize: 16,
              color: '#e32d8b',
              marginBottom: 4,
              lineHeight: 1.4,
            }}
          >
            {topWinner.winnerIds
              .map((id) => players.find((p) => p.id === id)?.name ?? id)
              .join(' & ')}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 14,
              color: '#58328f',
            }}
          >
            {HAND_CATEGORY_NAMES[topWinner.rank.category] ?? ''} · ${topWinner.amount}
          </div>
        </div>
      )}
    </div>
  );
}
