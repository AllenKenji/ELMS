/**
 * Reusable Joi Validation Schemas for ELMS Backend
 *
 * Covers authentication, ordinances, and messaging routes.
 * Import the relevant schema and pass it to the validate() middleware.
 */

const Joi = require('joi');

// ---------------------------------------------------------------------------
// Auth schemas
// ---------------------------------------------------------------------------

/**
 * Schema for POST /auth/register
 */
const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'string.min': 'Name must be at least 2 characters.',
    'string.max': 'Name must be at most 100 characters.',
    'any.required': 'Name is required.',
  }),
  email: Joi.string().trim().email().required().messages({
    'string.email': 'A valid email address is required.',
    'any.required': 'Email is required.',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters.',
    'any.required': 'Password is required.',
  }),
  roleId: Joi.number().integer().min(1).max(6).required().messages({
    'number.base': 'Role ID must be a number.',
    'number.min': 'Role ID must be between 1 and 6.',
    'number.max': 'Role ID must be between 1 and 6.',
    'any.required': 'Role ID is required.',
  }),
});

/**
 * Schema for POST /auth/login
 */
const loginSchema = Joi.object({
  email: Joi.string().trim().email().required().messages({
    'string.email': 'A valid email address is required.',
    'any.required': 'Email is required.',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required.',
  }),
});

/**
 * Schema for POST /auth/refresh
 */
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token is required.',
  }),
});

// ---------------------------------------------------------------------------
// Ordinance schemas
// ---------------------------------------------------------------------------

const ORDINANCE_STATUSES = [
  'draft',
  'pending',
  'under_review',
  'approved',
  'rejected',
  'enacted',
];

/**
 * Schema for POST /ordinances
 */
const createOrdinanceSchema = Joi.object({
  title: Joi.string().trim().min(3).max(255).required().messages({
    'string.min': 'Title must be at least 3 characters.',
    'string.max': 'Title must be at most 255 characters.',
    'any.required': 'Title is required.',
  }),
  description: Joi.string().trim().max(5000).optional().allow('').messages({
    'string.max': 'Description must be at most 5000 characters.',
  }),
  content: Joi.string().trim().required().messages({
    'any.required': 'Content is required.',
  }),
  status: Joi.string()
    .valid(...ORDINANCE_STATUSES)
    .default('draft')
    .messages({
      'any.only': `Status must be one of: ${ORDINANCE_STATUSES.join(', ')}.`,
    }),
  session_id: Joi.number().integer().positive().optional().allow(null),
  committee_id: Joi.number().integer().positive().optional().allow(null),
}).options({ allowUnknown: false });

/**
 * Schema for PUT /ordinances/:id
 */
const updateOrdinanceSchema = Joi.object({
  title: Joi.string().trim().min(3).max(255).optional().messages({
    'string.min': 'Title must be at least 3 characters.',
    'string.max': 'Title must be at most 255 characters.',
  }),
  description: Joi.string().trim().max(5000).optional().allow('').messages({
    'string.max': 'Description must be at most 5000 characters.',
  }),
  content: Joi.string().trim().optional(),
  status: Joi.string()
    .valid(...ORDINANCE_STATUSES)
    .optional()
    .messages({
      'any.only': `Status must be one of: ${ORDINANCE_STATUSES.join(', ')}.`,
    }),
  session_id: Joi.number().integer().positive().optional().allow(null),
  committee_id: Joi.number().integer().positive().optional().allow(null),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided to update.',
  })
  .options({ allowUnknown: false });

// ---------------------------------------------------------------------------
// Message schemas
// ---------------------------------------------------------------------------

/**
 * Schema for POST /messages
 */
const sendMessageSchema = Joi.object({
  recipient_id: Joi.number().integer().positive().required().messages({
    'number.base': 'Recipient ID must be a number.',
    'number.positive': 'Recipient ID must be a positive integer.',
    'any.required': 'Recipient ID is required.',
  }),
  subject: Joi.string().trim().min(1).max(255).required().messages({
    'string.min': 'Subject cannot be empty.',
    'string.max': 'Subject must be at most 255 characters.',
    'any.required': 'Subject is required.',
  }),
  body: Joi.string().trim().min(1).required().messages({
    'string.min': 'Message body cannot be empty.',
    'any.required': 'Message body is required.',
  }),
}).options({ allowUnknown: false });

/**
 * Schema for GET /messages/inbox and /messages/sent query parameters
 */
const messageSearchSchema = Joi.object({
  search: Joi.string().trim().max(255).optional().allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}).options({ allowUnknown: true });

module.exports = {
  // Auth
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  // Ordinances
  createOrdinanceSchema,
  updateOrdinanceSchema,
  // Messages
  sendMessageSchema,
  messageSearchSchema,
};
