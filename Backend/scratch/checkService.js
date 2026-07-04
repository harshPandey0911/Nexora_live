const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const checkService = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Service = require('../models/UserService');
    
    const service = await Service.findOne({ title: /1BHK HOME CLEANING START/i });
    if (service) {
      console.log('Service found:');
      console.log(JSON.stringify(service, null, 2));
    } else {
      console.log('Service not found');
    }
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

checkService();
