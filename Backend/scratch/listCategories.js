const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const listCategories = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Category = require('../models/Category');
    
    const cats = await Category.find();
    console.log(`Found ${cats.length} categories:`);
    cats.forEach(cat => {
      console.log(`- Title: "${cat.title}", ID: ${cat._id}`);
    });
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

listCategories();
