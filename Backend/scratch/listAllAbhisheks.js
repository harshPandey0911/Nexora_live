const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const listAllAbhisheks = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Vendor = require('../models/Vendor');
    
    const vendors = await Vendor.find({ name: /abhishek/i });
    console.log(`Found ${vendors.length} vendors matching "abhishek":`);
    vendors.forEach((vendor, i) => {
      console.log(`[${i}] ID: ${vendor._id}`);
      console.log(`    Name: ${vendor.name}`);
      console.log(`    Phone: ${vendor.phone}`);
      console.log(`    Email: ${vendor.email}`);
      console.log(`    Training Score: ${vendor.trainingScore}`);
      console.log(`    Performance Score: ${vendor.performanceScore}`);
      console.log(`    Level: ${vendor.level}`);
      console.log(`    Created At: ${vendor.createdAt}`);
    });
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

listAllAbhisheks();
