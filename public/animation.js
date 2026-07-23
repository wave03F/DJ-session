// ─── Character Animation Engine ──────────────────────────────────────────────
// Handles walk cycles, idle breathing, run animations, and music reactive effects

const AnimationEngine = {
  // Animation state per player
  states: new Map(), // playerId -> animState

  // Global music state
  beatTime: 0,
  bpm: 120,
  isMusicPlaying: false,
  lastBeatTimestamp: 0,
  beatInterval: 500, // ms between beats (120 BPM = 500ms)

  // Stage lighting
  stageLightColor: '#6366f1',
  stageLightPhase: 0,
  stageColors: ['#6366f1', '#ec4899', '#f59e0b', '#14b8a6', '#8b5cf6', '#ef4444'],

  /**
   * Initialize or get animation state for a player
   */
  getState(playerId) {
    if (!this.states.has(playerId)) {
      this.states.set(playerId, {
        frame: 0,
        frameTimer: 0,
        action: 'idle', // idle, walk, run
        idleTimer: 0,
        idleBreathOffset: 0,
        walkFrame: 0,
        lastX: 0,
        lastY: 0,
        isMoving: false,
        musicBounce: 0
      });
    }
    return this.states.get(playerId);
  },

  /**
   * Update animation state based on movement
   */
  update(playerId, x, y, isRunning) {
    const state = this.getState(playerId);
    const now = Date.now();

    const dx = x - state.lastX;
    const dy = y - state.lastY;
    const moved = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;

    if (moved) {
      state.isMoving = true;
      state.idleTimer = 0;
      state.action = isRunning ? 'run' : 'walk';

      // Walk cycle: 4 frames at 8 FPS (125ms per frame)
      const frameSpeed = isRunning ? 80 : 125;
      state.frameTimer += 16; // ~60fps update
      if (state.frameTimer >= frameSpeed) {
        state.frameTimer = 0;
        state.walkFrame = (state.walkFrame + 1) % 4;
      }
    } else {
      state.isMoving = false;
      state.idleTimer += 16;

      // Switch to idle after 1 second of no movement
      if (state.idleTimer > 1000) {
        state.action = 'idle';
        // Idle breathing: subtle bob at 2 FPS (500ms per frame)
        state.idleBreathOffset = Math.sin(now / 500) * 1.5;
      } else {
        state.action = 'idle';
        state.walkFrame = 0;
      }
    }

    // Music bounce (all players when music is playing)
    if (this.isMusicPlaying) {
      const beatProgress = ((now - this.lastBeatTimestamp) % this.beatInterval) / this.beatInterval;
      state.musicBounce = Math.sin(beatProgress * Math.PI) * 2;
    } else {
      state.musicBounce = 0;
    }

    state.lastX = x;
    state.lastY = y;
  },

  /**
   * Draw animated character
   */
  drawCharacter(ctx, player, state) {
    const x = player.x;
    let y = player.y;
    const color = player.color || '#6366f1';

    // Apply idle breathing offset
    if (state.action === 'idle') {
      y += state.idleBreathOffset;
    }

    // Apply music bounce
    y -= state.musicBounce;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(player.x + 4, player.y + 44, 24, 4);

    // ─── Body based on walk frame ─────────────────────────────────
    const frame = state.walkFrame;
    const isWalking = state.action === 'walk' || state.action === 'run';

    // Body
    ctx.fillStyle = color;
    ctx.fillRect(x + 8, y + 16, 16, 20);

    // Head
    ctx.fillStyle = '#f5d0a9';
    ctx.fillRect(x + 8, y + 4, 16, 14);

    // Hair/hat
    ctx.fillStyle = this.darkenColor(color, 40);
    ctx.fillRect(x + 6, y, 20, 6);

    // Eyes (direction-based)
    ctx.fillStyle = '#1a1a1a';
    if (player.direction === 'left') {
      ctx.fillRect(x + 10, y + 10, 3, 3);
    } else if (player.direction === 'right') {
      ctx.fillRect(x + 19, y + 10, 3, 3);
    } else {
      ctx.fillRect(x + 11, y + 10, 3, 3);
      ctx.fillRect(x + 18, y + 10, 3, 3);
    }

    // ─── Legs with walk cycle ─────────────────────────────────────
    ctx.fillStyle = '#2a2a4a';
    if (isWalking) {
      // 4-frame walk cycle
      const legOffsets = [
        { left: 0, right: 0 },    // frame 0: neutral
        { left: -3, right: 3 },   // frame 1: left forward
        { left: 0, right: 0 },    // frame 2: neutral
        { left: 3, right: -3 }    // frame 3: right forward
      ];
      const stride = state.action === 'run' ? 1.5 : 1;
      const offset = legOffsets[frame];
      ctx.fillRect(x + 9 + offset.left * stride, y + 36, 6, 10);
      ctx.fillRect(x + 17 + offset.right * stride, y + 36, 6, 10);
    } else {
      ctx.fillRect(x + 9, y + 36, 6, 10);
      ctx.fillRect(x + 17, y + 36, 6, 10);
    }

    // ─── Arms with swing ──────────────────────────────────────────
    ctx.fillStyle = color;
    if (isWalking) {
      const armSwing = Math.sin(frame * Math.PI / 2) * 4;
      ctx.fillRect(x + 4, y + 18 + armSwing, 4, 12);
      ctx.fillRect(x + 24, y + 18 - armSwing, 4, 12);
    } else {
      ctx.fillRect(x + 4, y + 18, 4, 12);
      ctx.fillRect(x + 24, y + 18, 4, 12);
    }
  },

  /**
   * Update music beat state
   */
  setBeat(bpm) {
    this.bpm = bpm || 120;
    this.beatInterval = 60000 / this.bpm;
    this.lastBeatTimestamp = Date.now();
    this.isMusicPlaying = true;
  },

  /**
   * Stop music reactive animations
   */
  stopMusic() {
    this.isMusicPlaying = false;
  },

  /**
   * Update stage lighting (call every frame)
   */
  updateStageLighting(ctx, stageX, stageY, stageW) {
    if (!this.isMusicPlaying) return;

    const now = Date.now();

    // Change color every 4-8 beats
    const colorChangeInterval = this.beatInterval * 6;
    const colorIndex = Math.floor(now / colorChangeInterval) % this.stageColors.length;
    this.stageLightColor = this.stageColors[colorIndex];

    // Pulsing glow behind stage
    const pulse = 0.3 + Math.sin(now / (this.beatInterval / 2)) * 0.15;
    ctx.fillStyle = this.hexToRgba(this.stageLightColor, pulse);
    ctx.fillRect(stageX - 20, stageY - 30, stageW + 40, 80);

    // Speaker pulse
    const speakerScale = 1 + Math.sin(now / (this.beatInterval / 2)) * 0.1;
    ctx.fillStyle = this.stageLightColor;
    ctx.fillRect(stageX + 5, stageY + 10, 20 * speakerScale, 20 * speakerScale);
    ctx.fillRect(stageX + stageW - 25, stageY + 10, 20 * speakerScale, 20 * speakerScale);
  },

  /**
   * Draw floating music notes from stage
   */
  drawMusicNotes(ctx, stageX, stageY, stageW) {
    if (!this.isMusicPlaying) return;

    const now = Date.now();
    const notes = ['♪', '♫', '♬'];

    for (let i = 0; i < 5; i++) {
      const t = ((now + i * 700) % 3000) / 3000; // 0 to 1 cycle
      const noteX = stageX + (i * stageW / 5) + Math.sin(now / 1000 + i) * 10;
      const noteY = stageY - 10 - t * 60;
      const alpha = 1 - t;

      if (alpha > 0) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.stageLightColor;
        ctx.font = '14px serif';
        ctx.fillText(notes[i % notes.length], noteX, noteY);
        ctx.globalAlpha = 1;
      }
    }
  },

  /**
   * Draw song transition ripple effect
   */
  drawTransitionRipple(ctx, centerX, centerY, startTime) {
    const elapsed = Date.now() - startTime;
    if (elapsed > 1000) return false; // Done after 1 second

    const progress = elapsed / 1000;
    const radius = progress * 200;
    const alpha = 1 - progress;

    ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
    ctx.lineWidth = 3 - progress * 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    return true; // Still animating
  },

  /**
   * Draw proximity glow around a player
   */
  drawProximityGlow(ctx, player, intensity) {
    if (intensity <= 0) return;

    const x = player.x - 4;
    const y = player.y - 4;
    const w = 40;
    const h = 56;

    ctx.strokeStyle = `rgba(99, 102, 241, ${intensity * 0.6})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = '#6366f1';
    ctx.shadowBlur = 8 * intensity;
    ctx.strokeRect(x, y, w, h);
    ctx.shadowBlur = 0;
  },

  // ─── Utility ─────────────────────────────────────────────────────
  darkenColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    let r = Math.max(0, (num >> 16) - amount);
    let g = Math.max(0, ((num >> 8) & 0x00FF) - amount);
    let b = Math.max(0, (num & 0x0000FF) - amount);
    return `rgb(${r},${g},${b})`;
  },

  hexToRgba(hex, alpha) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  },

  /**
   * Remove state when player leaves
   */
  removePlayer(playerId) {
    this.states.delete(playerId);
  }
};

// Export for use in app.js
if (typeof window !== 'undefined') {
  window.AnimationEngine = AnimationEngine;
}
