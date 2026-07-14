const mongoose = require('mongoose');
require('dotenv').config();

const dbUri = process.env.MONGODB_URI;

async function check() {
  await mongoose.connect(dbUri);
  console.log("Connected to DB");
  const Vendor = require('../models/Vendor');
  const Plan = require('../models/Plan');
  const vendors = await Vendor.find({});
  console.log(`Found ${vendors.length} vendors`);
  for (const vendor of vendors) {
    console.log(`Vendor: ${vendor.name} (${vendor.phone})`);
    console.log(`Subscription:`, JSON.stringify(vendor.subscription, null, 2));
    if (vendor.subscription && vendor.subscription.planId) {
      const plan = await Plan.findById(vendor.subscription.planId);
      console.log(`Plan Details:`, plan ? `${plan.name} - ${plan.duration}` : 'Not found');
    }
  }
  await mongoose.disconnect();
}

check().catch(console.error);
