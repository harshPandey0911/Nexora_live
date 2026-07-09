const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Vendor = require('../models/Vendor');

async function listVendors() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const vendors = await Vendor.find({}).select('name email mobile businessName');
    console.log('All Vendors in Database:');
    console.log(JSON.stringify(vendors, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

listVendors();
