import { useState, useEffect, useRef, useCallback } from 'react';
import { TexasHoldemGame } from '../engine/game';
import type {
  GameState,
  PlayerAction,
  PlayerActionType,
  PlayerState,
  GamePhase,
} from '../engine/game';
import { decideAIAction } from '../engine/ai';
import type { AIPersonalityId } from '../engine/ai';

export const HUMAN_ID = 'human';

const STARTING_CHIPS = 1000;
const SMALL_BLIND    = 10;
const AI_THINK_MS    = 2000;

export interface AIProfile {
  id: string;
  personality: AIPersonalityId;
  displayName: string;
}

// Seating order (left of human going clockwise on screen): Spectre(BL) → Cipher(TL) → Anchor(TR) → Architect(BR)
// Poker action goes LEFT, so: Human → Spectre → Cipher → Anchor → Architect → Human
export const AI_PROFILES: AIProfile[] = [
  { id: 'spectre',   personality: 'spectre',   displayName: 'SPECTRE'   },
  { id: 'cipher',    personality: 'cipher',    displayName: 'CIPHER'    },
  { id: 'anchor',    personality: 'anchor',    displayName: 'ANCHOR'    },
  { id: 'architect', personality: 'architect', displayName: 'ARCHITECT' },
];

export type ExpressionType = 'neutral' | 'thinking' | 'giggle' | 'angry';

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
  expression: ExpressionType;
  actionType: PlayerActionType;
}

type ReactionMap = Record<string, Record<string, string[]>>;
type ExpressionMap = Record<string, Record<string, ExpressionType>>;

const EXPRESSIONS: ExpressionMap = {
  anchor: {
    fold:     'neutral',
    check:    'thinking',
    call:     'neutral',
    raise:    'neutral',
    'all-in': 'neutral',
  },
  spectre: {
    fold:     'neutral',
    check:    'thinking',
    call:     'neutral',
    raise:    'giggle',
    'all-in': 'giggle',
  },
  architect: {
    fold:     'angry',
    check:    'neutral',
    call:     'neutral',
    raise:    'giggle',
    'all-in': 'giggle',
  },
  cipher: {
    fold:     'neutral',
    check:    'thinking',
    call:     'neutral',
    raise:    'thinking',
    'all-in': 'neutral',
  },
};

const REACTIONS: ReactionMap = {
  anchor: {
    fold:     ['Calculated risk.', 'Not my hand.', 'I fold. Patience.'],
    check:    ['Checking the waters.', 'I wait.', 'Methodical.'],
    call:     ['Even money.', 'I follow.', 'Acceptable odds.'],
    raise:    ['The tide rises.', 'Steady pressure.', 'Commitment.'],
    'all-in': ['Everything, calmly.', 'My final position.', 'All in.'],
  },
  spectre: {
    fold:     ['Ghost.', 'I was never here.', 'Vanish.'],
    check:    ['...', 'Watching.', 'I see you.'],
    call:     ['As expected.', 'Predictable.', 'Match.'],
    raise:    ['Your move.', 'Pressure applied.', 'Fear me.'],
    'all-in': ['Everything.', 'Nowhere to hide.', 'Endgame.'],
  },
  architect: {
    fold:     ['Tch. Not this one.', 'Bad blueprint.', 'Abort.'],
    check:    ["Free card? Fine.", 'Building...', "Let's see it."],
    call:     ['Sure, why not.', "I'll play.", 'Come on then!'],
    raise:    ['RAISE! Ha!', 'Build it up!', 'Top this!'],
    'all-in': ['ALL IN! Ha!', "Let's GO!", 'Burn it down!'],
  },
  cipher: {
    fold:     ['...', 'Null.', 'Exit.'],
    check:    ['0.', '...check.', 'Signal weak.'],
    call:     ['Match.', 'Copy.', 'Acknowledged.'],
    raise:    ['Signal rising.', 'Encode.', 'Encrypted.'],
    'all-in': ['Full signal.', 'Total commit.', 'Maximum output.'],
  },
};

let msgSeq = 0;

function pickReaction(personality: string, actionType: string): string {
  const pool = REACTIONS[personality]?.[actionType] ?? ['...'];
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickExpression(personality: string, actionType: string): ExpressionType {
  return EXPRESSIONS[personality]?.[actionType] ?? 'neutral';
}

function buildAIContext(state: GameState, player: PlayerState, personality: AIPersonalityId) {
  const toCall = Math.max(0, state.currentBet - player.currentBet);
  return {
    personality,
    holeCards: player.holeCards,
    communityCards: state.communityCards,
    phase: state.phase as 'preflop' | 'flop' | 'turn' | 'river',
    pot: state.pot,
    toCall,
    minRaiseTo: state.minRaiseTo,
    playerStack: player.chips,
    currentBet: player.currentBet,
    opponentCount: state.players.filter((p) => !p.folded && p.id !== player.id).length,
  };
}

const ACTIVE_PHASES: GamePhase[] = ['preflop', 'flop', 'turn', 'river'];
const isActivePhase = (phase: GamePhase) =>
  (ACTIVE_PHASES as string[]).includes(phase);

function makeGame(): TexasHoldemGame {
  return new TexasHoldemGame({
    players: [
      { id: HUMAN_ID, name: 'YOU', chips: STARTING_CHIPS },
      ...AI_PROFILES.map((p) => ({ id: p.id, name: p.displayName, chips: STARTING_CHIPS })),
    ],
    smallBlind: SMALL_BLIND,
    dealerIndex: 0,
  });
}

export interface UseGameStateReturn {
  gameState: GameState;
  chatMessages: ChatMessage[];
  isAIThinking: boolean;
  humanPlayer: PlayerState;
  humanIndex: number;
  isHumanTurn: boolean;
  toCall: number;
  canCheck: boolean;
  canCall: boolean;
  canRaise: boolean;
  canFold: boolean;
  humanAction: (action: PlayerAction) => void;
  latestExpressions: Record<string, ExpressionType>;
  restartGame: () => void;
}

export function useGameState(): UseGameStateReturn {
  const gameRef = useRef<TexasHoldemGame>(makeGame());

  const [gameState, setGameState] = useState<GameState>(() => ({
    ...gameRef.current.getState(),
  }));

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAIThinking, setIsAIThinking] = useState(false);

  const handNumberForChatRef = useRef(gameState.handNumber);
  useEffect(() => {
    if (handNumberForChatRef.current === gameState.handNumber) return;
    handNumberForChatRef.current = gameState.handNumber;
    setChatMessages([]);
  }, [gameState.handNumber]);

  const sync = useCallback(() => {
    setGameState({ ...gameRef.current.getState() });
  }, []);

  const pushChat = useCallback(
    (playerId: string, playerName: string, personality: string, actionType: string) => {
      const text       = pickReaction(personality, actionType);
      const expression = pickExpression(personality, actionType);
      const asAction = actionType as PlayerActionType;
      setChatMessages((prev) => [
        ...prev.slice(-24),
        {
          id: `m${++msgSeq}`,
          playerId,
          playerName,
          text,
          timestamp: Date.now(),
          expression,
          actionType: asAction,
        },
      ]);
    },
    [],
  );

  useEffect(() => {
    const state = gameState;
    const { phase } = state;

    if (phase === 'waiting' || phase === 'handComplete') return;

    if (!isActivePhase(phase)) return;

    const activePlayer = state.players[state.activePlayerIndex];
    if (!activePlayer || activePlayer.id === HUMAN_ID) return;
    if (activePlayer.folded || activePlayer.allIn) return;

    const profile = AI_PROFILES.find((p) => p.id === activePlayer.id);
    if (!profile) return;

    setIsAIThinking(true);
    const t = setTimeout(() => {
      try {
        const ctx = buildAIContext(state, activePlayer, profile.personality);
        const action = decideAIAction(ctx);
        pushChat(activePlayer.id, activePlayer.name, profile.personality, action.type);
        gameRef.current.applyAction(action);
      } catch {
        // guard against stale state
      }
      setIsAIThinking(false);
      sync();
    }, AI_THINK_MS);

    return () => clearTimeout(t);
  }, [gameState, pushChat, sync]);

  const restartGame = useCallback(() => {
    const s = gameRef.current.getState();
    const humanBust = s.players.find((p) => p.id === HUMAN_ID)?.chips === 0;
    const stillPlaying = s.players.filter((p) => p.chips > 0).length >= 2;
    const preserveSession =
      s.phase === 'waiting' ||
      (s.phase === 'handComplete' && stillPlaying && !humanBust);
    if (!preserveSession) {
      gameRef.current = makeGame();
    }
    gameRef.current.startHand();
    setChatMessages([]);
    setIsAIThinking(false);
    setGameState({ ...gameRef.current.getState() });
  }, []);

  const humanAction = useCallback(
    (action: PlayerAction) => {
      const state = gameRef.current.getState();
      const active = state.players[state.activePlayerIndex];
      if (active?.id !== HUMAN_ID) return;
      try {
        gameRef.current.applyAction(action);
        sync();
      } catch {
        // ignore invalid action (shouldn't happen with guarded UI)
      }
    },
    [sync],
  );

  const humanPlayer = gameState.players.find((p) => p.id === HUMAN_ID)!;
  const humanIndex  = gameState.players.findIndex((p) => p.id === HUMAN_ID);

  const isHumanTurn =
    isActivePhase(gameState.phase) &&
    gameState.players[gameState.activePlayerIndex]?.id === HUMAN_ID &&
    !humanPlayer?.folded &&
    !humanPlayer?.allIn;

  const toCall = humanPlayer
    ? Math.max(0, gameState.currentBet - humanPlayer.currentBet)
    : 0;

  const canCheck = isHumanTurn && toCall === 0;
  const canCall  = isHumanTurn && toCall > 0 && humanPlayer.chips > 0;
  const canRaise =
    isHumanTurn &&
    humanPlayer.chips + humanPlayer.currentBet > gameState.minRaiseTo;
  const canFold = isHumanTurn;

  const latestExpressions: Record<string, ExpressionType> = {};
  for (const msg of chatMessages) {
    latestExpressions[msg.playerId] = msg.expression;
  }

  // End of hand: winning AIs giggle, losing AIs angry (overrides last action until the next hand clears chat).
  if (gameState.phase === 'handComplete' && gameState.winners.length > 0) {
    const winnerIds = new Set<string>();
    for (const w of gameState.winners) {
      for (const id of w.winnerIds) {
        winnerIds.add(id);
      }
    }
    for (const p of gameState.players) {
      if (p.id === HUMAN_ID) continue;
      latestExpressions[p.id] = winnerIds.has(p.id) ? 'giggle' : 'angry';
    }
  }

  return {
    gameState,
    chatMessages,
    isAIThinking,
    humanPlayer,
    humanIndex,
    isHumanTurn,
    toCall,
    canCheck,
    canCall,
    canRaise,
    canFold,
    humanAction,
    latestExpressions,
    restartGame,
  };
}
