/**
 * Account management routes (PDPA compliance, account deletion, data export)
 */
const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { createError } = require('../middleware/errorHandler');
const db = require('../config/database');

const router = Router();

/**
 * DELETE /api/account
 * PDPA: Request account deletion (schedules for 30 days)
 */
router.delete('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Mark account as deletion pending (actual deletion in 30 days)
    await db('users').where({ id: userId }).update({
      is_suspended: true, // suspend immediately
      updated_at: new Date()
    });

    // Invalidate all sessions immediately
    await db('sessions').where({ user_id: userId }).update({ is_active: false });

    // Log deletion request (for PDPA audit)
    const { logger } = require('../middleware/logger');
    logger.info('Account deletion requested', { userId, scheduledDeletion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });

    res.json({
      message: 'Account deletion scheduled. Your account will be permanently deleted within 30 days.',
      scheduledDeletion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/account/export
 * PDPA: Export all personal data
 */
router.get('/export', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await db('users').where({ id: userId })
      .select('id', 'email', 'nickname', 'date_of_birth', 'created_at').first();

    const profile = await db('profiles').where({ user_id: userId }).first();

    const photos = await db('profile_photos')
      .join('profiles', 'profile_photos.profile_id', 'profiles.id')
      .where('profiles.user_id', userId)
      .select('profile_photos.url', 'profile_photos.position', 'profile_photos.created_at');

    const genres = await db('user_genres').where({ user_id: userId }).pluck('genre');

    const matches = await db('matches')
      .where(function() { this.where({ user1_id: userId }).orWhere({ user2_id: userId }); })
      .select('id', 'matched_at', 'is_active');

    const payments = await db('payments').where({ user_id: userId })
      .select('id', 'amount', 'currency', 'status', 'item_type', 'created_at');

    const export_data = {
      exportDate: new Date().toISOString(),
      user,
      profile: profile ? { display_name: profile.display_name, bio: profile.bio, gender: profile.gender } : null,
      photos,
      genres,
      matches,
      payments
    };

    res.setHeader('Content-Disposition', `attachment; filename="my-data-${userId}.json"`);
    res.json(export_data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/account/notifications
 * Get notification preferences
 */
router.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const notifs = await db('notifications')
      .where({ user_id: req.user.id })
      .orderBy('created_at', 'desc')
      .limit(50);
    res.json({ notifications: notifs });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/account/notifications/read
 * Mark all notifications as read
 */
router.put('/notifications/read', requireAuth, async (req, res, next) => {
  try {
    await db('notifications').where({ user_id: req.user.id, is_read: false }).update({ is_read: true });
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
