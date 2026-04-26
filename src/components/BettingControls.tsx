import { useState, useEffect } from 'react';
import type { PlayerAction } from '../engine/game';

interface BettingControlsProps {
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
  canFold: boolean;
  disabled: boolean;
  onAction: (action: PlayerAction) => void;
}

export function BettingControls({
  canCheck,
  canCall,
  callAmount,
  canRaise,
  minRaiseTo,
  maxRaiseTo,
  canFold,
  disabled,
  onAction,
}: BettingControlsProps) {
  const [raiseAmount, setRaiseAmount] = useState(minRaiseTo);

  useEffect(() => {
    setRaiseAmount(minRaiseTo);
  }, [minRaiseTo]);

  const clampedRaise = Math.min(Math.max(raiseAmount, minRaiseTo), maxRaiseTo);

  const isIdle = !canCheck && !canCall && !canFold && !disabled;

  return (
    <div className="os-window">
      <div className="os-title-bar">
        <div className="os-title-dots">
          <span className="dot-red" />
          <span className="dot-yellow" />
          <span className="dot-green" />
        </div>
        <span className="os-title-text">ACTION.EXE</span>
      </div>

      <div className="os-body" style={{ padding: 8 }}>
        {isIdle ? (
          <div
            style={{
              fontSize: 8,
              color: 'var(--text-dim)',
              textAlign: 'center',
              padding: '10px 0',
            }}
          >
            WAITING FOR YOUR TURN...
          </div>
        ) : (
          <>
            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <button
                className="btn btn-fold"
                disabled={disabled || !canFold}
                onClick={() => onAction({ type: 'fold' })}
              >
                FOLD
              </button>

              {canCheck && (
                <button
                  className="btn btn-check"
                  disabled={disabled}
                  onClick={() => onAction({ type: 'check' })}
                >
                  CHECK
                </button>
              )}

              {canCall && (
                <button
                  className="btn btn-call"
                  disabled={disabled}
                  onClick={() => onAction({ type: 'call' })}
                >
                  CALL ¥{callAmount}
                </button>
              )}

              {canRaise && (
                <button
                  className="btn btn-raise"
                  disabled={disabled}
                  onClick={() => onAction({ type: 'raise', amount: clampedRaise })}
                >
                  RAISE ¥{clampedRaise}
                </button>
              )}

              <button
                className="btn btn-allin"
                disabled={disabled || !canFold}
                onClick={() => onAction({ type: 'all-in' })}
              >
                ALL-IN
              </button>
            </div>

            {/* Raise slider */}
            {canRaise && minRaiseTo < maxRaiseTo && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0 2px',
                }}
              >
                <span style={{ fontSize: 7, color: 'var(--text-dim)', flexShrink: 0 }}>
                  MIN ¥{minRaiseTo}
                </span>
                <input
                  type="range"
                  min={minRaiseTo}
                  max={maxRaiseTo}
                  step={10}
                  value={clampedRaise}
                  onChange={(e) => setRaiseAmount(Number(e.target.value))}
                  disabled={disabled}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 7, color: 'var(--text-dim)', flexShrink: 0 }}>
                  MAX ¥{maxRaiseTo}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
