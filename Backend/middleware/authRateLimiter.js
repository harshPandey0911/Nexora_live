const rateLimit = require('express-rate-limit');

/**
 * Strict Rate Limiter for Authentication / Reset Password attempts
 * Limits each IP to 5 requests per hour to prevent spamming and DDoS
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // limit each IP to 5 password reset requests per windowMs
  message: {
    success: false,
    message: 'Too many password reset requests from this IP. Please try again after an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = passwordResetLimiter;
