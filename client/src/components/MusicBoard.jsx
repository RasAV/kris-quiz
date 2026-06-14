import React from 'react';
import './MusicBoard.css';

export default function MusicBoard({ notes, activeNote, timerPoints, onSelectNote }) {
  if (!notes || notes.length === 0) {
    return <div className="mboard__empty">Загрузка музыкального раунда...</div>;
  }

  return (
    <div className="mboard">
      {notes.map((cat, ci) => (
        <div key={ci} className="mboard__row">
          <div className="mboard__category">{cat.name}</div>
          {cat.notes.map((note, ni) => {
            const isActive = activeNote?.ci === ci && activeNote?.ni === ni;
            return (
              <button
                key={ni}
                className={`mboard__note ${note.played ? 'mboard__note--played' : ''} ${isActive ? 'mboard__note--active' : ''}`}
                onClick={() => !note.played && !activeNote && onSelectNote(ci, ni)}
                disabled={note.played || !!activeNote}
              >
                <span className="mboard__note-deco">♪</span>
                <span className="mboard__note-num">
                  {isActive ? (timerPoints ?? 100) : 100}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
