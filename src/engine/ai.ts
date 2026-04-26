import type { Card } from "./deck";
import { HandCategory, evaluateBestHand } from "./evaluator";
import type { PlayerAction } from "./game";

export type AIPersonalityId = "anchor" | "spectre" | "architect" | "cipher";

export interface PersonalityProfile {
  id: AIPersonalityId;
  displayName: string;
  aggressionFactor: number;
  bluffRate: number;
  tightness: number;
}

export interface AIDecisionContext {
  personality: AIPersonalityId;
  holeCards: Card[];
  communityCards: Card[];
  phase: "preflop" | "flop" | "turn" | "river";
  pot: number;
  toCall: number;
  minRaiseTo: number;
  playerStack: number;
  currentBet: number;
  opponentCount: number;
  random?: () => number;
}

export const AI_PERSONALITIES: Record<AIPersonalityId, PersonalityProfile> = {
  anchor: {
    id: "anchor",
    displayName: "Anchor",
    aggressionFactor: 0.25,
    bluffRate: 0.04,
    tightness: 0.92,
  },
  spectre: {
    id: "spectre",
    displayName: "Spectre",
    aggressionFactor: 0.82,
    bluffRate: 0.16,
    tightness: 0.8,
  },
  architect: {
    id: "architect",
    displayName: "Architect",
    aggressionFactor: 0.95,
    bluffRate: 0.28,
    tightness: 0.38,
  },
  cipher: {
    id: "cipher",
    displayName: "Cipher",
    aggressionFactor: 0.2,
    bluffRate: 0.08,
    tightness: 0.45,
  },
};

const rankValue = (rank: Card["rank"]): number => {
  if (rank === "A") return 14;
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;
  return Number(rank);
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const estimatePreflopStrength = (holeCards: Card[]): number => {
  if (holeCards.length !== 2) {
    return 0.5;
  }

  const [a, b] = holeCards;
  const aValue = rankValue(a.rank);
  const bValue = rankValue(b.rank);
  const high = Math.max(aValue, bValue);
  const low = Math.min(aValue, bValue);
  const paired = a.rank === b.rank;
  const suited = a.suit === b.suit;
  const gap = high - low;

  let score = 0.18 + high / 20 + low / 35;
  if (paired) {
    score += 0.32 + high / 30;
  }
  if (suited) {
    score += 0.08;
  }
  if (gap === 0 || gap === 1) {
    score += 0.06;
  } else if (gap >= 4) {
    score -= 0.08;
  }
  if (high >= 13) {
    score += 0.04;
  }

  return clamp(score, 0, 1);
};

const estimatePostflopStrength = (holeCards: Card[], communityCards: Card[]): number => {
  const evaluated = evaluateBestHand([...holeCards, ...communityCards]);
  const cat = evaluated.rank.category;
  const tie0 = evaluated.rank.tiebreakers[0] ?? 0;

  const baseByCategory: Record<HandCategory, number> = {
    [HandCategory.HIGH_CARD]: 0.24,
    [HandCategory.ONE_PAIR]: 0.46,
    [HandCategory.TWO_PAIR]: 0.61,
    [HandCategory.THREE_OF_A_KIND]: 0.72,
    [HandCategory.STRAIGHT]: 0.81,
    [HandCategory.FLUSH]: 0.86,
    [HandCategory.FULL_HOUSE]: 0.92,
    [HandCategory.FOUR_OF_A_KIND]: 0.97,
    [HandCategory.STRAIGHT_FLUSH]: 1,
  };

  const refinement = clamp((tie0 - 2) / 16, 0, 0.08);
  return clamp(baseByCategory[cat] + refinement, 0, 1);
};

const estimateStrength = (ctx: AIDecisionContext): number =>
  ctx.communityCards.length === 0
    ? estimatePreflopStrength(ctx.holeCards)
    : estimatePostflopStrength(ctx.holeCards, ctx.communityCards);

export const decideAIAction = (ctx: AIDecisionContext): PlayerAction => {
  const profile = AI_PERSONALITIES[ctx.personality];
  const rng = ctx.random ?? Math.random;

  const rawStrength = estimateStrength(ctx);
  const potOdds = ctx.toCall > 0 ? ctx.toCall / Math.max(1, ctx.pot + ctx.toCall) : 0;
  const multiwayPenalty = Math.max(0, (ctx.opponentCount - 1) * 0.03);
  const adjustedStrength = clamp(
    rawStrength - profile.tightness * 0.1 - potOdds * 0.2 - multiwayPenalty,
    0,
    1,
  );
  const bluffWindow = profile.bluffRate * (ctx.phase === "river" ? 0.7 : 1);
  const wantsBluff = rng() < bluffWindow && adjustedStrength < 0.55 && ctx.playerStack > ctx.toCall;

  const stackPressure = ctx.playerStack > 0 ? ctx.toCall / ctx.playerStack : 1;
  const allInThreshold = 0.88 - profile.aggressionFactor * 0.18;

  if (ctx.toCall > 0) {
    if (adjustedStrength < 0.3 - profile.tightness * 0.08 && !wantsBluff) {
      return { type: "fold" };
    }

    if (adjustedStrength > allInThreshold && stackPressure > 0.45) {
      return { type: "all-in" };
    }

    const raiseChance = clamp(
      profile.aggressionFactor * adjustedStrength + (wantsBluff ? 0.3 : 0) - stackPressure * 0.35,
      0,
      0.95,
    );

    if (rng() < raiseChance && ctx.playerStack + ctx.currentBet > ctx.minRaiseTo) {
      const pressureRaise = Math.max(
        ctx.minRaiseTo,
        ctx.currentBet + ctx.toCall + Math.ceil((ctx.pot + ctx.toCall) * (0.25 + profile.aggressionFactor * 0.35)),
      );
      const maxTo = ctx.currentBet + ctx.playerStack;
      if (pressureRaise >= maxTo) {
        return { type: "all-in" };
      }
      return { type: "raise", amount: pressureRaise };
    }

    return { type: "call" };
  }

  if (adjustedStrength > allInThreshold && ctx.playerStack > 0 && rng() < profile.aggressionFactor * 0.5) {
    return { type: "all-in" };
  }

  const proactiveRaiseChance = clamp(
    profile.aggressionFactor * (adjustedStrength + 0.12) + (wantsBluff ? 0.25 : 0),
    0,
    0.9,
  );

  if (rng() < proactiveRaiseChance && ctx.playerStack + ctx.currentBet > ctx.minRaiseTo) {
    const target = Math.max(
      ctx.minRaiseTo,
      ctx.currentBet + Math.ceil(Math.max(2, ctx.pot * (0.3 + profile.aggressionFactor * 0.35))),
    );
    const maxTo = ctx.currentBet + ctx.playerStack;
    if (target >= maxTo) {
      return { type: "all-in" };
    }
    return { type: "raise", amount: target };
  }

  return { type: "check" };
};
