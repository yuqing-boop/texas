import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
} from 'react';
import type { CSSProperties } from 'react';
import type { GamePhase, PlayerActionType, PlayerState } from '../engine/game';
import type { AIProfile } from '../hooks/useGameState';
import type { ExpressionType } from '../hooks/useGameState';
import { Card } from './Card';

/** Hashed dev/prod URLs for any file placed in src/assets/portraits/ */
const bundledPortraitBySuffix = (() => {
  const mod = import.meta.glob<string>('../assets/portraits/*.png', {
    eager: true,
    import: 'default',
  });
  const map: Record<string, string> = {};
  for (const [path, url] of Object.entries(mod)) {
    const m = path.match(/\/([^/]+\.png)$/);
    if (m) map[m[1]] = url as string;
  }
  return map;
})();

function urlForLocalPortrait(character: string, expression: string): string | undefined {
  return (
    bundledPortraitBySuffix[`${character}_${expression}.png`] ??
    // Some art files use a hyphen (e.g. cipher-thinking.png) instead of cipher_thinking.png
    bundledPortraitBySuffix[`${character}-${expression}.png`]
  );
}

interface PlayerPanelProps {
  player: PlayerState;
  isHuman: boolean;
  isActive: boolean;
  isDealer: boolean;
  revealCards: boolean;
  aiProfile?: AIProfile;
  expression?: ExpressionType;
  /** Latest line of dialogue (AI reactions); shown in the character speech box. */
  latestDialogue?: string;
  /** Last table action; shown as a side tab (AI only; which edge attaches to the window is set by table layout). */
  lastActionType?: PlayerActionType;
  /** `left` = subpanel left edge flush with window (tab extends table-left); `right` = right edge flush (tab extends table-right). */
  actionTitleMarkSide?: 'left' | 'right';
  /** Current table phase; used for AI action strip. Omit for human-only usage. */
  gamePhase?: GamePhase;
}

function actionMarkLabel(t: PlayerActionType): string {
  return t === 'all-in' ? 'ALL-IN' : t.toUpperCase();
}

/**
 * One source of truth for the AI action strip: engine state (fold, all-in, turn) and last chat
 * action for the last verb; `currentBet` is always the committed amount, never a separate “BET” label.
 */
function deriveAiActionDisplay(
  p: PlayerState,
  isActive: boolean,
  lastFromChat: PlayerActionType | undefined,
): { primary: string; amountLine: string | undefined } {
  const money = p.currentBet > 0 ? `$${p.currentBet.toLocaleString()}` : undefined;
  if (p.folded) {
    return { primary: 'FOLD', amountLine: money };
  }
  if (p.allIn) {
    return { primary: 'ALL-IN', amountLine: money };
  }
  if (isActive) {
    return { primary: 'ACTING', amountLine: money };
  }
  if (lastFromChat) {
    return { primary: actionMarkLabel(lastFromChat), amountLine: money };
  }
  if (money) {
    return { primary: '', amountLine: money };
  }
  return { primary: '—', amountLine: undefined };
}

const ACTION_MARK_CLASSES = (extendsFromRightEdge: boolean) =>
  [
    'action-side-subpanel--fused',
    extendsFromRightEdge
      ? 'action-side-subpanel--fused-to-right'
      : 'action-side-subpanel--fused-to-left',
  ].join(' ');

/** Beveled action mark only (no position — used inside the side column). */
function ActionSideMarkContent({
  primary,
  amountLine,
  actionTitleMarkSide,
}: {
  primary: string;
  amountLine: string | undefined;
  actionTitleMarkSide: 'left' | 'right';
}) {
  const extendsFromRightEdge = actionTitleMarkSide === 'right';
  return (
    <div
      className={ACTION_MARK_CLASSES(extendsFromRightEdge)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        minHeight: 32,
        padding: '4px 12px',
        background: 'var(--win-bg)',
        fontFamily: 'var(--font-pixel)',
        textAlign: 'center' as const,
        whiteSpace: 'normal' as const,
        pointerEvents: 'none' as const,
      }}
    >
      {primary ? (
        <span
          className="stat-note-line"
          style={{
            fontSize: 13,
            textTransform: 'uppercase',
            lineHeight: 1.15,
          }}
        >
          {primary}
        </span>
      ) : null}
      {amountLine && (
        <span
          className="stat-note-line"
          style={{
            fontFamily: 'var(--font-arcade)',
            fontSize: primary ? 10 : 9,
            lineHeight: 1.1,
            textTransform: 'none' as const,
          }}
        >
          {amountLine}
        </span>
      )}
    </div>
  );
}

/**
 * Action mark + hole cards in a column past the window edge, below the mark.
 * The mark’s vertical center stays on the portrait center line; cards sit under the mark.
 */
function AiSideMarkAndCards({
  actionTitleMarkSide,
  actionMarkCenterY,
  showMark,
  primary,
  amountLine,
  player,
  revealCards,
}: {
  actionTitleMarkSide: 'left' | 'right';
  actionMarkCenterY: number;
  showMark: boolean;
  primary: string;
  amountLine: string | undefined;
  player: PlayerState;
  revealCards: boolean;
}) {
  const markMeasureRef = useRef<HTMLDivElement>(null);
  const [markHeight, setMarkHeight] = useState(36);

  useLayoutEffect(() => {
    if (!showMark || !markMeasureRef.current) return;
    const el = markMeasureRef.current;
    const sync = () => setMarkHeight(Math.max(1, el.getBoundingClientRect().height));
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showMark, primary, amountLine, actionTitleMarkSide]);

  const extendsFromRightEdge = actionTitleMarkSide === 'right';
  const sideX = extendsFromRightEdge
    ? ({ left: '100%' as const } as const)
    : ({ right: '100%' as const } as const);

  const cardCol = (
    <div
      className="ai-side-hole-cards"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, pointerEvents: 'none' as const }}
    >
      {player.holeCards.length > 0 ? (
        player.holeCards.map((card, i) => (
          <Card key={i} card={card} faceDown={!revealCards} small />
        ))
      ) : (
        <>
          <Card faceDown small />
          <Card faceDown small />
        </>
      )}
    </div>
  );

  if (showMark) {
    return (
      <div
        style={{
          position: 'absolute',
          zIndex: 3,
          ...sideX,
          top: actionMarkCenterY - markHeight / 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <div ref={markMeasureRef}>
          <ActionSideMarkContent
            primary={primary}
            amountLine={amountLine}
            actionTitleMarkSide={actionTitleMarkSide}
          />
        </div>
        {cardCol}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 3,
        ...sideX,
        top: actionMarkCenterY,
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {cardCol}
    </div>
  );
}

/** Top “folder” tab: same fused idea as the side action mark — name sits above the window, no bevel on the join. */
function AiNameTopTab({
  name,
  isDealer,
  folded,
  alignToPanel,
}: {
  name: string;
  isDealer: boolean;
  folded: boolean;
  /** `right` = left-column panels (tab to the right edge of the window); `left` = right-column (tab to the left edge). */
  alignToPanel: 'left' | 'right';
}) {
  const alignClass =
    alignToPanel === 'right' ? 'ai-name-top-tab--align-panel-right' : 'ai-name-top-tab--align-panel-left';
  return (
    <div className={['ai-name-top-tab--fused', alignClass, folded ? 'label-folded' : ''].filter(Boolean).join(' ')}>
      <span className="ai-name-top-tab__name">{name}</span>
      {isDealer && <span className="ai-name-top-tab__dealer">D</span>}
    </div>
  );
}

const ASCII_PORTRAITS: Record<string, string[]> = {
  anchor:    ['░▓██▓░', '█ ◉◉ █', '█ ── █', '░████░'],
  spectre:   ['▓░▓░▓░', '░▓ ▓░▓', '▓░ ░▓░', '▓▓▓▓▓▓'],
  architect: ['██████', '█    █', '██  ██', '██████'],
  cipher:    ['010110', '101001', '011010', '100101'],
  human:     ['┌────┐', '│ ◉◉ │', '│ ── │', '└────┘'],
};

function publicPortraitPath(character: string, expression: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '') || '';
  return `${base}/portraits/${character}_${expression}.png`;
}

function publicPortraitPathHyphen(character: string, expression: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '') || '';
  return `${base}/portraits/${character}-${expression}.png`;
}

function buildPortraitSrcList(character: string, expression: ExpressionType): string[] {
  const out: string[] = [];
  const add = (u: string) => {
    if (u && !out.includes(u)) out.push(u);
  };
  const b1 = urlForLocalPortrait(character, expression);
  if (b1) add(b1);
  if (expression !== 'neutral') {
    const b0 = urlForLocalPortrait(character, 'neutral');
    if (b0) add(b0);
  }
  add(publicPortraitPath(character, expression));
  add(publicPortraitPathHyphen(character, expression));
  if (expression !== 'neutral') {
    add(publicPortraitPath(character, 'neutral'));
    add(publicPortraitPathHyphen(character, 'neutral'));
  }
  return out;
}

function PortraitImage({
  character,
  expression,
}: {
  character: string;
  expression: ExpressionType;
  color: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed]   = useState(false);
  const ascii = ASCII_PORTRAITS[character] ?? ASCII_PORTRAITS.human;

  const candidates = useMemo(
    () => buildPortraitSrcList(character, expression),
    [character, expression],
  );

  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [character, expression]);

  const src = candidates[attempt];

  if (failed || !src) {
    return (
      <div className="portrait-ascii">
        {ascii.map((line, i) => <div key={i}>{line}</div>)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${character} ${expression}`}
      onError={() => {
        if (attempt + 1 < candidates.length) {
          setAttempt(attempt + 1);
        } else {
          setFailed(true);
        }
      }}
      style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated' }}
    />
  );
}

export function PlayerPanel({
  player,
  isHuman,
  isActive,
  isDealer,
  revealCards,
  aiProfile,
  expression = 'neutral',
  latestDialogue,
  lastActionType,
  actionTitleMarkSide,
  gamePhase,
}: PlayerPanelProps) {
  // Prefer profile personality; if missing, use player id so AIs (e.g. cipher) still resolve the right asset
  const portraitKey = isHuman ? 'human' : (aiProfile?.personality ?? player.id);

  const rootStyle: CSSProperties = {
    minWidth: isHuman ? 138 : 184,
    maxWidth: isHuman ? 172 : 234,
    width: '100%',
    flexShrink: 0,
    position: 'relative',
    overflow: 'visible',
  };

  const aiActionDisplay = !isHuman
    ? deriveAiActionDisplay(player, isActive, lastActionType)
    : null;
  const showActionMark =
    !isHuman &&
    !!actionTitleMarkSide &&
    gamePhase != null &&
    gamePhase !== 'waiting' &&
    aiActionDisplay != null;

  const rootRef = useRef<HTMLDivElement>(null);
  const portraitRef = useRef<HTMLDivElement>(null);
  const [actionMarkCenterY, setActionMarkCenterY] = useState(48);

  const syncActionMarkY = useCallback(() => {
    if (!rootRef.current || !portraitRef.current) return;
    const pr = portraitRef.current.getBoundingClientRect();
    if (pr.height < 1) return;
    const rr = rootRef.current.getBoundingClientRect();
    setActionMarkCenterY(pr.top - rr.top + pr.height / 2);
  }, []);

  useLayoutEffect(() => {
    if (isHuman) return;
    syncActionMarkY();
    const pr = portraitRef.current;
    const rootEl = rootRef.current;
    const ro = new ResizeObserver(syncActionMarkY);
    if (pr) ro.observe(pr);
    if (rootEl) ro.observe(rootEl);
    window.addEventListener('resize', syncActionMarkY);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncActionMarkY);
    };
  }, [
    isHuman,
    syncActionMarkY,
    player.id,
    player.chips,
    player.currentBet,
    player.folded,
    player.allIn,
    isActive,
    lastActionType,
    expression,
    latestDialogue,
    player.holeCards.length,
    gamePhase,
  ]);

  return (
    <div ref={rootRef} className="player-panel" style={rootStyle}>
      {!isHuman && actionTitleMarkSide && aiActionDisplay && (
        <AiSideMarkAndCards
          actionTitleMarkSide={actionTitleMarkSide}
          actionMarkCenterY={actionMarkCenterY}
          showMark={Boolean(showActionMark)}
          primary={aiActionDisplay.primary}
          amountLine={aiActionDisplay.amountLine}
          player={player}
          revealCards={revealCards}
        />
      )}

      {!isHuman && actionTitleMarkSide && (
        <AiNameTopTab
          name={player.name}
          isDealer={isDealer}
          folded={player.folded}
          alignToPanel={actionTitleMarkSide === 'right' ? 'right' : 'left'}
        />
      )}

      <div
        className={[
          'os-window',
          'player-panel__window',
          !isHuman ? 'os-window--ai' : '',
          !isHuman && showActionMark && actionTitleMarkSide === 'right' ? 'os-window--fuse-tab-right' : '',
          !isHuman && showActionMark && actionTitleMarkSide === 'left' ? 'os-window--fuse-tab-left' : '',
          isActive && !player.folded ? 'glow-active' : '',
          player.folded ? 'label-folded' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ width: '100%' }}
      >
        {/* Blue gradient title + window buttons: human only. AIs get a flat name row inside the body. */}
        {isHuman && (
          <div className="os-title-bar">
            <span className="os-title-text">{player.name}</span>
            {isDealer && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#FFFF00',
                  background: '#000080',
                  border: '1px solid #FFFF00',
                  padding: '0 3px',
                  lineHeight: '1.4',
                  flexShrink: 0,
                }}
              >
                D
              </span>
            )}
            <div className="os-title-dots">
              <span className="dot-green" />
              <span className="dot-yellow" />
              <span className="dot-red" />
            </div>
          </div>
        )}

        <div className="os-body" style={{ padding: 6 }}>
        {/* Portrait frame — sunken inset */}
        <div
          className={[
            'portrait-frame',
            !isHuman ? 'ai-portrait-frame--ai' : '',
            isActive && !player.folded ? 'portrait-frame--thinking' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          ref={!isHuman ? portraitRef : undefined}
        >
          {!isHuman ? (
            <PortraitImage
              character={portraitKey}
              expression={expression}
              color="#00FFFF"
            />
          ) : (
            <div className="portrait-ascii">
              {(ASCII_PORTRAITS.human).map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </div>

        {/* Hole cards — human only; AIs use vertical stack on the side mark column */}
        {isHuman && (
          <div
            style={{
              display: 'flex',
              gap: 3,
              marginBottom: 5,
              justifyContent: 'center',
            }}
          >
            {player.holeCards.length > 0 ? (
              player.holeCards.map((card, i) => (
                <Card
                  key={i}
                  card={card}
                  faceDown={!revealCards}
                  small
                />
              ))
            ) : (
              <>
                <Card faceDown small />
                <Card faceDown small />
              </>
            )}
          </div>
        )}

        {/* Stats */}
        <div
          className="player-panel__chip-stats"
          style={{
            borderStyle: 'solid',
            borderWidth: 'var(--bevel-outer)',
            borderColor: 'var(--win-dark) var(--win-light) var(--win-light) var(--win-dark)',
            boxShadow: 'inset var(--bevel-inset) var(--bevel-inset) 0 var(--win-darker)',
            background: '#816ba7',
            padding: '3px 5px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <div
            className="chip-count"
            style={{ fontFamily: 'var(--font-arcade)', fontSize: 11, color: '#78c7ba' }}
          >
            ${player.chips.toLocaleString()}
          </div>

          {isHuman && player.currentBet > 0 && (
            <div className="stat-note-line" style={{ fontFamily: 'var(--font-arcade)', fontSize: 11 }}>
              BET ${player.currentBet}
            </div>
          )}

          {isHuman && player.allIn && !player.folded && (
            <div className="stat-note-line" style={{ fontFamily: 'var(--font-pixel)', fontSize: 12 }}>
              ALL-IN
            </div>
          )}

          {isHuman && player.folded && (
            <div style={{ fontSize: 10, color: '#880000' }}>FOLDED</div>
          )}

          {isHuman && isActive && !player.folded && !player.allIn && (
            <div className="blink stat-note-line" style={{ fontFamily: 'var(--font-pixel)', fontSize: 13 }}>
              ▶ ACTING
            </div>
          )}
        </div>

        {/* Speech / dialogue (flavor only; last action is on the side tab for AIs) */}
        <div
          className="sunken character-dialogue"
          style={{
            marginTop: 4,
            minHeight: 0,
            maxHeight: 76,
            padding: '5px 16px',
            overflow: 'auto',
            color: latestDialogue ? '#b21d77' : '#58328f',
          }}
        >
          {latestDialogue ?? (isHuman ? '—' : '...')}
        </div>
      </div>
    </div>
    </div>
  );
}
