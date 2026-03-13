/**
 * Frontend Error Utilities for ELMS
 *
 * Helper functions for formatting and displaying error responses from the API.
 * Works with the normalised error objects produced by the Axios response interceptor
 * in `src/api/api.js`.
 */

/**
 * @typedef {Object} NormalisedError
 * @property {number} status - HTTP status code (0 = network error, -1 = setup error).
 * @property {string} message - Top-level human-readable error message.
 * @property {Array<{field: string, message: string}>} details - Field-level validation errors.
 */

/**
 * Extracts a displayable message string from any error value.
 * Handles normalised API errors, plain Error objects, and strings.
 *
 * @param {NormalisedError|Error|string|unknown} error - The error to format.
 * @returns {string} A user-friendly error message.
 *
 * @example
 * try {
 *   await api.post('/auth/login', credentials);
 * } catch (err) {
 *   setError(getErrorMessage(err));
 * }
 */
export function getErrorMessage(error) {
  if (!error) return 'An unexpected error occurred.';

  // Normalised API error from the Axios interceptor
  if (typeof error === 'object' && 'message' in error) {
    return error.message;
  }

  // Native Error object
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred.';
}

/**
 * Returns a map of field names to their validation error messages.
 * Useful for highlighting individual form fields.
 *
 * @param {NormalisedError|unknown} error - The error received from the API.
 * @returns {Record<string, string>} Map of field → first error message for that field.
 *
 * @example
 * const fieldErrors = getFieldErrors(err);
 * // { email: 'A valid email address is required.', password: 'Password is required.' }
 */
export function getFieldErrors(error) {
  if (
    !error ||
    typeof error !== 'object' ||
    !Array.isArray(error.details) ||
    error.details.length === 0
  ) {
    return {};
  }

  return error.details.reduce((acc, { field, message }) => {
    if (field && !acc[field]) {
      acc[field] = message;
    }
    return acc;
  }, {});
}

/**
 * Returns true when the error is a validation failure (HTTP 422).
 *
 * @param {NormalisedError|unknown} error
 * @returns {boolean}
 */
export function isValidationError(error) {
  return typeof error === 'object' && error !== null && error.status === 422;
}

/**
 * Returns true when the error indicates the user is unauthenticated (HTTP 401).
 *
 * @param {NormalisedError|unknown} error
 * @returns {boolean}
 */
export function isAuthError(error) {
  return typeof error === 'object' && error !== null && error.status === 401;
}

/**
 * Returns true when the error indicates the user lacks permission (HTTP 403).
 *
 * @param {NormalisedError|unknown} error
 * @returns {boolean}
 */
export function isForbiddenError(error) {
  return typeof error === 'object' && error !== null && error.status === 403;
}

/**
 * Returns true when the error is a network failure (no response received).
 *
 * @param {NormalisedError|unknown} error
 * @returns {boolean}
 */
export function isNetworkError(error) {
  return typeof error === 'object' && error !== null && error.status === 0;
}
