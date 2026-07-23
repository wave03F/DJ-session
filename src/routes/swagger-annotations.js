/**
 * @swagger
 * /api/profiles/me:
 *   get:
 *     summary: Get own profile
 *     tags: [Profiles]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Full profile with photos, genres, and preferences
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   put:
 *     summary: Update profile fields
 *     tags: [Profiles]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               display_name:
 *                 type: string
 *                 maxLength: 100
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *               gender:
 *                 type: string
 *                 enum: [male, female, non-binary]
 *     responses:
 *       200:
 *         description: Updated profile
 *
 * /api/profiles/me/genres:
 *   put:
 *     summary: Update music genre preferences
 *     tags: [Profiles]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               genres:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [pop, rock, hiphop, rnb, jazz, classical, electronic, country, indie, metal, reggae, blues, folk, punk, kpop, jpop, thai, latin, soul, ambient]
 *                 example: [electronic, kpop, indie]
 *     responses:
 *       200:
 *         description: Updated genres
 *
 * /api/profiles/me/photos:
 *   post:
 *     summary: Upload a profile photo
 *     tags: [Profiles]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: JPEG or PNG, max 5MB
 *     responses:
 *       201:
 *         description: Photo uploaded
 *       400:
 *         description: Invalid file type or max 6 photos reached
 *
 * /api/matches/like/{userId}:
 *   post:
 *     summary: Like a user
 *     description: Sends a like. If mutual, creates a Match and auto-creates a DM conversation.
 *     tags: [Matching]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Like result (may include match)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LikeResponse'
 *       429:
 *         description: Daily like limit reached (20/day for free users)
 *
 * /api/matches/pass/{userId}:
 *   post:
 *     summary: Pass (reject) a user
 *     description: Hides the user from suggestions for 30 days.
 *     tags: [Matching]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User passed
 *
 * /api/matches:
 *   get:
 *     summary: Get all active matches
 *     tags: [Matching]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of matches with partner info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 matches:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Match'
 *
 * /api/matches/{matchId}:
 *   delete:
 *     summary: Unmatch a user
 *     description: Removes match, deletes conversation, blocks for 30 days.
 *     tags: [Matching]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: matchId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Unmatched
 *
 * /api/matches/likes-remaining:
 *   get:
 *     summary: Get remaining daily likes
 *     tags: [Matching]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Remaining likes info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 remaining:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 used:
 *                   type: integer
 *
 * /api/chat/conversations:
 *   get:
 *     summary: Get all conversations
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of conversations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Conversation'
 *
 * /api/chat/conversations/{id}/messages:
 *   get:
 *     summary: Get messages in conversation
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 50
 *       - name: before
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Messages list
 *   post:
 *     summary: Send a message
 *     description: REST fallback. Prefer Socket.io dm:send for real-time.
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Hey! Nice to meet you!"
 *     responses:
 *       201:
 *         description: Message sent
 *
 * /api/rooms:
 *   get:
 *     summary: List active and upcoming rooms
 *     tags: [Rooms]
 *     security: []
 *     responses:
 *       200:
 *         description: Room list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rooms:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Room'
 *   post:
 *     summary: Create a room (Premium/Admin only)
 *     tags: [Rooms]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *               description:
 *                 type: string
 *               genreTags:
 *                 type: array
 *                 items:
 *                   type: string
 *               maxCapacity:
 *                 type: integer
 *                 maximum: 100
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Room created
 *       403:
 *         description: Premium required
 *
 * /api/avatars/me:
 *   get:
 *     summary: Get current avatar with equipped items
 *     tags: [Avatars]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Avatar data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Avatar'
 *   post:
 *     summary: Create avatar (first time)
 *     tags: [Avatars]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bodyType]
 *             properties:
 *               bodyType:
 *                 type: string
 *                 enum: [male, female, non-binary]
 *               hairColor:
 *                 type: string
 *                 pattern: '^#[0-9a-fA-F]{6}$'
 *                 example: '#ff69b4'
 *               skinTone:
 *                 type: string
 *                 pattern: '^#[0-9a-fA-F]{6}$'
 *                 example: '#f5d0a9'
 *     responses:
 *       201:
 *         description: Avatar created + free items granted
 *   put:
 *     summary: Update avatar (body, colors)
 *     tags: [Avatars]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bodyType:
 *                 type: string
 *                 enum: [male, female, non-binary]
 *               hairColor:
 *                 type: string
 *               skinTone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Avatar updated
 *
 * /api/avatars/me/equip:
 *   put:
 *     summary: Equip an item to a slot
 *     tags: [Avatars]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [itemId, slot]
 *             properties:
 *               itemId:
 *                 type: string
 *                 format: uuid
 *               slot:
 *                 type: string
 *                 enum: [hair, top, bottom, shoes, accessory]
 *               colorOverride:
 *                 type: string
 *                 pattern: '^#[0-9a-fA-F]{6}$'
 *     responses:
 *       200:
 *         description: Item equipped, returns full avatar
 *       403:
 *         description: Item not owned or gender-restricted
 *
 * /api/avatars/shop:
 *   get:
 *     summary: Browse shop items
 *     tags: [Avatars]
 *     security: []
 *     parameters:
 *       - name: category
 *         in: query
 *         schema:
 *           type: string
 *           enum: [hair, top, bottom, shoes, accessory]
 *       - name: gender
 *         in: query
 *         schema:
 *           type: string
 *           enum: [male, female, non-binary]
 *       - name: freeOnly
 *         in: query
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Shop items list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ShopItem'
 *
 * /api/avatars/inventory:
 *   get:
 *     summary: Get owned items
 *     tags: [Avatars]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User inventory
 *
 * /api/dating/invite/{userId}:
 *   post:
 *     summary: Send a date invitation
 *     description: Invite a matched user for a virtual date. Free users limited to 3/day.
 *     tags: [Dating]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [theme]
 *             properties:
 *               theme:
 *                 type: string
 *                 enum: [rooftop, beach, cafe, music_garden]
 *               proposedTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Invitation sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DateInvitation'
 *       403:
 *         description: Must be matched first
 *       429:
 *         description: Daily invite limit reached
 *
 * /api/dating/relationship:
 *   get:
 *     summary: Get current relationship status
 *     tags: [Dating]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Relationship status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [single, in_relationship]
 *                 relationship:
 *                   $ref: '#/components/schemas/Relationship'
 *                 partner:
 *                   $ref: '#/components/schemas/User'
 *   delete:
 *     summary: End current relationship
 *     description: Ends the relationship. Both users revert to "single" status.
 *     tags: [Dating]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Relationship ended
 *
 * /api/dating/relationship/request/{userId}:
 *   post:
 *     summary: Request to become a couple
 *     description: Must be matched first. If partner has already requested, auto-confirms.
 *     tags: [Dating]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       201:
 *         description: Request sent (pending)
 *       409:
 *         description: Already in a relationship
 *
 * /api/payments/subscribe:
 *   post:
 *     summary: Subscribe to Premium
 *     description: "Activates Premium membership. Plans: monthly (299 THB) or yearly (2990 THB). Use isSandbox: true for testing."
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plan:
 *                 type: string
 *                 enum: [monthly, yearly]
 *                 default: monthly
 *               omiseToken:
 *                 type: string
 *                 description: Omise card token (omit for sandbox)
 *               isSandbox:
 *                 type: boolean
 *                 default: true
 *                 description: Set true for test mode (no real charge)
 *     responses:
 *       201:
 *         description: Subscription activated
 *         content:
 *           application/json:
 *             example:
 *               subscriptionId: "uuid"
 *               plan: monthly
 *               amount: 299
 *               currency: THB
 *               expiresAt: "2026-08-22T00:00:00.000Z"
 *               activated: true
 *       409:
 *         description: Already have active subscription
 *   delete:
 *     summary: Cancel Premium subscription
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription cancelled (remains active until expiry)
 *
 * /api/payments/purchase:
 *   post:
 *     summary: Purchase a virtual item
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [itemId]
 *             properties:
 *               itemId:
 *                 type: string
 *                 format: uuid
 *               omiseToken:
 *                 type: string
 *               isSandbox:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Item purchased and added to inventory
 *       409:
 *         description: Already owned
 *
 * /api/payments/history:
 *   get:
 *     summary: Get payment history and subscription status
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Payment history
 *
 * /api/moderation/block/{userId}:
 *   post:
 *     summary: Block a user
 *     description: Prevents all interaction. Deactivates match and conversation if exists.
 *     tags: [Moderation]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User blocked
 *   delete:
 *     summary: Unblock a user
 *     tags: [Moderation]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User unblocked
 *
 * /api/moderation/report:
 *   post:
 *     summary: Report a user
 *     description: Creates a moderation ticket. 3+ reports in 24h triggers auto-suspend.
 *     tags: [Moderation]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reportedId, category]
 *             properties:
 *               reportedId:
 *                 type: string
 *                 format: uuid
 *               category:
 *                 type: string
 *                 enum: [harassment, inappropriate_content, spam, fake_profile, underage]
 *               description:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Report submitted
 *
 * /api/account:
 *   delete:
 *     summary: Delete account (PDPA)
 *     description: Schedules account for permanent deletion within 30 days. Account is suspended immediately.
 *     tags: [Account]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Deletion scheduled
 *         content:
 *           application/json:
 *             example:
 *               message: Account deletion scheduled. Your account will be permanently deleted within 30 days.
 *               scheduledDeletion: "2026-08-22T00:00:00.000Z"
 *
 * /api/account/export:
 *   get:
 *     summary: Export personal data (PDPA)
 *     description: Downloads all user data in JSON format. Includes profile, photos, genres, matches, and payments.
 *     tags: [Account]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Personal data export (JSON file)
 *
 * /api/account/notifications:
 *   get:
 *     summary: Get notifications
 *     tags: [Account]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Notification list
 *
 * /api/account/notifications/read:
 *   put:
 *     summary: Mark all notifications as read
 *     tags: [Account]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications marked as read
 *
 * /api/health:
 *   get:
 *     summary: Basic health check
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Server is running
 *         content:
 *           application/json:
 *             example:
 *               status: ok
 *               timestamp: "2026-07-22T09:00:00.000Z"
 *
 * /api/health/detailed:
 *   get:
 *     summary: Detailed health check
 *     description: Checks database, Redis, and WebSocket connections.
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: All services healthy
 *         content:
 *           application/json:
 *             example:
 *               status: ok
 *               services:
 *                 database: ok
 *                 redis: ok
 *                 websocket: ok
 *               uptime_seconds: 120
 *               memory_mb: 45
 *       503:
 *         description: Service degraded
 */
