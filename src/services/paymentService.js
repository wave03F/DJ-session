const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { createError } = require('../middleware/errorHandler');

const PLANS = {
  monthly: { amount: 299, currency: 'THB', durationDays: 30, label: 'Monthly Premium' },
  yearly:  { amount: 2990, currency: 'THB', durationDays: 365, label: 'Yearly Premium' }
};

// ─── PREMIUM SUBSCRIPTION ─────────────────────────────────────────────────────

/**
 * Activate Premium subscription (Omise payment or sandbox test)
 */
async function subscribePremium(userId, { plan = 'monthly', omiseToken, isSandbox = false }) {
  if (!PLANS[plan]) throw createError('Invalid plan. Choose: monthly, yearly', 400);

  const planData = PLANS[plan];

  // Check existing active subscription
  const existing = await db('premium_subscriptions')
    .where({ user_id: userId, status: 'active' })
    .where('expires_at', '>', new Date())
    .first();

  if (existing) throw createError('Already have an active subscription', 409);

  // Create payment record
  const paymentId = uuidv4();
  let chargeStatus = 'successful';
  let omiseChargeId = null;

  if (!isSandbox && omiseToken) {
    // Real Omise charge (requires OMISE_SECRET_KEY env)
    try {
      const chargeResult = await createOmiseCharge({
        token: omiseToken,
        amount: planData.amount * 100, // Omise uses satang (smallest unit)
        currency: planData.currency,
        description: `${planData.label} - User ${userId}`
      });
      omiseChargeId = chargeResult.id;
      chargeStatus = chargeResult.status === 'successful' ? 'successful' : 'failed';
    } catch (err) {
      chargeStatus = 'failed';
      throw createError('Payment failed: ' + err.message, 402);
    }
  }

  // Save payment
  await db('payments').insert({
    id: paymentId,
    user_id: userId,
    omise_charge_id: omiseChargeId,
    amount: planData.amount,
    currency: planData.currency,
    payment_method: isSandbox ? 'sandbox' : 'omise',
    status: chargeStatus,
    item_type: 'subscription',
    metadata: JSON.stringify({ plan }),
    created_at: new Date(),
    updated_at: new Date()
  });

  if (chargeStatus !== 'successful') {
    throw createError('Payment was not successful', 402);
  }

  // Create subscription
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + planData.durationDays);

  const subId = uuidv4();
  await db('premium_subscriptions').insert({
    id: subId,
    user_id: userId,
    payment_id: paymentId,
    plan,
    amount: planData.amount,
    currency: planData.currency,
    status: 'active',
    starts_at: new Date(),
    expires_at: expiresAt,
    created_at: new Date()
  });

  // Activate premium on user
  await db('users').where({ id: userId }).update({
    is_premium: true,
    premium_expires_at: expiresAt
  });

  return {
    subscriptionId: subId,
    plan,
    amount: planData.amount,
    currency: planData.currency,
    expiresAt,
    activated: true
  };
}

/**
 * Cancel premium subscription
 */
async function cancelSubscription(userId) {
  const sub = await db('premium_subscriptions')
    .where({ user_id: userId, status: 'active' })
    .first();

  if (!sub) throw createError('No active subscription found', 404);

  await db('premium_subscriptions').where({ id: sub.id }).update({
    status: 'cancelled',
    cancelled_at: new Date()
  });

  // Downgrade user (keep premium until expiry date)
  // Note: actual downgrade happens when expiry date is reached
  return { cancelled: true, premiumUntil: sub.expires_at };
}

/**
 * Check and expire premium subscriptions (run periodically)
 */
async function expireSubscriptions() {
  const expired = await db('premium_subscriptions')
    .where({ status: 'active' })
    .where('expires_at', '<', new Date());

  for (const sub of expired) {
    await db('premium_subscriptions').where({ id: sub.id }).update({ status: 'expired' });
    await db('users').where({ id: sub.user_id }).update({
      is_premium: false,
      premium_expires_at: null
    });
  }

  return expired.length;
}

/**
 * Purchase a virtual item from the shop
 */
async function purchaseItem(userId, itemId, { omiseToken, isSandbox = false } = {}) {
  const item = await db('shop_items').where({ id: itemId }).first();
  if (!item) throw createError('Item not found', 404);

  if (item.price === 0) throw createError('This item is free — use inventory endpoint instead', 400);

  // Check already owned
  const owned = await db('user_inventory').where({ user_id: userId, item_id: itemId }).first();
  if (owned) throw createError('You already own this item', 409);

  let chargeStatus = 'successful';
  let omiseChargeId = null;

  if (!isSandbox && omiseToken) {
    try {
      const chargeResult = await createOmiseCharge({
        token: omiseToken,
        amount: item.price * 100,
        currency: 'THB',
        description: `Item: ${item.name}`
      });
      omiseChargeId = chargeResult.id;
      chargeStatus = chargeResult.status === 'successful' ? 'successful' : 'failed';
    } catch (err) {
      throw createError('Payment failed: ' + err.message, 402);
    }
  }

  const paymentId = uuidv4();
  await db('payments').insert({
    id: paymentId,
    user_id: userId,
    omise_charge_id: omiseChargeId,
    amount: item.price,
    currency: 'THB',
    payment_method: isSandbox ? 'sandbox' : 'omise',
    status: chargeStatus,
    item_type: 'virtual_item',
    item_id: itemId,
    metadata: JSON.stringify({ itemName: item.name }),
    created_at: new Date(),
    updated_at: new Date()
  });

  if (chargeStatus !== 'successful') throw createError('Payment was not successful', 402);

  // Add to inventory
  await db('user_inventory').insert({
    id: uuidv4(),
    user_id: userId,
    item_id: itemId,
    acquired_via: 'purchase',
    acquired_at: new Date()
  });

  return { purchased: true, item: { id: item.id, name: item.name }, paymentId };
}

/**
 * Get payment history for a user
 */
async function getPaymentHistory(userId) {
  const payments = await db('payments')
    .where({ user_id: userId })
    .orderBy('created_at', 'desc')
    .limit(50);

  const sub = await db('premium_subscriptions')
    .where({ user_id: userId })
    .orderBy('created_at', 'desc')
    .first();

  return { payments, subscription: sub || null };
}

// ─── OMISE INTEGRATION (Sandbox-ready) ───────────────────────────────────────

async function createOmiseCharge({ token, amount, currency, description }) {
  const secretKey = process.env.OMISE_SECRET_KEY;
  if (!secretKey) throw new Error('OMISE_SECRET_KEY not configured');

  const body = new URLSearchParams({
    amount: String(amount),
    currency: currency.toLowerCase(),
    card: token,
    description
  });

  const response = await fetch('https://api.omise.co/charges', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Omise error');
  return data;
}

module.exports = {
  subscribePremium,
  cancelSubscription,
  expireSubscriptions,
  purchaseItem,
  getPaymentHistory
};
