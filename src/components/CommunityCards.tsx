import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
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

const WINNER_BOX_STYLE: CSSProperties = {
  borderStyle: 'solid',
  borderWidth: 'var(--bevel-outer)',
  borderColor: 'rgb(88, 50, 143) rgb(160, 120, 200) rgb(160, 120, 200) rgb(88, 50, 143)',
  background: 'rgba(153, 85, 216, 0.75)',
  padding: '12px 16px',
  textAlign: 'center',
  maxWidth: '100%',
};

function CommunityWinnerInner({
  topWinner,
  players,
}: {
  topWinner: ShowdownResult;
  players: Array<{ id: string; name: string }>;
}) {
  return (
    <>
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
    </>
  );
}

/**
 * Board cards on the table background (no window chrome; pot is in InfoPanel).
 * Winner banner is portaled to `document.body` so it stacks above AI / human panels
 * while an in-flow measure copy keeps the same size and position in the layout.
 */
export function CommunityCards({ cards, phase, winners, players }: CommunityCardsProps) {
  const showWinner = phase === 'handComplete' && winners.length > 0;
  const topWinner = winners[0];

  const measureRef = useRef<HTMLDivElement>(null);
  const [portalRect, setPortalRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const syncPortalRect = useCallback(() => {
    const el = measureRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPortalRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, []);

  useLayoutEffect(() => {
    if (!showWinner || !topWinner) {
      setPortalRect(null);
      return;
    }
    syncPortalRect();
    const el = measureRef.current;
    const ro = el ? new ResizeObserver(() => syncPortalRect()) : null;
    if (el) ro!.observe(el);
    window.addEventListener('resize', syncPortalRect);
    window.addEventListener('scroll', syncPortalRect, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', syncPortalRect);
      window.removeEventListener('scroll', syncPortalRect, true);
    };
  }, [showWinner, topWinner, players, winners, cards, syncPortalRect]);

  return (
    <div className="community-cards">
      <div className="community-board-cards">
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i} card={cards[i]} faceDown={!cards[i]} board />
        ))}
      </div>

      {showWinner && topWinner && (
        <>
          <div ref={measureRef} className="community-winner-anchor">
            <div
              className="community-winner-box community-winner-box--measure"
              style={{
                ...WINNER_BOX_STYLE,
                visibility: 'hidden',
                pointerEvents: 'none',
              }}
              aria-hidden
            >
              <CommunityWinnerInner topWinner={topWinner} players={players} />
            </div>
          </div>
          {portalRect &&
            createPortal(
              <div
                className="community-winner-portal-root"
                style={{
                  position: 'fixed',
                  top: portalRect.top,
                  left: portalRect.left,
                  width: portalRect.width,
                  height: portalRect.height,
                  zIndex: 10000,
                  pointerEvents: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  className="community-winner-box community-winner-box--overlay"
                  style={{
                    ...WINNER_BOX_STYLE,
                    width: '100%',
                    height: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <CommunityWinnerInner topWinner={topWinner} players={players} />
                </div>
              </div>,
              document.body,
            )}
        </>
      )}
    </div>
  );
}
