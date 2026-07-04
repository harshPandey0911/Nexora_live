const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const updateIshaScore = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Vendor = require('../models/Vendor');
    
    // Find Isha Kumari and update her trainingScore to 2
    const res = await Vendor.updateOne(
      { name: /Isha/i },
      { $set: { trainingScore: 2 } }
    );
    console.log('Update result:', res);
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

updateIshaScore();
