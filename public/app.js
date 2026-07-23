// ─── State ───────────────────────────────────────────────────────────────────
let socket;
let myPlayer = null;
let players = new Map(); // id -> player data
let keys = {};
let canvas, ctx;
let camera = { x: 0, y: 0 };
let mapWidth = 1200;
let mapHeight = 800;
let currentSong = null;
let player = null; // YouTube player
let playerReady = false;

// Movement
const SPEED = 3;
const CHAR_WIDTH = 32;
const CHAR_HEIGHT = 48;

// Chat bubbles
const chatBubbles = new Map(); // playerId -> { message, timer }

// Dance emotes
const danceStates = new Map(); // playerId -> { emote, startTime }
const EMOTES = ['dance', 'wave', 'jump', 'spin', 'heart'];

// Floating song thumbnail
let songThumbnail = null; // Image object
let songThumbnailLoaded = false;

// Monsters & Shooting (Word Bubbles)
const monsters = []; // { id, x, y, word, color, spawnTime, speed, fontSize }
const projectiles = []; // { x, y, dx, dy, spawnTime }
const killEffects = []; // { x, y, time, text, color }
let monsterIdCounter = 0;
let lastBeatTime = 0;
let beatInterval = 500;
let score = 0;
let wordIndex = 0;

// Current song lyrics words (fetched from API)
let lyricWords = [];

// Fallback word pool if lyrics not found
const FALLBACK_WORDS = [
  'LOVE', 'FIRE', 'DREAM', 'NIGHT', 'DANCE', 'BEAT', 'SOUL',
  'HEART', 'GLOW', 'VIBE', 'FLOW', 'RISE', 'FALL', 'SHINE',
  'WILD', 'FREE', 'BURN', 'DEEP', 'HIGH', 'LOST', 'FEEL',
  'MOVE', 'WAVE', 'BASS', 'DROP', 'BOOM', 'RUSH', 'FADE',
  'ECHO', 'PULSE', 'BLISS', 'RAGE', 'COLD', 'HEAT', 'STAR',
  'MOON', 'SKY', 'FLY', 'CRY', 'WHY', 'RUN', 'STAY'
];

// Fancy colors for word bubbles
const WORD_COLORS = [
  '#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff',
  '#5f27cd', '#01a3a4', '#f368e0', '#ff6348', '#7bed9f',
  '#70a1ff', '#ffa502', '#ff4757', '#2ed573', '#1e90ff',
  '#ff6b81', '#7158e2', '#3ae374', '#ffdd57', '#17c0eb'
];

// ─── DOM ─────────────────────────────────────────────────────────────────────
const nicknameInput = document.getElementById('nickname-input');
const gameContainer = document.getElementById('game-container');
const songTitle = document.getElementById('song-title');
const songDj = document.getElementById('song-dj');
const skipBtn = document.getElementById('skip-btn');
const songUrlInput = document.getElementById('song-url-input');
const addSongBtn = document.getElementById('add-song-btn');
const queueList = document.getElementById('queue-list');
const queueCount = document.getElementById('queue-count');
const chatInput = document.getElementById('chat-input');

// ─── Color Picker (Guest tab only) ───────────────────────────────────────────
let selectedColor = '#6366f1';
document.querySelectorAll('#tab-guest .color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tab-guest .color-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedColor = btn.dataset.color;
  });
});

// ─── Join ────────────────────────────────────────────────────────────────────
// Called by UI.enterWorld() after auth or guest selection
function joinWorld() {
  const isGuest = window.UI?.isGuest ?? true;
  const token = window.UI?.token;

  if (isGuest) {
    // Guest mode — connect without auth
    const nickname = document.getElementById('nickname-input')?.value?.trim() || 'Anon';
    socket = io();
    socket.on('connect', () => {
      socket.emit('join', { nickname, color: selectedColor });
    });
  } else {
    // Authenticated mode — connect with JWT
    socket = io({ auth: { token } });
  }

  setupSocketListeners();
  initCanvas();
  loadYouTubeAPI();
  gameLoop();
}

// ─── Canvas Init ─────────────────────────────────────────────────────────────
function initCanvas() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  const viewport = document.getElementById('world-viewport');
  canvas.width = viewport.clientWidth;
  canvas.height = viewport.clientHeight;
}

// ─── Socket Listeners ────────────────────────────────────────────────────────
function setupSocketListeners() {
  socket.on('init', (data) => {
    myPlayer = data.player;
    mapWidth = data.mapWidth;
    mapHeight = data.mapHeight;

    players.clear();
    data.players.forEach(p => players.set(p.id, p));

    renderQueue(data.queue);

    if (data.currentSong) {
      currentSong = data.currentSong;
      updateNowPlaying(currentSong);
      loadSongThumbnail(currentSong.videoId);
      const elapsed = (Date.now() - currentSong.startTime) / 1000;
      if (playerReady) {
        loadVideo(currentSong.videoId, elapsed);
      } else {
        window._pendingSong = { videoId: currentSong.videoId, startAt: elapsed };
      }
    }
  });

  socket.on('player-joined', (p) => {
    players.set(p.id, p);
  });

  socket.on('player-left', (id) => {
    players.delete(id);
    chatBubbles.delete(id);
  });

  socket.on('player-moved', (data) => {
    const p = players.get(data.id);
    if (p) {
      p.x = data.x;
      p.y = data.y;
      p.direction = data.direction;
    }
  });

  socket.on('chat-message', (data) => {
    chatBubbles.set(data.playerId, {
      message: data.message,
      time: Date.now()
    });
    // Remove after 4 seconds
    setTimeout(() => {
      const bubble = chatBubbles.get(data.playerId);
      if (bubble && Date.now() - bubble.time >= 3900) {
        chatBubbles.delete(data.playerId);
      }
    }, 4000);
  });

  socket.on('player-emote', (data) => {
    danceStates.set(data.playerId, {
      emote: data.emote,
      startTime: Date.now()
    });
    // Remove after 3 seconds
    setTimeout(() => {
      const state = danceStates.get(data.playerId);
      if (state && Date.now() - state.startTime >= 2900) {
        danceStates.delete(data.playerId);
      }
    }, 3000);
  });

  socket.on('player-shoot', (data) => {
    // Only show other players' projectiles (we already show our own locally)
    if (data.playerId === myPlayer.id) return;
    spawnProjectile(data.x, data.y, data.direction);
  });

  socket.on('monster-killed', (data) => {
    // Remove monster by id
    const idx = monsters.findIndex(m => m.id === data.monsterId);
    if (idx !== -1) {
      const m = monsters[idx];
      killEffects.push({ x: m.x, y: m.y, time: Date.now(), text: data.killedBy + '!' });
      monsters.splice(idx, 1);
    }
  });

  socket.on('play-song', (song) => {
    currentSong = song;
    updateNowPlaying(song);
    loadSongThumbnail(song.videoId);
    // Activate music reactive animations
    if (window.AnimationEngine) {
      AnimationEngine.setBeat(120); // Default BPM, will improve with detection later
    }
    if (playerReady) {
      loadVideo(song.videoId, 0);
    } else {
      window._pendingSong = { videoId: song.videoId, startAt: 0 };
    }
  });

  socket.on('playback-state', (state) => {
    if (!state.currentSong) {
      currentSong = null;
      songThumbnail = null;
      songThumbnailLoaded = false;
      songTitle.textContent = 'No song playing';
      songDj.textContent = 'Add a YouTube URL below';
      // Stop music reactive animations
      if (window.AnimationEngine) {
        AnimationEngine.stopMusic();
      }
    }
  });

  socket.on('queue-updated', (queue) => {
    renderQueue(queue);
  });

  // ─── Proximity & Discovery Events (Req 5 + 6) ───────────────────
  socket.on('nearby-players', (list) => {
    if (window.ProfileCard) ProfileCard.updateNearby(list);
  });

  socket.on('profile-card', (data) => {
    if (window.ProfileCard) ProfileCard.open(data);
  });

  socket.on('profile-card-error', (data) => {
    console.log('Profile card error:', data.error);
  });

  socket.on('couple-emote', (data) => {
    if (window.ProfileCard) ProfileCard.addCoupleEmote(data);
  });

  socket.on('spotlight-effect', (data) => {
    if (window.ProfileCard) ProfileCard.addSpotlight(data);
  });

  socket.on('player-vip-status', (data) => {
    if (window.ProfileCard) {
      if (data.isVip) ProfileCard.vipPlayers.add(data.playerId);
      else ProfileCard.vipPlayers.delete(data.playerId);
    }
  });

  socket.on('entered-vip-zone', () => {
    socket.emit('enter-vip');
  });

  socket.on('left-vip-zone', () => {
    socket.emit('leave-vip');
  });

  socket.on('vip-denied', (data) => {
    // Show upgrade message (could be a toast)
    console.log('VIP denied:', data.error);
  });

  socket.on('match-created', (data) => {
    // Close profile card and show match celebration
    if (window.ProfileCard) ProfileCard.close();
    // Reload matches list
    if (window.UI && !UI.isGuest) {
      UI.loadMatches();
      UI.loadConversations();
    }
  });

  // DM received via socket
  socket.on('dm:receive', (msg) => {
    if (window.UI) UI.onDmReceive(msg);
  });

  socket.on('dm:sent', (msg) => {
    // Confirmation that message was sent successfully
  });

  socket.on('dm:status', (data) => {
    // Message status update (delivered/read)
  });
}

// ─── Input ───────────────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Don't capture when typing in inputs
  if (document.activeElement === chatInput || document.activeElement === songUrlInput) {
    if (e.key === 'Enter' && document.activeElement === chatInput) {
      sendChat();
    }
    return;
  }

  // Emote keys: 1-5
  if (e.key >= '1' && e.key <= '5') {
    const emoteIndex = parseInt(e.key) - 1;
    if (EMOTES[emoteIndex]) {
      socket.emit('emote', EMOTES[emoteIndex]);
    }
    return;
  }

  // Shoot: spacebar
  if (e.key === ' ') {
    e.preventDefault();
    shootProjectile();
    return;
  }

  keys[e.key] = true;
});

document.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// Chat
function sendChat() {
  const msg = chatInput.value.trim();
  if (!msg) return;
  socket.emit('chat-message', msg);
  chatInput.value = '';
  chatInput.blur();
}

// ─── Game Loop ───────────────────────────────────────────────────────────────
function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

function update() {
  if (!myPlayer) return;

  let moved = false;
  let dx = 0, dy = 0;
  const isRunning = keys['Shift'];
  const speed = isRunning ? SPEED * 1.5 : SPEED;

  if (keys['ArrowUp'] || keys['w'] || keys['W']) { dy = -speed; myPlayer.direction = 'up'; moved = true; }
  if (keys['ArrowDown'] || keys['s'] || keys['S']) { dy = speed; myPlayer.direction = 'down'; moved = true; }
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) { dx = -speed; myPlayer.direction = 'left'; moved = true; }
  if (keys['ArrowRight'] || keys['d'] || keys['D']) { dx = speed; myPlayer.direction = 'right'; moved = true; }

  if (moved) {
    myPlayer.x = Math.max(0, Math.min(mapWidth - CHAR_WIDTH, myPlayer.x + dx));
    myPlayer.y = Math.max(0, Math.min(mapHeight - CHAR_HEIGHT, myPlayer.y + dy));

    // Update in players map too
    const p = players.get(myPlayer.id);
    if (p) {
      p.x = myPlayer.x;
      p.y = myPlayer.y;
      p.direction = myPlayer.direction;
    }

    socket.emit('move', {
      x: myPlayer.x,
      y: myPlayer.y,
      direction: myPlayer.direction
    });
  }

  // Camera follows player
  camera.x = myPlayer.x - canvas.width / 2 + CHAR_WIDTH / 2;
  camera.y = myPlayer.y - canvas.height / 2 + CHAR_HEIGHT / 2;
  camera.x = Math.max(0, Math.min(mapWidth - canvas.width, camera.x));
  camera.y = Math.max(0, Math.min(mapHeight - canvas.height, camera.y));

  // Update animation states for all players
  if (window.AnimationEngine) {
    const isRunning = keys['Shift'];
    players.forEach((p) => {
      AnimationEngine.update(p.id, p.x, p.y, p.id === myPlayer.id ? isRunning : false);
    });
  }

  // Spawn monsters on the beat (only when music is playing)
  if (currentSong) {
    const now = Date.now();
    if (now - lastBeatTime >= beatInterval) {
      lastBeatTime = now;
      // Spawn with some randomness (not every beat)
      if (Math.random() < 0.6) {
        spawnMonster();
      }
      // Pulse the beat interval slightly for variety
      beatInterval = 400 + Math.sin(now / 2000) * 100;
    }
  }

  // Update monsters
  updateMonsters();

  // Update projectiles
  updateProjectiles();

  // Check collisions
  checkCollisions();

  // Clean up old kill effects
  for (let i = killEffects.length - 1; i >= 0; i--) {
    if (Date.now() - killEffects[i].time > 1500) {
      killEffects.splice(i, 1);
    }
  }
}

// ─── Rendering ───────────────────────────────────────────────────────────────
function render() {
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  drawMap();

  // Draw VIP Area (Req 6)
  if (window.ProfileCard) {
    ProfileCard.drawVipArea(ctx, camera);
  }

  drawMonsters();
  drawProjectiles();
  drawPlayers();
  drawKillEffects();

  // Draw proximity interest glow (Req 5)
  if (window.ProfileCard) {
    ProfileCard.drawInterestGlow(ctx, camera);
  }

  // Draw couple emotes (Req 6)
  if (window.ProfileCard) {
    ProfileCard.drawCoupleEmotes(ctx, camera);
  }

  // Draw spotlight effects (Req 6)
  if (window.ProfileCard) {
    ProfileCard.drawSpotlights(ctx, camera);
  }

  ctx.restore();

  // Draw HUD (score) - not affected by camera
  drawHUD();

  // Draw proximity "Press E" prompt (screen-space, after camera restore)
  if (window.ProfileCard) {
    ProfileCard.drawProximityPrompt(ctx, camera);
  }
}

function drawMap() {
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, mapHeight * 0.4);
  skyGrad.addColorStop(0, '#1a1a3e');
  skyGrad.addColorStop(1, '#2d5a27');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, mapWidth, mapHeight * 0.4);

  // Ground
  ctx.fillStyle = '#2d5a27';
  ctx.fillRect(0, mapHeight * 0.35, mapWidth, mapHeight * 0.65);

  // Grass variation pixels
  ctx.fillStyle = '#3a7a32';
  for (let i = 0; i < 200; i++) {
    const gx = (i * 137 + 51) % mapWidth;
    const gy = mapHeight * 0.4 + (i * 89 + 23) % (mapHeight * 0.55);
    ctx.fillRect(gx, gy, 4, 4);
  }

  // Darker grass patches
  ctx.fillStyle = '#1f4a1a';
  for (let i = 0; i < 80; i++) {
    const gx = (i * 211 + 97) % mapWidth;
    const gy = mapHeight * 0.5 + (i * 67 + 41) % (mapHeight * 0.4);
    ctx.fillRect(gx, gy, 8, 4);
  }

  // Mountains (background)
  drawMountain(100, mapHeight * 0.35, 200, 180, '#4a4a6a');
  drawMountain(350, mapHeight * 0.32, 280, 220, '#3a3a5a');
  drawMountain(650, mapHeight * 0.30, 320, 250, '#4a4a6a');
  drawMountain(900, mapHeight * 0.33, 250, 200, '#3a3a5a');
  drawMountain(1050, mapHeight * 0.35, 180, 160, '#4a4a6a');

  // Snow caps
  drawSnowCap(100, mapHeight * 0.35, 200, 180);
  drawSnowCap(350, mapHeight * 0.32, 280, 220);
  drawSnowCap(650, mapHeight * 0.30, 320, 250);
  drawSnowCap(900, mapHeight * 0.33, 250, 200);
  drawSnowCap(1050, mapHeight * 0.35, 180, 160);

  // Trees
  drawTree(80, 450);
  drawTree(250, 520);
  drawTree(500, 480);
  drawTree(750, 550);
  drawTree(950, 470);
  drawTree(1100, 530);
  drawTree(400, 650);
  drawTree(700, 700);
  drawTree(1000, 680);

  // Pixel rocks
  drawRock(180, 600);
  drawRock(600, 720);
  drawRock(850, 620);
  drawRock(1050, 750);

  // Stars in sky
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 50; i++) {
    const sx = (i * 173 + 29) % mapWidth;
    const sy = (i * 61 + 13) % (mapHeight * 0.3);
    ctx.fillRect(sx, sy, 2, 2);
  }

  // Stage/speaker area (where music plays)
  drawStage(550, 380);

  // Floating billboard showing current song
  drawFloatingBillboard();
}

function drawMountain(x, baseY, width, height, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x + width / 2, baseY - height);
  ctx.lineTo(x + width, baseY);
  ctx.closePath();
  ctx.fill();
}

function drawSnowCap(x, baseY, width, height) {
  ctx.fillStyle = '#e8e8f0';
  const peakX = x + width / 2;
  const peakY = baseY - height;
  ctx.beginPath();
  ctx.moveTo(peakX, peakY);
  ctx.lineTo(peakX - width * 0.12, peakY + height * 0.2);
  ctx.lineTo(peakX + width * 0.12, peakY + height * 0.2);
  ctx.closePath();
  ctx.fill();
}

function drawTree(x, y) {
  // Trunk
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(x + 8, y + 24, 8, 16);

  // Leaves (pixel triangle-ish)
  ctx.fillStyle = '#1a6a1a';
  ctx.fillRect(x + 4, y + 12, 16, 12);
  ctx.fillRect(x + 8, y + 4, 8, 8);
  ctx.fillRect(x, y + 20, 24, 4);

  // Highlight
  ctx.fillStyle = '#2a8a2a';
  ctx.fillRect(x + 4, y + 12, 4, 4);
  ctx.fillRect(x + 8, y + 4, 4, 4);
}

function drawRock(x, y) {
  ctx.fillStyle = '#5a5a6a';
  ctx.fillRect(x, y + 4, 20, 12);
  ctx.fillRect(x + 4, y, 12, 16);

  // Highlight
  ctx.fillStyle = '#7a7a8a';
  ctx.fillRect(x + 4, y + 2, 4, 4);
}

function drawStage(x, y) {
  // AnimationEngine stage lighting (music reactive)
  if (window.AnimationEngine) {
    AnimationEngine.updateStageLighting(ctx, x, y, 100);
  }

  // Platform
  ctx.fillStyle = '#5a4a3a';
  ctx.fillRect(x, y + 30, 100, 12);
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(x, y + 42, 100, 6);

  // Speakers (with pulse from AnimationEngine)
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(x + 5, y + 10, 20, 20);
  ctx.fillRect(x + 75, y + 10, 20, 20);

  // Speaker cones
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(x + 9, y + 14, 12, 12);
  ctx.fillRect(x + 79, y + 14, 12, 12);

  // Music note indicator + floating notes
  if (currentSong) {
    const bounce = Math.sin(Date.now() / 300) * 3;
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(x + 46, y - 5 + bounce, 8, 8);
    ctx.fillRect(x + 44, y - 10 + bounce, 4, 8);

    // Floating music notes
    if (window.AnimationEngine) {
      AnimationEngine.drawMusicNotes(ctx, x, y, 100);
    }
  }
}

function drawFloatingBillboard() {
  if (!currentSong) return;

  const bx = mapWidth / 2 - 100;
  const by = 60;
  const bw = 200;
  const bh = 130;
  const floatY = Math.sin(Date.now() / 1000) * 5;

  // Glow behind billboard
  ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
  ctx.fillRect(bx - 8, by - 8 + floatY, bw + 16, bh + 16);

  // Billboard frame
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(bx, by + floatY, bw, bh);
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 3;
  ctx.strokeRect(bx, by + floatY, bw, bh);

  // Thumbnail
  if (songThumbnailLoaded && songThumbnail) {
    ctx.drawImage(songThumbnail, bx + 10, by + 10 + floatY, bw - 20, 80);
  } else {
    // Placeholder
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(bx + 10, by + 10 + floatY, bw - 20, 80);
    ctx.fillStyle = '#6366f1';
    ctx.font = '20px monospace';
    ctx.fillText('♪', bx + 90, by + 55 + floatY);
  }

  // Song title text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px monospace';
  const title = currentSong.title || 'Unknown';
  const displayTitle = title.length > 28 ? title.substring(0, 28) + '...' : title;
  ctx.fillText(displayTitle, bx + 10, by + 105 + floatY);

  // DJ name
  ctx.fillStyle = '#9ca3af';
  ctx.font = '8px monospace';
  ctx.fillText('DJ: ' + (currentSong.addedByNickname || ''), bx + 10, by + 118 + floatY);

  // Pulsing music bars
  for (let i = 0; i < 5; i++) {
    const barH = 6 + Math.sin(Date.now() / 200 + i * 1.2) * 5;
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(bx + bw - 40 + i * 7, by + 120 - barH + floatY, 4, barH);
  }
}

function drawPlayers() {
  players.forEach((p) => {
    drawCharacter(p);
    // Draw VIP badge if applicable
    if (window.ProfileCard) {
      ProfileCard.drawVipBadge(ctx, p, { x: 0, y: 0 }); // already in camera-translated context
    }
  });
}

function drawCharacter(p) {
  const x = p.x;
  let y = p.y;
  const color = p.color || '#6366f1';

  // Apply AnimationEngine effects (music bounce + idle breathing)
  let animState = null;
  if (window.AnimationEngine) {
    animState = AnimationEngine.getState(p.id);
    // Music bounce
    y -= animState.musicBounce || 0;
    // Idle breathing
    if (animState.action === 'idle' && !danceStates.has(p.id)) {
      y += animState.idleBreathOffset || 0;
    }
  }

  // Check dance state
  const dance = danceStates.get(p.id);
  let danceOffset = 0;
  let armAngle = 0;
  let emoteIcon = '';

  if (dance) {
    const elapsed = (Date.now() - dance.startTime) / 1000;
    if (dance.emote === 'dance') {
      danceOffset = Math.sin(elapsed * 8) * 4;
      armAngle = Math.sin(elapsed * 6) * 0.5;
      emoteIcon = '💃';
    } else if (dance.emote === 'wave') {
      armAngle = Math.sin(elapsed * 5) * 0.8;
      emoteIcon = '👋';
    } else if (dance.emote === 'jump') {
      danceOffset = -Math.abs(Math.sin(elapsed * 6)) * 12;
      emoteIcon = '⬆️';
    } else if (dance.emote === 'spin') {
      danceOffset = Math.sin(elapsed * 10) * 2;
      emoteIcon = '🌀';
    } else if (dance.emote === 'heart') {
      emoteIcon = '❤️';
    }
  }

  y += danceOffset;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(p.x + 4, p.y + CHAR_HEIGHT - 4, CHAR_WIDTH - 8, 4);

  // Body
  ctx.fillStyle = color;
  ctx.fillRect(x + 8, y + 16, 16, 20);

  // Head
  ctx.fillStyle = '#f5d0a9';
  ctx.fillRect(x + 8, y + 4, 16, 14);

  // Hair/hat
  ctx.fillStyle = darkenColor(color, 40);
  ctx.fillRect(x + 6, y, 20, 6);

  // Eyes
  ctx.fillStyle = '#1a1a1a';
  if (p.direction === 'left') {
    ctx.fillRect(x + 10, y + 10, 3, 3);
  } else if (p.direction === 'right') {
    ctx.fillRect(x + 19, y + 10, 3, 3);
  } else {
    ctx.fillRect(x + 11, y + 10, 3, 3);
    ctx.fillRect(x + 18, y + 10, 3, 3);
  }

  // Legs (with walk cycle from AnimationEngine)
  ctx.fillStyle = '#2a2a4a';
  if (dance && dance.emote === 'dance') {
    const legKick = Math.sin(Date.now() / 100) * 3;
    ctx.fillRect(x + 9 + legKick, y + 36, 6, 10);
    ctx.fillRect(x + 17 - legKick, y + 36, 6, 10);
  } else if (animState && animState.isMoving) {
    // 4-frame walk cycle
    const legOffsets = [
      { left: 0, right: 0 },
      { left: -3, right: 3 },
      { left: 0, right: 0 },
      { left: 3, right: -3 }
    ];
    const stride = animState.action === 'run' ? 1.5 : 1;
    const offset = legOffsets[animState.walkFrame] || legOffsets[0];
    ctx.fillRect(x + 9 + offset.left * stride, y + 36, 6, 10);
    ctx.fillRect(x + 17 + offset.right * stride, y + 36, 6, 10);
  } else {
    ctx.fillRect(x + 9, y + 36, 6, 10);
    ctx.fillRect(x + 17, y + 36, 6, 10);
  }

  // Arms (with walk swing from AnimationEngine)
  ctx.fillStyle = color;
  if (dance && armAngle !== 0) {
    const armUp = Math.sin(Date.now() / 150) * 6;
    ctx.fillRect(x + 2, y + 14 - Math.abs(armUp), 4, 12);
    ctx.fillRect(x + 26, y + 14 - Math.abs(armUp), 4, 12);
  } else {
    ctx.fillRect(x + 4, y + 18, 4, 12);
    ctx.fillRect(x + 24, y + 18, 4, 12);
  }

  // Name tag
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  const name = p.nickname || 'Anon';
  ctx.font = '10px monospace';
  const nameWidth = ctx.measureText(name).width;
  ctx.fillRect(x + CHAR_WIDTH / 2 - nameWidth / 2 - 3, y - 12, nameWidth + 6, 12);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, x + CHAR_WIDTH / 2 - nameWidth / 2, y - 3);

  // Emote icon floating above
  if (dance && emoteIcon) {
    const floatUp = Math.sin(Date.now() / 400) * 3;
    ctx.font = '16px serif';
    ctx.fillText(emoteIcon, x + CHAR_WIDTH / 2 - 8, y - 20 + floatUp);
  }

  // Chat bubble
  const bubble = chatBubbles.get(p.id);
  if (bubble) {
    drawChatBubble(p.x, p.y, bubble.message);
  }
}

// ─── Word Bubble System ──────────────────────────────────────────────────────
function getNextWord() {
  const pool = lyricWords.length > 0 ? lyricWords : FALLBACK_WORDS;
  const word = pool[wordIndex % pool.length];
  wordIndex++;
  return word;
}

function spawnMonster() {
  if (monsters.length >= 20) return;

  const word = getNextWord();
  const color = WORD_COLORS[Math.floor(Math.random() * WORD_COLORS.length)];
  const fontSize = 16 + Math.floor(Math.random() * 14); // 16-30px

  // Spawn from edges
  let x, y;
  const side = Math.floor(Math.random() * 4);
  if (side === 0) { x = Math.random() * mapWidth; y = -40; }
  else if (side === 1) { x = mapWidth + 40; y = Math.random() * mapHeight; }
  else if (side === 2) { x = Math.random() * mapWidth; y = mapHeight + 40; }
  else { x = -40; y = Math.random() * mapHeight; }

  monsters.push({
    id: monsterIdCounter++,
    x, y,
    word,
    color,
    spawnTime: Date.now(),
    speed: 0.7 + Math.random() * 1.3,
    fontSize,
    wobble: Math.random() * Math.PI * 2
  });
}

function updateMonsters() {
  if (!myPlayer) return;

  for (let i = monsters.length - 1; i >= 0; i--) {
    const m = monsters[i];
    // Move toward player
    const dx = myPlayer.x - m.x;
    const dy = myPlayer.y - m.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      m.x += (dx / dist) * m.speed;
      m.y += (dy / dist) * m.speed;
    }
    // Remove if too old
    if (Date.now() - m.spawnTime > 15000) {
      monsters.splice(i, 1);
    }
  }
}

function shootProjectile() {
  if (!myPlayer || !socket) return;
  socket.emit('shoot', { direction: myPlayer.direction });
  spawnProjectile(myPlayer.x + 16, myPlayer.y + 24, myPlayer.direction);
}

function spawnProjectile(x, y, direction) {
  const speed = 8;
  let dx = 0, dy = 0;
  if (direction === 'up') dy = -speed;
  else if (direction === 'down') dy = speed;
  else if (direction === 'left') dx = -speed;
  else dx = speed;
  projectiles.push({ x, y, dx, dy, spawnTime: Date.now() });
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.dx;
    p.y += p.dy;
    if (p.x < -50 || p.x > mapWidth + 50 || p.y < -50 || p.y > mapHeight + 50) {
      projectiles.splice(i, 1);
    } else if (Date.now() - p.spawnTime > 3000) {
      projectiles.splice(i, 1);
    }
  }
}

function checkCollisions() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    for (let j = monsters.length - 1; j >= 0; j--) {
      const m = monsters[j];
      // Hit box based on word size
      const hitW = m.word.length * m.fontSize * 0.5;
      const hitH = m.fontSize + 8;
      if (p.x > m.x - hitW / 2 && p.x < m.x + hitW / 2 &&
          p.y > m.y - hitH / 2 && p.y < m.y + hitH / 2) {
        // Kill in 1 hit!
        score += 10;
        killEffects.push({ x: m.x, y: m.y, time: Date.now(), text: m.word, color: m.color });
        socket.emit('monster-killed', { monsterId: m.id });
        monsters.splice(j, 1);
        projectiles.splice(i, 1);
        break;
      }
    }
  }
}

function drawMonsters() {
  const now = Date.now();
  monsters.forEach(m => {
    const age = (now - m.spawnTime) / 1000;
    const wobble = Math.sin(now / 300 + m.wobble) * 4;
    const pulse = 1 + Math.sin(now / 200 + m.id) * 0.05;
    const x = m.x;
    const y = m.y + wobble;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);

    // Glow behind word
    ctx.shadowColor = m.color;
    ctx.shadowBlur = 12;

    // Background bubble
    ctx.font = `bold ${m.fontSize}px monospace`;
    const textW = ctx.measureText(m.word).width;
    const pad = 8;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-textW / 2 - pad, -m.fontSize / 2 - pad / 2, textW + pad * 2, m.fontSize + pad);

    // Border
    ctx.strokeStyle = m.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(-textW / 2 - pad, -m.fontSize / 2 - pad / 2, textW + pad * 2, m.fontSize + pad);

    // Word text
    ctx.shadowBlur = 0;
    ctx.fillStyle = m.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.word, 0, 2);

    ctx.restore();
  });
}

function drawProjectiles() {
  const now = Date.now();
  projectiles.forEach(p => {
    // Glowing star bullet
    const pulse = 1 + Math.sin(now / 100) * 0.3;
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(p.x - 4 * pulse, p.y - 4 * pulse, 8 * pulse, 8 * pulse);
    ctx.fillStyle = '#fff';
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    // Trail
    ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
    ctx.fillRect(p.x - p.dx * 0.5 - 2, p.y - p.dy * 0.5 - 2, 4, 4);
  });
}

function drawKillEffects() {
  killEffects.forEach(e => {
    const age = (Date.now() - e.time) / 1000;
    const alpha = Math.max(0, 1 - age / 1.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = e.color || '#fbbf24';
    ctx.textAlign = 'center';
    // Explode outward and fade
    const scale = 1 + age * 0.5;
    ctx.translate(e.x, e.y - age * 40);
    ctx.scale(scale, scale);
    ctx.fillText(e.text, 0, 0);
    ctx.restore();
  });
}

function drawHUD() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(10, 10, 130, 32);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('Score: ' + score, 20, 31);

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(10, 48, 200, 20);
  ctx.fillStyle = '#9ca3af';
  ctx.font = '10px monospace';
  ctx.fillText('SPACE=shoot | 1-5=emotes', 16, 61);

  // Show if lyrics are loaded
  if (currentSong && lyricWords.length > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(10, 74, 140, 16);
    ctx.fillStyle = '#4ade80';
    ctx.font = '9px monospace';
    ctx.fillText('♪ Lyrics loaded!', 16, 85);
  }
}

function drawChatBubble(x, y, message) {
  ctx.font = '10px monospace';
  const maxWidth = 140;
  const text = message.length > 40 ? message.substring(0, 40) + '...' : message;
  const textWidth = Math.min(ctx.measureText(text).width, maxWidth);

  const bx = x + CHAR_WIDTH / 2 - textWidth / 2 - 6;
  const by = y - 34;

  // Bubble background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bx, by, textWidth + 12, 18);

  // Bubble tail
  ctx.fillRect(x + CHAR_WIDTH / 2 - 3, by + 18, 6, 4);

  // Text
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText(text, bx + 6, by + 12);
}

function darkenColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16) - amount;
  let g = ((num >> 8) & 0x00FF) - amount;
  let b = (num & 0x0000FF) - amount;
  r = Math.max(0, r);
  g = Math.max(0, g);
  b = Math.max(0, b);
  return `rgb(${r},${g},${b})`;
}

// ─── Queue UI ────────────────────────────────────────────────────────────────
function renderQueue(queue) {
  queueCount.textContent = `(${queue.length})`;
  queueList.innerHTML = '';

  queue.forEach(song => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${escapeHtml(song.title)}</span>
      <span class="queue-by">${escapeHtml(song.addedByNickname)}</span>
    `;
    queueList.appendChild(li);
  });
}

function updateNowPlaying(song) {
  songTitle.textContent = song.title || 'Now Playing';
  songDj.textContent = `by ${song.addedByNickname}`;
  // Fetch lyrics for this song
  fetchLyrics(song.title);
}

async function fetchLyrics(title) {
  lyricWords = [];
  wordIndex = 0;
  try {
    const res = await fetch(`/api/lyrics?title=${encodeURIComponent(title)}`);
    const data = await res.json();
    if (data.words && data.words.length > 0) {
      lyricWords = data.words;
      console.log(`Loaded ${lyricWords.length} lyric words`);
    } else {
      lyricWords = [];
      console.log('No lyrics found, using fallback words');
    }
  } catch (e) {
    lyricWords = [];
    console.log('Lyrics fetch error, using fallback');
  }
}

// ─── Add Song ────────────────────────────────────────────────────────────────
addSongBtn.addEventListener('click', addSong);
songUrlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addSong();
});

function addSong() {
  const url = songUrlInput.value.trim();
  if (!url) return;

  const videoId = extractVideoId(url);
  if (!videoId) {
    alert('Enter a valid YouTube URL');
    return;
  }

  fetchVideoTitle(url).then(title => {
    socket.emit('add-song', { videoId, title });
    songUrlInput.value = '';
  });
}

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  return null;
}

async function fetchVideoTitle(url) {
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    return data.title || 'Unknown Track';
  } catch {
    return 'Unknown Track';
  }
}

// ─── Skip ────────────────────────────────────────────────────────────────────
skipBtn.addEventListener('click', () => {
  socket.emit('skip-song');
});

// ─── Emote Buttons ───────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('emote-btn')) {
    const emote = e.target.dataset.emote;
    if (emote && socket) {
      socket.emit('emote', emote);
    }
  }
});

// ─── YouTube API ─────────────────────────────────────────────────────────────
function loadYouTubeAPI() {
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

window.onYouTubeIframeAPIReady = function () {
  player = new YT.Player('youtube-player', {
    height: '1',
    width: '1',
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      modestbranding: 1,
      rel: 0
    },
    events: {
      onReady: () => {
        playerReady = true;
        if (window._pendingSong) {
          loadVideo(window._pendingSong.videoId, window._pendingSong.startAt);
          window._pendingSong = null;
        }
      },
      onStateChange: (event) => {
        if (event.data === YT.PlayerState.ENDED) {
          socket.emit('song-ended');
        }
      }
    }
  });
};

function loadVideo(videoId, startAt) {
  if (!player || !playerReady) return;
  player.loadVideoById({ videoId, startSeconds: startAt || 0 });
}

// ─── Song Thumbnail ──────────────────────────────────────────────────────────
function loadSongThumbnail(videoId) {
  songThumbnailLoaded = false;
  songThumbnail = new Image();
  songThumbnail.crossOrigin = 'anonymous';
  songThumbnail.onload = () => { songThumbnailLoaded = true; };
  songThumbnail.onerror = () => { songThumbnailLoaded = false; };
  songThumbnail.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

// ─── Utility ─────────────────────────────────────────────────────────────────
// escapeHtml is defined globally in ui.js (loaded before app.js)
