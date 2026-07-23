const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const matchService = require('../services/matchService');

const router = Router();

// Will be set from app.js to enable real-time notifications
let io = null;
router.setIO = function(ioInstance) { io = ioInstance; };

/**
 * POST /api/matches/like/:userId
 * Like a user
 */
router.post('/like/:userId', requireAuth, async (req, res, next) => {
  try {
    const result = await matchService.likeUser(req.user.id, req.params.userId);

    // Emit real-time match notification if matched
    if (result.matched && io) {
      const { findSocketByUserId } = require('../socket/chatHandler');
      const partnerSocket = findSocketByUserId(io, req.params.userId);
      if (partnerSocket) {
        partnerSocket.emit('match-created', {
          matchId: result.match.id,
          partnerId: req.user.id,
          partnerNickname: req.user.nickname,
          conversationId: result.match.conversationId
        });
      }
      // Also notify the liker
      const likerSocket = findSocketByUserId(io, req.user.id);
      if (likerSocket) {
        likerSocket.emit('match-created', {
          matchId: result.match.id,
          partnerId: req.params.userId,
          conversationId: result.match.conversationId
        });
      }
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/matches/pass/:userId
 * Pass (reject) a user
 */
router.post('/pass/:userId', requireAuth, async (req, res, next) => {
  try {
    const result = await matchService.passUser(req.user.id, req.params.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/matches
 * Get all active matches
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const matches = await matchService.getMatches(req.user.id);
    res.json({ matches });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/matches/:matchId
 * Unmatch a user
 */
router.delete('/:matchId', requireAuth, async (req, res, next) => {
  try {
    const result = await matchService.unmatchUser(req.user.id, req.params.matchId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/matches/likes-remaining
 * Get remaining daily likes count
 */
router.get('/likes-remaining', requireAuth, async (req, res, next) => {
  try {
    const result = await matchService.getRemainingLikes(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
