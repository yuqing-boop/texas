import { useEffect } from 'react';
import type { GameState } from '../engine/game';

/** Payload posted to `window.parent` for Readymag (or any embed parent). */
export interface TexasUpdateMessage {
  type: 'TEXAS_UPDATE';
  chipCount: number;
  gameOver: boolean;
  winner: string;
}

export function buildTexasUpdate(gameState: GameState, humanId: string): TexasUpdateMessage | null {
  const human = gameState.players.find((p) => p.id === humanId);
  if (!human) return null;

  const playersWithChips = gameState.players.filter((p) => p.chips > 0);
  const gameOver = playersWithChips.length < 2;
  const winner = gameOver
    ? gameState.players.reduce((a, b) => (a.chips > b.chips ? a : b)).name
    : '';

  return {
    type: 'TEXAS_UPDATE',
    chipCount: human.chips,
    gameOver,
    winner,
  };
}

/*
 * ─── Readymag: Custom Code widget (parent page) ─────────────────────────────
 *
 * Add elements with ids your layout expects, e.g. chip and winner text:
 *   <span id="texas-chips"></span>
 *   <span id="texas-winner"></span>
 *
 * Then paste:
 *
 * <script>
 * (function () {
 *   function onTexasMessage(event) {
 *     // Optional: allow only your game origin in production, e.g.
 *     // if (event.origin !== 'https://your-game.vercel.app') return;
 *     var data = event.data;
 *     if (!data || data.type !== 'TEXAS_UPDATE') return;
 *     var chipsEl = document.getElementById('texas-chips');
 *     var winnerEl = document.getElementById('texas-winner');
 *     if (chipsEl) chipsEl.textContent = String(data.chipCount);
 *     if (winnerEl && data.gameOver) winnerEl.textContent = data.winner || '—';
 *   }
 *   window.addEventListener('message', onTexasMessage);
 * })();
 * </script>
 *
 * Iframe embed (Readymag HTML block or similar):
 *   <iframe
 *     id="texas-game"
 *     src="https://YOUR_DEPLOYED_GAME_URL/"
 *     title="Texas Hold'em"
 *     style="width:100%;max-width:960px;height:720px;border:0;"
 *     allow="fullscreen"
 *   ></iframe>
 */

export function useReadymag(gameState: GameState, humanId: string): void {
  useEffect(() => {
    const payload = buildTexasUpdate(gameState, humanId);
    if (!payload) return;

    try {
      window.parent.postMessage(payload, '*');
    } catch {
      // cross-origin restriction or non-embedded context
    }
  }, [gameState, humanId]);
}
