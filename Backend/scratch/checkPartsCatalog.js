const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const checkPartsCatalog = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const VendorPartsCatalog = require('../models/VendorPartsCatalog');
    
    const count = await VendorPartsCatalog.countDocuments();
    console.log(`Total items in VendorPartsCatalog: ${count}`);
    if (count > 0) {
      const items = await VendorPartsCatalog.find().limit(5);
      console.log('Sample items:');
      console.log(JSON.stringify(items, null, 2));
    }
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

checkPartsCatalog();
