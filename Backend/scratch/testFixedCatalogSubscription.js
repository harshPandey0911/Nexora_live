const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const runTest = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const Vendor = require('../models/Vendor');
  const Category = require('../models/Category');
  const Service = require('../models/UserService');

  // Find or create test vendor
  let testVendor = await Vendor.findOne({ phone: '9876543210' });
  if (!testVendor) {
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

  // Create a Category if not exists
  let testCat = await Category.findOne({ title: 'Fixed Price Category' });
  if (!testCat) {
    testCat = await Category.create({
      title: 'Fixed Price Category',
      slug: 'fixed-price-category',
      status: 'active'
    });
  }

  // Create a Master Service
  await Service.deleteMany({ title: 'Master Fixed Service' });
  const masterService = await Service.create({
    title: 'Master Fixed Service',
    slug: 'master-fixed-service',
    categoryId: testCat._id,
    vendorId: null, // Admin created
    basePrice: 1200,
    status: 'active',
    description: 'Fixed price AC service'
  });

  console.log('--- Created Admin Master Service ---');
  console.log(`Title: ${masterService.title}, Fixed Price: ₹${masterService.basePrice}`);

  // Subscribe Vendor to it
  const { addVendorService } = require('../controllers/vendorControllers/vendorServiceController');

  let responseData = null;
  let status = null;

  const mockRes = {
    status: (code) => {
      status = code;
      return {
        json: (data) => {
          responseData = data;
        }
      };
    }
  };

  const reqSubscribe = {
    user: { id: testVendor._id },
    body: {
      serviceId: masterService._id.toString(),
      categoryId: testCat._id.toString()
    }
  };

  console.log('\n--- Step 2: Vendor Subscribing to Fixed Service ---');
  await addVendorService(reqSubscribe, mockRes);
  console.log(`Response Status: ${status}`);
  console.log('Response Body:', responseData);

  if (status !== 201 || !responseData.success) {
    console.error('FAIL: Subscription failed');
    process.exit(1);
  }

  // Verify DB
  const vendorServiceInstance = await Service.findOne({ title: 'Master Fixed Service', vendorId: testVendor._id });
  if (vendorServiceInstance && vendorServiceInstance.basePrice === 1200) {
    console.log('\nSUCCESS: Vendor subscribed successfully at admin fixed price (₹1200)!');
  } else {
    console.error('\nFAIL: Subscription record mismatch or incorrect price copy');
    process.exit(1);
  }

  await mongoose.disconnect();
  process.exit(0);
};

runTest();
