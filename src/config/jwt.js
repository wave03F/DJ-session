module.exports = {
  secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
  refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  refreshExpiryMs: 7 * 24 * 60 * 60 * 1000 // 7 days in ms
};
