const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const checkSettlements = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Settlement = require('../models/Settlement');
    const Vendor = require('../models/Vendor');
    
    // Find all settlements
    const settlements = await Settlement.find().populate('vendorId', 'name businessName wallet');
    console.log(`Total Settlements in DB: ${settlements.length}`);
    settlements.forEach(s => {
      console.log(`- Vendor: ${s.vendorId?.name || 'N/A'} (${s.vendorId?.businessName || 'N/A'})`);
      console.log(`  Amount: ₹${s.amount}`);
      console.log(`  Status: ${s.status}`);
      console.log(`  TXN Ref: ${s.paymentReference}`);
      console.log(`  Created At: ${s.createdAt}`);
      console.log(`  Dues Remaining on Vendor: ₹${s.vendorId?.wallet?.dues}`);
      console.log('----------------------------------------------------');
    });

  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

checkSettlements();
