import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../contexts/GameContext.jsx';
import MusicBoard from '../components/MusicBoard.jsx';
import Logo from '../components/Logo.jsx';
import './MusicRoundPage.css';

export default function MusicRoundPage({ name, onMainRound }) {
  const {
    connected, gameState, emit,
    musicGameState, musicTimerPoints, activeMusicNote, musicFreezeEvent,
    buzzerEvent, myId,
  } = useGame();

  const [editingScore, setEditingScore] = useState({});
  const [lastAudioSrc, setLastAudioSrc] = useState(null);
  const [extendedPlaying, setExtendedPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (connected) emit('join', { name, role: 'host' });
  }, [connected]);

  // Play/stop audio when note opens or closes
  useEffect(() => {
    if (!audioRef.current) return;
    if (activeMusicNote?.audioSrc) {
      setLastAudioSrc(activeMusicNote.audioSrc);
      setExtendedPlaying(false);
      audioRef.current.pause();
      audioRef.current.src = `/media/${activeMusicNote.audioSrc}`;
      audioRef.current.play().catch(() => {});
    } else {
      // Note closed — pause but keep src so "дослушать" can resume
      audioRef.current.pause();
      setExtendedPlaying(false);
    }
  }, [activeMusicNote]);

  // Pause when player buzzes, resume when timer restarts after wrong answer
  useEffect(() => {
    if (!audioRef.current || !activeMusicNote) return;
    if (musicFreezeEvent) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  }, [musicFreezeEvent]);

  function extendPlay() {
    if (!audioRef.current) return;
    audioRef.current.play().catch(() => {});
    setExtendedPlaying(true);
  }

  function stopExtended() {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setExtendedPlaying(false);
    setLastAudioSrc(null);
  }

  function openNote(ci, ni) {
    emit('host:openMusicNote', { ci, ni });
  }

  function correct(playerId) {
    emit('host:musicCorrect', { playerId });
  }

  function incorrect(playerId) {
    emit('host:musicIncorrect', { playerId });
  }

  function noAnswer() {
    emit('host:musicNoAnswer');
  }

  function saveScore(playerId) {
    const val = parseInt(editingScore[playerId], 10);
    if (!isNaN(val)) emit('host:setScore', { playerId, score: val });
    setEditingScore((prev) => { const n = { ...prev }; delete n[playerId]; return n; });
  }

  const players = gameState?.players?.filter((p) => p.role === 'player') || [];
  const notes = musicGameState?.notes || [];
  const freezer = musicFreezeEvent; // { frozenPoints, firstPlayer, firstPlayerId }
  const timerActive = activeMusicNote && !freezer;

  // Color for countdown: green → yellow → red
  function timerColor(pts) {
    if (pts > 60) return '#40e060';
    if (pts > 30) return '#f0c040';
    return '#ff4040';
  }

  return (
    <div className="page music-page">
      <div className="starfield" />
      <audio ref={audioRef} />

      <div className="music-host">
        <header className="music-host__header">
          <button className="music-host__back" onClick={onMainRound}>← Основная игра</button>
          <Logo small />
          <span className={`host__conn ${connected ? 'host__conn--ok' : ''}`}>
            {connected ? 'подключён' : 'нет связи'}
          </span>
        </header>

        <div className="music-host__main">
          <MusicBoard
            notes={notes}
            activeNote={activeMusicNote}
            timerPoints={musicTimerPoints}
            onSelectNote={openNote}
          />

          <aside className="music-host__sidebar">
            <h3 className="music-host__sidebar-title">Игроки</h3>
            {players.length === 0 && (
              <p className="music-host__no-players">Ждём игроков...</p>
            )}
            {players.map((p) => (
              <div
                key={p.id}
                className={`music-host__player ${freezer?.firstPlayerId === p.id ? 'music-host__player--buzzed' : ''}`}
              >
                <span className="music-host__player-name">{p.name}</span>
                <div className="music-host__score-row">
                  {editingScore[p.id] !== undefined ? (
                    <>
                      <input
                        className="host__score-input"
                        type="number"
                        value={editingScore[p.id]}
                        onChange={(e) => setEditingScore((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && saveScore(p.id)}
                        autoFocus
                      />
                      <button className="host__score-save" onClick={() => saveScore(p.id)}>✓</button>
                    </>
                  ) : (
                    <span
                      className="music-host__score"
                      onClick={() => setEditingScore((prev) => ({ ...prev, [p.id]: String(p.score) }))}
                    >
                      {p.score}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Дослушать трек после закрытия */}
            {!activeMusicNote && lastAudioSrc && (
              <div className="music-host__extended">
                {extendedPlaying ? (
                  <button className="host__btn host__btn--skip" onClick={stopExtended}>
                    ⏹ Стоп
                  </button>
                ) : (
                  <button className="host__btn host__btn--buzzer" onClick={extendPlay}>
                    ▶ Дослушать трек
                  </button>
                )}
              </div>
            )}

            {/* Active note controls */}
            {activeMusicNote && (
              <div className="music-host__controls">
                <div
                  className="music-host__timer"
                  style={{ color: timerColor(musicTimerPoints) }}
                >
                  {musicTimerPoints}
                </div>
                <div className="music-host__timer-label">
                  {timerActive ? 'идёт отсчёт...' : freezer ? `⚡ ${freezer.firstPlayer}` : ''}
                </div>

                {freezer && (
                  <div className="music-host__verdict-btns">
                    <button
                      className="host__btn host__btn--correct"
                      onClick={() => correct(freezer.firstPlayerId)}
                    >
                      ✓ Верно
                    </button>
                    <button
                      className="host__btn host__btn--wrong"
                      onClick={() => incorrect(freezer.firstPlayerId)}
                    >
                      ✗ Неверно
                    </button>
                  </div>
                )}

                <button className="host__btn host__btn--skip" onClick={noAnswer}>
                  Никто не ответил
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
