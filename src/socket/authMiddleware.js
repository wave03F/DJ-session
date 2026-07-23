const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const db = require('../config/database');

/**
 * Socket.io authentication middleware
 * - If token provided: verify and attach user
 * - If no token: allow as guest (for backward-compatible game play)
 */
async function socketAuthMiddleware(socket, next) {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      // Allow guest connections (backward-compatible with original game)
      socket.user = {
        id: null,
        nickname: 'Guest_' + Math.floor(Math.random() * 9999),
        is_guest: true,
        is_premium: false
      };
      return next();
    }

    const decoded = jwt.verify(token, jwtConfig.secret);

    if (decoded.type !== 'access') {
      return next(new Error('Invalid token type'));
    }

    // Load user
    const user = await db('users')
      .where({ id: decoded.userId, is_suspended: false })
      .first();

    if (!user) {
      return next(new Error('User not found or suspended'));
    }

    // Load profile
    const profile = await db('profiles')
      .where({ user_id: user.id })
      .first();

    // Attach user data to socket
    socket.user = {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      is_guest: false,
      is_premium: user.is_premium,
      profile: profile ? {
        display_name: profile.display_name,
        gender: profile.gender,
        relationship_status: profile.relationship_status
      } : null
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new Error('Token expired'));
    }
    return next(new Error('Authentication failed'));
  }
}

module.exports = { socketAuthMiddleware };
