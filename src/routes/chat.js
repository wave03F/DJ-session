const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const chatService = require('../services/chatService');

const router = Router();

/**
 * GET /api/chat/conversations
 * Get all conversations for the authenticated user
 */
router.get('/conversations', requireAuth, async (req, res, next) => {
  try {
    const conversations = await chatService.getConversations(req.user.id);
    res.json({ conversations });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/chat/conversations/:id/messages
 * Get messages in a conversation (paginated)
 */
router.get('/conversations/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const { limit, before } = req.query;
    const messages = await chatService.getMessages(req.user.id, req.params.id, {
      limit: limit ? parseInt(limit) : 50,
      before
    });
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/chat/conversations/:id/messages
 * Send a message (REST fallback — prefer Socket.io dm:send)
 */
router.post('/conversations/:id/messages', requireAuth, [
  body('content').trim().isLength({ min: 1, max: 500 }).withMessage('Message required (max 500 chars)'),
  validate
], async (req, res, next) => {
  try {
    const message = await chatService.sendMessage(req.user.id, req.params.id, req.body.content);
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
