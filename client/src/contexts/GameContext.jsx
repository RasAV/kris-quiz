import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [buzzerEvent, setBuzzerEvent] = useState(null);
  const [myId, setMyId] = useState(null);

  // Auction state
  const [auctionPhase, setAuctionPhase] = useState(null);
  const [auctionData, setAuctionData] = useState(null);
  const [auctionReadyIds, setAuctionReadyIds] = useState([]);

  // Music round state
  const [musicGameState, setMusicGameState] = useState(null);
  const [musicTimerPoints, setMusicTimerPoints] = useState(100);
  const [activeMusicNote, setActiveMusicNote] = useState(null);
  const [musicFreezeEvent, setMusicFreezeEvent] = useState(null);

  useEffect(() => {
    const socket = io(window.location.origin, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => { setConnected(true); setMyId(socket.id); });
    socket.on('disconnect', () => setConnected(false));

    // Auction
    socket.on('auction:phase', (data) => {
      setAuctionPhase(data.phase);
      setAuctionData(data);
      setAuctionReadyIds([]);
    });
    socket.on('auction:playerReady', ({ playerId }) => {
      setAuctionReadyIds((prev) => [...new Set([...prev, playerId])]);
    });
    socket.on('auction:end', () => {
      setAuctionPhase(null);
      setAuctionData(null);
      setAuctionReadyIds([]);
    });

    // Main round
    socket.on('state', setGameState);
    socket.on('question:show', (q) => setActiveQuestion(q));
    socket.on('question:hide', () => setActiveQuestion(null));
    socket.on('buzzer:open', () => setBuzzerEvent({ type: 'open' }));
    socket.on('buzzer:close', (data) => setBuzzerEvent({ type: 'close', ...data }));

    // Music round
    socket.on('music:state', (s) => {
      setMusicGameState(s);
      if (s.timerPoints !== undefined) setMusicTimerPoints(s.timerPoints);
      // Timer resumed after incorrect answer — clear freeze
      if (s.timerRunning) setMusicFreezeEvent(null);
    });
    socket.on('music:noteOpen', (data) => {
      setActiveMusicNote(data);
      setMusicTimerPoints(100);
      setMusicFreezeEvent(null);
    });
    socket.on('music:tick', ({ points }) => setMusicTimerPoints(points));
    socket.on('music:freeze', (data) => {
      setMusicFreezeEvent(data);
      setMusicTimerPoints(data.frozenPoints);
    });
    socket.on('music:noteClose', () => {
      setActiveMusicNote(null);
      setMusicFreezeEvent(null);
    });
    socket.on('music:noteExpired', () => {
      setActiveMusicNote(null);
      setMusicFreezeEvent(null);
    });

    return () => socket.disconnect();
  }, []);

  function emit(event, data) {
    socketRef.current?.emit(event, data);
  }

  return (
    <GameContext.Provider value={{
      connected, gameState, activeQuestion, buzzerEvent, myId, emit,
      auctionPhase, auctionData, auctionReadyIds,
      musicGameState, musicTimerPoints, activeMusicNote, musicFreezeEvent,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}
