import React, { useEffect, useRef } from 'react';
import './QuestionModal.css';

export default function QuestionModal({ question, onClose, isHost, hostControls }) {
  const audioRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (question?.type === 'audio' && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    };
  }, [question]);

  if (!question) return null;

  const { buzzerStatus, onOpenBuzzer, onCorrect, onIncorrect, onNoAnswer } = hostControls || {};
  const firstBuzzer = buzzerStatus && buzzerStatus !== 'open' ? buzzerStatus : null;

  return (
    <div className="qmodal__overlay">
      <div className="qmodal">
        <div className="qmodal__points">{question.points}</div>

        {isHost && (
          <button className="qmodal__close" onClick={onClose}>✕</button>
        )}


        <div className="qmodal__content">
          {question.type === 'text' && (
            <p className="qmodal__text">{question.content}</p>
          )}

          {question.type === 'image' && (
            <img className="qmodal__image" src={`/media/${question.content}`} alt="Вопрос" />
          )}

          {question.type === 'audio' && (
            <div className="qmodal__audio-wrap">
              <div className="qmodal__audio-icon">♪</div>
              <p className="qmodal__audio-hint">Слушайте...</p>
              <audio ref={audioRef} src={`/media/${question.content}`} controls />
            </div>
          )}

          {question.type === 'video' && (
            <video
              ref={videoRef}
              className="qmodal__video"
              src={`/media/${question.content}`}
              controls
            />
          )}

          {question.type === 'image_text' && (
            <>
              <img className="qmodal__image" src={`/media/${question.image}`} alt="Вопрос" />
              <p className="qmodal__text">{question.content}</p>
            </>
          )}
        </div>

        {isHost && hostControls && (
          <div className="qmodal__host-controls">
            {!buzzerStatus && !hostControls.autoOpenBuzzer && (
              <button className="qmodal__btn qmodal__btn--buzzer" onClick={onOpenBuzzer}>
                ⚡ Открыть кнопку игрокам
              </button>
            )}

            {buzzerStatus === 'open' && (
              <div className="qmodal__waiting">Ждём нажатия...</div>
            )}

            {firstBuzzer && (
              <>
                <div className="qmodal__buzzed">⚡ {firstBuzzer.name}</div>
                <div className="qmodal__verdict-btns">
                  <button className="qmodal__btn qmodal__btn--correct" onClick={() => onCorrect(firstBuzzer.id)}>
                    ✓ Верно
                  </button>
                  <button className="qmodal__btn qmodal__btn--wrong" onClick={() => onIncorrect(firstBuzzer.id)}>
                    ✗ Неверно
                  </button>
                </div>
              </>
            )}

            <button className="qmodal__btn qmodal__btn--skip" onClick={onNoAnswer}>
              Никто не взял вопрос
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
