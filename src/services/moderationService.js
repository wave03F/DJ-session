const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { createError } = require('../middleware/errorHandler');

/**
 * Block a user — prevents all interaction both ways
 */
async function blockUser(blockerId, blockedId) {
  if (blockerId === blockedId) throw createError('Cannot block yourself', 400);

  const target = await db('users').where({ id: blockedId }).first();
  if (!target) throw createError('User not found', 404);

  // Check if already blocked
  const existing = await db('blocks').where({ blocker_id: blockerId, blocked_id: blockedId }).first();
  if (existing) return { blocked: true, message: 'Already blocked' };

  // Insert block
  await db('blocks').insert({
    id: uuidv4(),
    blocker_id: blockerId,
    blocked_id: blockedId,
    created_at: new Date()
  });

  // Deactivate any existing match between them
  await db('matches')
    .where({ is_active: true })
    .andWhere(function() {
      this.where({ user1_id: blockerId, user2_id: blockedId })
        .orWhere({ user1_id: blockedId, user2_id: blockerId });
    })
    .update({ is_active: false });

  // Deactivate conversations
  const matches = await db('matches')
    .where(function() {
      this.where({ user1_id: blockerId, user2_id: blockedId })
        .orWhere({ user1_id: blockedId, user2_id: blockerId });
    });

  for (const match of matches) {
    await db('conversations').where({ match_id: match.id }).update({ is_active: false });
  }

  // Remove likes both ways
  await db('likes').where({ liker_id: blockerId, liked_id: blockedId }).del();
  await db('likes').where({ liker_id: blockedId, liked_id: blockerId }).del();

  return { blocked: true };
}

/**
 * Unblock a user
 */
async function unblockUser(blockerId, blockedId) {
  await db('blocks').where({ blocker_id: blockerId, blocked_id: blockedId }).del();
  return { unblocked: true };
}

/**
 * Get list of blocked users
 */
async function getBlockedUsers(userId) {
  const blocks = await db('blocks')
    .join('users', 'blocks.blocked_id', 'users.id')
    .where({ 'blocks.blocker_id': userId })
    .select('users.id', 'users.nickname', 'blocks.created_at');

  return blocks;
}

/**
 * Report a user
 */
async function reportUser(reporterId, reportedId, { category, description }) {
  if (reporterId === reportedId) throw createError('Cannot report yourself', 400);

  const validCategories = ['harassment', 'inappropriate_content', 'spam', 'fake_profile', 'underage'];
  if (!validCategories.includes(category)) {
    throw createError('Invalid report category', 400);
  }

  const target = await db('users').where({ id: reportedId }).first();
  if (!target) throw createError('User not found', 404);

  // Set priority based on category
  let priority = 3;
  if (category === 'underage') priority = 1;
  if (category === 'harassment') priority = 2;

  const report = {
    id: uuidv4(),
    reporter_id: reporterId,
    reported_id: reportedId,
    category,
    description: description?.substring(0, 500) || null,
    status: 'pending',
    priority,
    created_at: new Date()
  };

  await db('reports').insert(report);

  // Check if user has 3+ reports in 24 hours → auto-suspend
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentReports = await db('reports')
    .where({ reported_id: reportedId })
    .where('created_at', '>=', oneDayAgo)
    .count('* as count')
    .first();

  if (parseInt(recentReports.count) >= 3) {
    await db('users').where({ id: reportedId }).update({ is_suspended: true });
    report.autoSuspended = true;
  }

  return report;
}

/**
 * Check if two users have a block between them
 */
async function isBlocked(userId1, userId2) {
  const block = await db('blocks')
    .where(function() {
      this.where({ blocker_id: userId1, blocked_id: userId2 })
        .orWhere({ blocker_id: userId2, blocked_id: userId1 });
    })
    .first();

  return !!block;
}

module.exports = {
  blockUser,
  unblockUser,
  getBlockedUsers,
  reportUser,
  isBlocked
};
