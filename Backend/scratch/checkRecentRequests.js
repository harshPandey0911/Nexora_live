const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const checkRecentRequests = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Booking = require('../models/Booking');
    const BookingRequest = require('../models/BookingRequest');
    const Vendor = require('../models/Vendor');
    
    // Find the most recent booking
    const booking = await Booking.findOne().sort({ createdAt: -1 });
    if (!booking) {
      console.log('No bookings found');
      return;
    }
    
    console.log(`Most recent booking: ${booking.bookingNumber}`);
    console.log(`- ID: ${booking._id}`);
    console.log(`- Service Category: ${booking.serviceCategory}`);
    console.log(`- Status: ${booking.status}`);
    console.log(`- Potential Vendors: ${JSON.stringify(booking.potentialVendors)}`);
    console.log(`- Notified Vendors: ${JSON.stringify(booking.notifiedVendors)}`);
    
    // Find all booking requests for this booking
    const requests = await BookingRequest.find({ bookingId: booking._id });
    console.log(`\nBooking requests found (${requests.length}):`);
    for (const req of requests) {
      const vendor = await Vendor.findById(req.vendorId);
      console.log(`- Vendor: ${vendor ? vendor.name : 'Unknown'} (${req.vendorId})`);
      console.log(`  Wave: ${req.wave}`);
      console.log(`  Distance: ${req.distance}`);
      console.log(`  Status: ${req.status}`);
    }
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

checkRecentRequests();
