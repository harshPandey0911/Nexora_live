const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

async function setAllVendorsOffline() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    
    const updateObj = { isOnline: false, availability: 'OFFLINE' };
    const result = await mongoose.connection.db.collection('vendors').updateMany({}, { $set: updateObj });
    
    console.log(`Successfully updated ${result.modifiedCount} vendors to offline.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error updating vendors:', error);
    process.exit(1);
  }
}

setAllVendorsOffline();
