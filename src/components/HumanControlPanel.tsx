import { useState, useEffect } from 'react';
import type { PlayerState } from '../engine/game';
import type { PlayerAction } from '../engine/game';
import { Card } from './Card';

interface HumanControlPanelProps {
  player: PlayerState;
  isActive: boolean;
  isDealer: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
  canFold: boolean;
  disabled: boolean;
  onAction: (action: PlayerAction) => void;
  onNewGame: () => void;
  /** Draw attention when play only continues after clicking NEW GAME */
  promptNewGame?: boolean;
}

export function HumanControlPanel({
  player,
  isActive,
  isDealer,
  canCheck,
  canCall,
  callAmount,
  canRaise,
  minRaiseTo,
  maxRaiseTo,
  canFold,
  disabled,
  onAction,
  onNewGame,
  promptNewGame = false,
}: HumanControlPanelProps) {
  const isBust = player.chips === 0;
  const isIdle = !canCheck && !canCall && !canFold && !disabled;
  const actionsBlocked = disabled || isBust || isIdle;

  const safeMinRaise = Math.max(0, minRaiseTo);
  const safeMaxRaise = Math.max(safeMinRaise, maxRaiseTo);
  const raiseStep = 20;
  const sliderLow = Math.ceil(safeMinRaise / raiseStep) * raiseStep;
  const sliderHigh = Math.floor(safeMaxRaise / raiseStep) * raiseStep;
  const hasSteppedRaiseRange = safeMaxRaise > safeMinRaise && sliderLow <= sliderHigh;
  const raiseSliderActive = !actionsBlocked && canRaise && hasSteppedRaiseRange;

  const foldOk = !actionsBlocked && canFold;
  const checkOk = !actionsBlocked && canCheck;
  const callOk = !actionsBlocked && canCall;
  const allinOk = !actionsBlocked && canFold;

  const [raiseAmount, setRaiseAmount] = useState(sliderLow);
  const clampedRaise = Math.min(Math.max(raiseAmount, sliderLow), sliderHigh);

  useEffect(() => {
    setRaiseAmount(sliderLow);
  }, [sliderLow]);

  return (
    <div
      className={[
        'human-control-panel-oval-outer',
        isActive && !player.folded ? 'human-control-panel-oval-outer--active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={[
          'human-control-panel-oval',
          isActive && !player.folded ? 'human-control-panel-oval--active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="human-control-oval-lobe-row" aria-label="New game">
          <button
            type="button"
            className={[
              'btn',
              'btn-call',
              'human-control-panel-lobe-btn',
              'human-control-panel-new-game',
              'btn-new-game-oval',
              promptNewGame && 'btn-new-game-oval--prompt',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={onNewGame}
            title={promptNewGame ? 'Click to deal cards and start' : 'Start a new hand'}
          >
            NEW GAME
          </button>
        </div>

        <div className="human-control-panel-main">
        <div className="human-control-left-cluster">
        <div className="human-control-cards-peek human-control-cards-peek--tilt">
          {player.holeCards.length > 0 ? (
            player.holeCards.map((card, i) => (
              <Card key={i} card={card} faceDown={false} />
            ))
          ) : (
            <>
              <Card faceDown />
              <Card faceDown />
            </>
          )}
        </div>

        <div
          className="human-control-stats-box"
          style={{
            width: '100%',
            maxWidth: 240,
            borderStyle: 'solid',
            borderWidth: 'var(--bevel-outer)',
            borderColor: 'var(--win-dark) var(--win-light) var(--win-light) var(--win-dark)',
            boxShadow: 'inset var(--bevel-inset) var(--bevel-inset) 0 var(--win-darker)',
            background: 'rgba(226, 179, 203, 1)',
            padding: '6px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            alignItems: 'flex-start',
            boxSizing: 'border-box',
            marginBottom: 8,
          }}
        >
          <div
            className="human-control-stats-topline"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            {isDealer && (
              <span
                style={{
                  fontFamily: 'var(--font-pixel)',
                  fontSize: 8,
                  color: '#FFFF00',
                  background: '#000080',
                  border: '1px solid #FFFF00',
                  padding: '1px 4px',
                }}
              >
                D
              </span>
            )}
            <span
              style={{
                fontFamily: 'var(--font-arcade)',
                fontSize: 12,
                color: 'rgba(117, 34, 160, 1)',
              }}
            >
              ${player.chips.toLocaleString()}
            </span>
          </div>
          {player.currentBet > 0 && (
            <div style={{ fontFamily: 'var(--font-arcade)', fontSize: 8, color: 'rgba(102, 102, 102, 1)' }}>
              BET ${player.currentBet}
            </div>
          )}
          {player.allIn && !player.folded && (
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 8, color: '#FF8800' }}>ALL-IN</div>
          )}
          {player.folded && (
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 7, color: '#880000' }}>FOLDED</div>
          )}
          {isActive && !player.folded && !player.allIn && (
            <div
              className="blink"
              style={{ fontFamily: 'var(--font-pixel)', fontSize: 10, color: 'rgba(211, 102, 163, 1)' }}
            >
              ▶ YOUR TURN
            </div>
          )}
        </div>

        <div
          className={['human-control-slider-arc', 'human-control-slider-arc--embedded', !raiseSliderActive && 'human-control-slider-arc--inactive'].filter(Boolean).join(' ')}
        >
          <span
            className="human-control-slider-arc__label"
            style={{
              fontFamily: 'var(--font-arcade)',
              fontSize: 7,
              color: 'inherit',
              flexShrink: 0,
            }}
          >
            {hasSteppedRaiseRange ? `$${sliderLow}` : '—'}
          </span>
          <input
            type="range"
            min={hasSteppedRaiseRange ? sliderLow : 0}
            max={hasSteppedRaiseRange ? sliderHigh : 1}
            step={hasSteppedRaiseRange ? raiseStep : 1}
            value={hasSteppedRaiseRange ? clampedRaise : 0}
            onChange={(e) => hasSteppedRaiseRange && setRaiseAmount(Number(e.target.value))}
            disabled={!raiseSliderActive}
          />
          <span
            className="human-control-slider-arc__label"
            style={{
              fontFamily: 'var(--font-arcade)',
              fontSize: 7,
              color: 'inherit',
              flexShrink: 0,
            }}
          >
            {hasSteppedRaiseRange ? `$${sliderHigh}` : '—'}
          </span>
        </div>

        {isBust ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 6,
              padding: '4px 0 8px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 8,
                color: 'rgba(41, 0, 0, 1)',
                textAlign: 'left',
              }}
            >
              BUSTED — NO CHIPS LEFT
            </div>
          </div>
        ) : isIdle ? (
          <div
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 8,
              color: 'var(--text-dim)',
              textAlign: 'left',
              padding: '4px 0 8px',
            }}
          >
            WAITING FOR YOUR TURN...
          </div>
        ) : null}
        </div>

        <div className="human-control-actions-arc" aria-label="Check, fold, call, raise, and all-in">
          <button
            type="button"
            className={['btn', 'btn-fold', !foldOk && 'human-control-action--unavailable'].filter(Boolean).join(' ')}
            disabled={!foldOk}
            onClick={() => foldOk && onAction({ type: 'fold' })}
          >
            FOLD
          </button>
          <button
            type="button"
            className={['btn', 'btn-check', !checkOk && 'human-control-action--unavailable'].filter(Boolean).join(' ')}
            disabled={!checkOk}
            onClick={() => checkOk && onAction({ type: 'check' })}
            title={checkOk ? 'Check (no bet to call)' : 'Not available: you cannot check now'}
          >
            CHECK
          </button>
          <button
            type="button"
            className={['btn', 'btn-call', !callOk && 'human-control-action--unavailable'].filter(Boolean).join(' ')}
            disabled={!callOk}
            onClick={() => callOk && onAction({ type: 'call' })}
          >
            {callOk ? `CALL $${callAmount}` : 'CALL'}
          </button>
          <button
            type="button"
            className={['btn', 'btn-raise', !raiseSliderActive && 'human-control-action--unavailable'].filter(Boolean).join(' ')}
            disabled={!raiseSliderActive}
            onClick={() => raiseSliderActive && onAction({ type: 'raise', amount: clampedRaise })}
          >
            {raiseSliderActive ? `RAISE $${clampedRaise}` : 'RAISE'}
          </button>
          <button
            type="button"
            className={['btn', 'btn-allin', !allinOk && 'human-control-action--unavailable'].filter(Boolean).join(' ')}
            disabled={!allinOk}
            onClick={() => allinOk && onAction({ type: 'all-in' })}
          >
            ALL-IN
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
