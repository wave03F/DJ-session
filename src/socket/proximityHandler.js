const db = require('../config/database');
const { findSocketByUserId } = require('./chatHandler');

const PROXIMITY_ZONE = 64; // pixels
const PROXIMITY_CHAT_RADIUS = 150; // pixels

// VIP Area bounds (on the map)
const VIP_AREA = { x: 900, y: 300, width: 200, height: 150 };

/**
 * Register proximity-based discovery and interaction events
 */
function registerProximityEvents(io, socket, players) {

  /**
   * request-profile — User presses E near another player
   * Server checks proximity + returns profile data for the Profile Card
   */
  socket.on('request-profile', async (data) => {
    if (socket.user.is_guest) {
      return socket.emit('profile-card-error', { error: 'Login required to view profiles' });
    }

    const myPlayer = players.get(socket.id);
    if (!myPlayer) return;

    const { targetSocketId } = data;
    const targetPlayer = players.get(targetSocketId);
    if (!targetPlayer) {
      return socket.emit('profile-card-error', { error: 'Player not found' });
    }

    // Check proximity (64px)
    const dist = getDistance(myPlayer, targetPlayer);
    if (dist > PROXIMITY_ZONE) {
      return socket.emit('profile-card-error', { error: 'Too far away. Move closer.' });
    }

    // Target must be authenticated
    if (!targetPlayer.userId) {
      return socket.emit('profile-card-error', { error: 'Guest players do not have profiles' });
    }

    try {
      // Load profile data
      const profile = await db('profiles').where({ user_id: targetPlayer.userId }).first();
      const photos = profile ? await db('profile_photos')
        .where({ profile_id: profile.id })
        .orderBy('position', 'asc')
        .select('url', 'position') : [];
      const genres = await db('user_genres').where({ user_id: targetPlayer.userId }).pluck('genre');
      const user = await db('users').where({ id: targetPlayer.userId })
        .select('id', 'nickname', 'date_of_birth', 'is_premium').first();

      // Get viewer's genres to calculate shared interests
      const myGenres = await db('user_genres').where({ user_id: socket.user.id }).pluck('genre');
      const sharedGenres = genres.filter(g => myGenres.includes(g));

      // Check if already liked
      const existingLike = await db('likes')
        .where({ liker_id: socket.user.id, liked_id: targetPlayer.userId })
        .first();

      // Check if already matched
      const existingMatch = await db('matches')
        .where({ is_active: true })
        .andWhere(function() {
          this.where({ user1_id: socket.user.id, user2_id: targetPlayer.userId })
            .orWhere({ user1_id: targetPlayer.userId, user2_id: socket.user.id });
        })
        .first();

      // Check relationship status
      const relStatus = profile?.relationship_status || 'single';

      // Calculate age
      const age = user?.date_of_birth ? calculateAge(new Date(user.date_of_birth)) : null;

      socket.emit('profile-card', {
        userId: targetPlayer.userId,
        socketId: targetSocketId,
        displayName: profile?.display_name || user?.nickname || 'User',
        age,
        bio: profile?.bio || '',
        gender: profile?.gender,
        relationshipStatus: relStatus,
        genres,
        sharedGenres,
        photos: photos.map(p => p.url),
        isPremium: user?.is_premium || false,
        alreadyLiked: !!existingLike,
        isMatched: !!existingMatch,
        matchId: existingMatch?.id || null
      });
    } catch (err) {
      socket.emit('profile-card-error', { error: 'Failed to load profile' });
    }
  });

  /**
   * proximity-chat — Send message to players within 150px radius only
   */
  socket.on('proximity-chat', (data) => {
    const myPlayer = players.get(socket.id);
    if (!myPlayer || !data.message) return;

    const message = data.message.substring(0, 150);

    // Find all players within 150px
    players.forEach((p, sid) => {
      if (sid === socket.id) return;
      const dist = getDistance(myPlayer, p);
      if (dist <= PROXIMITY_CHAT_RADIUS) {
        const targetSocket = io.sockets.sockets.get(sid);
        if (targetSocket) {
          targetSocket.emit('proximity-chat', {
            playerId: socket.id,
            nickname: myPlayer.nickname,
            message
          });
        }
      }
    });
  });

  /**
   * couple-emote — Trigger special emote (only between matched users in proximity)
   */
  socket.on('couple-emote', async (data) => {
    if (socket.user.is_guest) return;

    const myPlayer = players.get(socket.id);
    if (!myPlayer) return;

    const { targetSocketId, emoteType } = data;
    const targetPlayer = players.get(targetSocketId);
    if (!targetPlayer || !targetPlayer.userId) return;

    // Check proximity
    const dist = getDistance(myPlayer, targetPlayer);
    if (dist > PROXIMITY_ZONE) return;

    // Verify they are matched
    const match = await db('matches')
      .where({ is_active: true })
      .andWhere(function() {
        this.where({ user1_id: socket.user.id, user2_id: targetPlayer.userId })
          .orWhere({ user1_id: targetPlayer.userId, user2_id: socket.user.id });
      })
      .first();

    if (!match) {
      return socket.emit('couple-emote-error', { error: 'Must be matched to use couple emotes' });
    }

    const validCoupleEmotes = ['heart_link', 'dance_together', 'couple_spin', 'hug'];
    if (!validCoupleEmotes.includes(emoteType)) return;

    // Broadcast to both players + nearby viewers
    io.emit('couple-emote', {
      player1Id: socket.id,
      player2Id: targetSocketId,
      emoteType,
      x: (myPlayer.x + targetPlayer.x) / 2,
      y: (myPlayer.y + targetPlayer.y) / 2
    });
  });

  /**
   * enter-vip — Check VIP access when entering VIP zone
   */
  socket.on('enter-vip', async () => {
    if (socket.user.is_guest) {
      return socket.emit('vip-denied', { error: 'Login required for VIP area' });
    }

    const user = await db('users').where({ id: socket.user.id }).first();
    if (!user.is_premium) {
      return socket.emit('vip-denied', {
        error: 'Premium membership required for VIP area',
        upgradeUrl: '/api/payments/subscribe'
      });
    }

    socket.emit('vip-granted', { message: 'Welcome to the VIP area!' });
    // Broadcast VIP badge to other players
    io.emit('player-vip-status', { playerId: socket.id, isVip: true });
  });

  /**
   * leave-vip — Remove VIP badge when leaving zone
   */
  socket.on('leave-vip', () => {
    io.emit('player-vip-status', { playerId: socket.id, isVip: false });
  });

  /**
   * spotlight — Trigger spotlight effect (visible to all, Premium only)
   */
  socket.on('spotlight', async (data) => {
    if (socket.user.is_guest) return;

    const user = await db('users').where({ id: socket.user.id }).first();
    if (!user.is_premium) {
      return socket.emit('spotlight-denied', { error: 'Premium required for spotlight' });
    }

    const myPlayer = players.get(socket.id);
    if (!myPlayer) return;

    const effectType = data?.effectType || 'fireworks';
    const validEffects = ['fireworks', 'hearts', 'stars', 'confetti'];
    if (!validEffects.includes(effectType)) return;

    io.emit('spotlight-effect', {
      playerId: socket.id,
      nickname: myPlayer.nickname,
      effectType,
      x: myPlayer.x,
      y: myPlayer.y
    });
  });

  /**
   * like-from-card — User clicked Like on Profile Card
   */
  socket.on('like-from-card', async (data) => {
    if (socket.user.is_guest || !data.targetUserId) return;
    try {
      const matchService = require('../services/matchService');
      const result = await matchService.likeUser(socket.user.id, data.targetUserId);

      socket.emit('like-result', result);

      // If matched, notify both
      if (result.matched) {
        const targetSocket = findSocketByUserId(io, data.targetUserId);
        if (targetSocket) {
          targetSocket.emit('match-created', {
            matchId: result.match.id,
            partnerId: socket.user.id,
            partnerNickname: socket.user.nickname,
            conversationId: result.match.conversationId
          });
        }
        socket.emit('match-created', {
          matchId: result.match.id,
          partnerId: data.targetUserId,
          conversationId: result.match.conversationId
        });
      }
    } catch (err) {
      socket.emit('like-error', { error: err.message });
    }
  });

  /**
   * pass-from-card — User clicked Pass on Profile Card
   */
  socket.on('pass-from-card', async (data) => {
    if (socket.user.is_guest || !data.targetUserId) return;
    try {
      const matchService = require('../services/matchService');
      await matchService.passUser(socket.user.id, data.targetUserId);
    } catch (err) {
      // Silent fail for pass
    }
  });
}

/**
 * Get nearby players for a given player (within proximity zone)
 * Used by the client to show interaction indicators
 */
function getNearbyPlayers(playerId, players) {
  const me = players.get(playerId);
  if (!me) return [];

  const nearby = [];
  players.forEach((p, sid) => {
    if (sid === playerId) return;
    const dist = getDistance(me, p);
    if (dist <= PROXIMITY_ZONE) {
      nearby.push({ socketId: sid, userId: p.userId, nickname: p.nickname, distance: dist });
    }
  });
  return nearby;
}

/**
 * Check if a player is inside the VIP area
 */
function isInVipArea(player) {
  return player.x >= VIP_AREA.x &&
    player.x <= VIP_AREA.x + VIP_AREA.width &&
    player.y >= VIP_AREA.y &&
    player.y <= VIP_AREA.y + VIP_AREA.height;
}

function getDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function calculateAge(dob) {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

module.exports = { registerProximityEvents, getNearbyPlayers, isInVipArea, VIP_AREA, PROXIMITY_ZONE };
