import React, { useEffect, useState } from 'react';
import { useGame } from '../contexts/GameContext.jsx';
import GameBoard from '../components/GameBoard.jsx';
import QuestionModal from '../components/QuestionModal.jsx';
import AuctionModal from '../components/AuctionModal.jsx';
import Logo from '../components/Logo.jsx';
import './HostPage.css';

export default function HostPage({ name, onMusicRound }) {
  const { connected, gameState, activeQuestion, buzzerEvent, emit, myId, auctionPhase, auctionData, auctionReadyIds } = useGame();
  const [buzzerStatus, setBuzzerStatus] = useState(null); // null | 'open' | { name, id }
  const [editingScore, setEditingScore] = useState({}); // playerId -> string
  const [reviewQuestion, setReviewQuestion] = useState(null); // { content, points, type, ... } | null
  const [autoOpenBuzzer, setAutoOpenBuzzer] = useState(true);
  const [superGameEnabled, setSuperGameEnabled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (connected) emit('join', { name, role: 'host' });
  }, [connected]);

  useEffect(() => {
    if (!buzzerEvent) return;
    if (buzzerEvent.type === 'open') setBuzzerStatus('open');
    if (buzzerEvent.type === 'close') setBuzzerStatus({ name: buzzerEvent.firstPlayer, id: buzzerEvent.firstPlayerId });
  }, [buzzerEvent]);

  function openQuestion(ci, qi) {
    setBuzzerStatus(null);
    emit('host:openQuestion', { categoryIndex: ci, questionIndex: qi });
    if (autoOpenBuzzer) emit('host:openBuzzer');
  }

  function reviewPlayedQuestion(ci, qi) {
    const q = gameState?.board?.[ci]?.questions?.[qi];
    if (q) setReviewQuestion(q);
  }

  function openBuzzer() {
    emit('host:openBuzzer');
  }

  function correct(playerId) {
    emit('host:correct', { playerId });
    setBuzzerStatus(null);
  }

  function incorrect(playerId) {
    emit('host:incorrect', { playerId });
    setBuzzerStatus(null);
  }

  function noAnswer() {
    emit('host:noAnswer');
    setBuzzerStatus(null);
  }

  function closeQuestion() {
    emit('host:closeQuestion');
    setBuzzerStatus(null);
  }

  function saveScore(playerId) {
    const val = parseInt(editingScore[playerId], 10);
    if (!isNaN(val)) emit('host:setScore', { playerId, score: val });
    setEditingScore((prev) => { const n = { ...prev }; delete n[playerId]; return n; });
  }

  const players = gameState?.players?.filter((p) => p.role === 'player') || [];
  const firstBuzzer = buzzerStatus && buzzerStatus !== 'open' ? buzzerStatus : null;

  return (
    <div className="page">
      <div className="starfield" />
      <div className="host">
        <header className="host__header">
          <Logo small />
          <button
            className="host__test-btn"
            onClick={() => { setBuzzerStatus(null); emit('host:openTest'); }}
            disabled={!!activeQuestion}
          >
            Тест
          </button>
          <button
            className="host__music-btn"
            onClick={onMusicRound}
          >
            🎵 Музыкальный раунд
          </button>

          <div className="host__settings-wrap">
            <button
              className="host__settings-btn"
              onClick={() => setSettingsOpen((v) => !v)}
              title="Настройки"
            >
              ⚙️
            </button>
            {settingsOpen && (
              <div className="host__settings-panel">
                <label className="host__settings-row">
                  <span>Открывать кнопки сразу</span>
                  <input
                    type="checkbox"
                    checked={autoOpenBuzzer}
                    onChange={(e) => setAutoOpenBuzzer(e.target.checked)}
                  />
                </label>
                <label className="host__settings-row">
                  <span>Супер-Игра активна</span>
                  <input
                    type="checkbox"
                    checked={superGameEnabled}
                    onChange={(e) => setSuperGameEnabled(e.target.checked)}
                  />
                </label>
              </div>
            )}
          </div>

          <button
            className="host__reset-btn"
            onClick={() => {
              if (window.confirm('Сбросить игру? Все счета и прогресс будут обнулены.')) {
                emit('host:resetGame');
                setBuzzerStatus(null);
              }
            }}
          >
            ↺ Сброс
          </button>

          <span className={`host__conn ${connected ? 'host__conn--ok' : ''}`}>
            {connected ? 'подключён' : 'нет связи'}
          </span>
        </header>

        <div className="host__main">
          <GameBoard
            board={gameState?.board}
            onSelectQuestion={openQuestion}
            onReviewQuestion={reviewPlayedQuestion}
            isHost
          />

          <aside className="host__sidebar">
            <h3 className="host__sidebar-title">Игроки</h3>
            {players.length === 0 && (
              <p className="host__no-players">Ждём игроков...</p>
            )}
            {players.map((p) => (
              <div
                key={p.id}
                className={`host__player ${firstBuzzer?.id === p.id ? 'host__player--buzzed' : ''}`}
              >
                <div className="host__player-name-row">
                  <span className={`host__online-dot ${p.online !== false ? 'host__online-dot--on' : 'host__online-dot--off'}`} title={p.online !== false ? 'онлайн' : 'офлайн'} />
                  <span className="host__player-name">{p.name}</span>
                  <button
                    className="host__kick-btn"
                    title="Удалить игрока"
                    onClick={() => emit('host:kickPlayer', { playerId: p.id })}
                  >✕</button>
                </div>
                <div className="host__player-score-row">
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
                      className="host__player-score"
                      title="Нажми для редактирования"
                      onClick={() => setEditingScore((prev) => ({ ...prev, [p.id]: String(p.score) }))}
                    >
                      {p.score}
                    </span>
                  )}
                </div>
                {firstBuzzer?.id === p.id && activeQuestion && (
                  <div className="host__answer-btns">
                    <button className="host__btn host__btn--correct" onClick={() => correct(p.id)}>✓ Верно</button>
                    <button className="host__btn host__btn--wrong" onClick={() => incorrect(p.id)}>✗ Неверно</button>
                  </div>
                )}
              </div>
            ))}

            {activeQuestion && (
              <div className="host__controls">
                {buzzerStatus === null && (
                  <button className="host__btn host__btn--buzzer" onClick={openBuzzer}>
                    Открыть кнопку
                  </button>
                )}
                {buzzerStatus === 'open' && (
                  <div className="host__buzzer-waiting">Ждём нажатия...</div>
                )}
                {firstBuzzer && (
                  <div className="host__buzzed-name">⚡ {firstBuzzer.name}</div>
                )}
                <button className="host__btn host__btn--skip" onClick={noAnswer}>
                  Никто не взял
                </button>
                <button className="host__btn host__btn--close" onClick={closeQuestion}>
                  Закрыть вопрос
                </button>
              </div>
            )}
          </aside>
        </div>

        <div className="host__supergame-wrap">
          <button
            className="host__supergame-btn"
            disabled={!superGameEnabled || !!activeQuestion}
            onClick={() => emit('host:openSuperGame')}
          >
            ★ СУПЕР-ИГРА ★
          </button>
        </div>
      </div>

      {activeQuestion && activeQuestion.type !== 'auction' && activeQuestion.type !== 'open_answer' && (
        <QuestionModal
          question={activeQuestion}
          onClose={closeQuestion}
          isHost
          hostControls={{
            buzzerStatus,
            autoOpenBuzzer,
            onOpenBuzzer: openBuzzer,
            onCorrect: correct,
            onIncorrect: incorrect,
            onNoAnswer: noAnswer,
          }}
        />
      )}

      {(activeQuestion?.type === 'auction' || activeQuestion?.type === 'open_answer') && (
        <AuctionModal
          phase={auctionPhase}
          data={auctionData}
          readyIds={auctionReadyIds}
          onRevealBets={() => emit('host:revealBets')}
          onStartQuestion={() => emit('host:startAuctionQuestion')}
          onRevealAnswers={() => emit('host:revealAuctionAnswers')}
          onMark={(winnerId, correct) => emit('host:awardAuction', { winnerId, correct })}
          onClose={closeQuestion}
        />
      )}

      {reviewQuestion && (
        <QuestionModal
          question={reviewQuestion}
          onClose={() => setReviewQuestion(null)}
          isHost
        />
      )}
    </div>
  );
}
