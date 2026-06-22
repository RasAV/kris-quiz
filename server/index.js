import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use('/media', express.static(join(ROOT, 'game-data/media')));
app.use(express.static(join(ROOT, 'client/dist')));

function loadGame() {
  const path = join(ROOT, 'game-data/game.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

const gameData = loadGame();

// ── Auction state ─────────────────────────────────────────────────────────────
const auction = {
  phase: null, // null | 'betting' | 'bets_revealed' | 'answering' | 'answers_revealed'
  bets: {},    // socketId -> amount
  answers: {}, // socketId -> text
  question: null, // overrides board question (used for super game)
  image: null,    // optional image filename
  video: null,    // optional video filename
  isOpenAnswer: false, // true = open_answer type (no bets, winner gets question points)
};

function getAuctionPlayers() {
  return Object.values(state.players)
    .filter((p) => p.role === 'player')
    .map((p) => ({ id: p.id, name: p.name, score: p.score }));
}

function getHostSocket() {
  return Object.values(state.players).find((p) => p.role === 'host');
}

// ── Score persistence by name ─────────────────────────────────────────────────
const scoresByName = {}; // name -> score, survives reconnects

function syncScore(player) {
  if (player && player.role === 'player') scoresByName[player.name] = player.score;
}

// ── Main round state ──────────────────────────────────────────────────────────
const state = {
  players: {},
  board: buildBoard(gameData),
  activeQuestion: null,
  buzzerOpen: false,
  buzzedPlayers: [],
};

function buildBoard(data) {
  if (!data) return [];
  return data.categories.map((cat) => ({
    name: cat.name,
    questions: cat.questions.map((q) => ({ ...q, played: false })),
  }));
}

function getPublicState() {
  return {
    board: state.board,
    players: Object.values(state.players).map((p) => ({
      id: p.id, name: p.name, score: p.score, role: p.role,
    })),
    activeQuestion: state.activeQuestion,
    buzzerOpen: state.buzzerOpen,
    buzzedPlayers: state.buzzedPlayers,
  };
}

// ── Music round state ─────────────────────────────────────────────────────────
const music = {
  notes: buildMusicNotes(gameData),
  activeNote: null,   // { ci, ni, audioSrc, frozenPoints }
  timerPoints: 0,
  timerRunning: false,
  buzzerOpen: false,
  buzzedPlayers: [],
};
let musicTimer = null;

function buildMusicNotes(data) {
  if (!data?.musicRound?.categories) return [];
  return data.musicRound.categories.map((cat) => ({
    name: cat.name,
    notes: cat.notes.map((n) => ({ ...n, played: false })),
  }));
}

function getMusicState() {
  return {
    notes: music.notes,
    activeNote: music.activeNote,
    timerPoints: music.timerPoints,
    timerRunning: music.timerRunning,
    buzzerOpen: music.buzzerOpen,
  };
}

function startMusicTimer(fromPoints) {
  clearInterval(musicTimer);
  music.timerPoints = fromPoints;
  music.timerRunning = true;
  music.buzzerOpen = true;
  music.buzzedPlayers = [];
  io.emit('buzzer:open');
  io.emit('music:state', getMusicState());

  musicTimer = setInterval(() => {
    if (!music.timerRunning) { clearInterval(musicTimer); return; }
    music.timerPoints = Math.max(0, music.timerPoints - 1);
    io.emit('music:tick', { points: music.timerPoints });
    if (music.timerPoints <= 0) {
      clearInterval(musicTimer);
      music.timerRunning = false;
      music.buzzerOpen = false;
      if (music.activeNote) {
        const { ci, ni } = music.activeNote;
        if (music.notes[ci]?.notes[ni]) music.notes[ci].notes[ni].played = true;
      }
      music.activeNote = null;
      io.emit('music:noteExpired');
      io.emit('music:state', getMusicState());
      // Reset player buttons
      io.emit('buzzer:close', { firstPlayer: null, firstPlayerId: null });
    }
  }, 500);
}

// ── Socket handlers ───────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('connected', socket.id);

  socket.on('join', ({ name, role }) => {
    const playerName = name || `Игрок ${Object.keys(state.players).length + 1}`;
    const restoredScore = (role === 'player' && scoresByName[playerName]) ?? 0;
    state.players[socket.id] = {
      id: socket.id,
      name: playerName,
      score: restoredScore,
      role: role || 'player',
    };
    socket.emit('state', getPublicState());
    socket.emit('music:state', getMusicState());
    io.emit('state', getPublicState());
  });

  // ── Test round ──
  socket.on('host:openTest', () => {
    if (state.players[socket.id]?.role !== 'host') return;
    state.activeQuestion = { categoryIndex: -1, questionIndex: -1, points: 10, isTest: true };
    state.buzzerOpen = false;
    state.buzzedPlayers = [];
    io.emit('state', getPublicState());
    io.emit('question:show', { points: 10, type: 'text', content: '🔌 Тест подключения', isTest: true });
  });

  // ── Main round ──
  socket.on('host:openQuestion', ({ categoryIndex, questionIndex }) => {
    if (state.players[socket.id]?.role !== 'host') return;
    state.activeQuestion = { categoryIndex, questionIndex };
    state.buzzerOpen = false;
    state.buzzedPlayers = [];
    io.emit('state', getPublicState());
    const q = state.board[categoryIndex]?.questions[questionIndex];
    if (!q) return;
    io.emit('question:show', q);
    if (q.type === 'auction') {
      auction.phase = 'betting';
      auction.bets = {};
      auction.answers = {};
      auction.question = q.content ?? null;
      auction.image = q.image ?? null;
      auction.video = q.video ?? null;
      auction.isOpenAnswer = false;
      io.emit('auction:phase', { phase: 'betting', players: getAuctionPlayers() });
    }
    if (q.type === 'open_answer') {
      auction.phase = 'answering';
      auction.bets = {};
      auction.answers = {};
      auction.question = q.content ?? null;
      auction.image = q.image ?? null;
      auction.video = q.video ?? null;
      auction.isOpenAnswer = true;
      io.emit('auction:phase', { phase: 'answering', isOpenAnswer: true, question: q.content ?? '', image: q.image ?? null, video: q.video ?? null, players: getAuctionPlayers() });
    }
  });

  socket.on('host:closeQuestion', () => {
    if (state.players[socket.id]?.role !== 'host') return;
    const { categoryIndex, questionIndex } = state.activeQuestion || {};
    const q = state.board[categoryIndex]?.questions[questionIndex];
    if (q) q.played = true;
    state.activeQuestion = null;
    state.buzzerOpen = false;
    state.buzzedPlayers = [];
    if (auction.phase) { auction.phase = null; auction.question = null; auction.image = null; auction.video = null; auction.isOpenAnswer = false; io.emit('auction:end'); }
    io.emit('question:hide');
    io.emit('state', getPublicState());
  });

  socket.on('host:openBuzzer', () => {
    if (state.players[socket.id]?.role !== 'host') return;
    state.buzzerOpen = true;
    state.buzzedPlayers = [];
    io.emit('state', getPublicState());
    io.emit('buzzer:open');
  });

  socket.on('host:correct', ({ playerId }) => {
    if (state.players[socket.id]?.role !== 'host') return;
    const player = state.players[playerId];
    const { categoryIndex, questionIndex, points: testPoints } = state.activeQuestion || {};
    const q = state.board[categoryIndex]?.questions[questionIndex];
    const points = q ? q.points : testPoints;
    if (!player || !points) return;
    player.score += points;
    syncScore(player);
    if (q) q.played = true;
    state.activeQuestion = null;
    state.buzzerOpen = false;
    state.buzzedPlayers = [];
    io.emit('question:hide');
    io.emit('state', getPublicState());
  });

  socket.on('host:incorrect', ({ playerId }) => {
    if (state.players[socket.id]?.role !== 'host') return;
    const player = state.players[playerId];
    const { categoryIndex, questionIndex, points: testPoints } = state.activeQuestion || {};
    const q = state.board[categoryIndex]?.questions[questionIndex];
    const points = q ? q.points : testPoints;
    if (!player || !points) return;
    player.score -= points;
    syncScore(player);
    state.buzzedPlayers = [];
    state.buzzerOpen = true;
    io.emit('buzzer:open');
    io.emit('state', getPublicState());
  });

  socket.on('host:noAnswer', () => {
    if (state.players[socket.id]?.role !== 'host') return;
    const { categoryIndex, questionIndex } = state.activeQuestion || {};
    const q = state.board[categoryIndex]?.questions[questionIndex];
    if (q) q.played = true;
    state.activeQuestion = null;
    state.buzzerOpen = false;
    state.buzzedPlayers = [];
    if (auction.phase) { auction.phase = null; auction.question = null; auction.image = null; auction.video = null; auction.isOpenAnswer = false; io.emit('auction:end'); }
    io.emit('question:hide');
    io.emit('state', getPublicState());
  });

  // ── Auction round ──
  socket.on('player:placeBet', ({ amount }) => {
    if (auction.phase !== 'betting') return;
    const player = state.players[socket.id];
    if (!player || player.role !== 'player') return;
    const maxBet = Math.max(0, player.score);
    const bet = Math.min(Math.max(0, parseInt(amount) || 0), maxBet);
    auction.bets[socket.id] = bet;
    io.emit('auction:playerReady', { playerId: socket.id });
  });

  socket.on('host:revealBets', () => {
    if (state.players[socket.id]?.role !== 'host') return;
    if (auction.phase !== 'betting') return;
    auction.phase = 'bets_revealed';
    const bets = Object.entries(auction.bets).map(([id, amount]) => ({
      id, amount, name: state.players[id]?.name ?? '?',
    }));
    io.emit('auction:phase', { phase: 'bets_revealed', bets, players: getAuctionPlayers() });
  });

  socket.on('host:startAuctionQuestion', () => {
    if (state.players[socket.id]?.role !== 'host') return;
    if (auction.phase !== 'bets_revealed') return;
    auction.phase = 'answering';
    let question = auction.question;
    if (!question) {
      const { categoryIndex, questionIndex } = state.activeQuestion || {};
      const q = state.board[categoryIndex]?.questions[questionIndex];
      question = q?.content ?? '';
    }
    io.emit('auction:phase', { phase: 'answering', question, image: auction.image ?? null, video: auction.video ?? null, players: getAuctionPlayers() });
  });

  socket.on('host:openSuperGame', () => {
    if (state.players[socket.id]?.role !== 'host') return;
    const superQ = { type: 'auction', content: '19 апреля хиппи по всему миру отмечают «день велосипеда», хотя к велосипедам он имеет очень косвенное отношение. Годовщину какого события они празднуют?', image: 'hippy.jpg', points: 0, isSuperGame: true };
    state.activeQuestion = { categoryIndex: -99, questionIndex: -99, isSuperGame: true };
    state.buzzerOpen = false;
    state.buzzedPlayers = [];
    auction.phase = 'betting';
    auction.bets = {};
    auction.answers = {};
    auction.question = superQ.content;
    auction.image = superQ.image;
    io.emit('state', getPublicState());
    io.emit('question:show', superQ);
    io.emit('auction:phase', { phase: 'betting', players: getAuctionPlayers() });
  });

  socket.on('player:submitAuctionAnswer', ({ answer }) => {
    if (auction.phase !== 'answering') return;
    const player = state.players[socket.id];
    if (!player || player.role !== 'player') return;
    auction.answers[socket.id] = answer ?? '';
    io.emit('auction:playerReady', { playerId: socket.id });
  });

  socket.on('host:revealAuctionAnswers', () => {
    if (state.players[socket.id]?.role !== 'host') return;
    if (auction.phase !== 'answering') return;
    auction.phase = 'answers_revealed';
    const answeredIds = new Set(Object.keys(auction.answers));
    let answers;
    if (auction.isOpenAnswer) {
      answers = getAuctionPlayers().map((p) => ({
        id: p.id, bet: null,
        name: p.name,
        answer: answeredIds.has(p.id) ? auction.answers[p.id] : '—',
      }));
    } else {
      answers = Object.entries(auction.bets).map(([id, bet]) => ({
        id, bet,
        name: state.players[id]?.name ?? '?',
        answer: answeredIds.has(id) ? auction.answers[id] : '—',
      }));
    }
    io.emit('auction:phase', { phase: 'answers_revealed', isOpenAnswer: auction.isOpenAnswer, answers, players: getAuctionPlayers() });
  });

  socket.on('host:awardAuction', ({ winnerId, correct }) => {
    if (state.players[socket.id]?.role !== 'host') return;
    const player = state.players[winnerId];
    const { categoryIndex, questionIndex } = state.activeQuestion || {};
    const q = state.board[categoryIndex]?.questions[questionIndex];
    if (player) {
      const points = auction.isOpenAnswer ? (q?.points ?? 0) : (auction.bets[winnerId] ?? 0);
      player.score += correct ? points : -points;
      syncScore(player);
    }
    io.emit('state', getPublicState());
  });

  socket.on('host:kickPlayer', ({ playerId }) => {
    if (state.players[socket.id]?.role !== 'host') return;
    const target = io.sockets.sockets.get(playerId);
    if (target) target.emit('player:kicked');
    delete state.players[playerId];
    io.emit('state', getPublicState());
  });

  socket.on('host:setScore', ({ playerId, score }) => {
    if (state.players[socket.id]?.role !== 'host') return;
    const player = state.players[playerId];
    if (player) { player.score = score; syncScore(player); io.emit('state', getPublicState()); }
  });

  // ── Music round ──
  socket.on('host:openMusicNote', ({ ci, ni }) => {
    if (state.players[socket.id]?.role !== 'host') return;
    const note = music.notes[ci]?.notes[ni];
    if (!note || note.played) return;

    // Close any active main-round question
    if (state.activeQuestion) {
      state.activeQuestion = null;
      state.buzzerOpen = false;
      state.buzzedPlayers = [];
      io.emit('question:hide');
    }

    clearInterval(musicTimer);
    music.activeNote = { ci, ni, audioSrc: note.audio, frozenPoints: null };
    io.emit('music:noteOpen', { ci, ni, audioSrc: note.audio });
    startMusicTimer(100);
  });

  socket.on('host:musicCorrect', ({ playerId }) => {
    if (state.players[socket.id]?.role !== 'host') return;
    const player = state.players[playerId];
    if (!player || !music.activeNote) return;
    const points = music.activeNote.frozenPoints ?? music.timerPoints;
    player.score += points;
    syncScore(player);
    clearInterval(musicTimer);
    const { ci, ni } = music.activeNote;
    if (music.notes[ci]?.notes[ni]) music.notes[ci].notes[ni].played = true;
    music.activeNote = null;
    music.timerRunning = false;
    music.buzzerOpen = false;
    music.buzzedPlayers = [];
    io.emit('music:noteClose', { ci, ni });
    io.emit('music:state', getMusicState());
    io.emit('state', getPublicState());
  });

  socket.on('host:musicIncorrect', ({ playerId }) => {
    if (state.players[socket.id]?.role !== 'host') return;
    if (!music.activeNote) return;
    const resumeFrom = music.activeNote.frozenPoints ?? music.timerPoints;
    const penalty = Math.floor(resumeFrom / 2);
    const player = state.players[playerId];
    if (player) { player.score -= penalty; syncScore(player); }
    music.activeNote.frozenPoints = null;
    startMusicTimer(resumeFrom);
    io.emit('state', getPublicState());
  });

  socket.on('host:musicNoAnswer', () => {
    if (state.players[socket.id]?.role !== 'host') return;
    if (!music.activeNote) return;
    clearInterval(musicTimer);
    const { ci, ni } = music.activeNote;
    if (music.notes[ci]?.notes[ni]) music.notes[ci].notes[ni].played = true;
    music.activeNote = null;
    music.timerRunning = false;
    music.buzzerOpen = false;
    music.buzzedPlayers = [];
    io.emit('music:noteClose', { ci, ni });
    io.emit('music:state', getMusicState());
    io.emit('state', getPublicState());
    io.emit('buzzer:close', { firstPlayer: null, firstPlayerId: null });
  });

  // ── Universal player buzz (works for both rounds) ──
  socket.on('player:buzz', () => {
    const player = state.players[socket.id];
    if (!player || player.role !== 'player') return;

    // Music round
    if (music.activeNote && music.buzzerOpen) {
      if (music.buzzedPlayers.includes(socket.id)) return;
      music.buzzedPlayers.push(socket.id);
      if (music.buzzedPlayers.length === 1) {
        clearInterval(musicTimer);
        music.timerRunning = false;
        music.buzzerOpen = false;
        music.activeNote.frozenPoints = music.timerPoints;
        io.emit('music:freeze', {
          frozenPoints: music.timerPoints,
          firstPlayer: player.name,
          firstPlayerId: socket.id,
        });
        io.emit('buzzer:close', { firstPlayer: player.name, firstPlayerId: socket.id });
        io.emit('music:state', getMusicState());
      }
      return;
    }

    // Main round
    if (!state.buzzerOpen) return;
    if (state.buzzedPlayers.includes(socket.id)) return;
    state.buzzedPlayers.push(socket.id);
    if (state.buzzedPlayers.length === 1) {
      state.buzzerOpen = false;
      io.emit('buzzer:close', { firstPlayer: player.name, firstPlayerId: socket.id });
    }
    io.emit('state', getPublicState());
  });

  socket.on('host:resetGame', () => {
    if (state.players[socket.id]?.role !== 'host') return;

    // Reset board
    state.board = buildBoard(gameData);
    state.activeQuestion = null;
    state.buzzerOpen = false;
    state.buzzedPlayers = [];

    // Reset player scores (keep players connected)
    Object.values(state.players).forEach((p) => { if (p.role === 'player') p.score = 0; });
    Object.keys(scoresByName).forEach((k) => delete scoresByName[k]);

    // Reset auction
    clearInterval(musicTimer);
    auction.phase = null;
    auction.bets = {};
    auction.answers = {};
    auction.question = null;
    auction.image = null;
    auction.video = null;

    // Reset music round
    music.notes = buildMusicNotes(gameData);
    music.activeNote = null;
    music.timerPoints = 0;
    music.timerRunning = false;
    music.buzzerOpen = false;
    music.buzzedPlayers = [];

    io.emit('auction:end');
    io.emit('question:hide');
    io.emit('music:noteExpired');
    io.emit('music:state', getMusicState());
    io.emit('state', getPublicState());
  });

  socket.on('disconnect', () => {
    delete state.players[socket.id];
    io.emit('state', getPublicState());
  });
});

app.get('*', (_, res) => {
  const index = join(ROOT, 'client/dist/index.html');
  if (existsSync(index)) res.sendFile(index);
  else res.send('Build client first: npm run build');
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Крис-Квиз server: http://localhost:${PORT}`));
