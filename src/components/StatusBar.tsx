import type { GamePhase } from '../engine/game';

interface StatusBarProps {
  phase: GamePhase;
  handNumber: number;
  smallBlind: number;
  bigBlind: number;
  activePlayerName: string;
  isAIThinking: boolean;
}

const PHASE_LABELS: Record<GamePhase, string> = {
  waiting:      'INIT',
  preflop:      'PRE-FLOP',
  flop:         'FLOP',
  turn:         'TURN',
  river:        'RIVER',
  showdown:     'SHOWDOWN',
  handComplete: 'COMPLETE',
};

export function StatusBar({
  phase,
  handNumber,
  smallBlind,
  bigBlind,
  activePlayerName,
  isAIThinking,
}: StatusBarProps) {
  const actingText = isAIThinking
    ? `${activePlayerName} THINKING...`
    : activePlayerName
    ? `ACTING: ${activePlayerName}`
    : '\u00a0';

  return (
    /* Win95-style taskbar / status bar */
    <div className="status-bar">
      {/* Recessed status cells */}
      {[
        { text: `HAND #${handNumber}` },
        { text: PHASE_LABELS[phase] },
        { text: `BL ${smallBlind}/${bigBlind}` },
      ].map((cell) => (
        <div
          key={cell.text}
          className="status-bar__cell"
          style={{
            borderStyle: 'solid',
            borderWidth: 'var(--bevel-outer-thin)',
            borderColor: 'var(--win-dark) var(--win-light) var(--win-light) var(--win-dark)',
            padding: '2px 8px',
            background: 'var(--win-bg)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 12,
              color: 'var(--suit-black)',
            }}
          >
            {cell.text}
          </span>
        </div>
      ))}

      {/* Acting indicator — stretches to fill */}
      <div
        className="status-bar__acting"
        style={{
          flex: 1,
          borderStyle: 'solid',
          borderWidth: 'var(--bevel-outer-thin)',
          borderColor: 'var(--win-dark) var(--win-light) var(--win-light) var(--win-dark)',
          padding: '2px 8px',
          background: 'var(--win-bg)',
          textAlign: 'center',
        }}
      >
        <span
          className={isAIThinking ? 'blink' : ''}
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 12,
            color: isAIThinking ? '#000080' : 'rgba(77, 0, 15, 1)',
          }}
        >
          {actingText}
        </span>
      </div>

      {/* Version cell */}
      <div
        className="status-bar__version"
        style={{
          borderStyle: 'solid',
          borderWidth: 'var(--bevel-outer-thin)',
          borderColor: 'var(--win-dark) var(--win-light) var(--win-light) var(--win-dark)',
          padding: '2px 8px',
          background: 'var(--win-bg)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 8,
            color: 'var(--text-dim)',
          }}
        >
          TEXAS v1.0
        </span>
      </div>
    </div>
  );
}
