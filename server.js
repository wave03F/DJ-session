const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Lyrics endpoint - fetches lyrics from a free API
app.get('/api/lyrics', async (req, res) => {
  const title = req.query.title || '';
  if (!title) return res.json({ words: [] });

  try {
    // Clean up title - remove common YouTube junk
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

    // Try lyrics.ovh free API
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
        // Split lyrics into individual words, filter short ones
        const words = data.lyrics
          .replace(/\[.*?\]/g, '') // remove [Chorus] etc
          .replace(/\n/g, ' ')
          .split(/\s+/)
          .filter(w => w.length >= 3)
          .map(w => w.replace(/[^a-zA-Z\u0E00-\u0E7F]/g, '').toUpperCase())
          .filter(w => w.length >= 3);

        // Remove duplicates but keep some variety
        const unique = [...new Set(words)];
        return res.json({ words: unique.slice(0, 200) });
      }
    }

    // Fallback: return empty (client will use default words)
    res.json({ words: [] });
  } catch (e) {
    console.log('Lyrics fetch failed:', e.message);
    res.json({ words: [] });
  }
});

// State
const players = new Map(); // socketId -> { id, nickname, color, x, y, direction }
const musicQueue = []; // [{ videoId, title, addedBy, addedByNickname }]
let currentSong = null;
let isPlaying = false;

// Map config
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 800;

// Spawn position (random within a safe area)
function getSpawnPosition() {
  return {
    x: 200 + Math.floor(Math.random() * 300),
    y: 400 + Math.floor(Math.random() * 200)
  };
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Player joins
  socket.on('join', (data) => {
    const spawn = getSpawnPosition();
    const player = {
      id: socket.id,
      nickname: data.nickname || 'Anonymous',
      color: data.color || '#6366f1',
      x: spawn.x,
      y: spawn.y,
      direction: 'down'
    };
    players.set(socket.id, player);

    // Send current state to the new player
    socket.emit('init', {
      player,
      players: Array.from(players.values()),
      queue: musicQueue,
      currentSong,
      isPlaying,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT
    });

    // Notify others
    socket.broadcast.emit('player-joined', player);
    console.log(`${player.nickname} joined the world`);
  });

  // Player movement
  socket.on('move', (data) => {
    const player = players.get(socket.id);
    if (!player) return;

    // Validate position (within map bounds)
    const x = Math.max(0, Math.min(MAP_WIDTH - 32, data.x));
    const y = Math.max(0, Math.min(MAP_HEIGHT - 48, data.y));

    player.x = x;
    player.y = y;
    player.direction = data.direction || player.direction;

    // Broadcast to others
    socket.broadcast.emit('player-moved', {
      id: socket.id,
      x: player.x,
      y: player.y,
      direction: player.direction
    });
  });

  // Chat message
  socket.on('chat-message', (message) => {
    const player = players.get(socket.id);
    if (!player) return;

    io.emit('chat-message', {
      playerId: socket.id,
      nickname: player.nickname,
      message: message.substring(0, 150)
    });
  });

  // Emote
  socket.on('emote', (emote) => {
    const player = players.get(socket.id);
    if (!player) return;

    const validEmotes = ['dance', 'wave', 'jump', 'spin', 'heart'];
    if (!validEmotes.includes(emote)) return;

    io.emit('player-emote', {
      playerId: socket.id,
      emote
    });
  });

  // Shoot projectile
  socket.on('shoot', (data) => {
    const player = players.get(socket.id);
    if (!player) return;

    io.emit('player-shoot', {
      playerId: socket.id,
      x: player.x + 16,
      y: player.y + 24,
      direction: player.direction
    });
  });

  // Monster killed
  socket.on('monster-killed', (data) => {
    const player = players.get(socket.id);
    if (!player) return;

    io.emit('monster-killed', {
      monsterId: data.monsterId,
      killedBy: player.nickname
    });
  });

  // Add song to queue
  socket.on('add-song', (data) => {
    const player = players.get(socket.id);
    if (!player) return;

    const song = {
      videoId: data.videoId,
      title: data.title || 'Unknown Track',
      addedBy: socket.id,
      addedByNickname: player.nickname
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
    const player = players.get(socket.id);
    players.delete(socket.id);

    if (player) {
      io.emit('player-left', socket.id);
      console.log(`${player.nickname} left the world`);
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Pixel Music World running on http://localhost:${PORT}`);
});
