const { v4: uuidv4 } = require('uuid');

/**
 * Seed: Free base items (5+ per category) + some premium items
 */
exports.seed = async function(knex) {
  // Clear existing items (dev only)
  await knex('avatar_equipped_items').del();
  await knex('user_inventory').del();
  await knex('shop_items').del();

  const items = [
    // ─── HAIR (7 free + 3 premium) ─────────────────────────────────────────
    { id: uuidv4(), name: 'Short Classic', category: 'hair', sprite_key: 'hair_short_classic', is_recolorable: true, price: 0, rarity: 'common', description: 'Simple short hairstyle' },
    { id: uuidv4(), name: 'Medium Wave', category: 'hair', sprite_key: 'hair_medium_wave', is_recolorable: true, price: 0, rarity: 'common', description: 'Wavy medium length hair' },
    { id: uuidv4(), name: 'Long Straight', category: 'hair', sprite_key: 'hair_long_straight', is_recolorable: true, price: 0, rarity: 'common', description: 'Long straight hair' },
    { id: uuidv4(), name: 'Spiky', category: 'hair', sprite_key: 'hair_spiky', is_recolorable: true, price: 0, rarity: 'common', description: 'Energetic spiky style' },
    { id: uuidv4(), name: 'Bob Cut', category: 'hair', sprite_key: 'hair_bob', is_recolorable: true, price: 0, rarity: 'common', description: 'Clean bob cut' },
    { id: uuidv4(), name: 'Ponytail', category: 'hair', sprite_key: 'hair_ponytail', is_recolorable: true, price: 0, rarity: 'common', description: 'Tied back ponytail' },
    { id: uuidv4(), name: 'Buzz Cut', category: 'hair', sprite_key: 'hair_buzz', is_recolorable: true, price: 0, rarity: 'common', description: 'Ultra short buzz' },
    { id: uuidv4(), name: 'Neon Mohawk', category: 'hair', sprite_key: 'hair_mohawk_neon', is_recolorable: true, price: 50, is_premium: true, rarity: 'rare', description: 'Punk mohawk' },
    { id: uuidv4(), name: 'Galaxy Bun', category: 'hair', sprite_key: 'hair_galaxy_bun', is_recolorable: false, price: 100, is_premium: true, rarity: 'epic', description: 'Sparkling galaxy bun' },
    { id: uuidv4(), name: 'Fire Crown', category: 'hair', sprite_key: 'hair_fire_crown', is_recolorable: false, price: 200, is_premium: true, rarity: 'legendary', description: 'Hair made of fire' },

    // ─── TOP (6 free + 3 premium) ──────────────────────────────────────────
    { id: uuidv4(), name: 'Basic Tee', category: 'top', sprite_key: 'top_basic_tee', is_recolorable: true, price: 0, rarity: 'common', description: 'Simple t-shirt' },
    { id: uuidv4(), name: 'Tank Top', category: 'top', sprite_key: 'top_tank', is_recolorable: true, price: 0, rarity: 'common', description: 'Sleeveless tank' },
    { id: uuidv4(), name: 'Hoodie', category: 'top', sprite_key: 'top_hoodie', is_recolorable: true, price: 0, rarity: 'common', description: 'Cozy hoodie' },
    { id: uuidv4(), name: 'Button Shirt', category: 'top', sprite_key: 'top_button_shirt', is_recolorable: true, price: 0, rarity: 'common', description: 'Casual button-up' },
    { id: uuidv4(), name: 'Crop Top', category: 'top', sprite_key: 'top_crop', is_recolorable: true, price: 0, rarity: 'common', description: 'Trendy crop top' },
    { id: uuidv4(), name: 'Band Tee', category: 'top', sprite_key: 'top_band_tee', is_recolorable: false, price: 0, rarity: 'common', description: 'Concert band t-shirt' },
    { id: uuidv4(), name: 'Leather Jacket', category: 'top', sprite_key: 'top_leather_jacket', is_recolorable: false, price: 80, is_premium: true, rarity: 'rare', description: 'Rock leather jacket' },
    { id: uuidv4(), name: 'DJ Vest', category: 'top', sprite_key: 'top_dj_vest', is_recolorable: true, price: 120, is_premium: true, rarity: 'epic', description: 'Glowing DJ vest' },
    { id: uuidv4(), name: 'Hologram Shirt', category: 'top', sprite_key: 'top_hologram', is_recolorable: false, price: 250, is_premium: true, rarity: 'legendary', description: 'Animated hologram top' },

    // ─── BOTTOM (5 free + 2 premium) ───────────────────────────────────────
    { id: uuidv4(), name: 'Jeans', category: 'bottom', sprite_key: 'bottom_jeans', is_recolorable: true, price: 0, rarity: 'common', description: 'Classic jeans' },
    { id: uuidv4(), name: 'Shorts', category: 'bottom', sprite_key: 'bottom_shorts', is_recolorable: true, price: 0, rarity: 'common', description: 'Casual shorts' },
    { id: uuidv4(), name: 'Skirt', category: 'bottom', sprite_key: 'bottom_skirt', is_recolorable: true, price: 0, rarity: 'common', description: 'Simple skirt' },
    { id: uuidv4(), name: 'Joggers', category: 'bottom', sprite_key: 'bottom_joggers', is_recolorable: true, price: 0, rarity: 'common', description: 'Comfy jogger pants' },
    { id: uuidv4(), name: 'Cargo Pants', category: 'bottom', sprite_key: 'bottom_cargo', is_recolorable: true, price: 0, rarity: 'common', description: 'Utility cargo pants' },
    { id: uuidv4(), name: 'Neon Leggings', category: 'bottom', sprite_key: 'bottom_neon_leggings', is_recolorable: false, price: 60, is_premium: true, rarity: 'rare', description: 'Glowing neon leggings' },
    { id: uuidv4(), name: 'Flame Pants', category: 'bottom', sprite_key: 'bottom_flame', is_recolorable: false, price: 150, is_premium: true, rarity: 'epic', description: 'Pants with flame effect' },

    // ─── SHOES (5 free + 2 premium) ────────────────────────────────────────
    { id: uuidv4(), name: 'Sneakers', category: 'shoes', sprite_key: 'shoes_sneakers', is_recolorable: true, price: 0, rarity: 'common', description: 'Basic sneakers' },
    { id: uuidv4(), name: 'Boots', category: 'shoes', sprite_key: 'shoes_boots', is_recolorable: true, price: 0, rarity: 'common', description: 'Sturdy boots' },
    { id: uuidv4(), name: 'Sandals', category: 'shoes', sprite_key: 'shoes_sandals', is_recolorable: true, price: 0, rarity: 'common', description: 'Open sandals' },
    { id: uuidv4(), name: 'High Tops', category: 'shoes', sprite_key: 'shoes_hightops', is_recolorable: true, price: 0, rarity: 'common', description: 'High top kicks' },
    { id: uuidv4(), name: 'Loafers', category: 'shoes', sprite_key: 'shoes_loafers', is_recolorable: true, price: 0, rarity: 'common', description: 'Casual loafers' },
    { id: uuidv4(), name: 'LED Shoes', category: 'shoes', sprite_key: 'shoes_led', is_recolorable: false, price: 90, is_premium: true, rarity: 'rare', description: 'Light-up LED sneakers' },
    { id: uuidv4(), name: 'Cloud Walkers', category: 'shoes', sprite_key: 'shoes_cloud', is_recolorable: false, price: 180, is_premium: true, rarity: 'epic', description: 'Walking on clouds effect' },

    // ─── ACCESSORY (6 free + 3 premium) ────────────────────────────────────
    { id: uuidv4(), name: 'Baseball Cap', category: 'accessory', sprite_key: 'acc_cap', is_recolorable: true, price: 0, rarity: 'common', description: 'Simple cap' },
    { id: uuidv4(), name: 'Round Glasses', category: 'accessory', sprite_key: 'acc_glasses_round', is_recolorable: false, price: 0, rarity: 'common', description: 'Round frame glasses' },
    { id: uuidv4(), name: 'Beanie', category: 'accessory', sprite_key: 'acc_beanie', is_recolorable: true, price: 0, rarity: 'common', description: 'Warm beanie hat' },
    { id: uuidv4(), name: 'Earbuds', category: 'accessory', sprite_key: 'acc_earbuds', is_recolorable: false, price: 0, rarity: 'common', description: 'Wireless earbuds' },
    { id: uuidv4(), name: 'Bandana', category: 'accessory', sprite_key: 'acc_bandana', is_recolorable: true, price: 0, rarity: 'common', description: 'Cool bandana' },
    { id: uuidv4(), name: 'Chain Necklace', category: 'accessory', sprite_key: 'acc_chain', is_recolorable: false, price: 0, rarity: 'common', description: 'Silver chain' },
    { id: uuidv4(), name: 'DJ Headphones', category: 'accessory', sprite_key: 'acc_dj_headphones', is_recolorable: true, price: 70, is_premium: true, rarity: 'rare', description: 'Professional DJ headphones' },
    { id: uuidv4(), name: 'Angel Wings', category: 'accessory', sprite_key: 'acc_angel_wings', is_recolorable: false, price: 200, is_premium: true, rarity: 'epic', description: 'Floating angel wings' },
    { id: uuidv4(), name: 'Flame Aura', category: 'accessory', sprite_key: 'acc_flame_aura', is_recolorable: false, price: 300, is_premium: true, rarity: 'legendary', description: 'Burning aura effect' }
  ];

  await knex('shop_items').insert(items.map(item => ({
    ...item,
    is_premium: item.is_premium || false,
    is_recolorable: item.is_recolorable || false,
    gender_restriction: item.gender_restriction || null,
    color_default: item.color_default || null,
    created_at: new Date()
  })));

  console.log(`Seeded ${items.length} shop items (${items.filter(i => i.price === 0).length} free, ${items.filter(i => i.price > 0).length} premium)`);
};
