const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  sendOTP,
  register,
  login,
  logout,
  verifyLogin,
  forgotPassword,
  verifyResetToken,
  resetPassword
} = require('../../controllers/vendorControllers/vendorAuthController');
const { authenticate } = require('../../middleware/authMiddleware');
const { isVendor } = require('../../middleware/roleMiddleware');
const passwordResetLimiter = require('../../middleware/authRateLimiter');

// Validation rules
const sendOTPValidation = [
  body('phone').trim().notEmpty().withMessage('Phone number is required').isLength({ min: 10, max: 10 }).withMessage('Phone number must be 10 digits'),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Please provide a valid email')
];

const verifyLoginValidation = [
  body('phone').trim().notEmpty().withMessage('Phone number is required').isLength({ min: 10, max: 10 }).withMessage('Phone number must be 10 digits'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
];

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('phone').trim().notEmpty().withMessage('Phone number is required').isLength({ min: 10, max: 10 }).withMessage('Phone number must be 10 digits'),
  body('password').trim().notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('aadhar').trim().notEmpty().withMessage('Aadhar number is required').isLength({ min: 12, max: 12 }).withMessage('Aadhar number must be 12 digits'),
  body('pan').trim().notEmpty().withMessage('PAN number is required').isLength({ min: 10, max: 10 }).withMessage('PAN number must be 10 characters')
  // service and otp/token relaxed
];

const loginValidation = [
  body('phone').trim().notEmpty().withMessage('Phone number is required').isLength({ min: 10, max: 10 }).withMessage('Phone number must be 10 digits'),
  body('password').trim().notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

const forgotPasswordValidation = [
  body('phone').trim().notEmpty().withMessage('Phone number is required')
    .isLength({ min: 10, max: 10 }).withMessage('Phone number must be 10 digits')
];

const resetPasswordValidation = [
  body('token').trim().notEmpty().withMessage('Token is required'),
  body('password').trim().notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must contain a special character')
];

// Routes
router.post('/send-otp', sendOTPValidation, sendOTP);
router.post('/verify-login', verifyLoginValidation, verifyLogin); // New Unified Entry
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/refresh-token', require('../../controllers/vendorControllers/vendorAuthController').refreshToken);
router.post('/logout', authenticate, isVendor, logout);

// Password Reset Flow
router.post('/forgot-password', passwordResetLimiter, forgotPasswordValidation, forgotPassword);
router.get('/verify-reset-token/:token', verifyResetToken);
router.post('/reset-password', resetPasswordValidation, resetPassword);

module.exports = router;

