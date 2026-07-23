const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const jwtConfig = require('../config/jwt');
const jwt = require('jsonwebtoken');
const { createError } = require('../middleware/errorHandler');

const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const LINE_PROFILE_URL = 'https://api.line.me/v2/profile';

/**
 * Generate Line Login authorization URL
 */
function getAuthorizationUrl(state) {
  const channelId = process.env.LINE_CHANNEL_ID;
  const callbackUrl = process.env.LINE_CALLBACK_URL;

  if (!channelId || !callbackUrl) {
    throw createError('Line OAuth not configured', 500);
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: channelId,
    redirect_uri: callbackUrl,
    state: state || uuidv4(),
    scope: 'profile openid email'
  });

  return `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(code) {
  const response = await fetch(LINE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.LINE_CALLBACK_URL,
      client_id: process.env.LINE_CHANNEL_ID,
      client_secret: process.env.LINE_CHANNEL_SECRET
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw createError(`Line token exchange failed: ${err.error_description || 'Unknown error'}`, 401);
  }

  return response.json();
}

/**
 * Get Line user profile using access token
 */
async function getLineProfile(accessToken) {
  const response = await fetch(LINE_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw createError('Failed to fetch Line profile', 401);
  }

  return response.json();
}

/**
 * Handle Line OAuth callback — create or link account
 */
async function handleCallback(code) {
  // Step 1: Exchange code for token
  const tokenData = await exchangeCodeForToken(code);

  // Step 2: Get user profile from Line
  const lineProfile = await getLineProfile(tokenData.access_token);
  const lineUserId = lineProfile.userId;
  const displayName = lineProfile.displayName || 'Line User';

  // Step 3: Check if Line account already linked
  let user = await db('users')
    .where({ oauth_provider: 'line', oauth_id: lineUserId })
    .first();

  if (user) {
    // Existing user — login
    if (user.is_suspended) {
      throw createError('Your account has been suspended', 403);
    }

    // Invalidate previous sessions (single active session)
    await db('sessions').where({ user_id: user.id }).update({ is_active: false });
    await db('users').where({ id: user.id }).update({ last_login_at: new Date() });
  } else {
    // New user — create account
    // Note: Line doesn't provide date_of_birth, so we require it later during onboarding
    const userId = uuidv4();

    user = {
      id: userId,
      email: `line_${lineUserId}@placeholder.local`, // Placeholder until user sets real email
      password_hash: null,
      nickname: displayName.substring(0, 50),
      date_of_birth: '2000-01-01', // Placeholder — must be updated during onboarding
      age_verified: false, // Requires age verification step
      oauth_provider: 'line',
      oauth_id: lineUserId,
      is_premium: false,
      is_suspended: false,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('users').insert(user);

    // Create empty profile
    await db('profiles').insert({
      id: uuidv4(),
      user_id: userId,
      display_name: displayName.substring(0, 100),
      relationship_status: 'single',
      discovery_age_min: 18,
      discovery_age_max: 50,
      discovery_genre_threshold: 3,
      is_active: false,
      updated_at: new Date()
    });
  }

  // Step 4: Generate JWT tokens
  const accessToken = jwt.sign(
    { userId: user.id, type: 'access' },
    jwtConfig.secret,
    { expiresIn: jwtConfig.accessExpiry }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    jwtConfig.secret,
    { expiresIn: jwtConfig.refreshExpiry }
  );

  // Save session
  const crypto = require('crypto');
  await db('sessions').insert({
    id: uuidv4(),
    user_id: user.id,
    token_hash: crypto.createHash('sha256').update(refreshToken).digest('hex').substring(0, 64),
    is_active: true,
    expires_at: new Date(Date.now() + jwtConfig.refreshExpiryMs),
    created_at: new Date()
  });

  return {
    user: {
      id: user.id,
      nickname: user.nickname,
      is_premium: user.is_premium,
      age_verified: user.age_verified,
      is_new_user: !user.age_verified // Flag for client to show onboarding
    },
    accessToken,
    refreshToken
  };
}

/**
 * Complete age verification for Line OAuth users
 * (Called during onboarding after Line login)
 */
async function completeAgeVerification(userId, dateOfBirth) {
  const age = calculateAge(new Date(dateOfBirth));
  if (age < 18) {
    // Delete the account since they're underage
    await db('profiles').where({ user_id: userId }).del();
    await db('sessions').where({ user_id: userId }).del();
    await db('users').where({ id: userId }).del();
    throw createError('This platform is restricted to users aged 18 and above. Your account has been removed.', 403);
  }

  await db('users').where({ id: userId }).update({
    date_of_birth: dateOfBirth,
    age_verified: true,
    updated_at: new Date()
  });

  return { age_verified: true };
}

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
  getAuthorizationUrl,
  handleCallback,
  completeAgeVerification
};
