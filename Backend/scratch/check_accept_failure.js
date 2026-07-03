/**
 * Deep dive: Check why vendor accept is failing for admin-assigned bookings
 * Run: node scratch/check_accept_failure.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function main() {
  console.log('\n🔗 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected!\n');

  const db = mongoose.connection.db;
  const bookings = db.collection('bookings');
  const vendors = db.collection('vendors');
  const bookingRequests = db.collection('bookingrequests');

  // The 5 stuck booking IDs from previous analysis
  const stuckBookings = await bookings.find(
    {
      assignedByAdmin: true,
      adminAssignmentStatus: 'PENDING',
      status: 'requested'
    }
  ).toArray();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📋 STUCK BOOKINGS DEEP DIVE (${stuckBookings.length} found)`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const booking of stuckBookings) {
    console.log(`\n📌 Booking: #${booking.bookingNumber}`);
    console.log(`   Service: ${booking.serviceName}`);
    console.log(`   status: ${booking.status}`);
    console.log(`   adminAssignmentStatus: ${booking.adminAssignmentStatus}`);
    console.log(`   assignedByAdmin: ${booking.assignedByAdmin}`);
    console.log(`   vendorId (admin-set): ${booking.vendorId}`);
    console.log(`   expiresAt: ${booking.expiresAt}`);
    console.log(`   createdAt: ${booking.createdAt}`);
    
    // Check if expiresAt has passed
    if (booking.expiresAt && new Date(booking.expiresAt) < new Date()) {
      console.log(`   ⚠️  EXPIRED: This booking's 5-min accept window has PASSED! (${booking.expiresAt})`);
    } else if (booking.expiresAt) {
      const msLeft = new Date(booking.expiresAt) - new Date();
      console.log(`   ⏱️  Expires in: ${Math.round(msLeft/1000)}s`);
    } else {
      console.log(`   ❌ No expiresAt set!`);
    }

    // Check the vendor that was assigned
    if (booking.vendorId) {
      const vendor = await vendors.findOne(
        { _id: new mongoose.Types.ObjectId(booking.vendorId.toString()) },
        { projection: { name: 1, businessName: 1, email: 1, isOnline: 1, availability: 1 } }
      );
      if (vendor) {
        console.log(`\n   👤 Assigned Vendor: ${vendor.businessName || vendor.name}`);
        console.log(`   📧 Email: ${vendor.email}`);
        console.log(`   🟢 isOnline: ${vendor.isOnline}`);
        console.log(`   📶 availability: ${vendor.availability}`);
      } else {
        console.log(`   ❌ Assigned vendor NOT FOUND in DB!`);
      }
    }

    // Check BookingRequests for this booking
    const requests = await bookingRequests.find(
      { bookingId: new mongoose.Types.ObjectId(booking._id.toString()) }
    ).sort({ createdAt: -1 }).toArray();
    
    console.log(`\n   📨 BookingRequests (${requests.length} total):`);
    requests.forEach(r => {
      console.log(`      vendorId: ${r.vendorId} | status: ${r.status} | sentAt: ${r.sentAt}`);
    });

    // Check notifiedVendors
    if (booking.notifiedVendors && booking.notifiedVendors.length > 0) {
      console.log(`\n   📢 notifiedVendors (${booking.notifiedVendors.length}):`);
      for (const vId of booking.notifiedVendors) {
        const v = await vendors.findOne(
          { _id: new mongoose.Types.ObjectId(vId.toString()) },
          { projection: { name: 1, businessName: 1 } }
        );
        console.log(`      ${vId} → ${v?.businessName || v?.name || 'NOT FOUND'}`);
      }
    } else {
      console.log(`   📢 notifiedVendors: NONE`);
    }

    console.log('\n   ---');
  }

  // Check the accept query simulation for the first stuck booking
  if (stuckBookings.length > 0) {
    const b = stuckBookings[0];
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🧪 SIMULATING accept query for first stuck booking');
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Try the exact query used in acceptBooking
    const result = await bookings.findOne({
      _id: b._id,
      status: { $in: ['requested', 'searching', 'pending'] },
      $or: [
        { vendorId: null },
        { vendorId: b.vendorId, assignedByAdmin: true }
      ]
    });

    if (result) {
      console.log(`✅ Query MATCHES — the accept would succeed if vendor ${b.vendorId} calls it`);
      console.log('   ⚠️  Issue is likely: wrong vendor calling accept, or frontend not hitting API');
    } else {
      console.log(`❌ Query DOES NOT MATCH — this is why accept fails!`);
      console.log(`   Checking individual conditions:`);
      
      const byId = await bookings.findOne({ _id: b._id });
      console.log(`   By _id: ${byId ? '✅ found' : '❌ not found'}`);
      console.log(`   status is '${byId?.status}' — in [requested, searching, pending]: ${['requested','searching','pending'].includes(byId?.status)}`);
      console.log(`   vendorId in DB: ${byId?.vendorId}`);
      console.log(`   assignedByAdmin: ${byId?.assignedByAdmin}`);
    }
  }

  await mongoose.disconnect();
  console.log('\n✅ Done.\n');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
