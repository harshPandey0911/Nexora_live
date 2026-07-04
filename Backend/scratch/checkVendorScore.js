const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const checkVendorScore = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Vendor = require('../models/Vendor');
    
    const vendor = await Vendor.findOne({ name: /Isha/i });
    if (vendor) {
      console.log('Vendor found:');
      console.log(`- ID: ${vendor._id}`);
      console.log(`- Name: ${vendor.name}`);
      console.log(`- Phone: ${vendor.phone}`);
      console.log(`- Email: ${vendor.email}`);
      console.log(`- Training Score: ${vendor.trainingScore}`);
    } else {
      console.log('Vendor Isha not found');
    }
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

checkVendorScore();
