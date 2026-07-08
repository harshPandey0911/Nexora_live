const Vendor = require('../../models/Vendor');
const { generateOTP, hashOTP, storeOTP, verifyOTP, checkRateLimit } = require('../../utils/redisOtp.util');
const { generateTokenPair, verifyRefreshToken, generateVerificationToken, verifyVerificationToken } = require('../../utils/tokenService');
const { sendOTP: sendSMSOTP } = require('../../services/smsService');
const cloudinaryService = require('../../services/cloudinaryService');
const { USER_ROLES, VENDOR_STATUS } = require('../../utils/constants');
const { validationResult } = require('express-validator');

/**
 * Send OTP for vendor registration/login
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

    const { phone } = req.body;
    const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : '';
    
    if (!cleanPhone || cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Invalid phone number format.' });
    }

    // Check existing vendor status to prevent OTP if restricted
    const existingVendor = await Vendor.findOne({ phone: cleanPhone });
    if (existingVendor) {
      if (existingVendor.approvalStatus === VENDOR_STATUS.PENDING) {
        return res.status(200).json({
          success: true,
          message: 'Your account is currently under review. Please wait for admin approval.',
          vendor: { adminApproval: 'pending' }
        });
      }
      if (existingVendor.approvalStatus === VENDOR_STATUS.REJECTED || existingVendor.approvalStatus === VENDOR_STATUS.SUSPENDED) {
        return res.status(403).json({ success: false, message: 'Account restricted.' });
      }
    }

    // 1. Rate limit check
    const allowed = await checkRateLimit(cleanPhone);
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
    await storeOTP(cleanPhone, otpHash);

    // 4. Send OTP via SMS
    const smsResult = await sendSMSOTP(cleanPhone, otp);

    // Log OTP in development mode
    if (process.env.NODE_ENV === 'development' || process.env.USE_DEFAULT_OTP === 'true') {
      console.log(`[DEV] Vendor OTP for ${phone}: ${otp}`);
    }

    if (!smsResult.success) {
      console.warn(`[OTP] SMS failed for vendor ${phone}, but OTP stored`);
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
 * Verify OTP and Check Vendor Status (Unified Login/Signup Entry)
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

    // 2. Check if vendor exists (using sanitized phone)
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const vendor = await Vendor.findOne({ phone: cleanPhone });

    if (vendor) {
      // EXISTING VENDOR

      // Check status checks (Login Logic)
      if (vendor.approvalStatus === VENDOR_STATUS.REJECTED) {
        return res.status(403).json({ success: false, message: 'Account rejected.' });
      }
      if (vendor.approvalStatus === VENDOR_STATUS.SUSPENDED) {
        return res.status(403).json({ success: false, message: 'Account suspended.' });
      }
      if (!vendor.isActive) {
        return res.status(403).json({ success: false, message: 'Account deactivated.' });
      }

      // BLOCK PENDING VENDORS
      if (vendor.approvalStatus === VENDOR_STATUS.PENDING) {
        return res.status(200).json({
          success: true,
          message: 'Your account is currently under review. Please wait for admin approval.',
          vendor: { adminApproval: 'pending' }
        });
      }

      // SINGLE DEVICE LOGIN: Update Session ID & Clear OLD FCM tokens
      const loginSessionId = Date.now().toString();
      await Vendor.findByIdAndUpdate(vendor._id, { 
        loginSessionId,
        $set: { fcmTokens: [], fcmTokenMobile: [] } // Clear all old tokens to prevent ghost notifications
      });

      const tokens = generateTokenPair({
        userId: vendor._id,
        role: USER_ROLES.VENDOR,
        loginSessionId
      });

      return res.status(200).json({
        success: true,
        isNewUser: false,
        message: 'Login successful',
        vendor: {
          id: vendor._id,
          name: vendor.name,
          email: vendor.email,
          phone: vendor.phone,
          businessName: vendor.businessName,
          service: vendor.service,
          approvalStatus: vendor.approvalStatus,
          subscription: vendor.subscription
        },
        ...tokens
      });

    } else {
      // NEW VENDOR -> RETURN VERIFICATION TOKEN
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
 * Register vendor with Verification Token (Service/Category Removed)
 */
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    // Ignore service validation error if present (since removed)
    const validErrors = errors.array().filter(e => e.path !== 'service');

    if (validErrors.length > 0) {
      console.log('[REGISTER] Validation errors:', validErrors);
      return res.status(400).json({
        success: false,
        message: `Validation failed: ${validErrors.map(e => e.msg || e.message).join(', ')}`,
        errors: validErrors
      });
    }

    const { name, email, phone: rawPhone, aadhar, pan, password } = req.body;
    if (!rawPhone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }
    const phone = rawPhone.replace(/\D/g, '').slice(-10);

    // Check existing (using sanitized phone)
    const existing = await Vendor.findOne({ $or: [{ phone }, { email }] });
    if (existing) {
      console.log('[REGISTER] Conflict found:', existing.phone === phone ? 'Phone' : 'Email');
      return res.status(400).json({ 
        success: false, 
        message: existing.phone === phone ? 'Phone number already registered.' : 'Email already registered.',
        isPhoneConflict: existing.phone === phone
      });
    }

    // Step 2: Upload Documents to Cloudinary in Parallel
    const uploadTasks = [];
    
    let aadharUrl = req.body.aadharDocument || null;
    let aadharBackUrl = req.body.aadharBackDocument || null;
    let panUrl = req.body.panDocument || null;
    const otherDocUrls = Array.isArray(req.body.otherDocuments) ? [...req.body.otherDocuments] : [];

    if (aadharUrl && aadharUrl.startsWith('data:')) {
      uploadTasks.push((async () => {
        const res = await cloudinaryService.uploadFile(aadharUrl, { folder: 'vendors/documents' });
        if (res.success) aadharUrl = res.url;
        else throw new Error(`Aadhar upload failed: ${res.error}`);
      })());
    }

    if (aadharBackUrl && aadharBackUrl.startsWith('data:')) {
      uploadTasks.push((async () => {
        const res = await cloudinaryService.uploadFile(aadharBackUrl, { folder: 'vendors/documents' });
        if (res.success) aadharBackUrl = res.url;
        else throw new Error(`Aadhar back upload failed: ${res.error}`);
      })());
    }

    if (panUrl && panUrl.startsWith('data:')) {
      uploadTasks.push((async () => {
        const res = await cloudinaryService.uploadFile(panUrl, { folder: 'vendors/documents' });
        if (res.success) panUrl = res.url;
        else throw new Error(`PAN upload failed: ${res.error}`);
      })());
    }

    // Handle other documents
    const processedOtherDocs = [];
    if (otherDocUrls.length > 0) {
      otherDocUrls.forEach((doc, index) => {
        if (doc && doc.startsWith('data:')) {
          uploadTasks.push((async () => {
            const res = await cloudinaryService.uploadFile(doc, { folder: 'vendors/documents' });
            if (res.success) processedOtherDocs.push(res.url);
          })());
        } else if (doc) {
          processedOtherDocs.push(doc);
        }
      });
    }

    // Wait for all uploads to complete
    try {
      await Promise.all(uploadTasks);
    } catch (uploadError) {
      console.error('Upload phase failed:', uploadError);
      return res.status(500).json({ 
        success: false, 
        message: uploadError.message || 'Failed to upload verification documents.' 
      });
    }

    // Step 2.5: Determine initial Level & Performance Score based on MCQ Score
    let initialLevel = 3;
    let initialPerformanceScore = 10;
    const trainingScore = req.body.trainingScore || 0;
    
    try {
      const Training = require('../../models/Training');
      const activeTraining = await Training.findOne({ isActive: true });
      if (activeTraining && activeTraining.questions && activeTraining.questions.length > 0) {
        const totalQuestions = activeTraining.questions.length;
        const percentage = (trainingScore / totalQuestions) * 100;
        
        if (percentage >= 100) {
          initialLevel = 1;
          initialPerformanceScore = 100;
        } else if (percentage >= 50) {
          initialLevel = 2;
          initialPerformanceScore = 75;
        } else {
          initialLevel = 3;
          initialPerformanceScore = 10;
        }
      }
    } catch (err) {
      console.error('Error calculating initial level from MCQ:', err);
    }

    // Step 3: Create Vendor Record
    const vendor = await Vendor.create({
      name,
      email,
      phone,
      password,
      aadhar: {
        number: aadhar,
        document: aadharUrl,
        backDocument: aadharBackUrl
      },
      pan: { 
        number: pan, 
        document: panUrl 
      },
      otherDocuments: processedOtherDocs,
      trainingScore: trainingScore,
      performanceScore: initialPerformanceScore,
      level: initialLevel,
      approvalStatus: VENDOR_STATUS.PENDING,
      isActive: true, // Allow them to attempt login but blocked by PENDING status
      settings: { serviceRange: 15 }
    });

    // Step 4: Notify Admins (Non-blocking)
    (async () => {
      try {
        const { createNotification } = require('../notificationControllers/notificationController');
        const Admin = require('../../models/Admin');
        const admins = await Admin.find({ role: 'super_admin' });
        
        const notificationData = {
          type: 'new_vendor_registration',
          title: 'New Vendor Registration',
          message: `A new vendor ${name} has registered and is awaiting approval.`,
          relatedId: vendor._id,
          relatedType: 'vendor'
        };

        await Promise.all(admins.map(admin => 
          createNotification({ ...notificationData, adminId: admin._id })
        ));
      } catch (e) {
        console.error('Non-blocking admin notification error:', e);
      }
    })();

    res.status(201).json({
      success: true,
      message: 'Registration successful! Your account is under review.',
      vendor: {
        id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        approvalStatus: vendor.approvalStatus
      }
    });

  } catch (error) {
    console.error('Vendor registration error:', error);
    try {
      const fs = require('fs');
      const logContent = `[${new Date().toISOString()}] Vendor registration error:\n${error.stack}\n\n`;
      fs.appendFileSync('error.log', logContent);
    } catch (fsErr) {
      console.error('Failed to write to error.log', fsErr);
    }
    res.status(500).json({
      success: false,
      message: `Registration failed: ${error.message}`,
      stack: error.stack
    });
  }
};

/**
 * Login vendor with OTP (only if approved)
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

    // Find vendor and select password field
    const vendor = await Vendor.findOne({ phone }).select('+password');
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found. Please sign up first.'
      });
    }

    // Compare Password
    const isMatch = await vendor.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number or password'
      });
    }

    // Check approval status
    if (vendor.approvalStatus === VENDOR_STATUS.PENDING) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin approval. Please wait for approval.'
      });
    }

    if (vendor.approvalStatus === VENDOR_STATUS.REJECTED) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been rejected. Please contact support.'
      });
    }

    if (vendor.approvalStatus === VENDOR_STATUS.SUSPENDED) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Please contact support.'
      });
    }

    if (!vendor.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // SINGLE DEVICE LOGIN: Update Session ID & Clear OLD FCM tokens
    const loginSessionId = Date.now().toString();
    await Vendor.findByIdAndUpdate(vendor._id, { 
      loginSessionId,
      $set: { fcmTokens: [], fcmTokenMobile: [] } // Clear all old tokens to prevent ghost notifications
    });

    // Generate JWT tokens
    const tokens = generateTokenPair({
      userId: vendor._id,
      role: USER_ROLES.VENDOR,
      loginSessionId
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      vendor: {
        id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        businessName: vendor.businessName,
        service: vendor.service,
        subscription: vendor.subscription
      },
      ...tokens
    });
  } catch (error) {
    console.error('Vendor login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
};

/**
 * Logout vendor
 */
const logout = async (req, res) => {
  try {
    const { platform = 'web' } = req.body;

    // Clear FCM tokens based on platform and reset Session ID
    if (req.user && req.user.id) {
      const updateQuery = platform === 'mobile'
        ? { $set: { fcmTokenMobile: [], loginSessionId: null } }
        : { $set: { fcmTokens: [], loginSessionId: null } };

      await Vendor.findByIdAndUpdate(req.user.id, updateQuery);
      console.log(`[AUTH] ✅ ${platform} session & tokens cleared for vendor: ${req.user.id}`);
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

    // Check if vendor exists
    const vendor = await Vendor.findById(decoded.userId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // Check status
    if (vendor.approvalStatus !== VENDOR_STATUS.APPROVED || !vendor.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is not approved or is inactive'
      });
    }

    // Verify Session ID for Vendor
    if (decoded.loginSessionId !== vendor.loginSessionId) {
      return res.status(401).json({
        success: false,
        message: 'Account logged in on a new device. Please login again.'
      });
    }

    // Generate new token pair with same session ID
    const tokens = generateTokenPair({
      userId: vendor._id,
      role: USER_ROLES.VENDOR,
      loginSessionId: vendor.loginSessionId
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
 * Request Password Reset (Forgot Password) for Vendor
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

    const { phone } = req.body;
    const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : '';

    const vendor = await Vendor.findOne({ phone: cleanPhone });

    if (!vendor) {
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

    // Deactivate/Delete previous reset tokens for this vendor
    await Token.deleteMany({ userId: vendor._id, type: TOKEN_TYPES.PASSWORD_RESET });

    await Token.create({
      userId: vendor._id,
      phone: vendor.phone,
      email: vendor.email,
      type: TOKEN_TYPES.PASSWORD_RESET,
      token: tokenHash,
      expiresAt,
      isUsed: false
    });

    // Create reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/vendor/reset-password/${rawToken}`;

    // Log reset link in terminal for easier local testing
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n=== [DEVELOPMENT ONLY] VENDOR SECURE RESET LINK ===\n${resetUrl}\n===================================================\n`);
    }

    // Send reset email if vendor has email
    if (vendor.email) {
      const { sendPasswordResetEmail } = require('../../services/emailService');
      await sendPasswordResetEmail(vendor.email, vendor.name, resetUrl);
    }

    return res.status(200).json({
      success: true,
      message: 'If an account exists, a reset link has been sent.'
    });

  } catch (error) {
    console.error('Vendor ForgotPassword Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process request. Please try again.'
    });
  }
};

/**
 * Verify Password Reset Token validity for Vendor
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
    console.error('Vendor VerifyResetToken Error:', error);
    return res.status(500).json({ valid: false, message: 'Internal Server Error' });
  }
};

/**
 * Reset Password using token for Vendor
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

    const vendor = await Vendor.findById(tokenDoc.userId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // Set new password (pre-save middleware handles hashing)
    vendor.password = password;
    
    // Invalidate active session and clear fcm tokens
    vendor.loginSessionId = Date.now().toString();
    vendor.fcmTokens = [];
    vendor.fcmTokenMobile = [];
    
    await vendor.save();

    // Delete the reset token
    await Token.deleteMany({ userId: vendor._id, type: TOKEN_TYPES.PASSWORD_RESET });

    // Invalidate refresh tokens
    await Token.deleteMany({ userId: vendor._id, type: TOKEN_TYPES.REFRESH_TOKEN });

    // Send confirmation email
    if (vendor.email) {
      const { sendPasswordChangedEmail } = require('../../services/emailService');
      await sendPasswordChangedEmail(vendor.email, vendor.name);
    }

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.'
    });

  } catch (error) {
    console.error('Vendor ResetPassword Error:', error);
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

