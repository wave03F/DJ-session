const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const moderationService = require('../services/moderationService');

const router = Router();

/**
 * POST /api/moderation/block/:userId
 * Block a user
 */
router.post('/block/:userId', requireAuth, async (req, res, next) => {
  try {
    const result = await moderationService.blockUser(req.user.id, req.params.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/moderation/block/:userId
 * Unblock a user
 */
router.delete('/block/:userId', requireAuth, async (req, res, next) => {
  try {
    const result = await moderationService.unblockUser(req.user.id, req.params.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/moderation/blocks
 * Get blocked users list
 */
router.get('/blocks', requireAuth, async (req, res, next) => {
  try {
    const blocks = await moderationService.getBlockedUsers(req.user.id);
    res.json({ blocks });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/moderation/report
 * Report a user
 */
router.post('/report', requireAuth, [
  body('reportedId').isUUID().withMessage('Valid user ID required'),
  body('category').isIn(['harassment', 'inappropriate_content', 'spam', 'fake_profile', 'underage']).withMessage('Valid category required'),
  body('description').optional().isLength({ max: 500 }),
  validate
], async (req, res, next) => {
  try {
    const result = await moderationService.reportUser(req.user.id, req.body.reportedId, {
      category: req.body.category,
      description: req.body.description
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
