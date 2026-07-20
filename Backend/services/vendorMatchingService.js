const Vendor = require('../models/Vendor');
const VendorService = require('../models/VendorService');
const UserService = require('../models/UserService');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Admin = require('../models/Admin');
const { BOOKING_STATUS } = require('../utils/constants');
const { createNotification } = require('../controllers/notificationControllers/notificationController');

/**
 * Fallback handler when no vendors are online or offer the required services
 */
const handleNoVendorsOnline = async (booking) => {
  console.log(`[VendorMatching] No online/active vendors found for booking ${booking.bookingNumber}.`);

  // Do not assign the booking
  booking.vendorId = null;
  await booking.save();

  // Notify the admin with exact requirement string: "No vendors are currently online for this booking."
  try {
    const activeAdmins = await Admin.find({ isActive: true }).select('_id');

    if (activeAdmins.length > 0) {
      await Promise.all(
        activeAdmins.map(admin =>
          createNotification({
            adminId: admin._id,
            type: 'general',
            title: 'No Vendors Available',
            message: 'No vendors are currently online for this booking.',
            relatedId: booking._id,
            relatedType: 'booking',
            data: {
              bookingId: booking._id.toString(),
              bookingNumber: booking.bookingNumber,
              serviceName: booking.serviceName
            }
          })
        )
      );
      console.log(`[VendorMatching] Notified ${activeAdmins.length} active admin(s): "No vendors are currently online for this booking."`);
    } else {
      console.warn('[VendorMatching] No active admins found in database to notify.');
    }
  } catch (adminNotifErr) {
    console.error('[VendorMatching] Error notifying admins:', adminNotifErr);
  }

  return {
    success: false,
    matchedCount: 0,
    message: 'No vendors are currently online for this booking.'
  };
};

/**
 * Match vendors for a customer booking request based on:
 * 1. Offering all selected services
 * 2. Currently online (isOnline: true)
 * 3. Active (isActive: true & approvalStatus: 'approved')
 *
 * Wave logic & distance sorting preserved:
 * - Sorts matching vendors by 100m distance brackets and vendor level.
 * - Stores all potentialVendors, currentWave: 1, waveStartedAt.
 * - Creates BookingRequest records for Wave 1.
 * - Updates status to "Waiting for Vendor Response".
 * - Sends Socket.IO & push notifications to Wave 1 vendors.
 * - If no online/matching vendors: notifies Admin.
 */
const matchAndNotifyVendors = async (bookingId, nearbyVendorsList = null) => {
  try {
    const booking = await Booking.findById(bookingId)
      .populate('userId', 'name phone email')
      .populate('serviceId');

    if (!booking) {
      console.error(`[VendorMatching] Booking ${bookingId} not found.`);
      return { success: false, reason: 'Booking not found' };
    }

    // Collect all selected service IDs and titles from booking
    const selectedServiceIds = [];
    const selectedServiceTitles = [];

    if (booking.serviceId) {
      const sId = booking.serviceId._id ? booking.serviceId._id.toString() : booking.serviceId.toString();
      selectedServiceIds.push(sId);
      if (booking.serviceId.title) {
        selectedServiceTitles.push(booking.serviceId.title);
      }
    }

    if (booking.serviceName && !selectedServiceTitles.includes(booking.serviceName)) {
      selectedServiceTitles.push(booking.serviceName);
    }

    if (Array.isArray(booking.bookedItems) && booking.bookedItems.length > 0) {
      booking.bookedItems.forEach(item => {
        if (item.serviceId) {
          const itemIdStr = item.serviceId.toString();
          if (!selectedServiceIds.includes(itemIdStr)) {
            selectedServiceIds.push(itemIdStr);
          }
        }
        if (item.serviceName && !selectedServiceTitles.includes(item.serviceName)) {
          selectedServiceTitles.push(item.serviceName);
        }
      });
    }

    // 1. Find vendors that are currently online and active
    let candidateVendors = [];
    if (Array.isArray(nearbyVendorsList) && nearbyVendorsList.length > 0) {
      candidateVendors = nearbyVendorsList.filter(v => v.isOnline !== false);
    } else {
      candidateVendors = await Vendor.find({
        isOnline: true,
        isActive: true,
        approvalStatus: 'approved',
        'wallet.isBlocked': { $ne: true }
      }).select('_id name businessName phone categories service address location settings level performanceScore').lean();
    }

    console.log(`[VendorMatching] System online & active candidate vendors count: ${candidateVendors.length}`);

    if (candidateVendors.length === 0) {
      return await handleNoVendorsOnline(booking);
    }

    // 2. Filter vendors that offer ALL selected services
    const matchingVendors = [];

    for (const vendor of candidateVendors) {
      let offersAllServices = true;

      if (selectedServiceIds.length > 0) {
        // Query vendor service subscriptions/catalog for explicit service ID matches
        const vendorServiceDocs = await VendorService.find({
          vendorId: vendor._id,
          serviceId: { $in: selectedServiceIds },
          isAvailable: { $ne: false }
        }).select('serviceId').lean();

        const offeredServiceIdStrs = vendorServiceDocs.map(vs => vs.serviceId.toString());

        const userServiceDocs = await UserService.find({
          vendorId: vendor._id,
          status: 'active'
        }).select('_id title').lean();

        const userServiceIdStrs = userServiceDocs.map(us => us._id.toString());
        const userServiceTitles = userServiceDocs.map(us => us.title);

        const allOfferedServiceIds = new Set([...offeredServiceIdStrs, ...userServiceIdStrs]);

        for (const reqServiceId of selectedServiceIds) {
          if (!allOfferedServiceIds.has(reqServiceId)) {
            // Check fallback by category title or service name match
            const categoryMatch = (vendor.categories && vendor.categories.includes(booking.serviceCategory)) ||
                                  (vendor.service && vendor.service.includes(booking.serviceCategory));
            const titleMatch = userServiceTitles.includes(booking.serviceName);

            if (!categoryMatch && !titleMatch) {
              offersAllServices = false;
              break;
            }
          }
        }
      } else {
        // Fallback category check
        const categoryMatch = (vendor.categories && vendor.categories.includes(booking.serviceCategory)) ||
                              (vendor.service && vendor.service.includes(booking.serviceCategory));
        if (!categoryMatch) {
          offersAllServices = false;
        }
      }

      if (offersAllServices) {
        matchingVendors.push(vendor);
      }
    }

    console.log(`[VendorMatching] Vendors offering all selected services count: ${matchingVendors.length}`);

    if (matchingVendors.length === 0) {
      return await handleNoVendorsOnline(booking);
    }

    // 3. Wave-based Distance & Level Sorting
    const sortedVendors = matchingVendors.sort((a, b) => {
      const distA = Math.round((a.distance || 0) * 10) / 10;
      const distB = Math.round((b.distance || 0) * 10) / 10;
      
      if (distA !== distB) {
        return distA - distB;
      }
      
      const levelA = a.level || 3;
      const levelB = b.level || 3;
      return levelA - levelB;
    });

    // Wave 1: First 3 vendors
    const WAVE_1_COUNT = 3;
    const wave1Vendors = sortedVendors.slice(0, WAVE_1_COUNT);

    // Save potential vendors, currentWave, and status in booking document
    booking.potentialVendors = sortedVendors.map(v => ({
      vendorId: v._id,
      distance: v.distance || 0
    }));
    booking.currentWave = 1;
    booking.waveStartedAt = new Date();
    booking.status = BOOKING_STATUS.WAITING_FOR_VENDOR_RESPONSE;
    booking.notifiedVendors = wave1Vendors.map(v => v._id);
    await booking.save();

    console.log(`[VendorMatching] Wave 1: Alerting ${wave1Vendors.length} closest vendors (of ${sortedVendors.length} total)`);

    // Create BookingRequest entries for Wave 1 vendors
    if (wave1Vendors.length > 0) {
      const BookingRequest = require('../models/BookingRequest');
      const bookingRequests = wave1Vendors.map(vendor => ({
        bookingId: booking._id,
        vendorId: vendor._id,
        status: 'PENDING',
        wave: 1,
        distance: vendor.distance || null,
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 1000) // 1 min fallback
      }));

      try {
        await BookingRequest.insertMany(bookingRequests, { ordered: false });
        console.log(`[VendorMatching] Created ${bookingRequests.length} BookingRequest entries for Wave 1`);
      } catch (err) {
        if (err.code !== 11000) console.error('[VendorMatching] BookingRequest insert error:', err);
      }
    }

    // Send notifications to Wave 1 vendors
    let io = null;
    try {
      const { getIO } = require('../sockets');
      io = getIO();
    } catch (e) {
      console.log('[VendorMatching] Socket check:', e.message);
    }

    if (io) {
      wave1Vendors.forEach(vendor => {
        const vendorRoom = `vendor_${vendor._id.toString()}`;
        io.to(vendorRoom).emit('new_booking_request', {
          bookingId: booking._id,
          bookingNumber: booking.bookingNumber,
          serviceName: booking.serviceName,
          customerName: booking.userId?.name || 'Customer',
          customerPhone: booking.userId?.phone,
          scheduledDate: booking.scheduledDate,
          scheduledTime: booking.scheduledTime,
          price: booking.finalAmount,
          address: booking.address,
          distance: vendor.distance,
          serviceCategory: booking.serviceCategory,
          brandName: booking.brandName,
          brandIcon: booking.brandIcon,
          categoryIcon: booking.categoryIcon,
          createdAt: booking.createdAt || new Date(),
          expiresAt: new Date(new Date(booking.createdAt || Date.now()).getTime() + (1 * 60 * 1000)).toISOString(),
          playSound: true,
          status: booking.status,
          message: `New booking request within ${vendor.distance?.toFixed(1) || '?'}km!`
        });
      });
    }

    await Promise.all(
      wave1Vendors.map(vendor =>
        createNotification({
          vendorId: vendor._id,
          type: 'booking_request',
          title: 'New Booking Request',
          message: `New service request for ${booking.serviceName} from ${booking.userId?.name || 'Customer'}`,
          relatedId: booking._id,
          relatedType: 'booking',
          data: {
            bookingId: booking._id.toString(),
            serviceName: booking.serviceName,
            customerName: booking.userId?.name,
            customerPhone: booking.userId?.phone,
            scheduledDate: booking.scheduledDate,
            scheduledTime: booking.scheduledTime,
            location: booking.address,
            price: booking.finalAmount,
            distance: vendor.distance
          },
          pushData: {
            type: 'new_booking',
            dataOnly: false,
            link: `/vendor/bookings/${booking._id}`
          }
        })
      )
    );

    return {
      success: true,
      matchedCount: sortedVendors.length,
      wave1Count: wave1Vendors.length,
      status: BOOKING_STATUS.WAITING_FOR_VENDOR_RESPONSE
    };

  } catch (error) {
    console.error('[VendorMatching] Error in matchAndNotifyVendors:', error);
    throw error;
  }
};

module.exports = {
  matchAndNotifyVendors,
  handleNoVendorsOnline
};
