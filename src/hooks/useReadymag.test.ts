import { describe, it, expect } from 'vitest';
import { buildTexasUpdate } from './useReadymag';
import type { GameState, PlayerState } from '../engine/game';

function basePlayer(overrides: Partial<PlayerState>): PlayerState {
  return {
    id: 'p',
    name: 'P',
    chips: 100,
    holeCards: [],
    folded: false,
    allIn: false,
    currentBet: 0,
    totalCommitted: 0,
    actedThisRound: false,
    ...overrides,
  };
}

function minimalState(players: PlayerState[]): GameState {
  return {
    handNumber: 1,
    phase: 'preflop',
    players,
    dealerIndex: 0,
    activePlayerIndex: 0,
    smallBlind: 10,
    bigBlind: 20,
    currentBet: 20,
    minRaiseTo: 40,
    pot: 30,
    sidePots: [],
    communityCards: [],
    deck: [],
    winners: [],
  };
}

describe('buildTexasUpdate', () => {
  it('returns chipCount for human and gameOver false when two+ players have chips', () => {
    const state = minimalState([
      basePlayer({ id: 'human', name: 'YOU', chips: 950 }),
      basePlayer({ id: 'a', name: 'A', chips: 50 }),
    ]);
    expect(buildTexasUpdate(state, 'human')).toEqual({
      type: 'TEXAS_UPDATE',
      chipCount: 950,
      gameOver: false,
      winner: '',
    });
  });

  it('sets gameOver and winner name when only one player has chips', () => {
    const state = minimalState([
      basePlayer({ id: 'human', name: 'YOU', chips: 2000 }),
      basePlayer({ id: 'a', name: 'ANCHOR', chips: 0 }),
      basePlayer({ id: 'b', name: 'SPECTRE', chips: 0 }),
      basePlayer({ id: 'c', name: 'ARCHITECT', chips: 0 }),
      basePlayer({ id: 'd', name: 'CIPHER', chips: 0 }),
    ]);
    expect(buildTexasUpdate(state, 'human')).toEqual({
      type: 'TEXAS_UPDATE',
      chipCount: 2000,
      gameOver: true,
      winner: 'YOU',
    });
  });

  it('returns null if human id is missing', () => {
    const state = minimalState([basePlayer({ id: 'a', chips: 100 })]);
    expect(buildTexasUpdate(state, 'human')).toBeNull();
  });
});
