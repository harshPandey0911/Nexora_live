const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');
require('dotenv').config();

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/nexora';

mongoose.connect(mongoURI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const phone = '9817921166';
    const res = await Vendor.deleteMany({ phone });
    console.log(`Deleted ${res.deletedCount} test vendor(s) with phone "${phone}"`);
    
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Connection error:', err);
  });
