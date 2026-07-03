/**
 * Booking Scheduler Service — Optimized
 * Handles Wave-Based Vendor Alerting
 *
 * Wave Logic:
 * - Wave 1: First 3 closest vendors (alerted immediately on booking creation)
 * - Wave 2: Next 3 vendors (after 15s if no accept)
 * - Wave 3: Next 4 vendors (after another 15s)
 * - Wave 4+: All remaining vendors
 *
 * OPTIMIZATIONS:
 * - All active bookings processed in PARALLEL (Promise.all, not serial for-loop)
 * - Circuit breaker: if no searching bookings exist, extend check interval to 30s
 * - Single Vendor.find per wave instead of per booking
 */

const Booking = require('../models/Booking');
const Vendor = require('../models/Vendor');
const { BOOKING_STATUS } = require('../utils/constants');
const { createNotification } = require('../controllers/notificationControllers/notificationController');

const Settings = require('../models/Settings');

// Wave configuration
let WAVE_CONFIG = {
  1: { count: 3, duration: 20000 },
  2: { count: 3, duration: 20000 },
  3: { count: 4, duration: 20000 },
  4: { count: Infinity, duration: 0 }
};

let MAX_SEARCH_TIME_MS = 2 * 60 * 1000; // 2 minute fallback

const ACTIVE_INTERVAL_MS = 5000;  // Poll every 5s when bookings exist
const IDLE_INTERVAL_MS = 30000;   // Poll every 30s when no active bookings (circuit breaker)

// Calculate vendor index range for a wave
const getVendorRange = (wave) => {
  let start = 0;
  for (let i = 1; i < wave; i++) {
    start += WAVE_CONFIG[i]?.count || 0;
  }
  const config = WAVE_CONFIG[wave] || WAVE_CONFIG[4];
  const end = config.count === Infinity ? Infinity : start + config.count;
  return { start, end };
};

class BookingScheduler {
  constructor(io) {
    this.io = io;
    this.intervalId = null;
    this.isRunning = false;
    this.isIdle = false; // Circuit breaker state
  }

  start() {
    if (this.isRunning) {
      console.log('[BookingScheduler] Already running.');
      return;
    }
    this.isRunning = true;
    console.log('[BookingScheduler] Started — active interval: 5s, idle interval: 30s');
    this.scheduleNext(ACTIVE_INTERVAL_MS);
  }

  scheduleNext(intervalMs) {
    if (this.intervalId) clearTimeout(this.intervalId);
    this.intervalId = setTimeout(async () => {
      const hadWork = await this.processWaves();
      // Adaptive interval: if idle, slow down; if active, stay fast
      this.scheduleNext(hadWork ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS);
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('[BookingScheduler] Stopped.');
    }
  }

  /**
   * Process all active searching bookings in PARALLEL.
   * @returns {boolean} true if any booking was processed, false if idle
   */
  async processWaves() {
    try {
      const BookingRequest = require('../models/BookingRequest');

      // --- REFRESH SETTINGS ---
      try {
        const globalSettings = await Settings.findOne({ type: 'global' }).lean();
        if (globalSettings) {
          // Force 20s per wave for a total of 60s search time (3 waves)
          const waveDur = 20 * 1000; 
          WAVE_CONFIG = {
            1: { count: 3, duration: waveDur },
            2: { count: 3, duration: waveDur },
            3: { count: 4, duration: waveDur },
            4: { count: Infinity, duration: 0 }
          };
          MAX_SEARCH_TIME_MS = 2 * 60 * 1000; // Strictly 2 minutes
        }
      } catch (sErr) {
        console.error('[BookingScheduler] Settings fetch error:', sErr);
      }

      // --- HANDLE EXPIRED ADMIN-ASSIGNED BOOKINGS ---
      // If vendor didn't accept within the 30-min window, re-escalate back to admin queue
      try {
        const now_check = new Date();
        const expiredAdminBookings = await Booking.find({
          assignedByAdmin: true,
          adminAssignmentStatus: 'PENDING',
          status: BOOKING_STATUS.REQUESTED,
          expiresAt: { $lt: now_check }
        }, '_id bookingNumber userId notifiedVendors').lean();

        if (expiredAdminBookings.length > 0) {
          console.log(`[BookingScheduler] Found ${expiredAdminBookings.length} expired admin-assigned booking(s) — re-escalating`);
          await Promise.all(expiredAdminBookings.map(async (b) => {
            await Booking.updateOne(
              { _id: b._id, adminAssignmentStatus: 'PENDING', status: BOOKING_STATUS.REQUESTED },
              {
                $set: {
                  status: BOOKING_STATUS.ESCALATED,
                  isEscalatedToAdmin: true,
                  adminAssignmentStatus: null,
                  expiresAt: null
                }
              }
            );
            console.log(`[BookingScheduler] Re-escalated admin booking ${b.bookingNumber} — vendor did not accept in time`);
            if (this.io) {
              this.io.emit('adminBookingEscalated', { bookingId: b._id, reason: 'vendor_no_accept' });
            }
          }));
        }
      } catch (adminExpErr) {
        console.error('[BookingScheduler] Error handling expired admin bookings:', adminExpErr);
      }

      // --- CIRCUIT BREAKER: Fast query to detect if any work is needed ---
      const activeBookings = await Booking.find(
        {
          status: BOOKING_STATUS.SEARCHING,
          waveStartedAt: { $ne: null },
          potentialVendors: { $exists: true, $not: { $size: 0 } }
        },
        '_id currentWave waveStartedAt potentialVendors notifiedVendors bookingNumber createdAt userId expiresAt'
      ).lean();

      if (activeBookings.length === 0) {
        return false; // Idle — caller will use longer interval
      }

      const now = Date.now();

      // --- PARALLEL PROCESSING: All ready bookings processed simultaneously ---
      await Promise.all(
        activeBookings.map(async (booking) => {
          try {
            const currentWave = booking.currentWave || 1;
            const waveConfig = WAVE_CONFIG[currentWave] || WAVE_CONFIG[4];
            const startTime = new Date(booking.createdAt || booking.waveStartedAt).getTime();
            const totalElapsed = now - startTime;

            // --- PERSISTENCE: Save expiresAt to DB if missing ---
            if (!booking.expiresAt) {
              const expiresAtDate = new Date(startTime + MAX_SEARCH_TIME_MS);
              await Booking.findByIdAndUpdate(booking._id, { $set: { expiresAt: expiresAtDate } });
            }

            // --- EXPIRY CHECK ---
            if (totalElapsed > MAX_SEARCH_TIME_MS) {
              // Try atomic update to ESCALATED
              const updateResult = await Booking.updateOne(
                { _id: booking._id, status: BOOKING_STATUS.SEARCHING },
                {
                  $set: {
                    status: BOOKING_STATUS.ESCALATED,
                    isEscalatedToAdmin: true
                  }
                }
              );

              if (updateResult.modifiedCount > 0) {
                console.log(`[BookingScheduler] ${booking.bookingNumber}: Search timed out. Status updated to ESCALATED.`);
                
                // Notify User & Admin
                if (this.io) {
                  this.io.to(`user_${booking.userId}`).emit('booking_escalated_to_admin', {
                    bookingId: booking._id,
                    message: 'Our admin team is manually assigning a professional for your service.'
                  });
                  this.io.emit('adminBookingEscalated', { bookingId: booking._id });
                }

                // Remove from all notified vendors
                if (booking.notifiedVendors && booking.notifiedVendors.length > 0) {
                  booking.notifiedVendors.forEach(vId => {
                    this.io.to(`vendor_${vId}`).emit('removeVendorBooking', { id: booking._id });
                  });
                }
              }
              return;
            }

            const waveElapsed = now - new Date(booking.waveStartedAt).getTime();
            // Only process if this booking's wave timer has expired
            if (waveConfig.duration === 0 || waveElapsed < waveConfig.duration) return;

            const nextWave = currentWave + 1;
            const { start, end } = getVendorRange(nextWave);

            // Get vendors to notify in this wave
            let vendorsToNotify = booking.potentialVendors.slice(
              start,
              end === Infinity ? undefined : end
            );

            if (vendorsToNotify.length === 0) {
              console.log(`[BookingScheduler] Booking ${booking.bookingNumber}: No vendors left in Wave ${nextWave}`);
              return;
            }

            // Filter to only online+available vendors (single batch find for this booking)
            const vendorIds = vendorsToNotify.map(v => v.vendorId);
            const onlineVendors = await Vendor.find(
              { _id: { $in: vendorIds }, isOnline: true, availability: { $in: ['AVAILABLE', 'BUSY'] } },
              '_id'
            ).lean();

            const onlineSet = new Set(onlineVendors.map(v => v._id.toString()));
            vendorsToNotify = vendorsToNotify.filter(v => onlineSet.has(v.vendorId.toString()));

            // Advance wave in DB — use findByIdAndUpdate for atomicity (avoids race with accept)
            const notifyIds = vendorsToNotify.map(v => v.vendorId);
            await Booking.findByIdAndUpdate(booking._id, {
              $set: { currentWave: nextWave, waveStartedAt: new Date() },
              $addToSet: { notifiedVendors: { $each: notifyIds } }
            });

            if (vendorsToNotify.length === 0) {
              console.log(`[BookingScheduler] Booking ${booking.bookingNumber}: Wave ${nextWave} all offline, advancing quietly`);
              return;
            }

            console.log(`[BookingScheduler] ${booking.bookingNumber}: Wave ${nextWave} → notifying ${vendorsToNotify.length} vendors`);

            // Insert BookingRequest records + send notifications (both in parallel)
            const bookingRequests = vendorsToNotify.map(v => ({
              bookingId: booking._id,
              vendorId: v.vendorId,
              status: 'PENDING',
              createdAt: booking.createdAt || new Date(),
              distance: v.distance || null,
              sentAt: new Date(),
              expiresAt: new Date(Date.now() + 60 * 60 * 1000)
            }));

            await Promise.all([
              BookingRequest.insertMany(bookingRequests, { ordered: false }).catch(err => {
                if (err.code !== 11000) console.error('[BookingScheduler] BookingRequest insert error:', err);
              }),
              this.notifyVendors(booking, vendorsToNotify)
            ]);

          } catch (bookingErr) {
            console.error(`[BookingScheduler] Error processing booking ${booking._id}:`, bookingErr);
          }
        })
      );

      return true; // Had work to do
    } catch (error) {
      console.error('[BookingScheduler] Error processing waves:', error);
      return false;
    }
  }

  async notifyVendors(booking, vendors) {
    try {
      // Fetch booking details for notification (single query for the whole wave)
      const populatedBooking = await Booking.findById(booking._id)
        .populate('serviceId', 'title')
        .populate('userId', 'name phone')
        .lean();

      if (!populatedBooking) return;

      const serviceName = populatedBooking.serviceId?.title || populatedBooking.serviceName;
      const customerName = populatedBooking.userId?.name || 'Customer';

      // Send all vendor notifications in parallel
      await Promise.all(
        vendors.map(async (v) => {
          // Fire socket immediately (synchronous, non-blocking)
          if (this.io) {
            this.io.to(`vendor_${v.vendorId}`).emit('new_booking_request', {
              bookingId: booking._id,
              serviceName,
              customerName,
              scheduledDate: populatedBooking.scheduledDate,
              scheduledTime: populatedBooking.scheduledTime,
              price: populatedBooking.finalAmount,
              address: populatedBooking.address,
              distance: v.distance,
              serviceCategory: populatedBooking.serviceCategory,
              brandName: populatedBooking.brandName,
              brandIcon: populatedBooking.brandIcon,
              categoryIcon: populatedBooking.categoryIcon,
              createdAt: populatedBooking.createdAt,
              expiresAt: new Date(new Date(populatedBooking.createdAt).getTime() + MAX_SEARCH_TIME_MS).toISOString(),
              playSound: true,
              message: `New booking request within ${v.distance?.toFixed(1) || '?'}km!`
            });
          }

          // Create DB notification + FCM push
          await createNotification({
            vendorId: v.vendorId,
            type: 'booking_request',
            title: 'New Booking Request',
            message: `New service request for ${serviceName} from ${customerName}`,
            relatedId: booking._id,
            relatedType: 'booking',
            data: {
              bookingId: booking._id,
              serviceName,
              customerName,
              scheduledDate: populatedBooking.scheduledDate,
              scheduledTime: populatedBooking.scheduledTime,
              location: populatedBooking.address,
              price: populatedBooking.finalAmount,
              distance: v.distance
            },
            pushData: {
              type: 'new_booking',
              dataOnly: false,
              link: `/vendor/bookings/${booking._id}`
            }
          });
        })
      );

      console.log(`[BookingScheduler] Notified ${vendors.length} vendors for booking ${booking.bookingNumber}`);
    } catch (error) {
      console.error('[BookingScheduler] Error notifying vendors:', error);
    }
  }
}

// Singleton instance
let schedulerInstance = null;

const initializeScheduler = (io) => {
  if (!schedulerInstance) {
    schedulerInstance = new BookingScheduler(io);
    schedulerInstance.start();
  }
  return schedulerInstance;
};

const getScheduler = () => schedulerInstance;

module.exports = { BookingScheduler, initializeScheduler, getScheduler };
