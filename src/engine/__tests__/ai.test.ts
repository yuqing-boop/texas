import { describe, it, expect } from "vitest";
import { decideAIAction, AI_PERSONALITIES, type AIPersonalityId } from "../ai";
import type { Card } from "../deck";
import type { AIDecisionContext } from "../ai";

// Pocket aces — strongest possible preflop hand
const STRONG_HOLE: Card[] = [
  { rank: "A", suit: "spades" },
  { rank: "A", suit: "hearts" },
];

// 2-3 offsuit — bottom of the preflop range
const WEAK_HOLE: Card[] = [
  { rank: "2", suit: "clubs" },
  { rank: "3", suit: "diamonds" },
];

// Royal-flush board (combined with A♠K♠ hole → straight flush)
const ROYAL_COMMUNITY: Card[] = [
  { rank: "K", suit: "spades" },
  { rank: "Q", suit: "spades" },
  { rank: "J", suit: "spades" },
];

const ROYAL_HOLE: Card[] = [
  { rank: "A", suit: "spades" },
  { rank: "10", suit: "spades" },
];

// Creates an rng that always returns the given constant
const constantRng = (v: number) => () => v;

const baseCtx = (overrides: Partial<AIDecisionContext> = {}): AIDecisionContext => ({
  personality: "anchor",
  holeCards: WEAK_HOLE,
  communityCards: [],
  phase: "preflop",
  pot: 30,
  toCall: 0,
  minRaiseTo: 40,
  playerStack: 1000,
  currentBet: 0,
  opponentCount: 1,
  ...overrides,
});

describe("decideAIAction — common contract", () => {
  const VALID_TYPES = new Set(["fold", "check", "call", "raise", "all-in"]);

  it("returns a valid action type for every personality in typical context", () => {
    const ids: AIPersonalityId[] = ["anchor", "spectre", "architect", "cipher"];
    for (const personality of ids) {
      const action = decideAIAction(baseCtx({ personality, holeCards: STRONG_HOLE }));
      expect(VALID_TYPES.has(action.type)).toBe(true);
    }
  });

  it("raise actions include an amount", () => {
    const action = decideAIAction(
      baseCtx({
        personality: "architect",
        holeCards: STRONG_HOLE,
        random: constantRng(0.99), // maximises aggression
      }),
    );
    if (action.type === "raise") {
      expect(typeof action.amount).toBe("number");
      expect(action.amount!).toBeGreaterThan(0);
    }
  });

  it("raise amount is at least minRaiseTo", () => {
    const action = decideAIAction(
      baseCtx({
        personality: "spectre",
        holeCards: STRONG_HOLE,
        minRaiseTo: 80,
        random: constantRng(0.3), // triggers raise path
      }),
    );
    if (action.type === "raise") {
      expect(action.amount!).toBeGreaterThanOrEqual(80);
    }
  });
});

describe("decideAIAction — personality traits", () => {
  it("Anchor folds a very weak hand when facing a pot-sized bet and bluff is suppressed", () => {
    // rng=1 → wantsBluff = (1 < bluffRate) = false for all personalities
    const action = decideAIAction(
      baseCtx({
        personality: "anchor",
        holeCards: WEAK_HOLE,
        pot: 100,
        toCall: 300,    // big overbet → high pot-odds → fold threshold reached
        playerStack: 1000,
        currentBet: 0,
        random: constantRng(1), // 1 < bluffRate (0.04) is false → no bluff
      }),
    );
    expect(action.type).toBe("fold");
  });

  it("Anchor does NOT bluff when rng exceeds its low bluffRate (0.04)", () => {
    // rng=0.9 → wantsBluff = (0.9 < 0.04) = false → folds the weak hand
    const action = decideAIAction(
      baseCtx({
        personality: "anchor",
        holeCards: WEAK_HOLE,
        pot: 100,
        toCall: 300,
        playerStack: 1000,
        random: constantRng(0.9), // well above 0.04 bluff rate
      }),
    );
    expect(action.type).toBe("fold");
  });

  it("Architect raises or goes all-in with strong hand and no call needed", () => {
    // rng=0.5 is comfortably below proactiveRaiseChance (~0.9) and above bluffRate
    const action = decideAIAction(
      baseCtx({
        personality: "architect",
        holeCards: STRONG_HOLE,
        toCall: 0,
        pot: 30,
        random: constantRng(0.5),
      }),
    );
    expect(["raise", "all-in"]).toContain(action.type);
  });

  it("Cipher checks with weak hand and no facing bet (passive path)", () => {
    // rng=0.5 exceeds Cipher's proactiveRaiseChance (~0.104) for a weak hand → check
    const action = decideAIAction(
      baseCtx({
        personality: "cipher",
        holeCards: WEAK_HOLE,
        toCall: 0,
        random: constantRng(0.5), // > 0.104 raise chance → not a raise
      }),
    );
    expect(action.type).toBe("check");
  });

  it("Spectre raises aggressively postflop with a made hand", () => {
    const action = decideAIAction(
      baseCtx({
        personality: "spectre",
        holeCards: ROYAL_HOLE,
        communityCards: ROYAL_COMMUNITY,
        phase: "flop",
        pot: 100,
        toCall: 0,
        random: constantRng(0.4), // below spectre's aggression threshold
      }),
    );
    expect(["raise", "all-in"]).toContain(action.type);
  });

  it("goes all-in when stack-to-call ratio is very high and hand is very strong", () => {
    const action = decideAIAction(
      baseCtx({
        personality: "spectre",
        holeCards: ROYAL_HOLE,
        communityCards: ROYAL_COMMUNITY,
        phase: "flop",
        pot: 500,
        toCall: 600,
        playerStack: 650,   // calling 600 with 650 left → high stack pressure
        currentBet: 0,
        random: constantRng(0),
      }),
    );
    // With near-stack-size bet and a monster hand, all-in is optimal
    expect(action.type).toBe("all-in");
  });
});

describe("AI_PERSONALITIES constants", () => {
  const ids: AIPersonalityId[] = ["anchor", "spectre", "architect", "cipher"];

  it("all four personalities are defined", () => {
    for (const id of ids) {
      expect(AI_PERSONALITIES[id]).toBeDefined();
    }
  });

  it("values are in [0, 1] range", () => {
    for (const id of ids) {
      const p = AI_PERSONALITIES[id];
      expect(p.aggressionFactor).toBeGreaterThanOrEqual(0);
      expect(p.aggressionFactor).toBeLessThanOrEqual(1);
      expect(p.bluffRate).toBeGreaterThanOrEqual(0);
      expect(p.bluffRate).toBeLessThanOrEqual(1);
      expect(p.tightness).toBeGreaterThanOrEqual(0);
      expect(p.tightness).toBeLessThanOrEqual(1);
    }
  });

  it("Architect is more aggressive than Anchor", () => {
    expect(AI_PERSONALITIES.architect.aggressionFactor).toBeGreaterThan(
      AI_PERSONALITIES.anchor.aggressionFactor,
    );
  });

  it("Anchor is tighter than Architect", () => {
    expect(AI_PERSONALITIES.anchor.tightness).toBeGreaterThan(
      AI_PERSONALITIES.architect.tightness,
    );
  });

  it("Architect has a higher bluff rate than Anchor", () => {
    expect(AI_PERSONALITIES.architect.bluffRate).toBeGreaterThan(
      AI_PERSONALITIES.anchor.bluffRate,
    );
  });
});
