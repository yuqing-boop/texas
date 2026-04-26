import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { GameState, PlayerAction, PlayerActionType } from '../engine/game';
import type { ChatMessage, ExpressionType } from '../hooks/useGameState';
import { AI_PROFILES } from '../hooks/useGameState';
import { HUMAN_ID } from '../hooks/useGameState';
import { PlayerPanel } from './PlayerPanel';
import { CommunityCards } from './CommunityCards';
import { StatusBar } from './StatusBar';
import { InfoPanel } from './InfoPanel';
import { HumanControlPanel } from './HumanControlPanel';

/** Table layout: row1 cipher | info | anchor; row2 community (center); row3 spectre | human | architect. */
const AI_SEAT_IDS = {
  topLeft: 'cipher',
  topRight: 'anchor',
  bottomLeft: 'spectre',
  bottomRight: 'architect',
} as const;

interface GameTableProps {
  gameState: GameState;
  isHumanTurn: boolean;
  isAIThinking: boolean;
  canCheck: boolean;
  canCall: boolean;
  canRaise: boolean;
  canFold: boolean;
  toCall: number;
  chatMessages: ChatMessage[];
  latestExpressions: Record<string, ExpressionType>;
  onAction: (action: PlayerAction) => void;
  onNewGame: () => void;
}

function profileFor(id: string) {
  return AI_PROFILES.find((a) => a.id === id);
}

export function GameTable({
  gameState,
  isHumanTurn,
  isAIThinking,
  canCheck,
  canCall,
  canRaise,
  canFold,
  toCall,
  chatMessages,
  latestExpressions,
  onAction,
  onNewGame,
}: GameTableProps) {
  const {
    players,
    dealerIndex,
    activePlayerIndex,
    phase,
    communityCards,
    pot,
    smallBlind,
    bigBlind,
    handNumber,
    minRaiseTo,
    winners,
  } = gameState;

  const humanPlayer  = players.find((p) => p.id === HUMAN_ID)!;
  const humanIndex   = players.findIndex((p) => p.id === HUMAN_ID);
  const revealAll    = phase === 'handComplete' || phase === 'showdown';
  const activePlayer   = players[activePlayerIndex];

  const maxRaiseTo = humanPlayer
    ? humanPlayer.chips + humanPlayer.currentBet
    : minRaiseTo;

  const byId = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p] as const)) as Record<string, (typeof players)[0]>,
    [players],
  );

  const lastDialogueById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const msg of chatMessages) {
      m[msg.playerId] = msg.text;
    }
    return m;
  }, [chatMessages]);

  const lastActionById = useMemo(() => {
    const m: Record<string, PlayerActionType> = {} as Record<string, PlayerActionType>;
    for (const msg of chatMessages) {
      m[msg.playerId] = msg.actionType;
    }
    return m;
  }, [chatMessages]);

  function renderAIPanel(
    seatId: (typeof AI_SEAT_IDS)[keyof typeof AI_SEAT_IDS],
    grid: { gridColumn: number; gridRow: number | string },
    position: { justifySelf: 'start' | 'end' | 'center'; alignSelf: 'start' | 'end' | 'center' },
    actionTitleMarkSide: 'left' | 'right',
    wrapperStyle?: CSSProperties,
    /** e.g. bottom-row Spectre / Architect: stack above the human control blob when overlap */
    aiSlotClassName?: string,
  ) {
    const p = byId[seatId];
    if (!p) return null;
    const idx = players.findIndex((x) => x.id === p.id);
    const prof = profileFor(p.id);
    return (
      <div
        className={['game-center-slot--ai', aiSlotClassName].filter(Boolean).join(' ')}
        style={{
          ...grid,
          justifySelf: position.justifySelf,
          alignSelf: position.alignSelf,
          overflow: 'visible',
          minWidth: 0,
          ...wrapperStyle,
        }}
      >
        <PlayerPanel
          key={p.id}
          player={p}
          isHuman={false}
          isActive={idx === activePlayerIndex}
          isDealer={idx === dealerIndex}
          revealCards={revealAll}
          aiProfile={prof}
          expression={latestExpressions[p.id] ?? 'neutral'}
          latestDialogue={lastDialogueById[p.id]}
          lastActionType={lastActionById[p.id]}
          actionTitleMarkSide={actionTitleMarkSide}
          gamePhase={phase}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent',
      }}
    >
      {/* ── Main window chrome — same Win95 strip + inset cells as StatusBar ── */}
      <div className="game-chrome-title">
        <div className="game-chrome-title__icon" aria-hidden>
          <span>♠</span>
        </div>
        <div className="game-chrome-title__title">
          <span>Texas Hold&apos;em — Surgery Simulation Interface</span>
        </div>
      </div>

      <div className="game-client">
        {/* Table + controls */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            overflow: 'visible',
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              overflow: 'visible',
              /* Slightly wider center column for board + pot readout; AIs on narrower side tracks */
              gridTemplateColumns: 'minmax(96px, 0.78fr) minmax(220px, 1.4fr) minmax(96px, 0.78fr)',
              gridTemplateRows: 'auto 1fr auto',
              columnGap: 4,
              rowGap: 4,
            }}
          >
            {renderAIPanel(
              AI_SEAT_IDS.topLeft,
              { gridColumn: 1, gridRow: 1 },
              { justifySelf: 'start', alignSelf: 'start' },
              'right',
              { transform: 'translate(14px, 54px)' },
            )}

            {/* InfoPanel — between Cipher and Anchor, top-center */}
            {humanPlayer && (
              <div
                className="game-center-slot game-center-slot--info"
                style={{
                  gridColumn: 2,
                  gridRow: 1,
                  alignSelf: 'end',
                  transform: 'translateY(-32px)',
                }}
              >
                <InfoPanel
                  humanChips={humanPlayer.chips}
                  pot={pot}
                  phase={phase}
                  smallBlind={smallBlind}
                  bigBlind={bigBlind}
                  handNumber={handNumber}
                  activePlayerName={activePlayer?.name ?? ''}
                  isAIThinking={isAIThinking}
                />
              </div>
            )}

            {renderAIPanel(
              AI_SEAT_IDS.topRight,
              { gridColumn: 3, gridRow: 1 },
              { justifySelf: 'end', alignSelf: 'start' },
              'left',
              { transform: 'translate(-14px, 54px)' },
            )}

            {/* Row 2 — community (center) */}
            <div
              className="game-center-slot game-center-slot--board"
              style={{
                gridColumn: 2,
                gridRow: 2,
                alignSelf: 'center',
                minHeight: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: 'translateY(46px)',
              }}
            >
              <CommunityCards
                cards={communityCards}
                phase={phase}
                winners={winners}
                players={players}
              />
            </div>

            {/* Row 3 — Spectre | Human | Architect (same grid columns as Cipher | info | Anchor) */}
            {renderAIPanel(
              AI_SEAT_IDS.bottomLeft,
              { gridColumn: 1, gridRow: 3 },
              { justifySelf: 'start', alignSelf: 'end' },
              'right',
              { transform: 'translate(14px, -24px)' },
              'game-center-slot--ai--bottom',
            )}

            {humanPlayer && (
              <div
                className="game-center-slot game-center-slot--human game-center-slot--human-bottom-row"
                style={{
                  gridColumn: 2,
                  gridRow: 3,
                  alignSelf: 'end',
                  minWidth: 0,
                }}
              >
                <HumanControlPanel
                  player={humanPlayer}
                  isActive={humanIndex === activePlayerIndex}
                  isDealer={humanIndex === dealerIndex}
                  canCheck={canCheck}
                  canCall={canCall}
                  callAmount={toCall}
                  canRaise={canRaise}
                  minRaiseTo={minRaiseTo}
                  maxRaiseTo={maxRaiseTo}
                  canFold={canFold}
                  disabled={!isHumanTurn || isAIThinking}
                  onAction={onAction}
                  onNewGame={onNewGame}
                />
              </div>
            )}

            {renderAIPanel(
              AI_SEAT_IDS.bottomRight,
              { gridColumn: 3, gridRow: 3 },
              { justifySelf: 'end', alignSelf: 'end' },
              'left',
              { transform: 'translate(-14px, -24px)' },
              'game-center-slot--ai--bottom',
            )}
          </div>
        </div>
      </div>

      <StatusBar
        phase={phase}
        handNumber={handNumber}
        smallBlind={smallBlind}
        bigBlind={bigBlind}
        activePlayerName={activePlayer?.name ?? ''}
        isAIThinking={isAIThinking}
      />
    </div>
  );
}
