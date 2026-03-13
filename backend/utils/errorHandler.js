/**
 * Custom Error Handler Classes for ELMS Backend
 *
 * Provides structured error classes for consistent error handling
 * across the application.
 */

/**
 * Base application error class.
 * Extends the native Error with an HTTP status code and operational flag.
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable error description.
   * @param {number} statusCode - HTTP status code to send to the client.
   */
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    /** @type {'error'|'fail'} */
    this.status = String(statusCode).startsWith('4') ? 'fail' : 'error';
    /** Marks this as an operational (expected) error, not a programming bug. */
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error class.
 * Wraps Joi or manual validation failures with a 422 status code.
 */
class ValidationError extends AppError {
  /**
   * @param {string} message - Summary of the validation failure.
   * @param {Array<{field: string, message: string}>} [details=[]] - Field-level errors.
   */
  constructor(message, details = []) {
    super(message, 422);
    this.details = details;
    this.name = 'ValidationError';
  }
}

module.exports = { AppError, ValidationError };
