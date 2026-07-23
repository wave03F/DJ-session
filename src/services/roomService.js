const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { createError } = require('../middleware/errorHandler');

/**
 * Create a new room (Premium/Admin only)
 */
async function createRoom(userId, { title, description, genreTags, maxCapacity, scheduledAt }) {
  const user = await db('users').where({ id: userId }).first();
  if (!user.is_premium) {
    throw createError('Only Premium users can create rooms', 403);
  }

  const room = {
    id: uuidv4(),
    title: title.trim(),
    description: description?.trim() || null,
    created_by: userId,
    genre_tags: genreTags || [],
    max_capacity: Math.min(maxCapacity || 100, 100),
    is_scheduled: !!scheduledAt,
    scheduled_at: scheduledAt || null,
    is_active: !scheduledAt, // Scheduled rooms start inactive until time
    last_activity_at: new Date(),
    created_at: new Date()
  };

  await db('rooms').insert(room);
  return room;
}

/**
 * Get list of active and upcoming rooms
 */
async function listRooms({ limit = 20, offset = 0 } = {}) {
  const rooms = await db('rooms')
    .where({ is_active: true })
    .orWhere(function() {
      this.where({ is_scheduled: true }).whereNull('closed_at');
    })
    .orderBy('last_activity_at', 'desc')
    .limit(limit)
    .offset(offset);

  // Add player count for each room
  const result = [];
  for (const room of rooms) {
    const playerCount = await db('room_players')
      .where({ room_id: room.id, status: 'active' })
      .count('* as count')
      .first();

    result.push({
      ...room,
      playerCount: parseInt(playerCount.count)
    });
  }

  return result;
}

/**
 * Get room details
 */
async function getRoom(roomId) {
  const room = await db('rooms').where({ id: roomId }).first();
  if (!room) throw createError('Room not found', 404);

  const playerCount = await db('room_players')
    .where({ room_id: roomId, status: 'active' })
    .count('* as count')
    .first();

  const currentSong = await db('music_queue')
    .where({ room_id: roomId, is_playing: true })
    .first();

  const queue = await db('music_queue')
    .where({ room_id: roomId, is_played: false, is_playing: false })
    .orderBy('upvotes', 'desc')
    .orderBy('position', 'asc');

  return {
    ...room,
    playerCount: parseInt(playerCount.count),
    currentSong,
    queue
  };
}

/**
 * Join a room — add player to room_players
 */
async function joinRoom(roomId, { userId, socketId, nickname }) {
  const room = await db('rooms').where({ id: roomId, is_active: true }).first();
  if (!room) throw createError('Room not found or closed', 404);

  // Check capacity
  const playerCount = await db('room_players')
    .where({ room_id: roomId, status: 'active' })
    .count('* as count')
    .first();

  if (parseInt(playerCount.count) >= room.max_capacity) {
    throw createError('Room is full', 403);
  }

  // Check if already in room (reconnection)
  if (userId) {
    const existing = await db('room_players')
      .where({ room_id: roomId, user_id: userId })
      .first();

    if (existing) {
      // Reconnection — update socket and status
      await db('room_players').where({ id: existing.id }).update({
        socket_id: socketId,
        status: 'active',
        disconnected_at: null
      });
      return { ...existing, reconnected: true };
    }
  }

  // Spawn position
  const spawn = {
    x: 200 + Math.floor(Math.random() * 300),
    y: 400 + Math.floor(Math.random() * 200)
  };

  const player = {
    id: uuidv4(),
    room_id: roomId,
    user_id: userId || null,
    socket_id: socketId,
    nickname: nickname,
    x: spawn.x,
    y: spawn.y,
    direction: 'down',
    status: 'active',
    joined_at: new Date()
  };

  await db('room_players').insert(player);

  // Update room activity
  await db('rooms').where({ id: roomId }).update({ last_activity_at: new Date() });

  return player;
}

/**
 * Leave a room
 */
async function leaveRoom(roomId, socketId) {
  await db('room_players')
    .where({ room_id: roomId, socket_id: socketId })
    .del();

  // Check if room is now empty — start auto-close timer tracked by last_activity
  const remaining = await db('room_players')
    .where({ room_id: roomId, status: 'active' })
    .count('* as count')
    .first();

  if (parseInt(remaining.count) === 0) {
    await db('rooms').where({ id: roomId }).update({ last_activity_at: new Date() });
  }
}

/**
 * Mark player as disconnected (grace period of 60 seconds)
 */
async function markDisconnected(socketId) {
  await db('room_players')
    .where({ socket_id: socketId, status: 'active' })
    .update({ status: 'disconnected', disconnected_at: new Date() });
}

/**
 * Clean up stale disconnected players (older than 60 seconds)
 */
async function cleanupDisconnectedPlayers() {
  const cutoff = new Date(Date.now() - 60 * 1000);
  await db('room_players')
    .where({ status: 'disconnected' })
    .where('disconnected_at', '<', cutoff)
    .del();
}

/**
 * Auto-close empty rooms (no activity for 10 minutes)
 */
async function autoCloseEmptyRooms() {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);

  const emptyRooms = await db('rooms')
    .where({ is_active: true })
    .where('last_activity_at', '<', cutoff)
    .whereNotExists(function() {
      this.select('*').from('room_players')
        .whereRaw('room_players.room_id = rooms.id')
        .where({ status: 'active' });
    });

  for (const room of emptyRooms) {
    await db('rooms').where({ id: room.id }).update({
      is_active: false,
      closed_at: new Date()
    });
  }

  return emptyRooms.length;
}

module.exports = {
  createRoom,
  listRooms,
  getRoom,
  joinRoom,
  leaveRoom,
  markDisconnected,
  cleanupDisconnectedPlayers,
  autoCloseEmptyRooms
};
