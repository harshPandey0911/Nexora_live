const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Worker = require('../models/Worker');
const Admin = require('../models/Admin');

async function findVendor() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const searchStr = '7879363299';
    
    // Search Vendor
    let vendor = await Vendor.findOne({ $or: [{ mobile: searchStr }, { mobile: parseInt(searchStr) }, { email: new RegExp(searchStr, 'i') }] }).select('+password');
    if (vendor) {
      console.log('Found in Vendor (with password):', JSON.stringify(vendor, null, 2));
      console.log('Password hash/value:', vendor.password);
    } else {
      // Let's find by name or email
      let vendorByName = await Vendor.findOne({ $or: [{ name: /Harsh/i }, { email: /harsh/i }] }).select('+password');
      if (vendorByName) {
        console.log('Found Vendor by name/email:', JSON.stringify(vendorByName, null, 2));
        console.log('Password hash/value:', vendorByName.password);
      }
    }

    // Search User
    let user = await User.findOne({ $or: [{ mobile: searchStr }, { mobile: parseInt(searchStr) }, { phone: searchStr }, { email: new RegExp(searchStr, 'i') }] }).select('+password');
    if (user) {
      console.log('Found in User (with password):', JSON.stringify(user, null, 2));
      console.log('Password hash/value:', user.password);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

findVendor();
