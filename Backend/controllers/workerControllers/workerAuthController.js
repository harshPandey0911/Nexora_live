const Worker = require('../../models/Worker');
const { generateOTP, hashOTP, storeOTP, verifyOTP, checkRateLimit } = require('../../utils/redisOtp.util');
const { generateTokenPair, verifyRefreshToken, generateVerificationToken, verifyVerificationToken } = require('../../utils/tokenService');
const { sendOTP: sendSMSOTP } = require('../../services/smsService');
const cloudinaryService = require('../../services/cloudinaryService');
const { USER_ROLES, WORKER_STATUS } = require('../../utils/constants');
const { validationResult } = require('express-validator');

/**
 * Send OTP for worker registration/login
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

    // Check if worker exists first (workers can only be added by vendors)
    const worker = await Worker.findOne({ phone });
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'This phone number is not registered. Please contact your vendor to add you as a worker.'
      });
    }

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

    // Log OTP
    if (process.env.NODE_ENV === 'development' || process.env.USE_DEFAULT_OTP === 'true') {
      console.log(`[DEV] Worker OTP for ${phone}: ${otp}`);
    }

    if (!smsResult.success) {
      console.warn(`[OTP] SMS failed for worker ${phone}, but OTP stored`);
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      token: 'verification-pending'
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
 * Verify OTP and Check Worker Status (Unified Login/Signup Entry)
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

    // 2. Check if worker exists
    const worker = await Worker.findOne({ phone });

    if (worker) {
      // EXISTING WORKER
      if (!worker.isActive) {
        return res.status(403).json({ success: false, message: 'Account deactivated.' });
      }

      if (worker.approvalStatus !== 'approved') {
        return res.status(403).json({ 
          success: false, 
          message: 'Your account is pending admin approval. You can start working once approved.' 
        });
      }

      // SINGLE DEVICE LOGIN: Update Session ID & Clear OLD FCM tokens
      const loginSessionId = Date.now().toString();
      await Worker.findByIdAndUpdate(worker._id, { 
        loginSessionId,
        $set: { fcmTokens: [], fcmTokenMobile: [] } // Clear all old tokens
      });

      const tokens = generateTokenPair({
        userId: worker._id,
        role: USER_ROLES.WORKER,
        loginSessionId
      });

      return res.status(200).json({
        success: true,
        isNewUser: false,
        message: 'Login successful',
        worker: {
          id: worker._id,
          name: worker.name,
          email: worker.email,
          phone: worker.phone,
          status: worker.status,
          status: worker.status,
          serviceCategories: worker.serviceCategories || []
        },
        ...tokens
      });

    } else {
      // NEW WORKER - Blocked as worker can only be added by vendor
      return res.status(403).json({
        success: false,
        message: 'Your phone number is not registered. Please contact your vendor to add you as a worker.'
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
 * Register worker with Verification Token
 */
const register = async (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Worker self-registration is disabled. Workers can only be added by a vendor.'
  });
};

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

    const { phone: rawPhone, password } = req.body;
    const phone = rawPhone.replace(/\D/g, '').slice(-10);

    // Find worker
    const worker = await Worker.findOne({ phone }).select('+password');
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found. Please register first.'
      });
    }

    if (!worker.password) {
      return res.status(400).json({
        success: false,
        message: 'Password not set. Please contact your vendor to set a password.'
      });
    }

    const isMatch = await worker.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number or password'
      });
    }

    if (!worker.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated.' });
    }

    const loginSessionId = Date.now().toString();
    await Worker.findByIdAndUpdate(worker._id, { 
      loginSessionId,
      $set: { fcmTokens: [], fcmTokenMobile: [] } // Clear all old tokens
    });

    const tokens = generateTokenPair({
      userId: worker._id,
      role: USER_ROLES.WORKER,
      loginSessionId
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      worker: {
        id: worker._id,
        name: worker.name,
        email: worker.email,
        phone: worker.phone,
        status: worker.status,
        serviceCategories: worker.serviceCategories || []
      },
      ...tokens
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
};

/**
 * Logout worker
 */
const logout = async (req, res) => {
  try {
    const { platform = 'web' } = req.body;

    // Clear FCM tokens based on platform and reset Session ID
    if (req.user && req.user.id) {
      const updateQuery = platform === 'mobile'
        ? { $set: { fcmTokenMobile: [], loginSessionId: null } }
        : { $set: { fcmTokens: [], loginSessionId: null } };

      await Worker.findByIdAndUpdate(req.user.id, updateQuery);
      console.log(`[AUTH] ✅ ${platform} session & tokens cleared for worker: ${req.user.id}`);
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

    // Check if worker exists
    const worker = await Worker.findById(decoded.userId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Check status
    if (!worker.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is not active'
      });
    }

    // Verify Session ID
    if (decoded.loginSessionId !== worker.loginSessionId) {
      return res.status(401).json({ success: false, message: 'LoggedIn on another device.' });
    }

    // Generate new token pair
    const tokens = generateTokenPair({
      userId: worker._id,
      role: USER_ROLES.WORKER,
      loginSessionId: worker.loginSessionId
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

module.exports = {
  sendOTP,
  verifyLogin,
  register,
  login,
  logout,
  refreshToken
};
