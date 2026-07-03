/**
 * DB Diagnostic: Check booking status for manual-assigned bookings
 * Run: node scratch/check_booking_status.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  console.log('\n🔗 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected!\n');

  const db = mongoose.connection.db;
  const bookings = db.collection('bookings');

  // 1. Find ALL bookings with assignedByAdmin = true
  const adminAssigned = await bookings.find(
    { assignedByAdmin: true },
    {
      projection: {
        bookingNumber: 1,
        status: 1,
        adminAssignmentStatus: 1,
        assignedByAdmin: 1,
        isEscalatedToAdmin: 1,
        createdAt: 1,
        'vendorId': 1,
        serviceName: 1
      }
    }
  ).sort({ createdAt: -1 }).limit(20).toArray();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📋 ADMIN-ASSIGNED BOOKINGS (last 20)');
  console.log('═══════════════════════════════════════════════════════════════');
  
  if (adminAssigned.length === 0) {
    console.log('❌ No admin-assigned bookings found in DB!');
  } else {
    adminAssigned.forEach(b => {
      const statusEmoji = {
        confirmed: '✅',
        work_done: '🏁',
        completed: '🎉',
        requested: '⏳',
        escalated: '🆘',
        cancelled: '❌',
        in_progress: '🔨',
        assigned: '📋'
      }[b.status] || '❓';

      const assignStatusEmoji = {
        ACCEPTED: '✅',
        PENDING: '⏳',
        DECLINED: '❌'
      }[b.adminAssignmentStatus] || '❓';

      console.log(`\n  Booking: #${b.bookingNumber || b._id.toString().slice(-6)}`);
      console.log(`  Service: ${b.serviceName || 'N/A'}`);
      console.log(`  DB Status:         ${statusEmoji} ${b.status}`);
      console.log(`  adminAssignStatus: ${assignStatusEmoji} ${b.adminAssignmentStatus || 'NOT SET'}`);
      console.log(`  assignedByAdmin:   ${b.assignedByAdmin}`);
      console.log(`  vendorId:          ${b.vendorId || 'NONE'}`);
      console.log(`  Created:           ${b.createdAt}`);
    });
  }

  // 2. Check specifically the MANUAL_ASSIGNMENT query filter result
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('🔍 MANUAL_ASSIGNMENT QUERY RESULT (what admin page fetches)');
  console.log('═══════════════════════════════════════════════════════════════');

  const manualAssignmentBookings = await bookings.find(
    {
      $or: [
        { status: 'escalated' },
        { status: 'requested', assignedByAdmin: true },
        { status: 'confirmed', assignedByAdmin: true },
        { status: 'awaiting_payment', assignedByAdmin: true }
      ]
    },
    {
      projection: {
        bookingNumber: 1,
        status: 1,
        adminAssignmentStatus: 1,
        assignedByAdmin: 1,
        serviceName: 1,
        vendorId: 1
      }
    }
  ).sort({ createdAt: -1 }).toArray();

  console.log(`Found ${manualAssignmentBookings.length} bookings in manual assignment queue:\n`);
  manualAssignmentBookings.forEach(b => {
    const shouldShowPending = b.assignedByAdmin && b.adminAssignmentStatus === 'PENDING';
    const shouldShowAccepted = b.adminAssignmentStatus === 'ACCEPTED';
    
    console.log(`  #${b.bookingNumber || b._id.toString().slice(-6)}`);
    console.log(`    status:               ${b.status}`);
    console.log(`    adminAssignmentStatus: ${b.adminAssignmentStatus || 'NOT SET'}`);
    console.log(`    UI would show:        ${shouldShowAccepted ? '✅ Claimed by Provider' : shouldShowPending ? '⏳ Pending Acceptance' : '🔵 Assign Vendor button'}`);
    console.log('');
  });

  // 3. Check if any booking is work_done/completed but STILL in manual queue (stuck)
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('⚠️  STUCK BOOKINGS: work_done/completed but still in admin queue');
  console.log('═══════════════════════════════════════════════════════════════');

  const stuckBookings = await bookings.find(
    {
      assignedByAdmin: true,
      status: { $in: ['work_done', 'completed', 'in_progress', 'journey_started', 'visited', 'assigned'] }
    },
    {
      projection: {
        bookingNumber: 1,
        status: 1,
        adminAssignmentStatus: 1,
        serviceName: 1
      }
    }
  ).toArray();

  if (stuckBookings.length === 0) {
    console.log('✅ No stuck bookings found.');
  } else {
    console.log(`❗ ${stuckBookings.length} bookings are work_done/completed but still have assignedByAdmin=true:`);
    stuckBookings.forEach(b => {
      console.log(`  #${b.bookingNumber} | status: ${b.status} | adminAssignmentStatus: ${b.adminAssignmentStatus}`);
    });
    
    console.log('\n  ⚠️  These bookings appear in MANUAL_ASSIGNMENT only if status=confirmed+assignedByAdmin.');
    console.log('  But work_done/completed are NOT in the query — so they won\'t show on admin page.\n');
  }

  // 4. Show summary stats
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 STATUS SUMMARY for ALL admin-assigned bookings');
  console.log('═══════════════════════════════════════════════════════════════');

  const statusGroups = await bookings.aggregate([
    { $match: { assignedByAdmin: true } },
    { $group: { _id: { status: '$status', adminAssignStatus: '$adminAssignmentStatus' }, count: { $sum: 1 } } },
    { $sort: { '_id.status': 1 } }
  ]).toArray();

  statusGroups.forEach(g => {
    console.log(`  status: ${g._id.status.padEnd(20)} | adminAssignmentStatus: ${(g._id.adminAssignStatus || 'NULL').padEnd(12)} | count: ${g.count}`);
  });

  await mongoose.disconnect();
  console.log('\n✅ Done. Disconnected from DB.\n');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
