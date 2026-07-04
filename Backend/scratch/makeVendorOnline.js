const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const makeVendorOnline = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Vendor = require('../models/Vendor');
    
    // Find abhisheka
    const vendor = await Vendor.findOne({ name: /abhisheka/i });
    if (!vendor) {
      console.log('Vendor abhisheka not found');
      return;
    }
    
    console.log('Current status of abhisheka:');
    console.log(`- Approval: ${vendor.approvalStatus}`);
    console.log(`- Is Online: ${vendor.isOnline}`);
    console.log(`- Availability: ${vendor.availability}`);
    console.log(`- Services: ${JSON.stringify(vendor.service)}`);
    console.log(`- Coordinates: ${JSON.stringify(vendor.geoLocation.coordinates)}`);
    
    // Update abhisheka to be completely approved, online, available, and match categories
    vendor.approvalStatus = 'approved';
    vendor.isOnline = true;
    vendor.availability = 'AVAILABLE';
    vendor.service = ['HOME CLEANING', 'Vegetables', 'Cleaning expert', 'General'];
    vendor.categories = ['HOME CLEANING', 'Vegetables', 'Cleaning expert', 'General'];
    
    // Set service range to 10000 km to bypass any local coordinate checks for testing!
    vendor.settings = {
      ...vendor.settings,
      serviceRange: 20000 // 20,000 km covers the entire Earth!
    };
    
    await vendor.save();
    console.log('\nUpdated abhisheka successfully! She is now APPROVED, ONLINE, and has category listings with a global service range.');
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

makeVendorOnline();
