const mongoose = require('mongoose');
require('dotenv').config();

const dbUri = process.env.MONGODB_URI;

async function fix() {
  await mongoose.connect(dbUri);
  console.log("Connected to DB");
  
  const db = mongoose.connection.db;
  const collection = db.collection('workers');
  
  try {
    console.log("Dropping email_1 index...");
    await collection.dropIndex("email_1");
    console.log("Successfully dropped email_1 index!");
  } catch (error) {
    console.error("Failed to drop email_1 index (it might not exist):", error.message);
  }
  
  // Re-run create index with sparse option
  try {
    console.log("Creating email_1 sparse index...");
    await collection.createIndex({ email: 1 }, { unique: true, sparse: true });
    console.log("Successfully created email_1 sparse index!");
  } catch (error) {
    console.error("Failed to create sparse index:", error);
  }
  
  await mongoose.disconnect();
}

fix().catch(console.error);
