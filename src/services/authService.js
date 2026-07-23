const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const jwtConfig = require('../config/jwt');
const { createError } = require('../middleware/errorHandler');

const BCRYPT_COST = 12;

/**
 * Register a new user
 */
async function register({ email, password, nickname, dateOfBirth }) {
  // Verify age >= 18
  const age = calculateAge(new Date(dateOfBirth));
  if (age < 18) {
    throw createError('This platform is restricted to users aged 18 and above', 403);
  }

  // Check if email already exists
  const existing = await db('users').where({ email: email.toLowerCase() }).first();
  if (existing) {
    throw createError('An account with this email already exists', 409);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  // Create user
  const userId = uuidv4();
  const [user] = await db('users')
    .insert({
      id: userId,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      nickname: nickname.trim(),
      date_of_birth: dateOfBirth,
      age_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    })
    .returning(['id', 'email', 'nickname']);

  // Create empty profile
  await db('profiles').insert({
    id: uuidv4(),
    user_id: userId,
    display_name: nickname.trim(),
    relationship_status: 'single',
    discovery_age_min: 18,
    discovery_age_max: 50,
    discovery_genre_threshold: 3,
    is_active: false,
    updated_at: new Date()
  });

  // Generate tokens
  const tokens = await generateTokens(userId);

  return {
    user: { id: user.id, email: user.email, nickname: user.nickname },
    ...tokens
  };
}

/**
 * Login with email and password
 */
async function login({ email, password }) {
  const user = await db('users')
    .where({ email: email.toLowerCase() })
    .first();

  if (!user) {
    throw createError('Invalid email or password', 401);
  }

  if (user.is_suspended) {
    throw createError('Your account has been suspended', 403);
  }

  if (!user.password_hash) {
    throw createError('This account uses social login. Please sign in with your linked provider.', 401);
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    throw createError('Invalid email or password', 401);
  }

  // Invalidate all previous sessions (single active session policy)
  await db('sessions').where({ user_id: user.id }).update({ is_active: false });

  // Update last login
  await db('users').where({ id: user.id }).update({ last_login_at: new Date() });

  // Generate tokens
  const tokens = await generateTokens(user.id);

  return {
    user: { id: user.id, email: user.email, nickname: user.nickname, is_premium: user.is_premium },
    ...tokens
  };
}

/**
 * Refresh access token using refresh token
 */
async function refreshToken(token) {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret);

    if (decoded.type !== 'refresh') {
      throw createError('Invalid token type', 401);
    }

    // Verify session is still active
    const session = await db('sessions')
      .where({ user_id: decoded.userId, is_active: true })
      .first();

    if (!session) {
      throw createError('Session expired. Please login again.', 401);
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { userId: decoded.userId, type: 'access' },
      jwtConfig.secret,
      { expiresIn: jwtConfig.accessExpiry }
    );

    return { accessToken };
  } catch (err) {
    if (err.statusCode) throw err;
    throw createError('Invalid refresh token', 401);
  }
}

/**
 * Logout - invalidate session
 */
async function logout(userId) {
  await db('sessions').where({ user_id: userId }).update({ is_active: false });
}

/**
 * Generate access + refresh tokens and save session
 */
async function generateTokens(userId) {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    jwtConfig.secret,
    { expiresIn: jwtConfig.accessExpiry }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    jwtConfig.secret,
    { expiresIn: jwtConfig.refreshExpiry }
  );

  // Save session
  await db('sessions').insert({
    id: uuidv4(),
    user_id: userId,
    token_hash: hashToken(refreshToken),
    is_active: true,
    expires_at: new Date(Date.now() + jwtConfig.refreshExpiryMs),
    created_at: new Date()
  });

  return { accessToken, refreshToken };
}

/**
 * Simple hash for storing token reference (not the full token)
 */
function hashToken(token) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex').substring(0, 64);
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dob) {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

module.exports = {
  register,
  login,
  refreshToken,
  logout
};
