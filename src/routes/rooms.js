const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const roomService = require('../services/roomService');
const musicService = require('../services/musicService');

const router = Router();

/**
 * GET /api/rooms
 * List active and upcoming rooms
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { limit, offset } = req.query;
    const rooms = await roomService.listRooms({
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0
    });
    res.json({ rooms });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/rooms
 * Create a new room (Premium/Admin only)
 */
router.post('/', requireAuth, [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title required (max 200 chars)'),
  body('description').optional().isLength({ max: 1000 }),
  body('genreTags').optional().isArray(),
  body('maxCapacity').optional().isInt({ min: 2, max: 100 }),
  body('scheduledAt').optional().isISO8601(),
  validate
], async (req, res, next) => {
  try {
    const room = await roomService.createRoom(req.user.id, req.body);
    res.status(201).json(room);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/rooms/:id
 * Get room details with current song and queue
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const room = await roomService.getRoom(req.params.id);
    res.json(room);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/rooms/:id/queue
 * Add song to room queue
 */
router.post('/:id/queue', optionalAuth, [
  body('videoId').trim().isLength({ min: 11, max: 11 }).withMessage('Valid YouTube video ID required'),
  body('title').optional().trim().isLength({ max: 300 }),
  validate
], async (req, res, next) => {
  try {
    const song = await musicService.addSong(req.params.id, {
      videoId: req.body.videoId,
      title: req.body.title,
      userId: req.user?.id,
      nickname: req.user?.nickname || 'Guest'
    });
    res.status(201).json(song);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/rooms/:id/queue
 * Get room queue
 */
router.get('/:id/queue', async (req, res, next) => {
  try {
    const queue = await musicService.getQueue(req.params.id);
    const currentSong = await musicService.getCurrentSong(req.params.id);
    res.json({ currentSong, queue });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/rooms/:id/vote-skip
 * Vote to skip current song
 */
router.post('/:id/vote-skip', optionalAuth, async (req, res, next) => {
  try {
    const result = await musicService.voteSkip(req.params.id, {
      userId: req.user?.id,
      socketId: req.body.socketId
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/rooms/:id/upvote/:songId
 * Upvote a song in queue
 */
router.post('/:id/upvote/:songId', optionalAuth, async (req, res, next) => {
  try {
    const queue = await musicService.upvoteSong(req.params.songId, {
      userId: req.user?.id,
      socketId: req.body.socketId
    });
    res.json({ queue });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
