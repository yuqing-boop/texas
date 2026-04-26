import type { CSSProperties } from 'react';
import type { GamePhase } from '../engine/game';

interface InfoPanelProps {
  humanChips: number;
  pot: number;
  phase: GamePhase;
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
  activePlayerName: string;
  isAIThinking: boolean;
}

const PHASE_LABELS: Record<GamePhase, string> = {
  waiting:      'WAITING',
  preflop:      'PRE-FLOP',
  flop:         'FLOP',
  turn:         'TURN',
  river:        'RIVER',
  showdown:     'SHOWDOWN',
  handComplete: 'HAND OVER',
};

export function InfoPanel({
  humanChips,
  pot,
  phase,
  smallBlind,
  bigBlind,
  handNumber,
  activePlayerName,
  isAIThinking,
}: InfoPanelProps) {
  const procedureItems = [
    { label: 'DEAL CARDS',    done: phase !== 'waiting' },
    { label: 'PRE-FLOP BET',  done: !['waiting', 'preflop'].includes(phase) },
    { label: 'FLOP',          done: !['waiting', 'preflop', 'flop'].includes(phase) },
    { label: 'TURN',          done: ['river', 'showdown', 'handComplete'].includes(phase) },
    { label: 'RIVER',         done: ['showdown', 'handComplete'].includes(phase) },
    { label: 'SHOWDOWN',      done: ['handComplete'].includes(phase) },
  ];

  const statRowStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '2px 4px',
    borderBottom: '1px solid #002244',
  };

  return (
    <div
      style={{
        maxWidth: 720,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 4,
        boxSizing: 'border-box',
      }}
    >
      {/* Current pot — folder tab; sits directly above stats os-window */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          className="community-pot-tab"
          style={{
            background: 'var(--win-bg)',
            borderStyle: 'solid',
            borderWidth: 'var(--bevel-outer-thin)',
            borderColor: 'var(--win-white) var(--win-darker) transparent var(--win-white)',
            borderBottom: 0,
            padding: '4px 16px 5px',
            fontFamily: 'var(--font-pixel)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: 'var(--text-panel)',
            zIndex: 1,
          }}
        >
          Current pot
        </div>
        <div
          className="os-window community-pot-body"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            marginTop: -1,
            padding: '6px 12px 8px',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-arcade)',
              fontSize: 18,
              color: 'rgba(124, 23, 164, 1)',
            }}
          >
            ${pot.toLocaleString()}
          </span>
        </div>
      </div>

      <div
        className="os-window"
        style={{
          width: '100%',
          minWidth: 0,
          maxWidth: 720,
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          alignItems: 'stretch',
          justifyContent: 'center',
          gap: 4,
          padding: 4,
          boxSizing: 'border-box' as const,
        }}
      >
        {/* Stats — left column */}
        <div
          className="info-panel__stats"
          style={{
            borderStyle: 'solid',
            borderWidth: 'var(--bevel-outer)',
            borderColor: 'var(--win-dark) var(--win-light) var(--win-light) var(--win-dark)',
            boxShadow: 'inset var(--bevel-inset) var(--bevel-inset) 0 var(--win-darker)',
            background: 'rgba(236, 147, 190, 1)',
            color: 'rgba(37, 41, 95, 1)',
            flex: '1 1 0',
            minWidth: 0,
            alignSelf: 'stretch',
          }}
        >
          {[
            { label: 'YOUR CHIPS', value: `$${humanChips.toLocaleString()}` },
            { label: 'BLINDS',     value: `${smallBlind}/${bigBlind}` },
            { label: 'HAND #',     value: String(handNumber) },
          ].map((row) => (
            <div key={row.label} style={statRowStyle}>
              <span style={{ fontFamily: 'var(--font-arcade)', fontSize: 13, color: '#666666' }}>
                {row.label}
              </span>
              <span style={{ fontFamily: 'var(--font-arcade)', fontSize: 12, color: '#7522A0' }}>
                {row.value}
              </span>
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '3px 5px',
            }}
          >
            <span style={{ fontFamily: 'var(--font-arcade)', fontSize: 13, color: '#666666' }}>
              {isAIThinking ? 'THINKING' : 'ACTING'}
            </span>
            <span
              className={isAIThinking ? 'blink' : ''}
              style={{ fontFamily: 'var(--font-arcade)', fontSize: 12, color: '#7522A0' }}
            >
              {activePlayerName || '—'}
            </span>
          </div>
        </div>

        {/* PROCEDURE — right column */}
        <div
          className="info-panel__procedure"
          style={{
            background: 'rgba(153, 89, 166, 1)',
            border: 'var(--bevel-outer) solid',
            borderColor: 'var(--win-white) var(--win-darker) var(--win-darker) var(--win-white)',
            boxShadow:
              'inset var(--bevel-inset) var(--bevel-inset) 0 var(--win-light), inset var(--bevel-inset-neg) var(--bevel-inset-neg) 0 var(--win-dark)',
            padding: '3px 5px',
            flex: '1 1 0',
            minWidth: 0,
            alignSelf: 'stretch',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 10,
              color: 'rgba(39, 36, 182, 1)',
              textAlign: 'center' as const,
              borderBottom: '1px solid #004488',
              paddingBottom: 0,
              marginBottom: 4,
              letterSpacing: 2,
            }}
          >
            PROCEDURE
          </div>
          {procedureItems.map((item) => (
            <div
              key={item.label}
              style={{
                fontFamily: 'var(--font-arcade)',
                fontSize: 10,
                color: item.done ? '#00FF00' : '#AAAAAA',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1px 0',
              }}
            >
              <span>{item.label}</span>
              <span>{item.done ? '✓' : ' '}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Phase — full width under the two boxes */}
      <div
        className="info-panel__phase"
        style={{
          width: '100%',
          maxWidth: 720,
          background: 'var(--win-bg)',
          borderStyle: 'solid',
          borderWidth: 'var(--bevel-outer)',
          borderColor: 'var(--win-dark) var(--win-light) var(--win-light) var(--win-dark)',
          boxShadow: 'inset var(--bevel-inset) var(--bevel-inset) 0 var(--win-darker)',
          padding: '3px 5px',
          textAlign: 'center' as const,
          boxSizing: 'border-box' as const,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-arcade)',
            fontSize: 14,
            fontWeight: 500,
            color: '#000080',
            letterSpacing: 1,
          }}
        >
          {PHASE_LABELS[phase]}
        </span>
      </div>
    </div>
  );
}
