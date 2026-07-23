const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const datingService = require('../services/datingService');

const router = Router();

// ─── RELATIONSHIP ────────────────────────────────────────────────────────────

/**
 * GET /api/dating/relationship
 * Get current relationship status
 */
router.get('/relationship', requireAuth, async (req, res, next) => {
  try {
    const status = await datingService.getRelationshipStatus(req.user.id);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/dating/relationship/request/:userId
 * Request to become a couple
 */
router.post('/relationship/request/:userId', requireAuth, async (req, res, next) => {
  try {
    const result = await datingService.requestRelationship(req.user.id, req.params.userId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/dating/relationship/confirm/:relationshipId
 * Confirm a relationship request
 */
router.post('/relationship/confirm/:relationshipId', requireAuth, async (req, res, next) => {
  try {
    const result = await datingService.confirmRelationship(req.user.id, req.params.relationshipId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/dating/relationship
 * End current relationship
 */
router.delete('/relationship', requireAuth, async (req, res, next) => {
  try {
    const result = await datingService.endRelationship(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── DATE INVITATIONS ────────────────────────────────────────────────────────

/**
 * POST /api/dating/invite/:userId
 * Send a date invitation
 */
router.post('/invite/:userId', requireAuth, [
  body('theme').isIn(['rooftop', 'beach', 'cafe', 'music_garden']).withMessage('Theme: rooftop, beach, cafe, music_garden'),
  body('proposedTime').optional().isISO8601(),
  validate
], async (req, res, next) => {
  try {
    const result = await datingService.sendDateInvitation(req.user.id, req.params.userId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/dating/invite/:inviteId/accept
 * Accept a date invitation
 */
router.post('/invite/:inviteId/accept', requireAuth, async (req, res, next) => {
  try {
    const result = await datingService.acceptDateInvitation(req.user.id, req.params.inviteId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/dating/invite/:inviteId/reject
 * Reject a date invitation
 */
router.post('/invite/:inviteId/reject', requireAuth, async (req, res, next) => {
  try {
    const result = await datingService.rejectDateInvitation(req.user.id, req.params.inviteId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dating/invitations
 * Get all sent and received invitations
 */
router.get('/invitations', requireAuth, async (req, res, next) => {
  try {
    const invitations = await datingService.getInvitations(req.user.id);
    res.json(invitations);
  } catch (err) {
    next(err);
  }
});

// ─── ACTIVE DATE ─────────────────────────────────────────────────────────────

/**
 * GET /api/dating/active
 * Get current active date session
 */
router.get('/active', requireAuth, async (req, res, next) => {
  try {
    const date = await datingService.getActiveDate(req.user.id);
    res.json({ date });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/dating/dates/:dateId/end
 * End a date session
 */
router.post('/dates/:dateId/end', requireAuth, async (req, res, next) => {
  try {
    const result = await datingService.endDate(req.user.id, req.params.dateId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/dating/dates/:dateId/rate
 * Rate a completed date (1-5 stars)
 */
router.post('/dates/:dateId/rate', requireAuth, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  validate
], async (req, res, next) => {
  try {
    const result = await datingService.rateDate(req.user.id, req.params.dateId, req.body.rating);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
