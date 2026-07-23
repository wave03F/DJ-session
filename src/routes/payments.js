const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const paymentService = require('../services/paymentService');

const router = Router();

/**
 * POST /api/payments/subscribe
 * Subscribe to Premium
 */
router.post('/subscribe', requireAuth, [
  body('plan').optional().isIn(['monthly', 'yearly']),
  body('omiseToken').optional().isString(),
  body('isSandbox').optional().isBoolean(),
  validate
], async (req, res, next) => {
  try {
    const result = await paymentService.subscribePremium(req.user.id, {
      plan: req.body.plan || 'monthly',
      omiseToken: req.body.omiseToken,
      isSandbox: req.body.isSandbox !== false // default sandbox in dev
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/payments/subscribe
 * Cancel Premium subscription
 */
router.delete('/subscribe', requireAuth, async (req, res, next) => {
  try {
    const result = await paymentService.cancelSubscription(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/payments/purchase
 * Purchase a virtual item
 */
router.post('/purchase', requireAuth, [
  body('itemId').isUUID().withMessage('Valid item ID required'),
  body('omiseToken').optional().isString(),
  body('isSandbox').optional().isBoolean(),
  validate
], async (req, res, next) => {
  try {
    const result = await paymentService.purchaseItem(req.user.id, req.body.itemId, {
      omiseToken: req.body.omiseToken,
      isSandbox: req.body.isSandbox !== false
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/payments/history
 * Get payment history + subscription status
 */
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const history = await paymentService.getPaymentHistory(req.user.id);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/payments/webhook/omise
 * Omise webhook handler
 */
router.post('/webhook/omise', async (req, res, next) => {
  try {
    const event = req.body;
    if (event.key === 'charge.complete') {
      const chargeId = event.data?.id;
      if (chargeId) {
        const status = event.data.status === 'successful' ? 'successful' : 'failed';
        await require('../config/database')('payments')
          .where({ omise_charge_id: chargeId })
          .update({ status, updated_at: new Date() });
      }
    }
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
