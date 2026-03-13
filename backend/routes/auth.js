// routes/auth.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { validateBody } = require('../middleware/validation');
const { registerSchema, loginSchema, refreshTokenSchema } = require('../validators/schemas');

// Strict rate limit for authentication endpoints to prevent brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many requests, please try again later.' },
});

router.post('/register', authLimiter, validateBody(registerSchema), authController.register);
router.post('/refresh', authLimiter, validateBody(refreshTokenSchema), authController.refresh);
router.post('/login', authLimiter, validateBody(loginSchema), authController.login);
router.post('/logout', authController.logout);

module.exports = router;
