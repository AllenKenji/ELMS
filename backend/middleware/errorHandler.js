/**
 * Global Error Handling Middleware for ELMS Backend
 *
 * Must be registered AFTER all routes in server.js:
 *   app.use(errorHandler);
 *
 * Catches every error forwarded via next(err) and sends a structured JSON
 * response. In development mode the full stack trace is included.
 */

const { AppError, ValidationError } = require('../utils/errorHandler');

/**
 * Formats a Mongoose/PostgreSQL duplicate-key error into an AppError.
 * @param {Error} err
 * @returns {AppError}
 */
function handleDuplicateKeyError(err) {
  // PostgreSQL unique violation code
  const match = err.detail && err.detail.match(/\(([^)]+)\)=\(([^)]+)\)/);
  const field = match ? match[1] : 'field';
  const value = match ? match[2] : 'value';
  return new AppError(`Duplicate value for ${field}: ${value} already exists.`, 409);
}

/**
 * Formats a JWT error into an AppError.
 * @param {Error} err
 * @returns {AppError}
 */
function handleJWTError() {
  return new AppError('Invalid token. Please log in again.', 401);
}

/**
 * Formats a JWT expiry error into an AppError.
 * @returns {AppError}
 */
function handleJWTExpiredError() {
  return new AppError('Your token has expired. Please log in again.', 401);
}

/**
 * Sends error details appropriate for development environments.
 * @param {Error} err
 * @param {import('express').Response} res
 */
function sendDevError(err, res) {
  res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    message: err.message,
    ...(err instanceof ValidationError && { details: err.details }),
    stack: err.stack,
  });
}

/**
 * Sends a safe error response for production environments.
 * Operational errors expose their message; unexpected errors show a generic message.
 * @param {Error} err
 * @param {import('express').Response} res
 */
function sendProdError(err, res) {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      ...(err instanceof ValidationError && { details: err.details }),
    });
  } else {
    // Unknown / programming error – don't leak details
    console.error('UNEXPECTED ERROR:', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong. Please try again later.',
    });
  }
}

/**
 * Express global error-handling middleware.
 * Must have exactly four parameters so Express identifies it as an error handler.
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    sendDevError(err, res);
    return;
  }

  // Production: convert known error types into operational AppErrors
  let error = err;

  if (err.code === '23505') {
    // PostgreSQL unique violation
    error = handleDuplicateKeyError(err);
  } else if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  } else if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  sendProdError(error, res);
}

module.exports = errorHandler;
