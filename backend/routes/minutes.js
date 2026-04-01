const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const minutesController = require('../controllers/minutesController');

// Rate limit for general minutes API usage
const minutesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many requests, please try again later.' },
});

// Stricter rate limit for AI generation endpoint to control OpenAI API costs
const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'AI generation rate limit reached. Please wait before generating more minutes.' },
});

router.post('/', minutesLimiter, authenticateToken, authorizeRoles('Admin', 'Secretary'), minutesController.create);
router.post('/:id/generate', generateLimiter, authenticateToken, authorizeRoles('Admin', 'Secretary'), minutesController.generate);
router.get('/', minutesLimiter, authenticateToken, minutesController.getAll);
router.get('/:id', minutesLimiter, authenticateToken, minutesController.getById);
router.get('/:id/export/text', minutesLimiter, authenticateToken, minutesController.exportText);
router.put('/:id', minutesLimiter, authenticateToken, authorizeRoles('Admin', 'Secretary'), minutesController.update);
router.delete('/:id', minutesLimiter, authenticateToken, authorizeRoles('Admin', 'Secretary'), minutesController.remove);

module.exports = router;
