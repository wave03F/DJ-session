const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const db = require('../config/database');

/**
 * Middleware: Require authentication
 * Verifies JWT from Authorization header and attaches user to req
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, jwtConfig.secret);

    // Check if user exists and is not suspended
    const user = await db('users')
      .where({ id: decoded.userId })
      .andWhere({ is_suspended: false })
      .first();

    if (!user) {
      return res.status(401).json({ error: 'User not found or suspended' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      is_premium: user.is_premium
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    next(err);
  }
}

/**
 * Middleware: Optional authentication
 * Attaches user if valid token present, continues without error if not
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, jwtConfig.secret);

    const user = await db('users')
      .where({ id: decoded.userId, is_suspended: false })
      .first();

    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        is_premium: user.is_premium
      };
    }
  } catch (err) {
    // Token invalid or expired — just continue without user
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
