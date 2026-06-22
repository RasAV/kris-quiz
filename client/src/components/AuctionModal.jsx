import React, { useState, useEffect } from 'react';
import './AuctionModal.css';

export default function AuctionModal({ phase, data, readyIds, onRevealBets, onStartQuestion, onRevealAnswers, onMark, onClose }) {
  const [marked, setMarked] = useState({});

  useEffect(() => { setMarked({}); }, [phase]);

  if (!phase) return null;

  const players = data?.players ?? [];
  const bets = data?.bets ?? [];
  const answers = data?.answers ?? [];
  const question = data?.question ?? '';
  const image = data?.image ?? null;
  const video = data?.video ?? null;
  const isOpenAnswer = data?.isOpenAnswer ?? false;

  return (
    <div className="auction__overlay">
      <div className="auction">
        <button className="auction__close" onClick={onClose}>✕</button>

        {phase === 'betting' && (
          <>
            <div className="auction__slot">🎰</div>
            <h2 className="auction__title">какова ставОчка?</h2>
            <p className="auction__subtitle">Игроки делают ставки...</p>
            <div className="auction__players">
              {players.map((p) => (
                <div key={p.id} className="auction__player-row">
                  <span className={`auction__dot ${readyIds.includes(p.id) ? 'auction__dot--ready' : ''}`} />
                  <span className="auction__player-name">{p.name}</span>
                  <span className="auction__player-score">{p.score}</span>
                </div>
              ))}
            </div>
            <button className="auction__btn auction__btn--primary" onClick={onRevealBets}>
              Показать ставки
            </button>
          </>
        )}

        {phase === 'bets_revealed' && (
          <>
            <h2 className="auction__title">Ставки</h2>
            <div className="auction__bets">
              {bets.map((b) => (
                <div key={b.id} className="auction__bet-row">
                  <span className="auction__player-name">{b.name}</span>
                  <span className="auction__bet-amount">{b.amount}</span>
                </div>
              ))}
              {bets.length === 0 && (
                <p className="auction__empty">Никто не поставил</p>
              )}
            </div>
            <button className="auction__btn auction__btn--primary" onClick={onStartQuestion}>
              Показать вопрос
            </button>
          </>
        )}

        {phase === 'answering' && (
          <>
            <h2 className="auction__title">Вопрос</h2>
            {video && <video className="auction__question-video" src={`/media/${video}`} controls />}
            {image && !video && <img className="auction__question-image" src={`/media/${image}`} alt="Вопрос" />}
            <p className="auction__question-text">{question}</p>
            <div className="auction__players">
              {players.map((p) => (
                <div key={p.id} className="auction__player-row">
                  <span className={`auction__dot ${readyIds.includes(p.id) ? 'auction__dot--ready' : ''}`} />
                  <span className="auction__player-name">{p.name}</span>
                </div>
              ))}
            </div>
            <button className="auction__btn auction__btn--primary" onClick={onRevealAnswers}>
              Показать ответы
            </button>
          </>
        )}

        {phase === 'answers_revealed' && (
          <>
            <h2 className="auction__title">Ответы</h2>
            <div className="auction__answers">
              {answers.map((a) => {
                const verdict = marked[a.id];
                return (
                  <div key={a.id} className={`auction__answer-row${verdict ? ` auction__answer-row--${verdict}` : ''}`}>
                    <div className="auction__answer-info">
                      <span className="auction__player-name">{a.name}</span>
                      {!isOpenAnswer && <span className="auction__answer-bet">ставка: {a.bet}</span>}
                      <span className="auction__answer-text">"{a.answer}"</span>
                    </div>
                    <div className="auction__verdict-btns">
                      <button
                        className="auction__btn auction__btn--correct"
                        disabled={!!verdict}
                        onClick={() => { setMarked(m => ({ ...m, [a.id]: 'correct' })); onMark(a.id, true); }}
                      >✓</button>
                      <button
                        className="auction__btn auction__btn--incorrect"
                        disabled={!!verdict}
                        onClick={() => { setMarked(m => ({ ...m, [a.id]: 'incorrect' })); onMark(a.id, false); }}
                      >✗</button>
                    </div>
                  </div>
                );
              })}
              {answers.length === 0 && (
                <p className="auction__empty">Никто не ответил</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
