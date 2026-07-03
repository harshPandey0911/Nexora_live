const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Users/Ishaa/Desktop/CompanyProjects/nexora/backend/.env' });

async function check() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const Booking = require('c:/Users/Ishaa/Desktop/CompanyProjects/nexora/backend/models/Booking');
    const bookings = await Booking.find({}).lean();
    console.log(`Total Bookings: ${bookings.length}`);
    bookings.forEach(b => {
      console.log(`ID: ${b._id}, No: ${b.bookingNumber}, Status: ${b.status}, AssignedByAdmin: ${b.assignedByAdmin}, adminAssignmentStatus: ${b.adminAssignmentStatus}, Vendor: ${b.vendorId}`);
    });

    const BookingRequest = require('c:/Users/Ishaa/Desktop/CompanyProjects/nexora/backend/models/BookingRequest');
    const requests = await BookingRequest.find({}).lean();
    console.log(`Total BookingRequests: ${requests.length}`);
    requests.forEach(r => {
      console.log(`ID: ${r._id}, BookingId: ${r.bookingId}, VendorId: ${r.vendorId}, Status: ${r.status}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

check();
