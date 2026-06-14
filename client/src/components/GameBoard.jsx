import React from 'react';
import './GameBoard.css';

export default function GameBoard({ board, onSelectQuestion, onReviewQuestion, isHost }) {
  if (!board || board.length === 0) {
    return <div className="board__empty">Загрузка игры...</div>;
  }

  return (
    <div className="board">
      {board.map((category, ci) => (
        <div key={ci} className="board__row">
          <div className="board__category">{category.name}</div>
          {category.questions.map((q, qi) => (
            <button
              key={qi}
              className={`board__cell ${q.played ? 'board__cell--played' : ''}`}
              onClick={() => {
                if (!isHost) return;
                if (q.played) onReviewQuestion?.(ci, qi);
                else onSelectQuestion(ci, qi);
              }}
              disabled={!isHost}
            >
              <span className={`board__points ${q.played ? 'board__points--played' : ''}`}>
                {q.points}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
