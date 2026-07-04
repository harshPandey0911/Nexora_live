const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const checkUser = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require('../models/User');
    
    // Find all users
    const users = await User.find({}).select('+password');
    console.log('Total users in database:', users.length);
    users.forEach(u => {
      console.log(`- ID: ${u._id}, Name: ${u.name}, Phone: ${u.phone}, Email: ${u.email}`);
    });
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

checkUser();
