import type { Card, Rank } from "./deck";

export const HandCategory = {
  HIGH_CARD: 0,
  ONE_PAIR: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8,
} as const;
export type HandCategory = (typeof HandCategory)[keyof typeof HandCategory];

const RANK_VALUE: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export interface HandRank {
  category: HandCategory;
  tiebreakers: number[];
}

export interface EvaluatedHand {
  cards: Card[];
  rank: HandRank;
}

const sortDesc = (values: number[]): number[] => [...values].sort((a, b) => b - a);

const getStraightHigh = (values: number[]): number | null => {
  const unique = Array.from(new Set(values)).sort((a, b) => a - b);
  if (unique.includes(14)) {
    unique.unshift(1);
  }

  let run = 1;
  let highest: number | null = null;
  for (let i = 1; i < unique.length; i += 1) {
    if (unique[i] === unique[i - 1] + 1) {
      run += 1;
      if (run >= 5) {
        highest = unique[i] === 1 ? 5 : unique[i];
      }
    } else {
      run = 1;
    }
  }
  return highest;
};

const combinations = <T>(items: T[], choose: number): T[][] => {
  const result: T[][] = [];
  const path: T[] = [];

  const backtrack = (start: number): void => {
    if (path.length === choose) {
      result.push([...path]);
      return;
    }

    for (let i = start; i <= items.length - (choose - path.length); i += 1) {
      path.push(items[i]);
      backtrack(i + 1);
      path.pop();
    }
  };

  backtrack(0);
  return result;
};

export const compareHandRanks = (a: HandRank, b: HandRank): number => {
  if (a.category !== b.category) {
    return a.category > b.category ? 1 : -1;
  }

  const maxLength = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < maxLength; i += 1) {
    const av = a.tiebreakers[i] ?? 0;
    const bv = b.tiebreakers[i] ?? 0;
    if (av !== bv) {
      return av > bv ? 1 : -1;
    }
  }
  return 0;
};

export const evaluateFiveCardHand = (cards: Card[]): HandRank => {
  if (cards.length !== 5) {
    throw new Error("evaluateFiveCardHand requires exactly 5 cards");
  }

  const values = cards.map((card) => RANK_VALUE[card.rank]);
  const sorted = sortDesc(values);
  const byValue = new Map<number, number>();
  for (const value of values) {
    byValue.set(value, (byValue.get(value) ?? 0) + 1);
  }

  const groups = Array.from(byValue.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return b[0] - a[0];
  });

  const isFlush = cards.every((card) => card.suit === cards[0].suit);
  const straightHigh = getStraightHigh(values);

  if (isFlush && straightHigh !== null) {
    return {
      category: HandCategory.STRAIGHT_FLUSH,
      tiebreakers: [straightHigh],
    };
  }

  if (groups[0][1] === 4) {
    return {
      category: HandCategory.FOUR_OF_A_KIND,
      tiebreakers: [groups[0][0], groups[1][0]],
    };
  }

  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return {
      category: HandCategory.FULL_HOUSE,
      tiebreakers: [groups[0][0], groups[1][0]],
    };
  }

  if (isFlush) {
    return {
      category: HandCategory.FLUSH,
      tiebreakers: sorted,
    };
  }

  if (straightHigh !== null) {
    return {
      category: HandCategory.STRAIGHT,
      tiebreakers: [straightHigh],
    };
  }

  if (groups[0][1] === 3) {
    const kickers = groups
      .slice(1)
      .map(([value]) => value)
      .sort((a, b) => b - a);
    return {
      category: HandCategory.THREE_OF_A_KIND,
      tiebreakers: [groups[0][0], ...kickers],
    };
  }

  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const pairValues = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    const kicker = groups[2][0];
    return {
      category: HandCategory.TWO_PAIR,
      tiebreakers: [...pairValues, kicker],
    };
  }

  if (groups[0][1] === 2) {
    const kickers = groups
      .slice(1)
      .map(([value]) => value)
      .sort((a, b) => b - a);
    return {
      category: HandCategory.ONE_PAIR,
      tiebreakers: [groups[0][0], ...kickers],
    };
  }

  return {
    category: HandCategory.HIGH_CARD,
    tiebreakers: sorted,
  };
};

export const evaluateBestHand = (cards: Card[]): EvaluatedHand => {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error("evaluateBestHand requires 5 to 7 cards");
  }

  const allHands = combinations(cards, 5);
  let bestCards = allHands[0];
  let bestRank = evaluateFiveCardHand(bestCards);

  for (let i = 1; i < allHands.length; i += 1) {
    const rank = evaluateFiveCardHand(allHands[i]);
    if (compareHandRanks(rank, bestRank) > 0) {
      bestCards = allHands[i];
      bestRank = rank;
    }
  }

  return {
    cards: bestCards,
    rank: bestRank,
  };
};
