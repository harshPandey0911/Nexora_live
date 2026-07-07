const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const runTest = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const Vendor = require('../models/Vendor');
  
  // Find a vendor
  const vendor = await Vendor.findOne();
  if (!vendor) {
    console.error('No vendor found in database.');
    process.exit(1);
  }

  console.log(`Using vendor: ${vendor.name} (ID: ${vendor._id})`);

  // Mock Request & Response
  const mockReq = {
    user: { id: vendor._id.toString(), _id: vendor._id.toString() },
    query: {}
  };

  const mockRes = {
    status: (code) => {
      console.log(`\nResponse Code: ${code}`);
      return {
        json: (data) => {
          console.log('Response JSON:', data);
        }
      };
    }
  };

  console.log('\n--- Testing vendorWalletController.getWallet ---');
  try {
    const { getWallet } = require('../controllers/vendorControllers/vendorWalletController');
    await getWallet(mockReq, mockRes);
  } catch (err) {
    console.error('getWallet CRASHED:', err);
  }

  console.log('\n--- Testing vendorBookingController.getVendorBookings ---');
  try {
    const { getVendorBookings } = require('../controllers/bookingControllers/vendorBookingController');
    await getVendorBookings(mockReq, mockRes);
  } catch (err) {
    console.error('getVendorBookings CRASHED:', err);
  }

  await mongoose.disconnect();
  process.exit(0);
};

runTest();
