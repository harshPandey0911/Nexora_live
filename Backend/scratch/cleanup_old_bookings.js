/**
 * Show ALL bookings currently in admin manual queue and delete them all
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const bookings = db.collection('bookings');
  const bookingRequests = db.collection('bookingrequests');

  // Show everything in admin queue
  const inQueue = await bookings.find({
    $or: [
      { status: 'escalated' },
      { status: 'requested', assignedByAdmin: true },
      { status: 'confirmed', assignedByAdmin: true },
      { status: 'awaiting_payment', assignedByAdmin: true }
    ]
  }, { projection: { bookingNumber: 1, status: 1, adminAssignmentStatus: 1, assignedByAdmin: 1, serviceName: 1 } }).toArray();

  console.log(`\n📋 All bookings in admin manual queue: ${inQueue.length}`);
  inQueue.forEach(b => console.log(`  #${b.bookingNumber} | ${b.status} | adminAssign: ${b.adminAssignmentStatus} | service: ${b.serviceName}`));

  if (inQueue.length === 0) {
    console.log('Queue is already empty!');
    await mongoose.disconnect();
    return;
  }

  const ids = inQueue.map(b => b._id);

  // DELETE ALL of them
  const del = await bookings.deleteMany({ _id: { $in: ids } });
  console.log(`\n✅ Deleted ${del.deletedCount} bookings from DB`);

  const reqDel = await bookingRequests.deleteMany({ bookingId: { $in: ids } });
  console.log(`✅ Deleted ${reqDel.deletedCount} related booking requests`);

  const remaining = await bookings.countDocuments({
    $or: [
      { status: 'escalated' },
      { status: 'requested', assignedByAdmin: true },
      { status: 'confirmed', assignedByAdmin: true }
    ]
  });
  console.log(`\n📊 Admin queue now: ${remaining} bookings`);
  
  await mongoose.disconnect();
  console.log('✅ Done. Fresh start!\n');
}

main().catch(e => { console.error(e.message); process.exit(1); });
