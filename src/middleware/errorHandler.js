/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err.message);

  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Validation errors
  if (err.type === 'validation') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.details || err.message
    });
  }

  // Known operational errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.message
    });
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large. Maximum size is 5MB.'
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Unexpected file field'
    });
  }

  // Default server error
  res.status(500).json({
    error: 'Internal server error'
  });
}

/**
 * Create an operational error with status code
 */
function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

module.exports = { errorHandler, createError };
