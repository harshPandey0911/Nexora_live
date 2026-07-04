const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const checkAbhishek = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Vendor = require('../models/Vendor');
    
    const vendor = await Vendor.findOne({ name: /abhishek/i });
    if (vendor) {
      console.log('Vendor found:');
      console.log(JSON.stringify(vendor, null, 2));
    } else {
      console.log('Vendor abhishek not found');
    }
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

checkAbhishek();
