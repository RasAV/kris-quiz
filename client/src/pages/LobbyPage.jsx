import React, { useState } from 'react';
import Logo from '../components/Logo.jsx';
import './LobbyPage.css';

export default function LobbyPage({ onJoin }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('player');

  function handleJoin(e) {
    e.preventDefault();
    if (role === 'host' || name.trim()) {
      onJoin(role, name.trim() || 'Ведущий');
    }
  }

  return (
    <div className="page">
      <div className="starfield" />
      <div className="lobby">
        <Logo />
        <form className="lobby__form" onSubmit={handleJoin}>
          <div className="lobby__roles">
            <button
              type="button"
              className={`lobby__role-btn ${role === 'player' ? 'active' : ''}`}
              onClick={() => setRole('player')}
            >
              Игрок
            </button>
            <button
              type="button"
              className={`lobby__role-btn ${role === 'host' ? 'active' : ''}`}
              onClick={() => setRole('host')}
            >
              Ведущий
            </button>
          </div>

          {role === 'player' && (
            <input
              className="lobby__input"
              type="text"
              placeholder="Твоё имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={20}
            />
          )}

          <button
            className="lobby__join-btn"
            type="submit"
            disabled={role === 'player' && !name.trim()}
          >
            {role === 'host' ? 'Войти как ведущий' : 'Войти в игру'}
          </button>
        </form>
      </div>
    </div>
  );
}
