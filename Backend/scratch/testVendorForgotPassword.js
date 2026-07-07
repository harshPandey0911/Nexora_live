const mongoose = require('mongoose');
const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/homster');
    console.log('Database connected successfully for testing vendor reset password');
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
};

const runTest = async () => {
  await connectDB();

  const Vendor = require('../models/Vendor');
  const Token = require('../models/Token');
  const { TOKEN_TYPES } = require('../utils/constants');

  // Find or create test vendor
  let testVendor = await Vendor.findOne({ phone: '9876543210' });
  if (!testVendor) {
    console.log('Creating test vendor...');
    testVendor = await Vendor.create({
      name: 'Test Vendor',
      phone: '9876543210',
      email: 'testvendor@example.com',
      password: 'OldPassword@123',
      aadhar: {
        number: '123456789012',
        document: 'http://example.com/aadhar-front.jpg',
        backDocument: 'http://example.com/aadhar-back.jpg'
      },
      pan: {
        number: 'ABCDE1234F',
        document: 'http://example.com/pan.jpg'
      },
      approvalStatus: 'approved'
    });
  }

  console.log(`Using test vendor: ${testVendor.name} (${testVendor.phone})`);

  // Step 1: Request Password Reset
  console.log('\n--- Step 1: Requesting Forgot Password ---');
  
  // Clear any existing reset tokens
  await Token.deleteMany({ userId: testVendor._id, type: TOKEN_TYPES.PASSWORD_RESET });

  // Mocking the request/response objects for the controller
  let responseData = null;
  let status = null;

  const reqForgot = {
    body: { phone: '9876543210' }
  };
  const resForgot = {
    status: (code) => {
      status = code;
      return {
        json: (data) => {
          responseData = data;
        }
      };
    }
  };

  const { forgotPassword, verifyResetToken, resetPassword } = require('../controllers/vendorControllers/vendorAuthController');
  
  // We mock validationResult to return no errors
  const validator = require('express-validator');
  const originalValidationResult = validator.validationResult;
  validator.validationResult = () => ({
    isEmpty: () => true,
    array: () => []
  });

  await forgotPassword(reqForgot, resForgot);

  console.log(`Response Status: ${status}`);
  console.log('Response Body:', responseData);

  if (status !== 200 || !responseData.success) {
    console.error('FAIL: Forgot password request failed');
    process.exit(1);
  }

  // Get the token from DB
  const tokenDoc = await Token.findOne({ userId: testVendor._id, type: TOKEN_TYPES.PASSWORD_RESET });
  if (!tokenDoc) {
    console.error('FAIL: Token was not stored in the database');
    process.exit(1);
  }
  console.log('Token successfully stored in DB:', tokenDoc);

  // Since we don't have raw token directly (it was generated inside forgotPassword and logged),
  // let's create a raw token manually or retrieve/verify using the database token hash.
  // Wait, let's test verifyResetToken using the stored token hash directly.
  // Actually, we can generate a new token and test the controller methods step-by-step.
  
  console.log('\n--- Step 2: Verifying Reset Token ---');
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  
  await Token.deleteMany({ userId: testVendor._id, type: TOKEN_TYPES.PASSWORD_RESET });
  await Token.create({
    userId: testVendor._id,
    phone: testVendor.phone,
    email: testVendor.email,
    type: TOKEN_TYPES.PASSWORD_RESET,
    token: tokenHash,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    isUsed: false
  });

  const reqVerify = {
    params: { token: rawToken }
  };
  const resVerify = {
    status: (code) => {
      status = code;
      return {
        json: (data) => {
          responseData = data;
        }
      };
    }
  };

  await verifyResetToken(reqVerify, resVerify);
  console.log(`Response Status: ${status}`);
  console.log('Response Body:', responseData);

  if (status !== 200 || !responseData.valid) {
    console.error('FAIL: Token verification failed');
    process.exit(1);
  }

  console.log('\n--- Step 3: Resetting Password ---');
  const newPassword = 'NewSecurePassword@123';
  const reqReset = {
    body: { token: rawToken, password: newPassword }
  };
  const resReset = {
    status: (code) => {
      status = code;
      return {
        json: (data) => {
          responseData = data;
        }
      };
    }
  };

  await resetPassword(reqReset, resReset);
  console.log(`Response Status: ${status}`);
  console.log('Response Body:', responseData);

  if (status !== 200 || !responseData.success) {
    console.error('FAIL: Reset password failed');
    process.exit(1);
  }

  // Verify vendor password has changed
  const updatedVendor = await Vendor.findById(testVendor._id).select('+password');
  const isMatch = await updatedVendor.comparePassword(newPassword);
  if (isMatch) {
    console.log('SUCCESS: Vendor password updated and verified!');
  } else {
    console.error('FAIL: Password comparison failed. Password was not updated correctly.');
    process.exit(1);
  }

  // Restore validationResult
  validator.validationResult = originalValidationResult;

  await mongoose.disconnect();
  console.log('Test completed successfully!');
  process.exit(0);
};

runTest();
