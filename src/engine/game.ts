import { createDeck, shuffleDeck, type Card } from "./deck";
import { compareHandRanks, evaluateBestHand, type EvaluatedHand } from "./evaluator";

export type GamePhase =
  | "waiting"
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "showdown"
  | "handComplete";

export type PlayerActionType = "fold" | "check" | "call" | "raise" | "all-in";

export interface PlayerAction {
  type: PlayerActionType;
  amount?: number;
}

export interface PlayerState {
  id: string;
  name: string;
  chips: number;
  holeCards: Card[];
  folded: boolean;
  allIn: boolean;
  currentBet: number;
  totalCommitted: number;
  actedThisRound: boolean;
}

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface ShowdownResult {
  winnerIds: string[];
  amount: number;
  rank: EvaluatedHand["rank"];
}

export interface GameState {
  handNumber: number;
  phase: GamePhase;
  players: PlayerState[];
  dealerIndex: number;
  activePlayerIndex: number;
  smallBlind: number;
  bigBlind: number;
  currentBet: number;
  minRaiseTo: number;
  pot: number;
  sidePots: SidePot[];
  communityCards: Card[];
  deck: Card[];
  winners: ShowdownResult[];
}

export interface GameConfig {
  players: Array<{ id: string; name: string; chips: number }>;
  dealerIndex?: number;
  smallBlind?: number;
}

const PHASES: Array<"preflop" | "flop" | "turn" | "river"> = ["preflop", "flop", "turn", "river"];

const nextIndex = (index: number, total: number): number => (index + 1) % total;

const isActiveInHand = (player: PlayerState): boolean => !player.folded && player.chips > 0;

const isEligibleToAct = (player: PlayerState): boolean =>
  !player.folded && !player.allIn && player.chips > 0;

const canMatchCurrentBet = (player: PlayerState, currentBet: number): boolean =>
  !player.folded && (player.allIn || player.currentBet === currentBet);

const sortedUnique = (values: number[]): number[] => Array.from(new Set(values)).sort((a, b) => a - b);

export class TexasHoldemGame {
  private state: GameState;

  public constructor(config: GameConfig) {
    if (config.players.length < 2) {
      throw new Error("TexasHoldemGame requires at least two players");
    }

    const smallBlind = config.smallBlind ?? 10;
    const bigBlind = smallBlind * 2;

    this.state = {
      handNumber: 0,
      phase: "waiting",
      players: config.players.map((player) => ({
        ...player,
        holeCards: [],
        folded: false,
        allIn: false,
        currentBet: 0,
        totalCommitted: 0,
        actedThisRound: false,
      })),
      dealerIndex: config.dealerIndex ?? 0,
      activePlayerIndex: 0,
      smallBlind,
      bigBlind,
      currentBet: 0,
      minRaiseTo: bigBlind,
      pot: 0,
      sidePots: [],
      communityCards: [],
      deck: [],
      winners: [],
    };
  }

  public getState(): Readonly<GameState> {
    return this.state;
  }

  public startHand(random = Math.random): void {
    const alivePlayers = this.state.players.filter((player) => player.chips > 0);
    if (alivePlayers.length < 2) {
      this.state.phase = "handComplete";
      return;
    }

    this.state.handNumber += 1;
    this.state.phase = "preflop";
    this.state.communityCards = [];
    this.state.deck = shuffleDeck(createDeck(), random);
    this.state.pot = 0;
    this.state.currentBet = 0;
    this.state.winners = [];
    this.state.sidePots = [];

    this.resetPlayersForHand();

    this.state.dealerIndex = this.findNextPlayerIndex(this.state.dealerIndex);
    this.postBlinds();
    this.dealHoleCards(2);

    const smallBlindIndex = this.findNextPlayerIndex(this.state.dealerIndex);
    const bigBlindIndex = this.findNextPlayerIndex(smallBlindIndex);
    this.state.activePlayerIndex = this.findNextPlayerIndex(bigBlindIndex);
    this.state.minRaiseTo = this.state.currentBet + this.state.bigBlind;

    this.advanceIfNoActionPossible();
  }

  public applyAction(action: PlayerAction): void {
    if (!PHASES.includes(this.state.phase as (typeof PHASES)[number])) {
      throw new Error(`Cannot act during phase ${this.state.phase}`);
    }

    const player = this.state.players[this.state.activePlayerIndex];
    if (!isEligibleToAct(player)) {
      throw new Error("Active player cannot act");
    }

    switch (action.type) {
      case "fold":
        player.folded = true;
        player.actedThisRound = true;
        break;
      case "check":
        if (player.currentBet !== this.state.currentBet) {
          throw new Error("Cannot check when facing a bet");
        }
        player.actedThisRound = true;
        break;
      case "call":
        this.putChipsInPot(player, this.state.currentBet - player.currentBet);
        player.actedThisRound = true;
        break;
      case "raise":
        this.handleRaise(player, action.amount ?? 0);
        break;
      case "all-in":
        this.handleAllIn(player);
        break;
      default:
        throw new Error("Unsupported action");
    }

    this.resolveAfterAction();
  }

  private resetPlayersForHand(): void {
    for (const player of this.state.players) {
      player.holeCards = [];
      player.folded = false;
      player.allIn = false;
      player.currentBet = 0;
      player.totalCommitted = 0;
      player.actedThisRound = false;
    }
  }

  private dealHoleCards(cardCount: number): void {
    for (let round = 0; round < cardCount; round += 1) {
      for (let offset = 1; offset <= this.state.players.length; offset += 1) {
        const playerIndex = (this.state.dealerIndex + offset) % this.state.players.length;
        const player = this.state.players[playerIndex];
        if (!isActiveInHand(player)) {
          continue;
        }

        const card = this.drawCard();
        player.holeCards.push(card);
      }
    }
  }

  private drawCard(): Card {
    const card = this.state.deck.pop();
    if (!card) {
      throw new Error("Deck exhausted");
    }
    return card;
  }

  private postBlinds(): void {
    const smallBlindIndex = this.findNextPlayerIndex(this.state.dealerIndex);
    const bigBlindIndex = this.findNextPlayerIndex(smallBlindIndex);
    const smallBlindPlayer = this.state.players[smallBlindIndex];
    const bigBlindPlayer = this.state.players[bigBlindIndex];

    this.putChipsInPot(smallBlindPlayer, this.state.smallBlind);
    this.putChipsInPot(bigBlindPlayer, this.state.bigBlind);

    this.state.currentBet = bigBlindPlayer.currentBet;
    this.state.minRaiseTo = this.state.currentBet + this.state.bigBlind;
    smallBlindPlayer.actedThisRound = false;
    bigBlindPlayer.actedThisRound = false;
  }

  private putChipsInPot(player: PlayerState, requestedAmount: number): number {
    if (requestedAmount <= 0) {
      return 0;
    }

    const amount = Math.min(player.chips, requestedAmount);
    player.chips -= amount;
    player.currentBet += amount;
    player.totalCommitted += amount;
    this.state.pot += amount;

    if (player.chips === 0) {
      player.allIn = true;
    }

    return amount;
  }

  private handleRaise(player: PlayerState, targetBet: number): void {
    if (targetBet <= this.state.currentBet) {
      throw new Error("Raise must exceed current bet");
    }
    if (targetBet < this.state.minRaiseTo && player.chips + player.currentBet > targetBet) {
      throw new Error("Raise size too small");
    }

    const previousBet = this.state.currentBet;
    const contributed = this.putChipsInPot(player, targetBet - player.currentBet);
    const actualBet = player.currentBet;

    if (actualBet <= previousBet) {
      throw new Error("Raise failed to exceed current bet");
    }

    const raiseSize = actualBet - previousBet;
    this.state.currentBet = actualBet;
    this.state.minRaiseTo = this.state.currentBet + Math.max(raiseSize, this.state.bigBlind);
    this.markRoundAsReopened(player.id);
    player.actedThisRound = true;

    if (contributed <= 0) {
      throw new Error("Raise contributed no chips");
    }
  }

  private handleAllIn(player: PlayerState): void {
    const before = player.currentBet;
    this.putChipsInPot(player, player.chips);
    const after = player.currentBet;

    if (after > this.state.currentBet) {
      const raiseSize = after - this.state.currentBet;
      this.state.currentBet = after;
      this.state.minRaiseTo = this.state.currentBet + Math.max(raiseSize, this.state.bigBlind);
      this.markRoundAsReopened(player.id);
    }

    player.actedThisRound = true;
    if (before === after) {
      throw new Error("All-in requires remaining chips");
    }
  }

  private markRoundAsReopened(raiserId: string): void {
    for (const player of this.state.players) {
      if (player.id !== raiserId && isEligibleToAct(player)) {
        player.actedThisRound = false;
      }
    }
  }

  private resolveAfterAction(): void {
    const contenders = this.state.players.filter((player) => !player.folded);
    if (contenders.length === 1) {
      const winner = contenders[0];
      winner.chips += this.state.pot;
      this.state.winners = [
        {
          winnerIds: [winner.id],
          amount: this.state.pot,
          rank: {
            category: 0,
            tiebreakers: [],
          },
        },
      ];
      this.state.pot = 0;
      this.state.phase = "handComplete";
      return;
    }

    if (this.isBettingRoundComplete()) {
      this.completeBettingRound();
      return;
    }

    this.state.activePlayerIndex = this.findNextActionIndex(this.state.activePlayerIndex);
  }

  private isBettingRoundComplete(): boolean {
    const actionable = this.state.players.filter(isEligibleToAct);
    if (actionable.length === 0) {
      return true;
    }

    for (const player of actionable) {
      if (!player.actedThisRound) {
        return false;
      }
      if (!canMatchCurrentBet(player, this.state.currentBet)) {
        return false;
      }
    }
    return true;
  }

  private completeBettingRound(): void {
    this.collectCurrentBetsIntoPotState();

    if (this.state.phase === "river" || this.onlyOnePlayerCanAct()) {
      this.resolveShowdown();
      return;
    }

    this.moveToNextPhase();
    this.resetRoundFlags();
    this.state.activePlayerIndex = this.findNextPlayerIndex(this.state.dealerIndex);
    this.advanceIfNoActionPossible();
  }

  private collectCurrentBetsIntoPotState(): void {
    this.state.sidePots = this.computeSidePots(this.state.players);
    this.state.currentBet = 0;
    this.state.minRaiseTo = this.state.bigBlind;
    for (const player of this.state.players) {
      player.currentBet = 0;
    }
  }

  private moveToNextPhase(): void {
    switch (this.state.phase) {
      case "preflop":
        this.burnCard();
        this.state.communityCards.push(this.drawCard(), this.drawCard(), this.drawCard());
        this.state.phase = "flop";
        break;
      case "flop":
        this.burnCard();
        this.state.communityCards.push(this.drawCard());
        this.state.phase = "turn";
        break;
      case "turn":
        this.burnCard();
        this.state.communityCards.push(this.drawCard());
        this.state.phase = "river";
        break;
      default:
        throw new Error(`Cannot move from phase ${this.state.phase}`);
    }
  }

  private burnCard(): void {
    this.drawCard();
  }

  private resetRoundFlags(): void {
    for (const player of this.state.players) {
      player.actedThisRound = !isEligibleToAct(player);
    }
  }

  private onlyOnePlayerCanAct(): boolean {
    return this.state.players.filter(isEligibleToAct).length <= 1;
  }

  private runOutBoard(): void {
    if (this.state.communityCards.length < 3) {
      this.burnCard();
      this.state.communityCards.push(this.drawCard(), this.drawCard(), this.drawCard());
    }
    if (this.state.communityCards.length < 4) {
      this.burnCard();
      this.state.communityCards.push(this.drawCard());
    }
    if (this.state.communityCards.length < 5) {
      this.burnCard();
      this.state.communityCards.push(this.drawCard());
    }
  }

  private resolveShowdown(): void {
    this.runOutBoard();
    this.state.phase = "showdown";
    const sidePots = this.computeSidePots(this.state.players);
    this.state.sidePots = sidePots;

    const activePlayers = this.state.players.filter((player) => !player.folded);
    const handMap = new Map<string, EvaluatedHand>();

    for (const player of activePlayers) {
      handMap.set(player.id, evaluateBestHand([...player.holeCards, ...this.state.communityCards]));
    }

    const winners: ShowdownResult[] = [];
    for (const pot of sidePots) {
      const eligible = activePlayers.filter((player) => pot.eligiblePlayerIds.includes(player.id));
      if (eligible.length === 0) {
        continue;
      }

      let best = handMap.get(eligible[0].id)!;
      let winnerIds = [eligible[0].id];
      for (let i = 1; i < eligible.length; i += 1) {
        const player = eligible[i];
        const hand = handMap.get(player.id)!;
        const comparison = compareHandRanks(hand.rank, best.rank);
        if (comparison > 0) {
          best = hand;
          winnerIds = [player.id];
        } else if (comparison === 0) {
          winnerIds.push(player.id);
        }
      }

      const baseShare = Math.floor(pot.amount / winnerIds.length);
      let remainder = pot.amount % winnerIds.length;
      const winnersBySeat = [...winnerIds].sort(
        (a, b) => this.playerIndexById(a) - this.playerIndexById(b),
      );

      for (const winnerId of winnersBySeat) {
        const winner = this.playerById(winnerId);
        winner.chips += baseShare;
        if (remainder > 0) {
          winner.chips += 1;
          remainder -= 1;
        }
      }

      winners.push({
        winnerIds: winnersBySeat,
        amount: pot.amount,
        rank: best.rank,
      });
    }

    this.state.winners = winners;
    this.state.pot = 0;
    this.state.phase = "handComplete";
  }

  private computeSidePots(players: PlayerState[]): SidePot[] {
    const committedLevels = sortedUnique(players.map((player) => player.totalCommitted).filter((v) => v > 0));
    const pots: SidePot[] = [];
    let previousLevel = 0;

    for (const level of committedLevels) {
      const contributors = players.filter((player) => player.totalCommitted >= level);
      const band = level - previousLevel;
      const amount = band * contributors.length;
      if (amount <= 0) {
        previousLevel = level;
        continue;
      }

      const eligiblePlayerIds = contributors.filter((player) => !player.folded).map((player) => player.id);
      pots.push({ amount, eligiblePlayerIds });
      previousLevel = level;
    }

    return pots;
  }

  private findNextPlayerIndex(fromIndex: number): number {
    let index = fromIndex;
    for (let i = 0; i < this.state.players.length; i += 1) {
      index = nextIndex(index, this.state.players.length);
      if (isActiveInHand(this.state.players[index])) {
        return index;
      }
    }
    throw new Error("No active players found");
  }

  private findNextActionIndex(fromIndex: number): number {
    let index = fromIndex;
    for (let i = 0; i < this.state.players.length; i += 1) {
      index = nextIndex(index, this.state.players.length);
      if (isEligibleToAct(this.state.players[index])) {
        return index;
      }
    }
    return fromIndex;
  }

  private playerById(id: string): PlayerState {
    const player = this.state.players.find((candidate) => candidate.id === id);
    if (!player) {
      throw new Error(`Unknown player id ${id}`);
    }
    return player;
  }

  private playerIndexById(id: string): number {
    const index = this.state.players.findIndex((candidate) => candidate.id === id);
    if (index < 0) {
      throw new Error(`Unknown player id ${id}`);
    }
    return index;
  }

  private advanceIfNoActionPossible(): void {
    if (this.onlyOnePlayerCanAct()) {
      this.completeBettingRound();
    }
  }
}
