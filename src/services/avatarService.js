const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { createError } = require('../middleware/errorHandler');

const VALID_BODY_TYPES = ['male', 'female', 'non-binary'];
const VALID_SLOTS = ['hair', 'top', 'bottom', 'shoes', 'accessory'];

const HAIR_COLORS = [
  '#1a1a1a', '#4a3728', '#8b4513', '#d2691e', '#f4a460',
  '#ffd700', '#ff6347', '#ff69b4', '#9370db', '#4169e1',
  '#2e8b57', '#708090', '#ffffff', '#c0c0c0', '#800000',
  '#ff4500', '#00ced1', '#7b68ee', '#32cd32', '#ff1493'
];

const SKIN_TONES = [
  '#fde7d1', '#f5d0a9', '#e8b88a', '#d4956a', '#c47f4e',
  '#a0623a', '#7a4830', '#5c3a21', '#3d2515', '#2b1a10'
];

/**
 * Get or create avatar for user
 */
async function getAvatar(userId) {
  let avatar = await db('avatars').where({ user_id: userId }).first();

  if (!avatar) {
    // Auto-create default avatar
    avatar = await createAvatar(userId, { bodyType: 'male' });
  }

  // Get equipped items
  const equipped = await db('avatar_equipped_items')
    .join('shop_items', 'avatar_equipped_items.item_id', 'shop_items.id')
    .where({ avatar_id: avatar.id })
    .select(
      'avatar_equipped_items.slot',
      'avatar_equipped_items.color_override',
      'shop_items.id as item_id',
      'shop_items.name',
      'shop_items.sprite_key',
      'shop_items.category',
      'shop_items.color_default',
      'shop_items.is_recolorable'
    );

  return {
    ...avatar,
    equipped,
    availableHairColors: HAIR_COLORS,
    availableSkinTones: SKIN_TONES
  };
}

/**
 * Create avatar with body type
 */
async function createAvatar(userId, { bodyType, hairColor, skinTone }) {
  if (bodyType && !VALID_BODY_TYPES.includes(bodyType)) {
    throw createError('Invalid body type. Choose: male, female, non-binary', 400);
  }

  const existing = await db('avatars').where({ user_id: userId }).first();
  if (existing) {
    throw createError('Avatar already exists. Use update instead.', 409);
  }

  const avatar = {
    id: uuidv4(),
    user_id: userId,
    body_type: bodyType || 'male',
    hair_color: hairColor || '#4a3728',
    skin_tone: skinTone || '#f5d0a9',
    updated_at: new Date()
  };

  await db('avatars').insert(avatar);

  // Grant free starter items
  await grantFreeStarterItems(userId);

  // Also update profile gender to match avatar body type
  await db('profiles').where({ user_id: userId }).update({ gender: bodyType || 'male' });

  return avatar;
}

/**
 * Update avatar (body type, colors)
 */
async function updateAvatar(userId, { bodyType, hairColor, skinTone }) {
  const avatar = await db('avatars').where({ user_id: userId }).first();
  if (!avatar) throw createError('Avatar not found. Create one first.', 404);

  const updates = {};

  if (bodyType) {
    if (!VALID_BODY_TYPES.includes(bodyType)) {
      throw createError('Invalid body type', 400);
    }
    updates.body_type = bodyType;
    // Sync with profile gender
    await db('profiles').where({ user_id: userId }).update({ gender: bodyType });
  }

  if (hairColor) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hairColor)) {
      throw createError('Invalid hair color format (use hex like #4a3728)', 400);
    }
    updates.hair_color = hairColor;
  }

  if (skinTone) {
    if (!/^#[0-9a-fA-F]{6}$/.test(skinTone)) {
      throw createError('Invalid skin tone format', 400);
    }
    updates.skin_tone = skinTone;
  }

  if (Object.keys(updates).length === 0) {
    throw createError('No valid fields to update', 400);
  }

  updates.updated_at = new Date();
  await db('avatars').where({ user_id: userId }).update(updates);

  return getAvatar(userId);
}

/**
 * Equip an item to a slot
 */
async function equipItem(userId, { itemId, slot, colorOverride }) {
  const avatar = await db('avatars').where({ user_id: userId }).first();
  if (!avatar) throw createError('Avatar not found', 404);

  if (!VALID_SLOTS.includes(slot)) {
    throw createError('Invalid slot. Options: ' + VALID_SLOTS.join(', '), 400);
  }

  // Check if user owns the item
  const owned = await db('user_inventory')
    .where({ user_id: userId, item_id: itemId })
    .first();
  if (!owned) throw createError('You do not own this item', 403);

  // Check item exists and matches slot
  const item = await db('shop_items').where({ id: itemId }).first();
  if (!item) throw createError('Item not found', 404);
  if (item.category !== slot) {
    throw createError(`This item is for the "${item.category}" slot, not "${slot}"`, 400);
  }

  // Check gender restriction
  if (item.gender_restriction && item.gender_restriction !== avatar.body_type) {
    throw createError(`This item is restricted to ${item.gender_restriction} body type`, 403);
  }

  // Validate color override
  if (colorOverride && !item.is_recolorable) {
    throw createError('This item does not support custom colors', 400);
  }

  // Upsert equipped item (one per slot)
  const existing = await db('avatar_equipped_items')
    .where({ avatar_id: avatar.id, slot })
    .first();

  if (existing) {
    await db('avatar_equipped_items').where({ id: existing.id }).update({
      item_id: itemId,
      color_override: colorOverride || null
    });
  } else {
    await db('avatar_equipped_items').insert({
      id: uuidv4(),
      avatar_id: avatar.id,
      item_id: itemId,
      slot,
      color_override: colorOverride || null
    });
  }

  return getAvatar(userId);
}

/**
 * Unequip an item from a slot
 */
async function unequipSlot(userId, slot) {
  const avatar = await db('avatars').where({ user_id: userId }).first();
  if (!avatar) throw createError('Avatar not found', 404);

  if (!VALID_SLOTS.includes(slot)) {
    throw createError('Invalid slot', 400);
  }

  await db('avatar_equipped_items')
    .where({ avatar_id: avatar.id, slot })
    .del();

  return getAvatar(userId);
}

/**
 * Get user inventory (all owned items)
 */
async function getInventory(userId) {
  const items = await db('user_inventory')
    .join('shop_items', 'user_inventory.item_id', 'shop_items.id')
    .where({ 'user_inventory.user_id': userId })
    .select(
      'shop_items.*',
      'user_inventory.acquired_via',
      'user_inventory.acquired_at'
    )
    .orderBy('shop_items.category');

  return items;
}

/**
 * Get shop items (with filters)
 */
async function getShopItems({ category, gender, freeOnly, page = 1, limit = 50 } = {}) {
  let query = db('shop_items');

  if (category) query = query.where({ category });
  if (gender) {
    query = query.where(function() {
      this.whereNull('gender_restriction').orWhere({ gender_restriction: gender });
    });
  }
  if (freeOnly) query = query.where({ price: 0 });

  const items = await query
    .orderBy('price', 'asc')
    .orderBy('name', 'asc')
    .limit(limit)
    .offset((page - 1) * limit);

  return items;
}

/**
 * Grant free starter items to new user
 */
async function grantFreeStarterItems(userId) {
  const freeItems = await db('shop_items').where({ price: 0 });

  if (freeItems.length === 0) return;

  const inventory = freeItems.map(item => ({
    id: uuidv4(),
    user_id: userId,
    item_id: item.id,
    acquired_via: 'free',
    acquired_at: new Date()
  }));

  // Use onConflict to skip duplicates
  await db('user_inventory')
    .insert(inventory)
    .onConflict(['user_id', 'item_id'])
    .ignore();
}

/**
 * Get avatar data for rendering (compact format for Socket.io broadcast)
 */
async function getAvatarRenderData(userId) {
  const avatar = await db('avatars').where({ user_id: userId }).first();
  if (!avatar) return null;

  const equipped = await db('avatar_equipped_items')
    .join('shop_items', 'avatar_equipped_items.item_id', 'shop_items.id')
    .where({ avatar_id: avatar.id })
    .select('avatar_equipped_items.slot', 'shop_items.sprite_key', 'avatar_equipped_items.color_override', 'shop_items.color_default');

  return {
    bodyType: avatar.body_type,
    hairColor: avatar.hair_color,
    skinTone: avatar.skin_tone,
    items: equipped.reduce((acc, e) => {
      acc[e.slot] = { sprite: e.sprite_key, color: e.color_override || e.color_default };
      return acc;
    }, {})
  };
}

module.exports = {
  getAvatar,
  createAvatar,
  updateAvatar,
  equipItem,
  unequipSlot,
  getInventory,
  getShopItems,
  grantFreeStarterItems,
  getAvatarRenderData
};
