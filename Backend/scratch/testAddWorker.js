const mongoose = require('mongoose');
require('dotenv').config();

const dbUri = process.env.MONGODB_URI;

async function test() {
  await mongoose.connect(dbUri);
  console.log("Connected to DB");
  
  const Worker = require('../models/Worker');
  
  try {
    const res = await Worker.create({
      name: "Test Worker Unique",
      phone: "9999999999",
      password: "password123",
      aadhar: {
        number: "123456789012",
        document: "http://example.com"
      },
      vendorId: new mongoose.Types.ObjectId(),
      serviceCategories: ["salon"],
      address: {},
      approvalStatus: 'pending',
      status: 'OFFLINE'
    });
    console.log("Created successfully:", res);
    // Cleanup
    await Worker.deleteOne({ _id: res._id });
    console.log("Cleaned up");
  } catch (error) {
    console.error("Error thrown during Worker.create:", error);
  }
  
  await mongoose.disconnect();
}

test().catch(console.error);
