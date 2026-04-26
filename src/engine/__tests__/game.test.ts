import { describe, it, expect, beforeEach } from "vitest";
import { TexasHoldemGame } from "../game";

// Always returns 0.5 so Fisher-Yates swaps every element with itself — deck
// order stays deterministic and reproducible.
const midRng = () => 0.5;

const twoPlayers = () => [
  { id: "p1", name: "Hero", chips: 1000 },
  { id: "p2", name: "Villain", chips: 1000 },
];

const threePlayers = () => [
  { id: "p1", name: "Hero", chips: 1000 },
  { id: "p2", name: "Anchor", chips: 1000 },
  { id: "p3", name: "Spectre", chips: 1000 },
];

describe("TexasHoldemGame — initialisation", () => {
  it("starts in waiting phase", () => {
    const game = new TexasHoldemGame({ players: twoPlayers() });
    expect(game.getState().phase).toBe("waiting");
  });

  it("throws when fewer than two players are provided", () => {
    expect(() => new TexasHoldemGame({ players: [{ id: "p1", name: "Lone", chips: 1000 }] })).toThrow();
  });

  it("uses the configured small blind", () => {
    const game = new TexasHoldemGame({ players: twoPlayers(), smallBlind: 25 });
    game.startHand(midRng);
    expect(game.getState().smallBlind).toBe(25);
    expect(game.getState().bigBlind).toBe(50);
  });
});

describe("TexasHoldemGame — startHand", () => {
  it("deals exactly 2 hole cards to every player", () => {
    const game = new TexasHoldemGame({ players: threePlayers() });
    game.startHand(midRng);
    for (const player of game.getState().players) {
      expect(player.holeCards).toHaveLength(2);
    }
  });

  it("community cards are empty after the deal", () => {
    const game = new TexasHoldemGame({ players: twoPlayers() });
    game.startHand(midRng);
    expect(game.getState().communityCards).toHaveLength(0);
  });

  it("posts small + big blind into the pot", () => {
    const game = new TexasHoldemGame({ players: twoPlayers(), smallBlind: 10 });
    game.startHand(midRng);
    // SB=10 + BB=20
    expect(game.getState().pot).toBe(30);
    expect(game.getState().currentBet).toBe(20);
  });

  it("increments handNumber on successive starts", () => {
    const game = new TexasHoldemGame({ players: twoPlayers() });
    game.startHand(midRng);
    expect(game.getState().handNumber).toBe(1);
    game.applyAction({ type: "fold" }); // end the hand
    game.startHand(midRng);
    expect(game.getState().handNumber).toBe(2);
  });

  it("transitions to handComplete when only one player has chips", () => {
    const game = new TexasHoldemGame({
      players: [
        { id: "p1", name: "Rich", chips: 1000 },
        { id: "p2", name: "Broke", chips: 0 },
      ],
    });
    game.startHand(midRng);
    expect(game.getState().phase).toBe("handComplete");
  });
});

describe("TexasHoldemGame — fold mechanics", () => {
  it("one fold in heads-up ends the hand immediately", () => {
    const game = new TexasHoldemGame({ players: twoPlayers() });
    game.startHand(midRng);
    game.applyAction({ type: "fold" });
    expect(game.getState().phase).toBe("handComplete");
  });

  it("pot is zero after fold-win (chips awarded to winner)", () => {
    const game = new TexasHoldemGame({ players: twoPlayers(), smallBlind: 50 });
    game.startHand(midRng);
    game.applyAction({ type: "fold" });
    const state = game.getState();
    expect(state.pot).toBe(0);
    expect(state.winners).toHaveLength(1);
  });

  it("chips are conserved after a fold-win", () => {
    const game = new TexasHoldemGame({ players: twoPlayers(), smallBlind: 50 });
    game.startHand(midRng);
    game.applyAction({ type: "fold" });
    const total = game.getState().players.reduce((sum, p) => sum + p.chips, 0);
    expect(total).toBe(2000);
  });
});

describe("TexasHoldemGame — phase progression", () => {
  let game: TexasHoldemGame;

  beforeEach(() => {
    game = new TexasHoldemGame({ players: twoPlayers(), smallBlind: 10 });
    game.startHand(midRng);
  });

  it("advances to flop after call + check", () => {
    game.applyAction({ type: "call" });   // SB calls BB
    game.applyAction({ type: "check" });  // BB checks → round complete
    expect(game.getState().phase).toBe("flop");
    expect(game.getState().communityCards).toHaveLength(3);
  });

  it("advances to turn after flop checks", () => {
    game.applyAction({ type: "call" });
    game.applyAction({ type: "check" });
    // flop: both check
    game.applyAction({ type: "check" });
    game.applyAction({ type: "check" });
    expect(game.getState().phase).toBe("turn");
    expect(game.getState().communityCards).toHaveLength(4);
  });

  it("advances to river after turn checks", () => {
    game.applyAction({ type: "call" });
    game.applyAction({ type: "check" });
    game.applyAction({ type: "check" });
    game.applyAction({ type: "check" });
    game.applyAction({ type: "check" });
    game.applyAction({ type: "check" });
    expect(game.getState().phase).toBe("river");
    expect(game.getState().communityCards).toHaveLength(5);
  });

  it("reaches handComplete after river checks", () => {
    // HU hand: 1 call (preflop) + 7 checks (2 per postflop street × 3 streets = 6,
    // but dealer acts first on flop so it resolves with 2+2+2+1-extra = 7 checks)
    game.applyAction({ type: "call" });
    for (let i = 0; i < 7; i += 1) {
      game.applyAction({ type: "check" });
    }
    expect(game.getState().phase).toBe("handComplete");
  });
});

describe("TexasHoldemGame — all-in and side pots", () => {
  it("resolves correctly when the shorter stack goes all-in and is called", () => {
    const game = new TexasHoldemGame({
      players: [
        { id: "p1", name: "Short", chips: 100 },
        { id: "p2", name: "Deep", chips: 1000 },
      ],
      smallBlind: 10,
    });
    game.startHand(midRng);
    game.applyAction({ type: "all-in" }); // SB goes all-in
    game.applyAction({ type: "call" });   // BB calls
    const state = game.getState();
    expect(state.phase).toBe("handComplete");
    expect(state.pot).toBe(0); // fully distributed
  });

  it("conserves total chips during an all-in showdown", () => {
    const game = new TexasHoldemGame({
      players: [
        { id: "p1", name: "Short", chips: 100 },
        { id: "p2", name: "Deep", chips: 1000 },
      ],
      smallBlind: 10,
    });
    game.startHand(midRng);
    game.applyAction({ type: "all-in" });
    game.applyAction({ type: "call" });
    const total = game.getState().players.reduce((sum, p) => sum + p.chips, 0);
    expect(total).toBe(1100);
  });

  it("does not create a side pot eligible to a folded player", () => {
    const game = new TexasHoldemGame({
      players: [
        { id: "p1", name: "Short", chips: 200 },
        { id: "p2", name: "Deep", chips: 1000 },
        { id: "p3", name: "Folder", chips: 1000 },
      ],
      smallBlind: 10,
    });
    game.startHand(midRng);
    // active player (UTG/BTN in 3-handed) raises all-in
    game.applyAction({ type: "all-in" });
    game.applyAction({ type: "fold" }); // SB folds
    game.applyAction({ type: "call" }); // BB calls
    const state = game.getState();
    expect(state.phase).toBe("handComplete");
    const total = state.players.reduce((sum, p) => sum + p.chips, 0);
    expect(total).toBe(2200);
    // No winning pot should list the folded player as eligible
    for (const result of state.winners) {
      expect(result.winnerIds).not.toContain("p3");
    }
  });

  it("cannot fold when there is no active hand", () => {
    const game = new TexasHoldemGame({ players: twoPlayers() });
    expect(() => game.applyAction({ type: "fold" })).toThrow();
  });

  it("cannot check when facing a bet", () => {
    const game = new TexasHoldemGame({ players: twoPlayers(), smallBlind: 10 });
    game.startHand(midRng);
    // SB is active and faces a 20 BB — check should be illegal
    expect(() => game.applyAction({ type: "check" })).toThrow();
  });
});
