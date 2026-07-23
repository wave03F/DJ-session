const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pixel Music World API',
      version: '2.0.0',
      description: `
# Pixel Music World — Virtual Concert + Social Matching Platform

A real-time multiplayer platform where users join virtual concerts, match with each other (Tinder-style), chat, go on virtual dates, and customize pixel-art avatars.

## Authentication
Most endpoints require a **Bearer JWT token** in the Authorization header:
\`\`\`
Authorization: Bearer <accessToken>
\`\`\`

Tokens are obtained via \`POST /api/auth/register\` or \`POST /api/auth/login\`.
Access tokens expire in **15 minutes**. Use \`POST /api/auth/refresh\` with the refresh token (7 days) to get a new one.

## Rate Limits
| Endpoint Group | Limit |
|---|---|
| Auth endpoints | 10 requests / 15 minutes |
| All other APIs | 100 requests / minute |
| Chat messages | 60 messages / minute |
| Profile views | 10 / minute |
      `,
      contact: { name: 'Pixel Music World', email: 'dev@pixelmusicworld.com' },
      license: { name: 'MIT' }
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Development' },
      { url: 'https://api.pixelmusicworld.com', description: 'Production' }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token from /api/auth/login or /api/auth/register'
        }
      },
      schemas: {
        // ─── User ───────────────────────────────────────────────────
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            nickname: { type: 'string' },
            is_premium: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            user: { $ref: '#/components/schemas/User' },
            accessToken: { type: 'string', description: 'JWT access token (15 min)' },
            refreshToken: { type: 'string', description: 'JWT refresh token (7 days)' }
          }
        },
        // ─── Profile ─────────────────────────────────────────────────
        Profile: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            display_name: { type: 'string' },
            bio: { type: 'string', maxLength: 500 },
            gender: { type: 'string', enum: ['male', 'female', 'non-binary'] },
            relationship_status: { type: 'string', enum: ['single', 'in_relationship'] },
            age: { type: 'integer' },
            is_premium: { type: 'boolean' },
            photos: { type: 'array', items: { $ref: '#/components/schemas/Photo' } },
            genres: { type: 'array', items: { type: 'string' } }
          }
        },
        Photo: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            url: { type: 'string', format: 'uri' },
            position: { type: 'integer', minimum: 1, maximum: 6 }
          }
        },
        // ─── Match ───────────────────────────────────────────────────
        Match: {
          type: 'object',
          properties: {
            matchId: { type: 'string', format: 'uuid' },
            matchedAt: { type: 'string', format: 'date-time' },
            conversationId: { type: 'string', format: 'uuid' },
            partner: { $ref: '#/components/schemas/User' }
          }
        },
        LikeResponse: {
          type: 'object',
          properties: {
            liked: { type: 'boolean' },
            matched: { type: 'boolean' },
            match: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                partnerId: { type: 'string', format: 'uuid' },
                conversationId: { type: 'string', format: 'uuid' }
              }
            }
          }
        },
        // ─── Chat ────────────────────────────────────────────────────
        Message: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            conversation_id: { type: 'string', format: 'uuid' },
            sender_id: { type: 'string', format: 'uuid' },
            content: { type: 'string', maxLength: 500 },
            status: { type: 'string', enum: ['sent', 'delivered', 'read'] },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Conversation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            matchId: { type: 'string', format: 'uuid' },
            partner: { $ref: '#/components/schemas/User' },
            lastMessage: { type: 'object' },
            unreadCount: { type: 'integer' }
          }
        },
        // ─── Avatar ──────────────────────────────────────────────────
        Avatar: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            body_type: { type: 'string', enum: ['male', 'female', 'non-binary'] },
            hair_color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', example: '#4a3728' },
            skin_tone: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', example: '#f5d0a9' },
            equipped: { type: 'array', items: { $ref: '#/components/schemas/EquippedItem' } }
          }
        },
        ShopItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            category: { type: 'string', enum: ['hair', 'top', 'bottom', 'shoes', 'accessory'] },
            sprite_key: { type: 'string' },
            price: { type: 'integer', description: '0 = free' },
            is_premium: { type: 'boolean' },
            rarity: { type: 'string', enum: ['common', 'rare', 'epic', 'legendary'] }
          }
        },
        EquippedItem: {
          type: 'object',
          properties: {
            slot: { type: 'string' },
            item_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            sprite_key: { type: 'string' },
            color_override: { type: 'string' }
          }
        },
        // ─── Room ────────────────────────────────────────────────────
        Room: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            genre_tags: { type: 'array', items: { type: 'string' } },
            max_capacity: { type: 'integer', default: 100 },
            playerCount: { type: 'integer' },
            is_active: { type: 'boolean' },
            is_scheduled: { type: 'boolean' },
            scheduled_at: { type: 'string', format: 'date-time' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        // ─── Dating ──────────────────────────────────────────────────
        DateInvitation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            inviter_id: { type: 'string', format: 'uuid' },
            invitee_id: { type: 'string', format: 'uuid' },
            theme: { type: 'string', enum: ['rooftop', 'beach', 'cafe', 'music_garden'] },
            status: { type: 'string', enum: ['pending', 'accepted', 'rejected', 'expired'] },
            expires_at: { type: 'string', format: 'date-time' }
          }
        },
        Relationship: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['pending', 'active', 'ended'] },
            partner: { $ref: '#/components/schemas/User' },
            confirmed_at: { type: 'string', format: 'date-time' }
          }
        },
        // ─── Payment ─────────────────────────────────────────────────
        Payment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            amount: { type: 'number' },
            currency: { type: 'string', default: 'THB' },
            payment_method: { type: 'string', enum: ['credit_card', 'promptpay', 'mobile_banking', 'sandbox'] },
            status: { type: 'string', enum: ['pending', 'successful', 'failed', 'refunded'] },
            item_type: { type: 'string', enum: ['subscription', 'virtual_item', 'vip_ticket'] },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        // ─── Errors ──────────────────────────────────────────────────
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error message' },
            details: { type: 'array', items: { type: 'object' }, description: 'Validation error details' }
          }
        }
      },
      responses: {
        Unauthorized: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Authentication required' }
            }
          }
        },
        NotFound: {
          description: 'Resource not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
        },
        RateLimit: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Too many requests', retryAfter: 60 }
            }
          }
        },
        Forbidden: {
          description: 'Forbidden',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
        }
      }
    },
    security: [{ BearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Registration, login, token management' },
      { name: 'Profiles', description: 'User profile management and photos' },
      { name: 'Matching', description: 'Like, pass, match, unmatch' },
      { name: 'Chat', description: 'Direct messages and conversations' },
      { name: 'Rooms', description: 'Concert rooms and music queue' },
      { name: 'Avatars', description: 'Avatar customization, clothing, shop' },
      { name: 'Dating', description: 'Virtual dates and relationships' },
      { name: 'Payments', description: 'Premium subscription and purchases' },
      { name: 'Moderation', description: 'Block and report users' },
      { name: 'Account', description: 'PDPA data export, notifications, deletion' },
      { name: 'Health', description: 'Server health checks' }
    ]
  },
  apis: [
    './src/routes/auth.js',
    './src/routes/swagger-annotations.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
