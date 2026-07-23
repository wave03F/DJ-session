const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { createError } = require('../middleware/errorHandler');

/**
 * Add song to room queue
 */
async function addSong(roomId, { videoId, title, userId, nickname }) {
  // Get next position
  const lastSong = await db('music_queue')
    .where({ room_id: roomId, is_played: false })
    .orderBy('position', 'desc')
    .first();

  const position = lastSong ? lastSong.position + 1 : 1;

  const song = {
    id: uuidv4(),
    room_id: roomId,
    video_id: videoId,
    title: title || 'Unknown Track',
    added_by: userId || null,
    added_by_nickname: nickname,
    upvotes: 0,
    position,
    is_playing: false,
    is_played: false,
    created_at: new Date()
  };

  await db('music_queue').insert(song);

  return song;
}

/**
 * Get current playing song for a room
 */
async function getCurrentSong(roomId) {
  return db('music_queue')
    .where({ room_id: roomId, is_playing: true })
    .first();
}

/**
 * Get queue for a room (ordered by upvotes desc, then position asc)
 */
async function getQueue(roomId) {
  return db('music_queue')
    .where({ room_id: roomId, is_played: false, is_playing: false })
    .orderBy('upvotes', 'desc')
    .orderBy('position', 'asc');
}

/**
 * Play next song in queue
 * Returns the song that started playing, or null if queue empty
 */
async function playNext(roomId) {
  // Mark current as played
  await db('music_queue')
    .where({ room_id: roomId, is_playing: true })
    .update({ is_playing: false, is_played: true });

  // Clear skip votes for the room
  await db('skip_votes').where({ room_id: roomId }).del();

  // Get next song (highest upvotes first, then position)
  const nextSong = await db('music_queue')
    .where({ room_id: roomId, is_played: false, is_playing: false })
    .orderBy('upvotes', 'desc')
    .orderBy('position', 'asc')
    .first();

  if (!nextSong) return null;

  // Mark as playing
  await db('music_queue').where({ id: nextSong.id }).update({
    is_playing: true,
    started_at: new Date()
  });

  return { ...nextSong, is_playing: true, started_at: new Date() };
}

/**
 * Vote to skip current song
 * Returns { voted, skipped, currentVotes, neededVotes }
 */
async function voteSkip(roomId, { userId, socketId }) {
  const currentSong = await getCurrentSong(roomId);
  if (!currentSong) throw createError('No song is playing', 400);

  // Check if already voted
  const existingVote = await db('skip_votes')
    .where({ song_id: currentSong.id })
    .andWhere(function() {
      if (userId) this.where({ user_id: userId });
      else this.where({ socket_id: socketId });
    })
    .first();

  if (existingVote) {
    throw createError('Already voted to skip', 400);
  }

  // Add vote
  await db('skip_votes').insert({
    id: uuidv4(),
    room_id: roomId,
    song_id: currentSong.id,
    user_id: userId || null,
    socket_id: socketId || null,
    created_at: new Date()
  });

  // Count votes vs active players
  const voteCount = await db('skip_votes')
    .where({ song_id: currentSong.id })
    .count('* as count')
    .first();

  const playerCount = await db('room_players')
    .where({ room_id: roomId, status: 'active' })
    .count('* as count')
    .first();

  const currentVotes = parseInt(voteCount.count);
  const totalPlayers = Math.max(1, parseInt(playerCount.count));
  const neededVotes = Math.ceil(totalPlayers * 0.5);

  // Skip if > 50%
  if (currentVotes >= neededVotes) {
    const nextSong = await playNext(roomId);
    return { voted: true, skipped: true, currentVotes, neededVotes, nextSong };
  }

  return { voted: true, skipped: false, currentVotes, neededVotes };
}

/**
 * Upvote a song in queue (reorders queue)
 */
async function upvoteSong(songId, { userId, socketId }) {
  const song = await db('music_queue').where({ id: songId, is_played: false, is_playing: false }).first();
  if (!song) throw createError('Song not found or already playing', 404);

  // Check if already upvoted
  const existing = await db('song_upvotes')
    .where({ song_id: songId })
    .andWhere(function() {
      if (userId) this.where({ user_id: userId });
      else this.where({ socket_id: socketId });
    })
    .first();

  if (existing) throw createError('Already upvoted this song', 400);

  // Add upvote
  await db('song_upvotes').insert({
    id: uuidv4(),
    song_id: songId,
    user_id: userId || null,
    socket_id: socketId || null,
    created_at: new Date()
  });

  // Increment upvote count on song
  await db('music_queue').where({ id: songId }).increment('upvotes', 1);

  // Return updated queue
  return getQueue(song.room_id);
}

module.exports = {
  addSong,
  getCurrentSong,
  getQueue,
  playNext,
  voteSkip,
  upvoteSong
};
