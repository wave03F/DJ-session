const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const authService = require('../services/authService');
const lineAuthService = require('../services/lineAuthService');

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new account
 *     description: Creates a new user account. Users must be 18+ years old (age gate enforced).
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, nickname, dateOfBirth]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: mypassword123
 *               nickname:
 *                 type: string
 *                 maxLength: 50
 *                 example: CoolUser
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 description: Must be 18+ years ago
 *                 example: "2000-01-15"
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: User is under 18 years old
 *         content:
 *           application/json:
 *             example:
 *               error: This platform is restricted to users aged 18 and above
 *       409:
 *         description: Email already exists
 *       429:
 *         $ref: '#/components/responses/RateLimit'
 */
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('nickname').trim().isLength({ min: 1, max: 50 }).withMessage('Nickname required (max 50 chars)'),
  body('dateOfBirth').isISO8601().withMessage('Valid date of birth required (YYYY-MM-DD)'),
  validate
], async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: mypassword123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials or account suspended
 *       429:
 *         $ref: '#/components/responses/RateLimit'
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
  validate
], async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Use a valid refresh token to get a new access token without re-login.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token received from login/register (valid 7 days)
 *     responses:
 *       200:
 *         description: New access token issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token required'),
  validate
], async (req, res, next) => {
  try {
    const result = await authService.refreshToken(req.body.refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout current session
 *     description: Invalidates the current session. User must re-login to get new tokens.
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             example:
 *               message: Logged out successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await authService.logout(req.user.id);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// ─── Line OAuth ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/auth/line:
 *   get:
 *     summary: Start Line OAuth login
 *     description: Redirects user to Line's authorization page. After approval, Line redirects to /api/auth/line/callback.
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to Line authorization
 *       500:
 *         description: Line OAuth not configured
 */
router.get('/line', (req, res, next) => {
  try {
    const url = lineAuthService.getAuthorizationUrl();
    res.redirect(url);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/line/callback:
 *   get:
 *     summary: Line OAuth callback
 *     description: Handles Line OAuth callback. Creates or links account and redirects with JWT tokens.
 *     tags: [Auth]
 *     security: []
 *     parameters:
 *       - name: code
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Authorization code from Line
 *       - name: state
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirect to frontend with tokens
 */
router.get('/line/callback', async (req, res, next) => {
  try {
    const { code, error } = req.query;
    if (error) return res.redirect(`${process.env.APP_URL || '/'}?auth_error=${error}`);
    if (!code) return res.redirect(`${process.env.APP_URL || '/'}?auth_error=no_code`);
    const result = await lineAuthService.handleCallback(code);
    const params = new URLSearchParams({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      isNewUser: result.user.is_new_user ? '1' : '0',
      ageVerified: result.user.age_verified ? '1' : '0'
    });
    res.redirect(`${process.env.APP_URL || '/'}?auth_success=1&${params.toString()}`);
  } catch (err) {
    console.error('Line callback error:', err.message);
    res.redirect(`${process.env.APP_URL || '/'}?auth_error=callback_failed`);
  }
});

/**
 * @swagger
 * /api/auth/line/verify-age:
 *   post:
 *     summary: Verify age for Line OAuth users
 *     description: Line doesn't provide date of birth, so new Line users must complete age verification before using the platform.
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dateOfBirth]
 *             properties:
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: "1998-07-20"
 *     responses:
 *       200:
 *         description: Age verified
 *         content:
 *           application/json:
 *             example:
 *               age_verified: true
 *       403:
 *         description: User is under 18 — account deleted
 */
router.post('/line/verify-age', requireAuth, [
  body('dateOfBirth').isISO8601().withMessage('Valid date of birth required (YYYY-MM-DD)'),
  validate
], async (req, res, next) => {
  try {
    const result = await lineAuthService.completeAgeVerification(req.user.id, req.body.dateOfBirth);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
