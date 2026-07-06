const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');
require('dotenv').config();

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/nexora';

mongoose.connect(mongoURI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const phone = '8765432109';
    const password = 'password123';
    
    const vendor = await Vendor.findOne({ phone });
    if (vendor) {
      vendor.password = password;
      await vendor.save();
      console.log(`Password successfully set to "${password}" for vendor with phone "${phone}"`);
    } else {
      console.log(`Vendor with phone "${phone}" not found.`);
    }
    
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Connection error:', err);
  });
