import './styles/retro.css';
import { useState, useEffect } from 'react';
import { useGameState } from './hooks/useGameState';
import { useReadymag } from './hooks/useReadymag';
import { GameTable } from './components/GameTable';
import { HUMAN_ID } from './hooks/useGameState';

const DESIGN_W = 1280;
const DESIGN_H = 960;

function useViewportScale() {
  const [scale, setScale] = useState(() =>
    Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H)
  );
  useEffect(() => {
    const update = () =>
      setScale(Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H));
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return scale;
}

function App() {
  const {
    gameState,
    chatMessages,
    isAIThinking,
    isHumanTurn,
    toCall,
    canCheck,
    canCall,
    canRaise,
    canFold,
    humanAction,
    latestExpressions,
    restartGame,
    lastActiveId,
  } = useGameState();

  useReadymag(gameState, HUMAN_ID);

  const scale = useViewportScale();

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Fixed design canvas scaled to fit the viewport; all px values stay at 1x */}
      <div
        className="game-screen"
        style={{
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <GameTable
          gameState={gameState}
          isHumanTurn={isHumanTurn}
          isAIThinking={isAIThinking}
          canCheck={canCheck}
          canCall={canCall}
          canRaise={canRaise}
          canFold={canFold}
          toCall={toCall}
          chatMessages={chatMessages}
          latestExpressions={latestExpressions}
          onAction={humanAction}
          onNewGame={restartGame}
          lastActiveId={lastActiveId}
        />
      </div>
    </div>
  );
}

export default App;
