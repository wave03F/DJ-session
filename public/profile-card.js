// ─── Profile Card UI + Proximity Discovery ──────────────────────────────────
// Handles: proximity indicators, Profile Card overlay, Like/Pass buttons,
// interest glow, VIP zone, couple emotes, spotlight effects

const ProfileCard = {
  isOpen: false,
  data: null, // current profile card data
  nearbyPlayers: [], // players within 64px
  closestPlayer: null, // nearest player for E prompt
  vipPlayers: new Set(), // players with VIP status
  spotlightEffects: [], // active spotlight effects
  coupleEmotes: [], // active couple emote animations

  // ─── Profile Card Overlay ──────────────────────────────────────
  open(profileData) {
    this.data = profileData;
    this.isOpen = true;
    this.renderOverlay();
  },

  close() {
    this.isOpen = false;
    this.data = null;
    const el = document.getElementById('profile-card-overlay');
    if (el) el.classList.add('hidden');
  },

  renderOverlay() {
    let el = document.getElementById('profile-card-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'profile-card-overlay';
      el.className = 'profile-card-overlay';
      document.getElementById('game-container').appendChild(el);
    }

    const d = this.data;
    const sharedGenresHtml = d.sharedGenres?.length > 0
      ? `<div class="pc-shared"><span class="pc-match-icon">♪</span> ${d.sharedGenres.length} shared genres: ${d.sharedGenres.join(', ')}</div>`
      : '';

    const photosHtml = d.photos?.length > 0
      ? `<div class="pc-photos"><img src="${d.photos[0]}" alt="photo" class="pc-photo-main"></div>`
      : '<div class="pc-photos pc-no-photo">No photo</div>';

    const statusBadge = d.relationshipStatus === 'in_relationship'
      ? '<span class="pc-badge pc-badge-taken">❤️ In Relationship</span>'
      : '<span class="pc-badge pc-badge-single">Single</span>';

    const premiumBadge = d.isPremium ? '<span class="pc-badge pc-badge-premium">⭐ Premium</span>' : '';

    let actionButtons = '';
    if (d.isMatched) {
      actionButtons = '<button class="pc-btn pc-btn-matched" disabled>✓ Matched</button>';
    } else if (d.alreadyLiked) {
      actionButtons = '<button class="pc-btn pc-btn-liked" disabled>♥ Liked</button>';
    } else {
      actionButtons = `
        <button class="pc-btn pc-btn-like" onclick="ProfileCard.handleLike()">♥ Like</button>
        <button class="pc-btn pc-btn-pass" onclick="ProfileCard.handlePass()">✗ Pass</button>
      `;
    }

    el.innerHTML = `
      <div class="pc-card">
        <button class="pc-close" onclick="ProfileCard.close()">✕</button>
        ${photosHtml}
        <div class="pc-info">
          <h3 class="pc-name">${escapeHtml(d.displayName)}${d.age ? ', ' + d.age : ''}</h3>
          <div class="pc-badges">${statusBadge} ${premiumBadge}</div>
          <p class="pc-bio">${escapeHtml(d.bio || 'No bio yet')}</p>
          <div class="pc-genres">${d.genres?.map(g => `<span class="pc-genre">${g}</span>`).join('') || ''}</div>
          ${sharedGenresHtml}
        </div>
        <div class="pc-actions">${actionButtons}</div>
      </div>
    `;
    el.classList.remove('hidden');
  },

  handleLike() {
    if (!this.data || !socket) return;
    socket.emit('like-from-card', { targetUserId: this.data.userId });
    // Optimistic UI update
    this.data.alreadyLiked = true;
    this.renderOverlay();
  },

  handlePass() {
    if (!this.data || !socket) return;
    socket.emit('pass-from-card', { targetUserId: this.data.userId });
    this.close();
  },

  // ─── Proximity Detection (called every frame) ─────────────────
  updateNearby(nearbyList) {
    this.nearbyPlayers = nearbyList || [];
    // Find closest authenticated player
    this.closestPlayer = this.nearbyPlayers.length > 0
      ? this.nearbyPlayers.reduce((a, b) => a.distance < b.distance ? a : b)
      : null;
  },

  // ─── Draw proximity indicator ("Press E") above nearest player ─
  drawProximityPrompt(ctx, camera) {
    if (!this.closestPlayer || this.isOpen) return;

    const targetPlayer = players.get(this.closestPlayer.socketId);
    if (!targetPlayer) return;

    const x = targetPlayer.x - camera.x;
    const y = targetPlayer.y - camera.y;

    // Pulsing "Press E" indicator
    const pulse = 0.7 + Math.sin(Date.now() / 300) * 0.3;

    ctx.save();
    ctx.globalAlpha = pulse;

    // Background pill
    ctx.fillStyle = 'rgba(99, 102, 241, 0.85)';
    const text = 'Press E';
    ctx.font = 'bold 10px monospace';
    const textW = ctx.measureText(text).width;
    ctx.fillRect(x + 16 - textW / 2 - 6, y - 24, textW + 12, 16);

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x + 16 - textW / 2, y - 12);

    ctx.restore();
  },

  // ─── Draw interest indicator (glow for shared genres ≥3) ───────
  drawInterestGlow(ctx, camera) {
    this.nearbyPlayers.forEach(np => {
      // Only glow if we have shared genre data (checked server-side on profile-card request)
      // For now, draw glow on all nearby players as a subtle indicator
      const targetPlayer = players.get(np.socketId);
      if (!targetPlayer) return;

      const x = targetPlayer.x - camera.x;
      const y = targetPlayer.y - camera.y;

      // Subtle glow outline
      const intensity = Math.min(1, (64 - np.distance) / 64);
      if (intensity > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(99, 102, 241, ${intensity * 0.4})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = '#6366f1';
        ctx.shadowBlur = 6 * intensity;
        ctx.strokeRect(x - 2, y - 2, 36, 52);
        ctx.restore();
      }
    });
  },

  // ─── VIP Area Rendering ────────────────────────────────────────
  drawVipArea(ctx, camera) {
    const vip = { x: 900, y: 300, width: 200, height: 150 };
    const x = vip.x - camera.x;
    const y = vip.y - camera.y;

    // VIP zone background
    ctx.save();
    ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
    ctx.fillRect(x, y, vip.width, vip.height);

    // VIP border (dashed golden)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(x, y, vip.width, vip.height);
    ctx.setLineDash([]);

    // VIP label
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('⭐ VIP AREA', x + vip.width / 2 - 40, y - 6);
    ctx.restore();
  },

  // ─── VIP Badge on players ──────────────────────────────────────
  drawVipBadge(ctx, playerObj, camera) {
    if (!this.vipPlayers.has(playerObj.id)) return;
    const x = playerObj.x - camera.x;
    const y = playerObj.y - camera.y;
    ctx.fillStyle = '#f59e0b';
    ctx.font = '8px monospace';
    ctx.fillText('⭐VIP', x + 2, y - 2);
  },

  // ─── Spotlight Effects ─────────────────────────────────────────
  addSpotlight(data) {
    this.spotlightEffects.push({ ...data, startTime: Date.now() });
  },

  drawSpotlights(ctx, camera) {
    const now = Date.now();
    for (let i = this.spotlightEffects.length - 1; i >= 0; i--) {
      const sp = this.spotlightEffects[i];
      const elapsed = now - sp.startTime;
      if (elapsed > 3000) {
        this.spotlightEffects.splice(i, 1);
        continue;
      }

      const progress = elapsed / 3000;
      const alpha = 1 - progress;
      const x = sp.x - camera.x;
      const y = sp.y - camera.y;

      ctx.save();
      ctx.globalAlpha = alpha;

      if (sp.effectType === 'fireworks') {
        for (let j = 0; j < 8; j++) {
          const angle = (j / 8) * Math.PI * 2 + progress * 2;
          const dist = progress * 60;
          const px = x + 16 + Math.cos(angle) * dist;
          const py = y + Math.sin(angle) * dist;
          ctx.fillStyle = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3'][j % 4];
          ctx.fillRect(px - 3, py - 3, 6, 6);
        }
      } else if (sp.effectType === 'hearts') {
        for (let j = 0; j < 6; j++) {
          const angle = (j / 6) * Math.PI * 2;
          const dist = progress * 50;
          ctx.font = '16px serif';
          ctx.fillText('❤️', x + 10 + Math.cos(angle) * dist, y - 10 + Math.sin(angle) * dist - progress * 30);
        }
      } else if (sp.effectType === 'stars') {
        for (let j = 0; j < 10; j++) {
          const sx = x + 16 + (Math.random() - 0.5) * 80 * progress;
          const sy = y - progress * 50 + (Math.random() - 0.5) * 40;
          ctx.fillStyle = '#ffd700';
          ctx.font = '12px serif';
          ctx.fillText('⭐', sx, sy);
        }
      } else if (sp.effectType === 'confetti') {
        for (let j = 0; j < 12; j++) {
          const cx = x + 16 + (Math.sin(j * 1.3 + elapsed / 200)) * progress * 60;
          const cy = y - 20 + progress * 40 + Math.cos(j * 0.7) * 20;
          ctx.fillStyle = ['#ff6b6b', '#4ade80', '#60a5fa', '#fbbf24', '#a78bfa'][j % 5];
          ctx.fillRect(cx, cy, 4, 4);
        }
      }

      // Nickname label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(sp.nickname + ' ✨', x + 16, y - 30 - progress * 20);
      ctx.textAlign = 'left';

      ctx.restore();
    }
  },

  // ─── Couple Emote Animations ───────────────────────────────────
  addCoupleEmote(data) {
    this.coupleEmotes.push({ ...data, startTime: Date.now() });
  },

  drawCoupleEmotes(ctx, camera) {
    const now = Date.now();
    for (let i = this.coupleEmotes.length - 1; i >= 0; i--) {
      const ce = this.coupleEmotes[i];
      const elapsed = now - ce.startTime;
      if (elapsed > 3000) {
        this.coupleEmotes.splice(i, 1);
        continue;
      }

      const progress = elapsed / 3000;
      const alpha = 1 - progress;
      const x = ce.x - camera.x;
      const y = ce.y - camera.y;

      ctx.save();
      ctx.globalAlpha = alpha;

      if (ce.emoteType === 'heart_link') {
        // Hearts floating up between the two players
        for (let j = 0; j < 5; j++) {
          const hy = y - progress * 40 - j * 12;
          const hx = x + Math.sin(now / 300 + j) * 10;
          ctx.font = '14px serif';
          ctx.fillText('💕', hx, hy);
        }
      } else if (ce.emoteType === 'dance_together') {
        // Musical notes spinning around
        for (let j = 0; j < 4; j++) {
          const angle = (now / 500) + j * Math.PI / 2;
          const dist = 20 + Math.sin(now / 300) * 5;
          ctx.font = '12px serif';
          ctx.fillText('♪', x + Math.cos(angle) * dist, y + Math.sin(angle) * dist);
        }
      } else if (ce.emoteType === 'couple_spin') {
        ctx.font = '20px serif';
        ctx.fillText('💫', x + Math.cos(now / 200) * 15, y + Math.sin(now / 200) * 15);
      } else if (ce.emoteType === 'hug') {
        ctx.font = '18px serif';
        const bounce = Math.sin(now / 400) * 3;
        ctx.fillText('🤗', x, y - 20 + bounce);
      }

      ctx.restore();
    }
  }
};

// ─── Keyboard shortcut: Press E for Profile Card ─────────────────────────────
document.addEventListener('keydown', (e) => {
  if (document.activeElement === document.getElementById('chat-input') ||
      document.activeElement === document.getElementById('song-url-input')) return;

  if (e.key === 'e' || e.key === 'E') {
    if (ProfileCard.isOpen) {
      ProfileCard.close();
    } else if (ProfileCard.closestPlayer && socket) {
      socket.emit('request-profile', { targetSocketId: ProfileCard.closestPlayer.socketId });
    }
  }
});

// Make it globally accessible
if (typeof window !== 'undefined') {
  window.ProfileCard = ProfileCard;
}
