require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const { errorHandler } = require('./middleware/errorHandler');
const { socketAuthMiddleware } = require('./socket/authMiddleware');
const { apiLimiter, authLimiter, chatLimiter, likeLimiter, uploadLimiter, profileViewLimiter, checkMovementRate, clearMovementCounter } = require('./middleware/rateLimiter');
const { requestLogger, logger } = require('./middleware/logger');
const swaggerSpec = require('./config/swagger');
const swaggerUi = require('swagger-ui-express');

// Routes
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profiles');
const matchRoutes = require('./routes/matches');
const chatRoutes = require('./routes/chat');
const moderationRoutes = require('./routes/moderation');
const roomRoutes = require('./routes/rooms');
const avatarRoutes = require('./routes/avatars');
const datingRoutes = require('./routes/dating');
const paymentRoutes = require('./routes/payments');
const accountRoutes = require('./routes/account');

// Socket handlers
const { registerChatEvents } = require('./socket/chatHandler');
const { registerProximityEvents, getNearbyPlayers, isInVipArea, VIP_AREA } = require('./socket/proximityHandler');

// Create Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.APP_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for game
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Serve static files (existing frontend)
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Swagger API Docs ────────────────────────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Pixel Music World API Docs'
}));
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/profiles', apiLimiter, profileRoutes);
app.use('/api/matches', apiLimiter, matchRoutes);
matchRoutes.setIO(io);
app.use('/api/chat', apiLimiter, chatRoutes);
app.use('/api/moderation', apiLimiter, moderationRoutes);
app.use('/api/rooms', apiLimiter, roomRoutes);
app.use('/api/avatars', apiLimiter, avatarRoutes);
app.use('/api/dating', apiLimiter, datingRoutes);
app.use('/api/payments', apiLimiter, paymentRoutes);
app.use('/api/account', apiLimiter, accountRoutes);

// Health check (simple)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Health check (detailed) — Phase 7
app.get('/api/health/detailed', async (req, res) => {
  const db = require('./config/database');
  const checks = { status: 'ok', timestamp: new Date().toISOString(), services: {} };

  // DB check
  try {
    await db.raw('SELECT 1');
    checks.services.database = 'ok';
  } catch (e) {
    checks.services.database = 'error: ' + e.message;
    checks.status = 'degraded';
  }

  // Redis check
  try {
    const { getRedis } = require('./config/redis');
    const redis = getRedis();
    await redis.ping();
    checks.services.redis = 'ok';
  } catch {
    checks.services.redis = 'unavailable (non-critical)';
  }

  checks.services.websocket = 'ok';
  checks.uptime_seconds = Math.floor(process.uptime());
  checks.memory_mb = Math.floor(process.memoryUsage().heapUsed / 1024 / 1024);

  res.status(checks.status === 'ok' ? 200 : 503).json(checks);
});

// ─── Lyrics API (preserved from original) ────────────────────────────────────
app.get('/api/lyrics', async (req, res) => {
  const title = req.query.title || '';
  if (!title) return res.json({ words: [] });

  try {
    const cleaned = title
      .replace(/\(official.*?\)/gi, '')
      .replace(/\[official.*?\]/gi, '')
      .replace(/official (music )?video/gi, '')
      .replace(/\(lyric.*?\)/gi, '')
      .replace(/\[lyric.*?\]/gi, '')
      .replace(/lyrics/gi, '')
      .replace(/MV/g, '')
      .replace(/HD|HQ|4K/gi, '')
      .replace(/\|.*$/, '')
      .trim();

    const parts = cleaned.split(/[-–—]/).map(s => s.trim());
    let artist = '', songName = '';
    if (parts.length >= 2) {
      artist = parts[0];
      songName = parts.slice(1).join(' ');
    } else {
      artist = '';
      songName = cleaned;
    }

    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(songName)}`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      if (data.lyrics) {
        const words = data.lyrics
          .replace(/\[.*?\]/g, '')
          .replace(/\n/g, ' ')
          .split(/\s+/)
          .filter(w => w.length >= 3)
          .map(w => w.replace(/[^a-zA-Z\u0E00-\u0E7F]/g, '').toUpperCase())
          .filter(w => w.length >= 3);

        const unique = [...new Set(words)];
        return res.json({ words: unique.slice(0, 200) });
      }
    }

    res.json({ words: [] });
  } catch (e) {
    console.log('Lyrics fetch failed:', e.message);
    res.json({ words: [] });
  }
});

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Socket.io Setup ─────────────────────────────────────────────────────────
// Apply auth middleware
io.use(socketAuthMiddleware);

// Game state (preserved from original, will migrate to DB later)
const players = new Map();
const musicQueue = [];
let currentSong = null;
let isPlaying = false;

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 800;

function getSpawnPosition() {
  return {
    x: 200 + Math.floor(Math.random() * 300),
    y: 400 + Math.floor(Math.random() * 200)
  };
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.nickname} (${socket.id})`);

  // Register DM chat events (authenticated users only)
  if (!socket.user.is_guest) {
    registerChatEvents(io, socket);
    registerProximityEvents(io, socket, players);
  }

  // Auto-join on connect (use authenticated user data or guest data from join event)
  let player = null;

  // For guests, wait for 'join' event with nickname
  // For authenticated users, auto-join immediately
  if (!socket.user.is_guest) {
    const spawn = getSpawnPosition();
    player = {
      id: socket.id,
      userId: socket.user.id,
      nickname: socket.user.profile?.display_name || socket.user.nickname,
      color: '#6366f1',
      x: spawn.x,
      y: spawn.y,
      direction: 'down'
    };
    players.set(socket.id, player);

    socket.emit('init', {
      player,
      players: Array.from(players.values()),
      queue: musicQueue,
      currentSong,
      isPlaying,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT
    });
    socket.broadcast.emit('player-joined', player);
  }

  // Guest join (backward-compatible with original client)
  socket.on('join', (data) => {
    if (player) return; // Already joined (authenticated user)

    const spawn = getSpawnPosition();
    player = {
      id: socket.id,
      userId: null,
      nickname: data.nickname || socket.user.nickname,
      color: data.color || '#6366f1',
      x: spawn.x,
      y: spawn.y,
      direction: 'down'
    };
    players.set(socket.id, player);

    socket.emit('init', {
      player,
      players: Array.from(players.values()),
      queue: musicQueue,
      currentSong,
      isPlaying,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT
    });
    socket.broadcast.emit('player-joined', player);
  });

  // Player movement (with rate limiting)
  socket.on('move', (data) => {
    const p = players.get(socket.id);
    if (!p) return;

    // Rate limit: 30 updates/second
    if (!checkMovementRate(socket.id)) return;

    const x = Math.max(0, Math.min(MAP_WIDTH - 32, data.x));
    const y = Math.max(0, Math.min(MAP_HEIGHT - 48, data.y));

    p.x = x;
    p.y = y;
    p.direction = data.direction || p.direction;

    socket.broadcast.emit('player-moved', {
      id: socket.id,
      x: p.x,
      y: p.y,
      direction: p.direction
    });

    // Emit nearby players for proximity indicator (authenticated only)
    if (!socket.user.is_guest && p.userId) {
      const nearby = getNearbyPlayers(socket.id, players);
      if (nearby.length > 0) {
        socket.emit('nearby-players', nearby);
      }

      // VIP area check
      if (isInVipArea(p)) {
        if (!p._inVip) {
          p._inVip = true;
          socket.emit('entered-vip-zone');
        }
      } else if (p._inVip) {
        p._inVip = false;
        socket.emit('left-vip-zone');
      }
    }
  });

  // Chat message
  socket.on('chat-message', (message) => {
    const p = players.get(socket.id);
    if (!p) return;

    io.emit('chat-message', {
      playerId: socket.id,
      nickname: p.nickname,
      message: message.substring(0, 150)
    });
  });

  // Emote
  socket.on('emote', (emote) => {
    const p = players.get(socket.id);
    if (!p) return;

    const validEmotes = ['dance', 'wave', 'jump', 'spin', 'heart'];
    if (!validEmotes.includes(emote)) return;

    io.emit('player-emote', { playerId: socket.id, emote });
  });

  // Shoot projectile
  socket.on('shoot', (data) => {
    const p = players.get(socket.id);
    if (!p) return;

    io.emit('player-shoot', {
      playerId: socket.id,
      x: p.x + 16,
      y: p.y + 24,
      direction: p.direction
    });
  });

  // Monster killed
  socket.on('monster-killed', (data) => {
    const p = players.get(socket.id);
    if (!p) return;

    io.emit('monster-killed', {
      monsterId: data.monsterId,
      killedBy: p.nickname
    });
  });

  // Add song to queue
  socket.on('add-song', (data) => {
    const p = players.get(socket.id);
    if (!p) return;

    const song = {
      videoId: data.videoId,
      title: data.title || 'Unknown Track',
      addedBy: socket.id,
      addedByNickname: p.nickname
    };

    musicQueue.push(song);
    io.emit('queue-updated', musicQueue);

    if (!currentSong) {
      playNext();
    }
  });

  // Song ended
  socket.on('song-ended', () => {
    playNext();
  });

  // Skip song
  socket.on('skip-song', () => {
    playNext();
  });

  // Disconnect
  socket.on('disconnect', () => {
    const p = players.get(socket.id);
    players.delete(socket.id);
    clearMovementCounter(socket.id); // cleanup rate limit counter

    if (p) {
      io.emit('player-left', socket.id);
      logger.info('Player disconnected', { nickname: p.nickname, socketId: socket.id });
    }
  });
});

function playNext() {
  if (musicQueue.length === 0) {
    currentSong = null;
    isPlaying = false;
    io.emit('playback-state', { currentSong: null, isPlaying: false });
    return;
  }

  currentSong = musicQueue.shift();
  currentSong.startTime = Date.now();
  isPlaying = true;

  io.emit('play-song', currentSong);
  io.emit('queue-updated', musicQueue);
}

// ─── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Pixel Music World running on http://localhost:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// ─── Background Jobs ──────────────────────────────────────────────────────────
// Check and expire premium subscriptions every hour
setInterval(async () => {
  try {
    const { expireSubscriptions } = require('./services/paymentService');
    const count = await expireSubscriptions();
    if (count > 0) logger.info('Expired subscriptions', { count });
  } catch (e) {
    logger.warn('Subscription expiry check failed', { error: e.message });
  }
}, 60 * 60 * 1000);

// Auto-close empty rooms every 15 minutes
setInterval(async () => {
  try {
    const { autoCloseEmptyRooms } = require('./services/roomService');
    const count = await autoCloseEmptyRooms();
    if (count > 0) logger.info('Auto-closed empty rooms', { count });
  } catch (e) {
    logger.warn('Room cleanup failed', { error: e.message });
  }
}, 15 * 60 * 1000);

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info('Received shutdown signal', { signal });
  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      const db = require('./config/database');
      await db.destroy();
      logger.info('Database connections closed');
    } catch (e) {
      logger.warn('Error closing DB', { error: e.message });
    }
    process.exit(0);
  });
  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

module.exports = { app, server, io };
