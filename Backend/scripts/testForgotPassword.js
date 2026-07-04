/**
 * Script to test the secure forgot password flow
 */
const mongoose = require('mongoose');
const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/homster');
    console.log('Database connected successfully for testing');
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
};

const runTest = async () => {
  await connectDB();

  const User = require('../models/User');
  const Token = require('../models/Token');
  const { TOKEN_TYPES } = require('../utils/constants');

  // Let's find an existing user or create a temporary one
  let testUser = await User.findOne({ phone: '9876543210' });
  if (!testUser) {
    console.log('Creating test user...');
    testUser = await User.create({
      name: 'Test Ishaa',
      phone: '9876543210',
      email: 'testishaa@example.com',
      password: 'password123',
      isPhoneVerified: true,
      role: 'user'
    });
  }

  console.log(`Using test user: ${testUser.name} (${testUser.phone})`);

  // 1. Simulating POST /api/auth/forgot-password
  console.log('\n--- Step 1: Requesting Forgot Password ---');
  // Generate token as backend controller would do
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  // Clear previous reset tokens for this test user
  await Token.deleteMany({ userId: testUser._id, type: TOKEN_TYPES.PASSWORD_RESET });

  // Store in DB
  const createdToken = await Token.create({
    userId: testUser._id,
    phone: testUser.phone,
    email: testUser.email,
    type: TOKEN_TYPES.PASSWORD_RESET,
    token: tokenHash,
    expiresAt,
    isUsed: false
  });
  
  console.log('Reset token successfully generated and stored in DB');
  console.log(`Raw Token (sent to user): ${rawToken}`);
  console.log(`Hashed Token (stored in DB): ${tokenHash}`);

  // 2. Simulating GET /api/auth/reset-password/:token
  console.log('\n--- Step 2: Verifying Reset Token ---');
  const incomingTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const verifyTokenDoc = await Token.findOne({
    token: incomingTokenHash,
    type: TOKEN_TYPES.PASSWORD_RESET,
    expiresAt: { $gt: new Date() },
    isUsed: false
  });

  if (verifyTokenDoc) {
    console.log('Token is valid and active!');
  } else {
    console.error('FAIL: Token is invalid or expired');
    process.exit(1);
  }

  // 3. Simulating POST /api/auth/reset-password (Updating password)
  console.log('\n--- Step 3: Updating Password ---');
  const newPassword = 'NewSecurePassword@123';
  
  // Find token again
  const activeToken = await Token.findOne({
    token: incomingTokenHash,
    type: TOKEN_TYPES.PASSWORD_RESET,
    expiresAt: { $gt: new Date() },
    isUsed: false
  });

  if (!activeToken) {
    console.error('FAIL: Token not found');
    process.exit(1);
  }

  const userToUpdate = await User.findById(activeToken.userId);
  userToUpdate.password = newPassword; // Will trigger pre-save hook for hashing
  await userToUpdate.save();

  console.log('User password updated and hashed successfully!');

  // Clear tokens
  await Token.deleteMany({ userId: userToUpdate._id, type: TOKEN_TYPES.PASSWORD_RESET });
  console.log('Reset tokens cleaned up.');

  // Validate we can log in with new password
  const updatedUser = await User.findById(userToUpdate._id).select('+password');
  const isMatch = await updatedUser.comparePassword(newPassword);
  
  if (isMatch) {
    console.log('SUCCESS: Able to log in with new password!');
  } else {
    console.error('FAIL: Password match failed!');
    process.exit(1);
  }

  console.log('\nAll security flow test stages completed successfully! ✅');
  mongoose.connection.close();
};

runTest();
