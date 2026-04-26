import { describe, it, expect } from "vitest";
import {
  evaluateFiveCardHand,
  evaluateBestHand,
  compareHandRanks,
  HandCategory,
} from "../evaluator";
import type { Card } from "../deck";

const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });
const C = (rank: Card["rank"]) => c(rank, "clubs");
const D = (rank: Card["rank"]) => c(rank, "diamonds");
const H = (rank: Card["rank"]) => c(rank, "hearts");
const S = (rank: Card["rank"]) => c(rank, "spades");

describe("evaluateFiveCardHand", () => {
  describe("Straight Flush", () => {
    it("identifies a king-high straight flush", () => {
      const rank = evaluateFiveCardHand([C("9"), C("10"), C("J"), C("Q"), C("K")]);
      expect(rank.category).toBe(HandCategory.STRAIGHT_FLUSH);
      expect(rank.tiebreakers[0]).toBe(13);
    });

    it("identifies a royal flush (ace-high straight flush)", () => {
      const rank = evaluateFiveCardHand([C("10"), C("J"), C("Q"), C("K"), C("A")]);
      expect(rank.category).toBe(HandCategory.STRAIGHT_FLUSH);
      expect(rank.tiebreakers[0]).toBe(14);
    });

    it("identifies a 6-high straight flush", () => {
      const rank = evaluateFiveCardHand([H("2"), H("3"), H("4"), H("5"), H("6")]);
      expect(rank.category).toBe(HandCategory.STRAIGHT_FLUSH);
      expect(rank.tiebreakers[0]).toBe(6);
    });
  });

  describe("Four of a Kind", () => {
    it("identifies four sevens", () => {
      const rank = evaluateFiveCardHand([C("7"), D("7"), H("7"), S("7"), C("A")]);
      expect(rank.category).toBe(HandCategory.FOUR_OF_A_KIND);
      expect(rank.tiebreakers[0]).toBe(7);
      expect(rank.tiebreakers[1]).toBe(14); // ace kicker
    });
  });

  describe("Full House", () => {
    it("identifies kings full of twos", () => {
      const rank = evaluateFiveCardHand([C("K"), D("K"), H("K"), C("2"), D("2")]);
      expect(rank.category).toBe(HandCategory.FULL_HOUSE);
      expect(rank.tiebreakers).toEqual([13, 2]);
    });

    it("ranks higher three-of-a-kind over lower", () => {
      const kingsFullOfAces = evaluateFiveCardHand([C("K"), D("K"), H("K"), C("A"), D("A")]);
      const queensFullOfAces = evaluateFiveCardHand([C("Q"), D("Q"), H("Q"), C("A"), D("A")]);
      expect(compareHandRanks(kingsFullOfAces, queensFullOfAces)).toBeGreaterThan(0);
    });
  });

  describe("Flush", () => {
    it("identifies a flush", () => {
      const rank = evaluateFiveCardHand([C("2"), C("5"), C("7"), C("J"), C("A")]);
      expect(rank.category).toBe(HandCategory.FLUSH);
      expect(rank.tiebreakers[0]).toBe(14); // ace-high
    });
  });

  describe("Straight", () => {
    it("identifies a nine-high straight", () => {
      const rank = evaluateFiveCardHand([C("5"), D("6"), H("7"), S("8"), C("9")]);
      expect(rank.category).toBe(HandCategory.STRAIGHT);
      expect(rank.tiebreakers[0]).toBe(9);
    });

    it("identifies a wheel (A-2-3-4-5) as a 5-high straight", () => {
      const rank = evaluateFiveCardHand([C("A"), D("2"), H("3"), S("4"), C("5")]);
      expect(rank.category).toBe(HandCategory.STRAIGHT);
      expect(rank.tiebreakers[0]).toBe(5);
    });

    it("does NOT treat A-K-Q-J-2 as a straight", () => {
      const rank = evaluateFiveCardHand([C("A"), D("K"), H("Q"), S("J"), C("2")]);
      expect(rank.category).not.toBe(HandCategory.STRAIGHT);
    });
  });

  describe("Three of a Kind", () => {
    it("identifies trip queens with kickers", () => {
      const rank = evaluateFiveCardHand([C("Q"), D("Q"), H("Q"), S("3"), C("7")]);
      expect(rank.category).toBe(HandCategory.THREE_OF_A_KIND);
      expect(rank.tiebreakers[0]).toBe(12);
      expect(rank.tiebreakers[1]).toBe(7); // higher kicker first
      expect(rank.tiebreakers[2]).toBe(3);
    });
  });

  describe("Two Pair", () => {
    it("identifies aces and kings with a deuce kicker", () => {
      const rank = evaluateFiveCardHand([C("A"), D("A"), H("K"), S("K"), C("2")]);
      expect(rank.category).toBe(HandCategory.TWO_PAIR);
      expect(rank.tiebreakers[0]).toBe(14);
      expect(rank.tiebreakers[1]).toBe(13);
      expect(rank.tiebreakers[2]).toBe(2); // kicker
    });
  });

  describe("One Pair", () => {
    it("identifies a pair of jacks with kickers in order", () => {
      const rank = evaluateFiveCardHand([C("J"), D("J"), H("A"), S("9"), C("5")]);
      expect(rank.category).toBe(HandCategory.ONE_PAIR);
      expect(rank.tiebreakers[0]).toBe(11);
      expect(rank.tiebreakers[1]).toBe(14); // ace kicker
    });
  });

  describe("High Card", () => {
    it("identifies jack-high with descending kickers", () => {
      const rank = evaluateFiveCardHand([C("2"), D("5"), H("7"), S("9"), C("J")]);
      expect(rank.category).toBe(HandCategory.HIGH_CARD);
      expect(rank.tiebreakers[0]).toBe(11); // J
      expect(rank.tiebreakers[1]).toBe(9);
    });
  });

  it("throws for wrong card count", () => {
    expect(() => evaluateFiveCardHand([C("A"), D("A"), H("A"), S("A")])).toThrow();
  });
});

describe("evaluateBestHand (7 cards)", () => {
  it("selects the flush over the pair when both are present", () => {
    const cards = [C("A"), C("K"), C("Q"), C("J"), C("3"), D("7"), H("7")];
    const result = evaluateBestHand(cards);
    expect(result.rank.category).toBe(HandCategory.FLUSH);
    expect(result.cards).toHaveLength(5);
  });

  it("identifies a straight flush hidden among 7 cards", () => {
    // 6-7-8-9-10 clubs = straight flush, plus a pair of 10s
    const cards = [C("6"), C("7"), C("8"), C("9"), C("10"), D("10"), H("J")];
    const result = evaluateBestHand(cards);
    expect(result.rank.category).toBe(HandCategory.STRAIGHT_FLUSH);
  });

  it("finds full house from 7 cards", () => {
    const cards = [C("K"), D("K"), H("K"), C("A"), D("A"), S("7"), H("2")];
    const result = evaluateBestHand(cards);
    expect(result.rank.category).toBe(HandCategory.FULL_HOUSE);
  });

  it("throws for fewer than 5 cards", () => {
    expect(() => evaluateBestHand([C("A"), D("A"), H("A"), S("A")])).toThrow();
  });
});

describe("compareHandRanks", () => {
  it("flush beats a straight", () => {
    const flush = evaluateFiveCardHand([C("2"), C("5"), C("7"), C("J"), C("A")]);
    const straight = evaluateFiveCardHand([D("5"), H("6"), S("7"), C("8"), D("9")]);
    expect(compareHandRanks(flush, straight)).toBeGreaterThan(0);
  });

  it("returns 0 for identical hands across suits", () => {
    const h1 = evaluateFiveCardHand([C("A"), D("A"), H("K"), S("K"), C("Q")]);
    const h2 = evaluateFiveCardHand([H("A"), S("A"), C("K"), D("K"), H("Q")]);
    expect(compareHandRanks(h1, h2)).toBe(0);
  });

  it("breaks pair ties by kicker", () => {
    const pairNinesWithAce = evaluateFiveCardHand([C("9"), D("9"), H("A"), S("K"), C("Q")]);
    const pairNinesWithKing = evaluateFiveCardHand([H("9"), S("9"), C("K"), D("Q"), H("J")]);
    expect(compareHandRanks(pairNinesWithAce, pairNinesWithKing)).toBeGreaterThan(0);
  });

  it("higher straight beats lower straight", () => {
    const tenHigh = evaluateFiveCardHand([C("6"), D("7"), H("8"), S("9"), C("10")]);
    const nineHigh = evaluateFiveCardHand([D("5"), H("6"), S("7"), C("8"), D("9")]);
    expect(compareHandRanks(tenHigh, nineHigh)).toBeGreaterThan(0);
  });

  it("higher flush beats lower flush", () => {
    const aceHigh = evaluateFiveCardHand([C("A"), C("K"), C("Q"), C("J"), C("3")]);
    const kingHigh = evaluateFiveCardHand([D("K"), D("Q"), D("J"), D("10"), D("2")]);
    expect(compareHandRanks(aceHigh, kingHigh)).toBeGreaterThan(0);
  });
});
