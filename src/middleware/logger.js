/**
 * Structured JSON logger for production
 * Falls back to console in development
 */

const isDev = process.env.NODE_ENV !== 'production';

function formatLog(level, message, meta = {}) {
  if (isDev) {
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `[${level.toUpperCase()}] ${message}${metaStr}`;
  }
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  });
}

const logger = {
  info: (message, meta) => console.log(formatLog('info', message, meta)),
  warn: (message, meta) => console.warn(formatLog('warn', message, meta)),
  error: (message, meta) => console.error(formatLog('error', message, meta)),
  debug: (message, meta) => {
    if (isDev) console.debug(formatLog('debug', message, meta));
  }
};

/**
 * HTTP request logging middleware
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]('HTTP ' + req.method + ' ' + req.path, {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      ip: req.ip,
      user_id: req.user?.id
    });
  });
  next();
}

module.exports = { logger, requestLogger };
