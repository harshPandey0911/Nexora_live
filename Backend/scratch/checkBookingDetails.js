const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const checkBookingDetails = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Booking = require('../models/Booking');
    
    const booking = await Booking.findOne().sort({ createdAt: -1 });
    if (booking) {
      console.log('Booking Address Details:');
      console.log(JSON.stringify(booking.address, null, 2));
    } else {
      console.log('No bookings found');
    }
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

checkBookingDetails();
