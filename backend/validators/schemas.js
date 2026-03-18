/**
 * Reusable Joi Validation Schemas for ELMS Backend
 *
 * Covers authentication, ordinances, and messaging routes.
 * Import the relevant schema and pass it to the validate() middleware.
 */

const Joi = require('joi');

const emailSchema = Joi.string().trim().email({ tlds: { allow: false } });

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
  email: emailSchema.required().messages({
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
  email: emailSchema.required().messages({
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
  'Draft',
  'Submitted',
  'Under Review',
  'Approved',
  'Rejected',
  'Published',
  'Archived',
];

const attachmentsSchema = Joi.array().items(Joi.string().trim().max(500)).optional().default([]);
const coAuthorIdsSchema = Joi.array().items(Joi.number().integer().positive());

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
  ordinance_number: Joi.string().trim().max(100).optional().allow(null, '').messages({
    'string.max': 'Ordinance number must be at most 100 characters.',
  }),
  content: Joi.string().trim().required().messages({
    'any.required': 'Content is required.',
  }),
  remarks: Joi.string().trim().max(5000).optional().allow(null, '').messages({
    'string.max': 'Remarks must be at most 5000 characters.',
  }),
  co_authors: coAuthorIdsSchema.optional().default([]),
  whereas_clauses: Joi.string().trim().min(10).max(10000).required().messages({
    'string.min': 'Whereas clauses must be at least 10 characters.',
    'string.max': 'Whereas clauses must be at most 10000 characters.',
    'any.required': 'Whereas clauses are required.',
  }),
  effectivity_clause: Joi.string().trim().min(5).max(5000).required().messages({
    'string.min': 'Effectivity clause must be at least 5 characters.',
    'string.max': 'Effectivity clause must be at most 5000 characters.',
    'any.required': 'Effectivity clause is required.',
  }),
  attachments: attachmentsSchema,
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
  ordinance_number: Joi.string().trim().max(100).optional().allow(null, '').messages({
    'string.max': 'Ordinance number must be at most 100 characters.',
  }),
  content: Joi.string().trim().optional(),
  remarks: Joi.string().trim().max(5000).optional().allow(null, '').messages({
    'string.max': 'Remarks must be at most 5000 characters.',
  }),
  co_authors: coAuthorIdsSchema.optional(),
  whereas_clauses: Joi.string().trim().min(10).max(10000).optional().allow(null, '').messages({
    'string.min': 'Whereas clauses must be at least 10 characters.',
    'string.max': 'Whereas clauses must be at most 10000 characters.',
  }),
  effectivity_clause: Joi.string().trim().min(5).max(5000).optional().allow(null, '').messages({
    'string.min': 'Effectivity clause must be at least 5 characters.',
    'string.max': 'Effectivity clause must be at most 5000 characters.',
  }),
  attachments: attachmentsSchema,
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

const createResolutionSchema = Joi.object({
  title: Joi.string().trim().min(3).max(255).required(),
  description: Joi.string().trim().min(10).max(5000).required(),
  resolution_number: Joi.string().trim().max(100).optional().allow(null, ''),
  content: Joi.string().trim().min(20).required(),
  remarks: Joi.string().trim().max(5000).optional().allow(null, ''),
  co_authors: coAuthorIdsSchema.required(),
  whereas_clauses: Joi.string().trim().min(10).max(10000).required(),
  effectivity_clause: Joi.string().trim().min(5).max(5000).required(),
  attachments: attachmentsSchema,
  status: Joi.string().valid('Draft', 'Submitted', 'Under Review', 'Approved', 'Published', 'Rejected').optional(),
}).options({ allowUnknown: false });

const updateResolutionSchema = Joi.object({
  title: Joi.string().trim().min(3).max(255).optional(),
  description: Joi.string().trim().min(10).max(5000).optional(),
  resolution_number: Joi.string().trim().max(100).optional().allow(null, ''),
  content: Joi.string().trim().min(20).optional(),
  remarks: Joi.string().trim().max(5000).optional().allow(null, ''),
  co_authors: coAuthorIdsSchema.optional(),
  whereas_clauses: Joi.string().trim().min(10).max(10000).optional().allow(null, ''),
  effectivity_clause: Joi.string().trim().min(5).max(5000).optional().allow(null, ''),
  attachments: attachmentsSchema,
  status: Joi.string().valid('Draft', 'Submitted', 'Under Review', 'Approved', 'Published', 'Rejected').optional(),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided to update.',
  })
  .options({ allowUnknown: false });

// ---------------------------------------------------------------------------
// Minutes schemas
// ---------------------------------------------------------------------------

/**
 * Schema for POST /minutes
 */
const createMinutesSchema = Joi.object({
  title: Joi.string().trim().min(3).max(255).required().messages({
    'string.min': 'Title must be at least 3 characters.',
    'string.max': 'Title must be at most 255 characters.',
    'any.required': 'Title is required.',
  }),
  meeting_date: Joi.string().isoDate().optional().allow(null, ''),
  participants: Joi.string().trim().max(500).optional().allow(null, ''),
  transcript: Joi.string().trim().required().messages({
    'any.required': 'Transcript is required.',
  }),
  session_id: Joi.number().integer().positive().optional().allow(null),
}).options({ allowUnknown: false });

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
  createResolutionSchema,
  updateResolutionSchema,
  // Minutes
  createMinutesSchema,
  // Messages
  sendMessageSchema,
  messageSearchSchema,
};
