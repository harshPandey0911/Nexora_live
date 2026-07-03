/**
 * Fix: Clean up stuck/expired admin-assigned bookings from yesterday
 * Re-escalates them so admin can reassign or cancel
 * Run: node scratch/fix_stuck_bookings.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function main() {
  console.log('\n🔗 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected!\n');

  const db = mongoose.connection.db;
  const bookings = db.collection('bookings');

  // Find all expired admin-assigned PENDING bookings
  const now = new Date();
  const expiredStuck = await bookings.find({
    assignedByAdmin: true,
    adminAssignmentStatus: 'PENDING',
    status: 'requested',
    expiresAt: { $lt: now }
  }).toArray();

  console.log(`Found ${expiredStuck.length} expired stuck bookings.\n`);

  if (expiredStuck.length === 0) {
    console.log('✅ Nothing to fix!');
    await mongoose.disconnect();
    return;
  }

  for (const b of expiredStuck) {
    console.log(`\n🔧 Fixing #${b.bookingNumber} (expired: ${b.expiresAt})`);
    
    // Re-escalate to admin for reassignment
    const result = await bookings.updateOne(
      { _id: b._id },
      {
        $set: {
          status: 'escalated',
          isEscalatedToAdmin: true,
          adminAssignmentStatus: null,
          // Clear vendorId so admin can reassign fresh
          // Keep assignedByAdmin: true so it shows in manual queue
          expiresAt: null
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`  ✅ Reset to escalated — admin can now reassign`);
    } else {
      console.log(`  ❌ Failed to update`);
    }
  }

  // Verify
  const stillStuck = await bookings.countDocuments({
    assignedByAdmin: true,
    adminAssignmentStatus: 'PENDING',
    status: 'requested',
    expiresAt: { $lt: now }
  });

  console.log(`\n📊 Remaining stuck: ${stillStuck}`);

  const inQueue = await bookings.countDocuments({
    $or: [
      { status: 'escalated' },
      { status: 'requested', assignedByAdmin: true },
      { status: 'confirmed', assignedByAdmin: true },
      { status: 'awaiting_payment', assignedByAdmin: true }
    ]
  });
  console.log(`📊 Admin queue now has: ${inQueue} bookings`);

  await mongoose.disconnect();
  console.log('\n✅ Done.\n');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
