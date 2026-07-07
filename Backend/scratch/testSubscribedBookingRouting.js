const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const runTest = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const Vendor = require('../models/Vendor');
  const Service = require('../models/UserService');
  const Category = require('../models/Category');
  const User = require('../models/User');

  // Find or create Category
  let testCat = await Category.findOne({ title: 'Dynamic Routing Category' });
  if (!testCat) {
    testCat = await Category.create({
      title: 'Dynamic Routing Category',
      slug: 'dynamic-routing-category',
      status: 'active'
    });
  }

  // Find or create Subscribed Vendor
  let vendorSubscribed = await Vendor.findOne({ phone: '9876543211' });
  if (vendorSubscribed) {
    vendorSubscribed.approvalStatus = 'approved';
    vendorSubscribed.isOnline = true;
    vendorSubscribed.isActive = true;
    vendorSubscribed.address = {
      addressLine1: 'Corporate House',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      lat: 18.93,
      lng: 72.83
    };
    await vendorSubscribed.save();
  } else {
    vendorSubscribed = await Vendor.create({
      name: 'Subscribed Vendor',
      phone: '9876543211',
      email: 'subscribed@example.com',
      password: 'OldPassword@123',
      aadhar: { number: '123456789013', document: 'http://example.com/aadhar-front.jpg', backDocument: 'http://example.com/aadhar-back.jpg' },
      pan: { number: 'ABCDE1234G', document: 'http://example.com/pan.jpg' },
      approvalStatus: 'approved',
      isOnline: true,
      isActive: true,
      service: ['Dynamic Routing Category'],
      address: {
        addressLine1: 'Corporate House',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        lat: 18.93,
        lng: 72.83
      }
    });
  }

  // Find or create Unsubscribed Vendor
  let vendorUnsubscribed = await Vendor.findOne({ phone: '9876543212' });
  if (vendorUnsubscribed) {
    vendorUnsubscribed.approvalStatus = 'approved';
    vendorUnsubscribed.isOnline = true;
    vendorUnsubscribed.isActive = true;
    vendorUnsubscribed.address = {
      addressLine1: 'Corporate House',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      lat: 18.93,
      lng: 72.83
    };
    await vendorUnsubscribed.save();
  } else {
    vendorUnsubscribed = await Vendor.create({
      name: 'Unsubscribed Vendor',
      phone: '9876543212',
      email: 'unsubscribed@example.com',
      password: 'OldPassword@123',
      aadhar: { number: '123456789014', document: 'http://example.com/aadhar-front.jpg', backDocument: 'http://example.com/aadhar-back.jpg' },
      pan: { number: 'ABCDE1234H', document: 'http://example.com/pan.jpg' },
      approvalStatus: 'approved',
      isOnline: true,
      isActive: true,
      service: ['Dynamic Routing Category'],
      address: {
        addressLine1: 'Corporate House',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        lat: 18.93,
        lng: 72.83
      }
    });
  }

  // Find or create User
  let testUser = await User.findOne({ phone: '9876543220' });
  if (!testUser) {
    testUser = await User.create({
      name: 'Sagar User',
      phone: '9876543220',
      email: 'sagar@example.com',
      password: 'OldPassword@123',
      role: 'user',
      isPhoneVerified: true
    });
  }

  // Create Admin Master Service
  await Service.deleteMany({ title: 'Dynamic Router Service' });
  const masterService = await Service.create({
    title: 'Dynamic Router Service',
    slug: 'dynamic-router-service',
    categoryId: testCat._id,
    vendorId: null, // Admin created
    basePrice: 1500,
    status: 'active',
    description: 'Dynamic service description'
  });

  // Subscribe only vendorSubscribed to it
  await Service.create({
    title: 'Dynamic Router Service',
    slug: 'dynamic-router-service-subscribed',
    categoryId: testCat._id,
    vendorId: vendorSubscribed._id,
    basePrice: 1500,
    status: 'active',
    description: 'Dynamic service description'
  });

  console.log('--- Setup Done ---');
  console.log(`Subscribed Vendor ID: ${vendorSubscribed._id}`);
  console.log(`Unsubscribed Vendor ID: ${vendorUnsubscribed._id}`);
  console.log(`Master Service ID: ${masterService._id}`);

  // Call createBooking
  const { createBooking } = require('../controllers/bookingControllers/userBookingController');

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

  const reqBooking = {
    user: { id: testUser._id.toString() },
    body: {
      serviceId: masterService._id.toString(),
      address: {
        addressLine1: 'Corporate House',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        lat: 18.93,
        lng: 72.83
      },
      scheduledDate: new Date(),
      scheduledTime: 'ASAP',
      timeSlot: { start: '10:00', end: '11:00' },
      paymentMethod: 'pay_at_home',
      amount: 1500
    }
  };

  console.log('\n--- Step 2: Creating Booking for Master Service ---');
  await createBooking(reqBooking, mockRes);
  console.log(`Response Status: ${status}`);
  console.log('Response Body:', responseData);

  if (status !== 201 || !responseData.success) {
    console.error('FAIL: Booking creation failed');
    process.exit(1);
  }

  // Wait 1.5 seconds for background tasks to complete
  console.log('\nWaiting 1.5s for background tasks to process...');
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Verify that the booking request has correct nearby potential vendors
  const Booking = require('../models/Booking');
  const savedBooking = await Booking.findById(responseData.data._id);
  console.log('\n--- Booking Verification ---');
  console.log('Potential Vendors in Booking:', savedBooking.potentialVendors);

  const matchedSubscribed = savedBooking.potentialVendors.some(pv => pv.vendorId.toString() === vendorSubscribed._id.toString());
  const matchedUnsubscribed = savedBooking.potentialVendors.some(pv => pv.vendorId.toString() === vendorUnsubscribed._id.toString());

  if (matchedSubscribed && !matchedUnsubscribed) {
    console.log('\nSUCCESS: Request successfully routed only to the subscribed vendor!');
  } else {
    console.error('\nFAIL: Request routing mismatch. Unsubscribed vendor was targeted or subscribed vendor was missed.');
    process.exit(1);
  }

  await mongoose.disconnect();
  process.exit(0);
};

runTest();
