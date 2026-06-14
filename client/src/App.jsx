import React, { useState } from 'react';
import { GameProvider } from './contexts/GameContext.jsx';
import LobbyPage from './pages/LobbyPage.jsx';
import HostPage from './pages/HostPage.jsx';
import MusicRoundPage from './pages/MusicRoundPage.jsx';
import PlayerPage from './pages/PlayerPage.jsx';

export default function App() {
  const [role, setRole] = useState(null);
  const [name, setName] = useState('');
  const [round, setRound] = useState('main'); // 'main' | 'music'

  if (!role) return <LobbyPage onJoin={(r, n) => { setRole(r); setName(n); }} />;

  return (
    <GameProvider>
      {role === 'host' ? (
        round === 'main'
          ? <HostPage name={name} onMusicRound={() => setRound('music')} />
          : <MusicRoundPage name={name} onMainRound={() => setRound('main')} />
      ) : (
        <PlayerPage name={name} />
      )}
    </GameProvider>
  );
}
