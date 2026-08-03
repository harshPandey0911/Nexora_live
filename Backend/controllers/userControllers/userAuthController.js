const User = require('../../models/User');
const { generateTokenPair, verifyRefreshToken, generateVerificationToken, verifyVerificationToken } = require('../../utils/tokenService');
const { generateOTP, hashOTP, storeOTP, verifyOTP, checkRateLimit } = require('../../utils/redisOtp.util');
const { sendOTP: sendSMSOTP } = require('../../services/smsService');
const { sendOTPEmail, sendWelcomeEmail } = require('../../services/emailService');
const { USER_ROLES } = require('../../utils/constants');
const { validationResult } = require('express-validator');

/**
 * Send OTP for user registration/login
 */
const sendOTP = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { phone, email } = req.body;

    // 1. Rate limit check
    const allowed = await checkRateLimit(phone);
    if (!allowed) {
      return res.status(429).json({
        success: false,
        message: 'Too many OTP requests. Please try again after 10 minutes.'
      });
    }

    // 2. Generate OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp);

    // 3. Store OTP (Redis primary, MongoDB fallback)
    await storeOTP(phone, otpHash);

    // 4. Send OTP via SMS
    const smsResult = await sendSMSOTP(phone, otp);

    // Log OTP in development mode only (NEVER in production)
    if (process.env.NODE_ENV === 'development' || process.env.USE_DEFAULT_OTP === 'true') {
      console.log(`[DEV] OTP for ${phone}: ${otp}`);
    }

    // 5. Optional: Send email notification if email provided
    if (email) {
      await sendOTPEmail(email, otp, 'verification');
    }

    // Check if SMS failed
    if (!smsResult.success) {
      console.warn(`[OTP] SMS failed for ${phone}, but OTP stored for manual entry`);
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      token: 'verification-pending' // Required by frontend to allow login
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.'
    });
  }
};

/**
 * Verify OTP and Check User Status (Unified Login/Signup Entry)
 */
const verifyLogin = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    // 1. Verify OTP
    const verification = await verifyOTP(phone, otp);
    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    // 2. Check if user exists
    const user = await User.findOne({ phone });

    if (user) {
      // EXISTING USER -> LOGIN
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated.'
        });
      }

      // SINGLE DEVICE LOGIN: Update Session ID & Clear OLD FCM tokens
      const loginSessionId = Date.now().toString();
      await User.findByIdAndUpdate(user._id, { 
        loginSessionId,
        $set: { fcmTokens: [], fcmTokenMobile: [] } // Clear all old tokens
      });
      
      const tokens = generateTokenPair({
        userId: user._id,
        role: USER_ROLES.USER,
        loginSessionId
      });

      return res.status(200).json({
        success: true,
        isNewUser: false,
        message: 'Login successful',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isPhoneVerified: user.isPhoneVerified,
          isEmailVerified: user.isEmailVerified
        },
        ...tokens
      });

    } else {
      // NEW USER -> RETURN VERIFICATION TOKEN
      const verificationToken = generateVerificationToken(phone);

      return res.status(200).json({
        success: true,
        isNewUser: true,
        message: 'OTP verified. Please complete registration.',
        verificationToken
      });
    }

  } catch (error) {
    console.error('Verify Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed. Please try again.'
    });
  }
};

/**
 * Register user with Phone and Password
 */
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, phone, password, email } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this phone number. Please login.'
      });
    }

    // Create user
    const user = await User.create({
      name,
      phone,
      password,
      email: email || null,
      isPhoneVerified: true,
      isEmailVerified: email ? false : true
    });

    // Send Welcome Email
    if (email) {
      sendWelcomeEmail(email, name).catch(err => console.error(err));
    }

    // Generate JWT tokens with session
    const loginSessionId = Date.now().toString();
    await User.findByIdAndUpdate(user._id, { loginSessionId });

    const tokens = generateTokenPair({
      userId: user._id,
      role: USER_ROLES.USER,
      loginSessionId
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isPhoneVerified: user.isPhoneVerified,
        isEmailVerified: user.isEmailVerified
      },
      ...tokens
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
};

/**
 * Login user with OTP
 */
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { phone, password } = req.body;

    // Find user and select password field
    const user = await User.findOne({ phone }).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Phone number is not registered. Please create an account.'
      });
    }

    // Compare Password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number or password'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // SINGLE DEVICE LOGIN: Update Session ID & Clear OLD FCM tokens
    const loginSessionId = Date.now().toString();
    await User.findByIdAndUpdate(user._id, { 
      loginSessionId,
      $set: { fcmTokens: [], fcmTokenMobile: [] } // Clear all old tokens
    });

    const tokens = generateTokenPair({
      userId: user._id,
      role: USER_ROLES.USER,
      loginSessionId
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isPhoneVerified: user.isPhoneVerified,
        isEmailVerified: user.isEmailVerified
      },
      ...tokens
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
};

/**
 * Logout user
 */
const logout = async (req, res) => {
  try {
    const { platform = 'web' } = req.body;

    // Clear FCM tokens based on platform and reset session
    if (req.user && req.user.id) {
      const updateQuery = platform === 'mobile'
        ? { $set: { fcmTokenMobile: [], loginSessionId: null } }
        : { $set: { fcmTokens: [], loginSessionId: null } };

      await User.findByIdAndUpdate(req.user.id, updateQuery);
      console.log(`[AUTH] ✅ ${platform} session & tokens cleared for user: ${req.user.id}`);
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};

/**
 * Refresh Access Token
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Check if user exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check status
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is not active'
      });
    }

    // Verify Session ID
    if (decoded.loginSessionId !== user.loginSessionId) {
      return res.status(401).json({ success: false, message: 'LoggedIn on another device.' });
    }

    // Generate new token pair
    const tokens = generateTokenPair({
      userId: user._id,
      role: USER_ROLES.USER,
      loginSessionId: user.loginSessionId
    });

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      ...tokens
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh token'
    });
  }
};

/**
 * Request Password Reset (Forgot Password)
 */
const forgotPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { mobile } = req.body;
    // Clean mobile number (strip non-digits, take last 10 digits)
    const cleanPhone = mobile ? String(mobile).replace(/\D/g, '').slice(-10) : '';
    const user = await User.findOne({ phone: cleanPhone });

    if (!user) {
      // Generic success to prevent user enumeration
      return res.status(200).json({
        success: true,
        message: 'If an account exists, a reset link has been sent.'
      });
    }

    // Generate secure random token
    const crypto = require('crypto');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Token expiry (15 minutes)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Save token in DB using the Token model
    const Token = require('../../models/Token');
    const { TOKEN_TYPES } = require('../../utils/constants');
    
    // Deactivate/Delete previous reset tokens for this user
    await Token.deleteMany({ userId: user._id, type: TOKEN_TYPES.PASSWORD_RESET });

    await Token.create({
      userId: user._id,
      phone: user.phone,
      email: user.email,
      type: TOKEN_TYPES.PASSWORD_RESET,
      token: tokenHash,
      expiresAt,
      isUsed: false
    });

    // Create reset URL - Extract primary domain if FRONTEND_URL contains comma-separated origins
    const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const frontendUrl = rawFrontendUrl.split(',')[0].trim();
    const resetUrl = `${frontendUrl}/user/reset-password/${rawToken}`;

    // Log reset link in terminal for easier local testing
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n=== [DEVELOPMENT ONLY] SECURE RESET LINK ===\n${resetUrl}\n============================================\n`);
    }

    // Send reset email if user has email
    if (user.email) {
      const { sendPasswordResetEmail } = require('../../services/emailService');
      await sendPasswordResetEmail(user.email, user.name, resetUrl, frontendUrl);
    }

    return res.status(200).json({
      success: true,
      message: 'If an account exists, a reset link has been sent.'
    });

  } catch (error) {
    console.error('ForgotPassword Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process request. Please try again.'
    });
  }
};

/**
 * Verify Password Reset Token validity
 */
const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ valid: false, message: 'Token is required' });
    }

    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const Token = require('../../models/Token');
    const { TOKEN_TYPES } = require('../../utils/constants');

    const tokenDoc = await Token.findOne({
      token: tokenHash,
      type: TOKEN_TYPES.PASSWORD_RESET,
      expiresAt: { $gt: new Date() },
      isUsed: false
    });

    if (!tokenDoc) {
      return res.status(400).json({ valid: false, message: 'Reset Link Expired or Invalid' });
    }

    return res.status(200).json({ valid: true });

  } catch (error) {
    console.error('VerifyResetToken Error:', error);
    return res.status(500).json({ valid: false, message: 'Internal Server Error' });
  }
};

/**
 * Reset Password using token
 */
const resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { token, password } = req.body;

    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const Token = require('../../models/Token');
    const { TOKEN_TYPES } = require('../../utils/constants');

    const tokenDoc = await Token.findOne({
      token: tokenHash,
      type: TOKEN_TYPES.PASSWORD_RESET,
      expiresAt: { $gt: new Date() },
      isUsed: false
    });

    if (!tokenDoc) {
      return res.status(400).json({
        success: false,
        message: 'Reset Link Expired or Invalid'
      });
    }

    const user = await User.findById(tokenDoc.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Set new password (pre-save middleware handles hashing)
    user.password = password;
    
    // Invalidate active session and clear fcm tokens
    const loginSessionId = Date.now().toString();
    user.loginSessionId = loginSessionId;
    user.fcmTokens = [];
    user.fcmTokenMobile = [];
    
    await user.save();

    // Delete the reset token
    await Token.deleteMany({ userId: user._id, type: TOKEN_TYPES.PASSWORD_RESET });

    // Invalidate user refresh tokens
    await Token.deleteMany({ userId: user._id, type: TOKEN_TYPES.REFRESH_TOKEN });

    // Send confirmation email
    if (user.email) {
      const { sendPasswordChangedEmail } = require('../../services/emailService');
      await sendPasswordChangedEmail(user.email, user.name);
    }

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.'
    });

  } catch (error) {
    console.error('ResetPassword Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update password. Please try again.'
    });
  }
};

module.exports = {
  sendOTP,
  verifyLogin,
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  verifyResetToken,
  resetPassword
};
