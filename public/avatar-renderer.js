// ─── Avatar Layered Sprite Renderer ──────────────────────────────────────────
// Renders pixel-art avatars with body type, clothing layers, and colors

const AvatarRenderer = {
  /**
   * Draw a full avatar with all layers
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - position x
   * @param {number} y - position y
   * @param {object} avatarData - { bodyType, hairColor, skinTone, items: { hair, top, bottom, shoes, accessory } }
   * @param {string} direction - 'up', 'down', 'left', 'right'
   * @param {number} walkFrame - 0-3 walk cycle frame
   * @param {boolean} isMoving
   */
  draw(ctx, x, y, avatarData, direction, walkFrame, isMoving) {
    if (!avatarData) {
      // Fallback to default if no avatar data
      this.drawDefault(ctx, x, y, '#6366f1', direction, walkFrame, isMoving);
      return;
    }

    const { bodyType, hairColor, skinTone, items } = avatarData;

    // Layer order (back to front):
    // 1. Shadow
    // 2. Shoes
    // 3. Bottom (pants/skirt)
    // 4. Body/skin
    // 5. Top (shirt/jacket)
    // 6. Head/face
    // 7. Hair
    // 8. Accessory

    this.drawShadow(ctx, x, y);
    this.drawShoes(ctx, x, y, items?.shoes, walkFrame, isMoving, bodyType);
    this.drawLegs(ctx, x, y, items?.bottom, walkFrame, isMoving, bodyType);
    this.drawBody(ctx, x, y, skinTone, bodyType);
    this.drawTop(ctx, x, y, items?.top, bodyType);
    this.drawHead(ctx, x, y, skinTone, direction, bodyType);
    this.drawHair(ctx, x, y, items?.hair, hairColor, direction, bodyType);
    this.drawAccessory(ctx, x, y, items?.accessory, direction);
  },

  drawShadow(ctx, x, y) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 6, y + 44, 20, 4);
  },

  drawBody(ctx, x, y, skinTone, bodyType) {
    const skin = skinTone || '#f5d0a9';
    ctx.fillStyle = skin;

    // Arms (skin visible part)
    if (bodyType === 'female') {
      ctx.fillRect(x + 5, y + 20, 3, 10);
      ctx.fillRect(x + 24, y + 20, 3, 10);
    } else {
      ctx.fillRect(x + 4, y + 20, 4, 10);
      ctx.fillRect(x + 24, y + 20, 4, 10);
    }
  },

  drawHead(ctx, x, y, skinTone, direction, bodyType) {
    const skin = skinTone || '#f5d0a9';
    ctx.fillStyle = skin;

    // Head shape varies by body type
    if (bodyType === 'female') {
      ctx.fillRect(x + 9, y + 4, 14, 13);
    } else if (bodyType === 'non-binary') {
      ctx.fillRect(x + 8, y + 4, 16, 13);
    } else {
      ctx.fillRect(x + 8, y + 4, 16, 14);
    }

    // Eyes
    ctx.fillStyle = '#1a1a1a';
    if (direction === 'left') {
      ctx.fillRect(x + 10, y + 10, 3, 3);
    } else if (direction === 'right') {
      ctx.fillRect(x + 19, y + 10, 3, 3);
    } else if (direction === 'up') {
      // Back of head — no eyes visible
    } else {
      ctx.fillRect(x + 11, y + 10, 3, 3);
      ctx.fillRect(x + 18, y + 10, 3, 3);
      // Mouth (small)
      ctx.fillRect(x + 14, y + 14, 4, 1);
    }
  },

  drawHair(ctx, x, y, hairItem, hairColor, direction, bodyType) {
    const color = hairItem?.color || hairColor || '#4a3728';
    ctx.fillStyle = color;

    // Different hair sprites based on sprite_key
    const sprite = hairItem?.sprite || 'hair_short_classic';

    if (sprite.includes('long')) {
      // Long hair
      ctx.fillRect(x + 6, y, 20, 6);
      ctx.fillRect(x + 5, y + 4, 4, 14);
      ctx.fillRect(x + 23, y + 4, 4, 14);
      if (direction === 'down') {
        ctx.fillRect(x + 8, y + 16, 16, 6);
      }
    } else if (sprite.includes('bob')) {
      ctx.fillRect(x + 6, y, 20, 6);
      ctx.fillRect(x + 5, y + 4, 4, 10);
      ctx.fillRect(x + 23, y + 4, 4, 10);
    } else if (sprite.includes('spiky')) {
      ctx.fillRect(x + 6, y + 2, 20, 4);
      ctx.fillRect(x + 8, y - 2, 4, 4);
      ctx.fillRect(x + 14, y - 3, 4, 5);
      ctx.fillRect(x + 20, y - 1, 4, 3);
    } else if (sprite.includes('ponytail')) {
      ctx.fillRect(x + 6, y, 20, 6);
      if (direction !== 'left') {
        ctx.fillRect(x + 22, y + 6, 4, 12);
      }
    } else if (sprite.includes('mohawk')) {
      ctx.fillRect(x + 12, y - 4, 8, 8);
      ctx.fillRect(x + 13, y + 4, 6, 2);
    } else if (sprite.includes('buzz')) {
      ctx.fillRect(x + 7, y + 1, 18, 4);
    } else {
      // Default: short classic
      ctx.fillRect(x + 6, y, 20, 6);
      ctx.fillRect(x + 6, y + 4, 4, 4);
      ctx.fillRect(x + 22, y + 4, 4, 4);
    }
  },

  drawTop(ctx, x, y, topItem, bodyType) {
    const color = topItem?.color || '#6366f1';
    ctx.fillStyle = color;

    const sprite = topItem?.sprite || 'top_basic_tee';

    // Torso shape varies by body type
    if (bodyType === 'female') {
      ctx.fillRect(x + 8, y + 16, 16, 18);
      // Slight waist taper
      ctx.fillRect(x + 9, y + 30, 14, 4);
    } else if (bodyType === 'non-binary') {
      ctx.fillRect(x + 8, y + 16, 16, 20);
    } else {
      // Male — wider shoulders
      ctx.fillRect(x + 7, y + 16, 18, 20);
    }

    // Sleeves
    if (sprite.includes('tank')) {
      // No sleeves
    } else if (sprite.includes('hoodie') || sprite.includes('jacket')) {
      // Full arm cover
      ctx.fillRect(x + 4, y + 18, 4, 12);
      ctx.fillRect(x + 24, y + 18, 4, 12);
    } else if (sprite.includes('crop')) {
      // Shorter torso
      ctx.fillStyle = topItem?.color || '#6366f1';
      ctx.clearRect(x + 8, y + 30, 16, 6);
    } else {
      // Normal sleeves
      ctx.fillRect(x + 4, y + 18, 4, 8);
      ctx.fillRect(x + 24, y + 18, 4, 8);
    }

    // Detail lines (collar)
    const darker = this.darken(color, 30);
    ctx.fillStyle = darker;
    ctx.fillRect(x + 12, y + 16, 8, 2);
  },

  drawLegs(ctx, x, y, bottomItem, walkFrame, isMoving, bodyType) {
    const color = bottomItem?.color || '#2a2a4a';
    ctx.fillStyle = color;

    const legOffsets = [
      { left: 0, right: 0 },
      { left: -2, right: 2 },
      { left: 0, right: 0 },
      { left: 2, right: -2 }
    ];
    const offset = isMoving ? (legOffsets[walkFrame] || legOffsets[0]) : legOffsets[0];

    const sprite = bottomItem?.sprite || 'bottom_jeans';

    if (sprite.includes('skirt')) {
      // Skirt — single piece, less leg movement
      ctx.fillRect(x + 8, y + 34, 16, 8);
      ctx.fillStyle = this.darken(color, 20);
      ctx.fillRect(x + 9 + offset.left * 0.5, y + 42, 5, 5);
      ctx.fillRect(x + 18 + offset.right * 0.5, y + 42, 5, 5);
    } else if (sprite.includes('shorts')) {
      ctx.fillRect(x + 9 + offset.left, y + 34, 6, 6);
      ctx.fillRect(x + 17 + offset.right, y + 34, 6, 6);
    } else {
      // Full pants
      ctx.fillRect(x + 9 + offset.left, y + 34, 6, 12);
      ctx.fillRect(x + 17 + offset.right, y + 34, 6, 12);
    }
  },

  drawShoes(ctx, x, y, shoesItem, walkFrame, isMoving, bodyType) {
    const color = shoesItem?.color || '#3a3a3a';
    ctx.fillStyle = color;

    const legOffsets = [{ left: 0, right: 0 }, { left: -2, right: 2 }, { left: 0, right: 0 }, { left: 2, right: -2 }];
    const offset = isMoving ? (legOffsets[walkFrame] || legOffsets[0]) : legOffsets[0];

    const sprite = shoesItem?.sprite || 'shoes_sneakers';

    if (sprite.includes('boots')) {
      ctx.fillRect(x + 8 + offset.left, y + 43, 7, 5);
      ctx.fillRect(x + 17 + offset.right, y + 43, 7, 5);
    } else if (sprite.includes('sandals')) {
      ctx.fillRect(x + 9 + offset.left, y + 45, 6, 3);
      ctx.fillRect(x + 17 + offset.right, y + 45, 6, 3);
    } else {
      // Sneakers/default
      ctx.fillRect(x + 8 + offset.left, y + 44, 7, 4);
      ctx.fillRect(x + 17 + offset.right, y + 44, 7, 4);
    }

    // LED effect
    if (sprite.includes('led')) {
      const glow = Math.sin(Date.now() / 200) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(0, 255, 200, ${glow * 0.6})`;
      ctx.fillRect(x + 8 + offset.left, y + 47, 7, 1);
      ctx.fillRect(x + 17 + offset.right, y + 47, 7, 1);
    }
  },

  drawAccessory(ctx, x, y, accessoryItem, direction) {
    if (!accessoryItem) return;

    const color = accessoryItem.color || '#ffd700';
    ctx.fillStyle = color;
    const sprite = accessoryItem.sprite || '';

    if (sprite.includes('cap')) {
      ctx.fillRect(x + 6, y - 2, 20, 4);
      if (direction === 'right' || direction === 'down') {
        ctx.fillRect(x + 22, y, 6, 3);
      } else {
        ctx.fillRect(x + 4, y, 6, 3);
      }
    } else if (sprite.includes('glasses')) {
      ctx.fillStyle = '#333333';
      ctx.fillRect(x + 9, y + 9, 5, 4);
      ctx.fillRect(x + 17, y + 9, 5, 4);
      ctx.fillRect(x + 14, y + 10, 3, 1);
    } else if (sprite.includes('beanie')) {
      ctx.fillRect(x + 6, y - 3, 20, 5);
      ctx.fillRect(x + 8, y + 2, 16, 2);
    } else if (sprite.includes('headphones') || sprite.includes('earbuds')) {
      ctx.fillStyle = '#333333';
      ctx.fillRect(x + 4, y + 6, 4, 8);
      ctx.fillRect(x + 24, y + 6, 4, 8);
      ctx.fillRect(x + 6, y + 2, 20, 2);
    } else if (sprite.includes('bandana')) {
      ctx.fillRect(x + 6, y + 2, 20, 3);
    } else if (sprite.includes('chain')) {
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(x + 10, y + 16, 12, 1);
      ctx.fillRect(x + 14, y + 17, 4, 3);
    } else if (sprite.includes('wings')) {
      const flap = Math.sin(Date.now() / 500) * 2;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(x - 6, y + 14 + flap, 8, 16);
      ctx.fillRect(x + 30, y + 14 - flap, 8, 16);
    } else if (sprite.includes('aura')) {
      const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.4;
      ctx.fillStyle = `rgba(255, 100, 0, ${pulse})`;
      ctx.fillRect(x - 3, y - 3, 38, 52);
    }
  },

  /**
   * Draw default avatar (no avatar data — fallback)
   */
  drawDefault(ctx, x, y, color, direction, walkFrame, isMoving) {
    this.draw(ctx, x, y, {
      bodyType: 'male',
      hairColor: '#4a3728',
      skinTone: '#f5d0a9',
      items: {
        top: { sprite: 'top_basic_tee', color: color },
        bottom: { sprite: 'bottom_jeans', color: '#2a2a4a' },
        shoes: { sprite: 'shoes_sneakers', color: '#3a3a3a' }
      }
    }, direction, walkFrame, isMoving);
  },

  darken(hex, amount) {
    if (!hex || hex.startsWith('rgb')) return hex;
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xFF) - amount);
    const b = Math.max(0, (num & 0xFF) - amount);
    return `rgb(${r},${g},${b})`;
  }
};

if (typeof window !== 'undefined') {
  window.AvatarRenderer = AvatarRenderer;
}
