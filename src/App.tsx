import './styles/retro.css';
import { useGameState } from './hooks/useGameState';
import { useReadymag } from './hooks/useReadymag';
import { GameTable } from './components/GameTable';
import { HUMAN_ID } from './hooks/useGameState';

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
  } = useGameState();

  useReadymag(gameState, HUMAN_ID);

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
      {/* 4:3 “safe” area: always fits; letterboxes on wider/taller viewports */}
      <div
        className="game-screen"
        style={{
          width: 'min(100vw, calc(100vh * 4 / 3))',
          height: 'min(100vh, calc(100vw * 3 / 4))',
          maxWidth: '100%',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
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
      />
      </div>
    </div>
  );
}

export default App;
