const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const avatarService = require('../services/avatarService');

const router = Router();

/**
 * GET /api/avatars/me
 * Get current avatar with equipped items
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const avatar = await avatarService.getAvatar(req.user.id);
    res.json(avatar);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/avatars/me
 * Create avatar (first time setup)
 */
router.post('/me', requireAuth, [
  body('bodyType').isIn(['male', 'female', 'non-binary']).withMessage('Body type: male, female, or non-binary'),
  body('hairColor').optional().matches(/^#[0-9a-fA-F]{6}$/),
  body('skinTone').optional().matches(/^#[0-9a-fA-F]{6}$/),
  validate
], async (req, res, next) => {
  try {
    const avatar = await avatarService.createAvatar(req.user.id, req.body);
    res.status(201).json(avatar);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/avatars/me
 * Update avatar (body type, colors)
 */
router.put('/me', requireAuth, [
  body('bodyType').optional().isIn(['male', 'female', 'non-binary']),
  body('hairColor').optional().matches(/^#[0-9a-fA-F]{6}$/),
  body('skinTone').optional().matches(/^#[0-9a-fA-F]{6}$/),
  validate
], async (req, res, next) => {
  try {
    const avatar = await avatarService.updateAvatar(req.user.id, req.body);
    res.json(avatar);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/avatars/me/equip
 * Equip an item to a slot
 */
router.put('/me/equip', requireAuth, [
  body('itemId').isUUID().withMessage('Valid item ID required'),
  body('slot').isIn(['hair', 'top', 'bottom', 'shoes', 'accessory']).withMessage('Valid slot required'),
  body('colorOverride').optional().matches(/^#[0-9a-fA-F]{6}$/),
  validate
], async (req, res, next) => {
  try {
    const avatar = await avatarService.equipItem(req.user.id, req.body);
    res.json(avatar);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/avatars/me/equip/:slot
 * Unequip a slot
 */
router.delete('/me/equip/:slot', requireAuth, async (req, res, next) => {
  try {
    const avatar = await avatarService.unequipSlot(req.user.id, req.params.slot);
    res.json(avatar);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/avatars/inventory
 * Get all owned items
 */
router.get('/inventory', requireAuth, async (req, res, next) => {
  try {
    const items = await avatarService.getInventory(req.user.id);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/avatars/shop
 * Browse shop items (with filters)
 */
router.get('/shop', async (req, res, next) => {
  try {
    const { category, gender, freeOnly, page } = req.query;
    const items = await avatarService.getShopItems({
      category,
      gender,
      freeOnly: freeOnly === 'true',
      page: page ? parseInt(page) : 1
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
