import React, { useEffect, useState } from 'react';
import { useGame } from '../contexts/GameContext.jsx';
import Logo from '../components/Logo.jsx';
import './PlayerPage.css';

export default function PlayerPage({ name }) {
  const { connected, gameState, buzzerEvent, emit, myId, auctionPhase } = useGame();
  const [buzzerState, setBuzzerState] = useState('idle'); // 'idle' | 'ready' | 'buzzed' | 'blocked' | 'winner'
  const [pressed, setPressed] = useState(false);

  // Auction local state
  const [betAmount, setBetAmount] = useState('');
  const [betSubmitted, setBetSubmitted] = useState(false);
  const [auctionAnswer, setAuctionAnswer] = useState('');
  const [answerSubmitted, setAnswerSubmitted] = useState(false);

  useEffect(() => {
    if (connected) emit('join', { name, role: 'player' });
  }, [connected]);

  useEffect(() => {
    if (!buzzerEvent) return;
    if (buzzerEvent.type === 'open') {
      setBuzzerState('ready');
      setPressed(false);
    }
    if (buzzerEvent.type === 'close') {
      if (buzzerEvent.firstPlayerId === myId) {
        setBuzzerState('winner');
      } else {
        setBuzzerState('missed');
      }
    }
  }, [buzzerEvent, myId]);

  // Reset when question closes
  useEffect(() => {
    setBuzzerState('idle');
    setPressed(false);
  }, [gameState?.activeQuestion === null]);

  // Reset auction inputs on phase change
  useEffect(() => {
    setBetAmount('');
    setBetSubmitted(false);
    setAuctionAnswer('');
    setAnswerSubmitted(false);
  }, [auctionPhase]);

  function buzz() {
    if (buzzerState !== 'ready') return;
    setPressed(true);
    setBuzzerState('buzzed');
    emit('player:buzz');
  }

  function placeBet() {
    const amount = parseInt(betAmount, 10);
    if (isNaN(amount)) return;
    emit('player:placeBet', { amount });
    setBetSubmitted(true);
  }

  function submitAnswer() {
    if (!auctionAnswer.trim()) return;
    emit('player:submitAuctionAnswer', { answer: auctionAnswer.trim() });
    setAnswerSubmitted(true);
  }

  const me = gameState?.players?.find((p) => p.id === myId);
  const score = me?.score ?? 0;
  const maxBet = Math.max(0, score);

  const buzzerLabel = {
    idle: 'Ждём вопроса',
    ready: 'ЖАТЬ!',
    buzzed: 'Нажато!',
    winner: 'Ты первый!',
    blocked: 'Заблокирован',
    missed: 'Не успел',
  }[buzzerState];

  return (
    <div className="page player-page">
      <div className="starfield" />
      <div className="player">
        <Logo small />
        <div className="player__name">{name}</div>
        <div className="player__score-label">Счёт</div>
        <div className="player__score">{score}</div>

        {/* Auction UI */}
        {auctionPhase === 'betting' && (
          <div className="player__auction">
            <div className="player__auction-title">🎰 АУКЦИОН!</div>
            {betSubmitted ? (
              <div className="player__auction-wait">Ставка принята! Ждём...</div>
            ) : (
              <>
                <p className="player__auction-hint">Сколько поставить? (макс: {maxBet})</p>
                <input
                  className="player__auction-input"
                  type="number"
                  min="0"
                  max={maxBet}
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && placeBet()}
                  placeholder="0"
                  autoFocus
                />
                <button
                  className="player__auction-btn"
                  onClick={placeBet}
                  disabled={betAmount === '' || isNaN(parseInt(betAmount, 10))}
                >
                  Поставить
                </button>
              </>
            )}
          </div>
        )}

        {(auctionPhase === 'bets_revealed') && (
          <div className="player__auction">
            <div className="player__auction-wait">Ставки раскрыты, ждём вопрос...</div>
          </div>
        )}

        {auctionPhase === 'answering' && (
          <div className="player__auction">
            <div className="player__auction-title">Твой ответ</div>
            {answerSubmitted ? (
              <div className="player__auction-wait">Ответ принят! Ждём...</div>
            ) : (
              <>
                <input
                  className="player__auction-input"
                  type="text"
                  value={auctionAnswer}
                  onChange={(e) => setAuctionAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitAnswer()}
                  placeholder="Введи ответ..."
                  autoFocus
                />
                <button
                  className="player__auction-btn"
                  onClick={submitAnswer}
                  disabled={!auctionAnswer.trim()}
                >
                  Отправить
                </button>
              </>
            )}
          </div>
        )}

        {(auctionPhase === 'answers_revealed') && (
          <div className="player__auction">
            <div className="player__auction-wait">Ведущий объявляет победителя...</div>
          </div>
        )}

        {/* Normal buzzer (hidden during auction) */}
        {!auctionPhase && (
          <button
            className={`player__buzz player__buzz--${buzzerState}`}
            onClick={buzz}
            disabled={buzzerState !== 'ready'}
          >
            {buzzerState === 'ready' && <span className="player__buzz-ring" />}
            <span className="player__buzz-label">{buzzerLabel}</span>
          </button>
        )}

        <div className="player__others">
          {gameState?.players
            ?.filter((p) => p.role === 'player' && p.id !== myId)
            .sort((a, b) => b.score - a.score)
            .map((p) => (
              <div key={p.id} className="player__other">
                <span>{p.name}</span>
                <span>{p.score}</span>
              </div>
            ))}
        </div>

        <div className={`player__conn ${connected ? 'player__conn--ok' : ''}`}>
          {connected ? '● онлайн' : '● нет связи'}
        </div>
      </div>
    </div>
  );
}
