const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Worker = require('../models/Worker');
require('dotenv').config();

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nexora';
  console.log('Connecting to', uri);
  await mongoose.connect(uri);
  console.log('Connected to DB');
  
  const bookingId = '6a4dd91b36bce4686d4123a0';
  const booking = await Booking.findById(bookingId);
  console.log('Booking details:', {
    id: booking?._id,
    bookingNumber: booking?.bookingNumber,
    workerId: booking?.workerId,
    status: booking?.status,
    workerResponse: booking?.workerResponse
  });

  if (booking?.workerId) {
    const worker = await Worker.findById(booking.workerId);
    console.log('Worker assigned details:', {
      id: worker?._id,
      name: worker?.name,
      phone: worker?.phone
    });
  }

  const allWorkers = await Worker.find({});
  console.log('All workers in DB:', allWorkers.map(w => ({ id: w._id, name: w.name, phone: w.phone })));

  await mongoose.disconnect();
}

run().catch(console.error);
