/**
 * Centralized Validation Middleware for ELMS Backend
 *
 * Wraps Joi schemas and attaches them to any route as Express middleware.
 * Validated/coerced values are written back onto the request so controllers
 * always receive clean, typed data.
 */

const { ValidationError } = require('../utils/errorHandler');

/**
 * Supported parts of an HTTP request that can be validated.
 * @typedef {'body'|'query'|'params'} RequestPart
 */

/**
 * Factory that returns an Express middleware function validating the specified
 * part of the request against the provided Joi schema.
 *
 * On failure the middleware calls next() with a ValidationError so the global
 * error handler can format a consistent 422 response.
 *
 * @param {import('joi').Schema} schema - Joi schema to validate against.
 * @param {RequestPart} [part='body'] - Which part of the request to validate.
 * @returns {import('express').RequestHandler}
 *
 * @example
 * const { validate } = require('../middleware/validation');
 * const { loginSchema } = require('../validators/schemas');
 *
 * router.post('/login', validate(loginSchema), authController.login);
 */
function validate(schema, part = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[part], {
      abortEarly: false,
      stripUnknown: part !== 'query', // keep unknown query params for pagination etc.
      convert: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      return next(new ValidationError('Validation failed', details));
    }

    // Replace request data with coerced/stripped values from Joi
    req[part] = value;
    return next();
  };
}

/**
 * Convenience wrapper to validate req.body.
 *
 * @param {import('joi').Schema} schema
 * @returns {import('express').RequestHandler}
 */
function validateBody(schema) {
  return validate(schema, 'body');
}

/**
 * Convenience wrapper to validate req.query.
 *
 * @param {import('joi').Schema} schema
 * @returns {import('express').RequestHandler}
 */
function validateQuery(schema) {
  return validate(schema, 'query');
}

/**
 * Convenience wrapper to validate req.params.
 *
 * @param {import('joi').Schema} schema
 * @returns {import('express').RequestHandler}
 */
function validateParams(schema) {
  return validate(schema, 'params');
}

module.exports = { validate, validateBody, validateQuery, validateParams };
