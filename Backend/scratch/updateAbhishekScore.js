const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const updateAbhishekScore = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Vendor = require('../models/Vendor');
    
    // Update abhishek's trainingScore to 2, level to 1, and performanceScore to 100
    const res = await Vendor.updateOne(
      { name: /abhishek/i },
      { 
        $set: { 
          trainingScore: 2,
          level: 1,
          performanceScore: 100
        } 
      }
    );
    console.log('Update result for abhishek:', res);
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

updateAbhishekScore();
