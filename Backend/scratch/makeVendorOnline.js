const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const makeVendorOnline = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Vendor = require('../models/Vendor');
    
    const vendor = await Vendor.findOne({ name: /abhisheka/i });
    if (!vendor) {
      console.log('Vendor abhisheka not found');
      return;
    }
    
    // Set abhisheka's coordinates and city details to Indore
    vendor.address = {
      ...vendor.address,
      city: 'Indore',
      state: 'Madhya Pradesh',
      pincode: '452001',
      lat: 22.7196,
      lng: 75.8577
    };
    vendor.location = {
      lat: 22.7196,
      lng: 75.8577
    };
    vendor.geoLocation = {
      type: 'Point',
      coordinates: [75.8577, 22.7196]
    };
    
    vendor.approvalStatus = 'approved';
    vendor.isOnline = true;
    vendor.availability = 'AVAILABLE';
    vendor.service = ['HOME CLEANING', 'Vegetables', 'Cleaning expert', 'General', 'HOME CLEANING SERVICES'];
    vendor.categories = ['HOME CLEANING', 'Vegetables', 'Cleaning expert', 'General', 'HOME CLEANING SERVICES'];
    
    await vendor.save();
    console.log('Updated abhisheka city to Indore, coordinates and categories successfully!');
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

makeVendorOnline();
