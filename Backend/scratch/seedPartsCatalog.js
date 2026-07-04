const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const seedParts = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const VendorPartsCatalog = require('../models/VendorPartsCatalog');
    
    // Clear existing parts
    await VendorPartsCatalog.deleteMany({});
    
    // Exact categories from DB
    const homeCleaningId = '6a391597ee37fe6d6c27162e'; // HOME CLEANING SERVICES
    const vegetablesId = '6a40e4caea8539822c2350c5'; // Vegetables
    
    const mockParts = [
      {
        name: 'Specialized Cleaning Spray',
        hsnCode: '34029090',
        price: 250,
        gstApplicable: true,
        gstPercentage: 18,
        status: 'active',
        categoryId: homeCleaningId,
        description: 'Professional grade cleaning fluid for home and kitchens.'
      },
      {
        name: 'Microfiber Cleaning Cloths (Pack of 5)',
        hsnCode: '63071010',
        price: 150,
        gstApplicable: true,
        gstPercentage: 18,
        status: 'active',
        categoryId: homeCleaningId,
        description: 'Lint-free, scratch-free cloths for premium cleaning.'
      },
      {
        name: 'Organic Premium Soil (5kg)',
        hsnCode: '31010099',
        price: 350,
        gstApplicable: true,
        gstPercentage: 18,
        status: 'active',
        categoryId: vegetablesId,
        description: 'Nutrient-rich organic soil for home gardening.'
      },
      {
        name: 'Standard Copper Pipe (1 Meter)',
        hsnCode: '74111000',
        price: 800,
        gstApplicable: true,
        gstPercentage: 18,
        status: 'active',
        categoryId: homeCleaningId,
        description: 'Heavy duty standard copper piping for appliance installation.'
      }
    ];
    
    const result = await VendorPartsCatalog.insertMany(mockParts);
    console.log(`Successfully seeded ${result.length} parts in VendorPartsCatalog linked to HOME CLEANING SERVICES and Vegetables!`);
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

seedParts();
