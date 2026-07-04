const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const listAllVendors = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Vendor = require('../models/Vendor');
    
    const vendors = await Vendor.find({ approvalStatus: 'approved' });
    console.log(`Found ${vendors.length} approved vendors:`);
    vendors.forEach((vendor, i) => {
      console.log(`[${i}] Name: ${vendor.name}`);
      console.log(`    Phone: ${vendor.phone}`);
      console.log(`    Is Online: ${vendor.isOnline}`);
      console.log(`    Level: ${vendor.level}`);
      console.log(`    Services: ${JSON.stringify(vendor.service)}`);
      console.log(`    Address Coordinates: Lat: ${vendor.address?.lat}, Lng: ${vendor.address?.lng}`);
      console.log(`    GeoLocation Coordinates: ${JSON.stringify(vendor.geoLocation?.coordinates)}`);
    });
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

listAllVendors();
