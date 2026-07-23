const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { createError } = require('../middleware/errorHandler');

const FREE_DAILY_LIKES = 20;

/**
 * Like another user — check for mutual match
 * Returns { liked: true, matched: boolean, match?: object }
 */
async function likeUser(likerId, likedId) {
  if (likerId === likedId) {
    throw createError('Cannot like yourself', 400);
  }

  // Check if target user exists
  const target = await db('users').where({ id: likedId, is_suspended: false }).first();
  if (!target) throw createError('User not found', 404);

  // Check if blocked (either direction)
  const blocked = await db('blocks')
    .where(function() {
      this.where({ blocker_id: likerId, blocked_id: likedId })
        .orWhere({ blocker_id: likedId, blocked_id: likerId });
    })
    .first();
  if (blocked) throw createError('Cannot interact with this user', 403);

  // Check if target is "In a Relationship" — exclude from matching
  const targetProfile = await db('profiles').where({ user_id: likedId }).first();
  if (targetProfile && targetProfile.relationship_status === 'in_relationship') {
    throw createError('This user is not available for matching', 400);
  }

  // Check daily like limit (free users)
  const liker = await db('users').where({ id: likerId }).first();
  if (!liker.is_premium) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayLikes = await db('likes')
      .where({ liker_id: likerId })
      .where('created_at', '>=', todayStart)
      .count('* as count')
      .first();

    if (parseInt(todayLikes.count) >= FREE_DAILY_LIKES) {
      throw createError(`Daily like limit reached (${FREE_DAILY_LIKES}). Upgrade to Premium for unlimited likes.`, 429);
    }
  }

  // Check if already liked (ignore duplicate)
  const existingLike = await db('likes').where({ liker_id: likerId, liked_id: likedId }).first();
  if (existingLike) {
    return { liked: true, matched: false, message: 'Already liked this user' };
  }

  // Insert like
  await db('likes').insert({
    id: uuidv4(),
    liker_id: likerId,
    liked_id: likedId,
    created_at: new Date()
  });

  // Check for mutual like (match!)
  const reciprocal = await db('likes').where({ liker_id: likedId, liked_id: likerId }).first();

  if (reciprocal) {
    // Create match
    const matchId = uuidv4();
    const [user1, user2] = [likerId, likedId].sort(); // deterministic order

    await db('matches').insert({
      id: matchId,
      user1_id: user1,
      user2_id: user2,
      is_active: true,
      matched_at: new Date()
    });

    // Create conversation for DM
    const convoId = uuidv4();
    await db('conversations').insert({
      id: convoId,
      match_id: matchId,
      user1_id: user1,
      user2_id: user2,
      is_active: true,
      created_at: new Date()
    });

    // Create notifications for both users
    await db('notifications').insert([
      {
        id: uuidv4(),
        user_id: likerId,
        type: 'match',
        data: JSON.stringify({ matchId, partnerId: likedId }),
        created_at: new Date()
      },
      {
        id: uuidv4(),
        user_id: likedId,
        type: 'match',
        data: JSON.stringify({ matchId, partnerId: likerId }),
        created_at: new Date()
      }
    ]);

    return {
      liked: true,
      matched: true,
      match: { id: matchId, partnerId: likedId, conversationId: convoId }
    };
  }

  return { liked: true, matched: false };
}

/**
 * Pass (reject) a user — hide for 30 days
 */
async function passUser(passerId, passedId) {
  if (passerId === passedId) {
    throw createError('Cannot pass yourself', 400);
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // Upsert pass
  await db('passes')
    .insert({
      id: uuidv4(),
      passer_id: passerId,
      passed_id: passedId,
      expires_at: expiresAt,
      created_at: new Date()
    })
    .onConflict(['passer_id', 'passed_id'])
    .merge({ expires_at: expiresAt });

  return { passed: true };
}

/**
 * Unmatch — remove match, delete conversation, block for 30 days
 */
async function unmatchUser(userId, matchId) {
  const match = await db('matches')
    .where({ id: matchId, is_active: true })
    .andWhere(function() {
      this.where({ user1_id: userId }).orWhere({ user2_id: userId });
    })
    .first();

  if (!match) throw createError('Match not found', 404);

  const partnerId = match.user1_id === userId ? match.user2_id : match.user1_id;

  // Deactivate match
  await db('matches').where({ id: matchId }).update({ is_active: false });

  // Deactivate conversation
  await db('conversations').where({ match_id: matchId }).update({ is_active: false });

  // Delete messages in the conversation
  const convo = await db('conversations').where({ match_id: matchId }).first();
  if (convo) {
    await db('messages').where({ conversation_id: convo.id }).del();
  }

  // Remove likes both ways
  await db('likes').where({ liker_id: userId, liked_id: partnerId }).del();
  await db('likes').where({ liker_id: partnerId, liked_id: userId }).del();

  // Add 30-day pass both ways
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await db('passes')
    .insert([
      { id: uuidv4(), passer_id: userId, passed_id: partnerId, expires_at: expiresAt, created_at: new Date() },
      { id: uuidv4(), passer_id: partnerId, passed_id: userId, expires_at: expiresAt, created_at: new Date() }
    ])
    .onConflict(['passer_id', 'passed_id'])
    .merge({ expires_at: expiresAt });

  return { unmatched: true, partnerId };
}

/**
 * Get all active matches for a user
 */
async function getMatches(userId) {
  const matches = await db('matches')
    .where({ is_active: true })
    .andWhere(function() {
      this.where({ user1_id: userId }).orWhere({ user2_id: userId });
    })
    .orderBy('matched_at', 'desc');

  // Enrich with partner info
  const result = [];
  for (const match of matches) {
    const partnerId = match.user1_id === userId ? match.user2_id : match.user1_id;
    const partner = await db('users')
      .join('profiles', 'users.id', 'profiles.user_id')
      .where('users.id', partnerId)
      .select('users.id', 'users.nickname', 'profiles.display_name', 'profiles.gender', 'profiles.bio')
      .first();

    const convo = await db('conversations').where({ match_id: match.id, is_active: true }).first();

    result.push({
      matchId: match.id,
      matchedAt: match.matched_at,
      conversationId: convo?.id,
      partner: partner || { id: partnerId, nickname: 'Deleted User' }
    });
  }

  return result;
}

/**
 * Get remaining daily likes count
 */
async function getRemainingLikes(userId) {
  const user = await db('users').where({ id: userId }).first();
  if (user.is_premium) return { remaining: Infinity, limit: 'unlimited' };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayLikes = await db('likes')
    .where({ liker_id: userId })
    .where('created_at', '>=', todayStart)
    .count('* as count')
    .first();

  const used = parseInt(todayLikes.count);
  return { remaining: Math.max(0, FREE_DAILY_LIKES - used), limit: FREE_DAILY_LIKES, used };
}

module.exports = {
  likeUser,
  passUser,
  unmatchUser,
  getMatches,
  getRemainingLikes
};
