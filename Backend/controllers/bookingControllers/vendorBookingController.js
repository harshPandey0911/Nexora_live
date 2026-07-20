const mongoose = require('mongoose');
const Booking = require('../../models/Booking');
const Worker = require('../../models/Worker');
const VendorBill = require('../../models/VendorBill');
const User = require('../../models/User');
const UserService = require('../../models/UserService');
const Category = require('../../models/Category');
const Admin = require('../../models/Admin');
const { validationResult } = require('express-validator');
const { BOOKING_STATUS, PAYMENT_STATUS } = require('../../utils/constants');
const { createNotification } = require('../notificationControllers/notificationController');
const { sendNotificationToUser, sendNotificationToVendor, sendNotificationToWorker } = require('../../services/firebaseAdmin');

/**
 * Get vendor bookings with filters
 */
const getVendorBookings = async (req, res) => {
  try {
    const vendorId = req.user._id || req.user.id;
    const { status, q, page = 1, limit = 50 } = req.query;

    // ── Get vendor categories from req.user (set in auth middleware) ──
    let vendorCategories = req.user.categories || req.user.service || [];
    if (!vendorCategories.length) {
      const Vendor = require('../../models/Vendor');
      const v = await Vendor.findById(vendorId, 'service').lean();
      vendorCategories = v?.service || [];
    }

    const vId = new mongoose.Types.ObjectId(vendorId);

    // ── Build Base Query ──
    // This Or condition ensures vendors see their own jobs OR relevant unassigned alerts
    const query = {
      $or: [
        { vendorId: vId },
        {
          vendorId: null,
          status: { $in: [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.SEARCHING] },
          serviceCategory: { $in: vendorCategories },
          'potentialVendors.vendorId': vId // Only show jobs where THIS vendor is within range
        }
      ]
    };

    // ── Apply Status Group Filters ──
    if (status && status !== 'all') {
      if (status === 'in_progress') {
        query.status = {
          $in: [
            BOOKING_STATUS.ACCEPTED,
            BOOKING_STATUS.ASSIGNED,
            BOOKING_STATUS.CONFIRMED,
            BOOKING_STATUS.JOURNEY_STARTED,
            BOOKING_STATUS.VISITED,
            BOOKING_STATUS.IN_PROGRESS,
            BOOKING_STATUS.WORK_DONE,
            'started', 'reached', 'on_the_way'
          ]
        };
      } else if (status === 'completed') {
        query.status = {
          $in: [
            BOOKING_STATUS.COMPLETED,
            'worker_paid', 'settlement_pending', 'paid', 'closed'
          ]
        };
      } else if (status === 'assigned') {
        query.status = { $in: [BOOKING_STATUS.ASSIGNED, 'worker_accepted'] };
      } else if (status === 'pending' || status === 'requested' || status === 'searching') {
        // Handle "New Requests" specifically - include all pre-acceptance statuses
        query.status = { 
          $in: [
            BOOKING_STATUS.PENDING, 
            BOOKING_STATUS.REQUESTED, 
            BOOKING_STATUS.SEARCHING
          ] 
        };
      } else {
        query.status = status;
      }
    }

    // ── Apply Search Filter (Simple regex on serviceName or bookingNumber) ──
    if (q) {
      query.$and = [
        {
          $or: [
            { serviceName: { $regex: q, $options: 'i' } },
            { bookingNumber: { $regex: q, $options: 'i' } }
          ]
        }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ── Single DB round-trip: list + total via $facet ──
    const [result] = await Booking.aggregate([
      { $match: query },
      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: parseInt(limit) },
            {
              $project: {
                _id: 1,
                bookingNumber: 1,
                status: 1,
                paymentMethod: 1,
                finalAmount: 1,
                scheduledDate: 1,
                scheduledTime: 1,
                serviceName: 1,
                serviceCategory: 1,
                categoryIcon: 1,
                createdAt: 1,
                'address.addressLine1': 1,
                'address.city': 1,
                userId: 1,
                workerId: 1,
                rejectedWorkerId: 1,
                workerResponse: 1,
                serviceId: 1,
                acceptedAt: 1,
                assignedAt: 1,
                brandName: 1,
                brandIcon: 1,
                expiresAt: 1,
                offeringType: 1
              }
            }
          ],
          total: [{ $count: 'n' }]
        }
      }
    ]);

    const bookings = result.data || [];
    const total = result.total?.[0]?.n || 0;

    // ── Populate only required fields ──
    await Booking.populate(bookings, [
      { path: 'userId', select: 'name phone', options: { lean: true } },
      { path: 'workerId', select: 'name', options: { lean: true } },
      { path: 'rejectedWorkerId', select: 'name', options: { lean: true } },
      {
        path: 'serviceId',
        select: 'title iconUrl categoryId',
        populate: { path: 'categoryId', select: 'title' },
        options: { lean: true }
      }
    ]);

    res.status(200).json({
      success: true,
      data: bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get vendor bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings. Please try again.'
    });
  }
};


/**
 * Get booking details by ID
 */
const getBookingById = async (req, res) => {
  try {
    const vendorId = req.user._id || req.user.id;
    const { id } = req.params;

    const booking = await Booking.findOne({
      _id: id,
      $or: [
        { vendorId },
        { vendorId: null, status: { $in: ['requested', 'searching'] } }
      ]
    })
      .populate('userId', 'name phone email profilePhoto')
      .populate('vendorId', 'name businessName phone email')
      .populate('serviceId', 'title description iconUrl images')
      .populate('categoryId', 'title slug')
      .populate('workerId', 'name phone rating totalJobs completedJobs')
      .populate('vendorBillId', 'vendorTotalEarning companyRevenue');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking. Please try again.'
    });
  }
};

/**
 * Accept booking and perform personally
 */
const acceptBooking = async (req, res) => {
  try {
    const vendorId = req.user._id || req.user.id;
    const { id } = req.params;

    // Only skip if already in a post-acceptance state for this vendor.
    const POST_ACCEPT_STATUSES = [
      BOOKING_STATUS.VENDOR_ACCEPTED, BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.ACCEPTED,
      BOOKING_STATUS.ASSIGNED, BOOKING_STATUS.JOURNEY_STARTED,
      BOOKING_STATUS.VISITED, BOOKING_STATUS.IN_PROGRESS, BOOKING_STATUS.WORK_DONE
    ];
    const current = await Booking.findById(id);
    if (
      current &&
      current.vendorId &&
      current.vendorId.toString() === vendorId.toString() &&
      POST_ACCEPT_STATUSES.includes(current.status)
    ) {
      return res.status(200).json({
        success: true,
        message: 'Order already accepted by you',
        data: current
      });
    }

    const now = new Date();
    const activityEntry = {
      action: 'Vendor Accepted',
      actorId: vendorId,
      actorModel: 'Vendor',
      timestamp: now,
      note: 'Vendor accepted and decided to perform service personally'
    };

    // ATOMIC UPDATE: Check status and vendorId in query to prevent race conditions
    // Only accept if status is REQUESTED/SEARCHING and NO vendor is assigned yet
    const updatedBooking = await Booking.findOneAndUpdate(
      {
        _id: id,
        status: { $in: [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.SEARCHING, BOOKING_STATUS.PENDING, BOOKING_STATUS.WAITING_FOR_VENDOR_RESPONSE] },
        $or: [
          { vendorId: null },
          { vendorId: new mongoose.Types.ObjectId(vendorId), assignedByAdmin: true }
        ]
      },
      {
        $set: {
          vendorId: vendorId,
          acceptedAt: now,
          status: BOOKING_STATUS.VENDOR_ACCEPTED,
          adminAssignmentStatus: 'ACCEPTED'
        },
        $push: {
          activityLog: activityEntry
        }
      },
      { new: true } // Return updated doc
    );

    if (!updatedBooking) {
      // If update failed, check why (likely already taken)
      const existing = await Booking.findById(id);
      if (existing && existing.vendorId) {
        return res.status(409).json({ // 409 Conflict
          success: false,
          message: 'Sorry, this job has already been accepted by another vendor.'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Booking is no longer available.'
      });
    }

    // Booking successfully accepted by THIS vendor
    const booking = updatedBooking;
    const vendorName = req.user.businessName || req.user.name || 'Vendor';

    // Update vendor availability to ON_JOB
    const Vendor = require('../../models/Vendor');
    await Vendor.findByIdAndUpdate(vendorId, { availability: 'ON_JOB' });

    // Update BookingRequest statuses
    const BookingRequest = require('../../models/BookingRequest');

    // Mark this vendor's request as ACCEPTED
    await BookingRequest.findOneAndUpdate(
      { bookingId: id, vendorId },
      { status: 'ACCEPTED', respondedAt: now }
    );

    // Mark all other vendors' requests as EXPIRED/CANCELLED
    await BookingRequest.updateMany(
      { bookingId: id, vendorId: { $ne: vendorId } },
      { status: 'EXPIRED', respondedAt: now }
    );

    // NOTIFY OTHER VENDORS to remove this job
    const io = req.app.get('io');
    if (io && booking.notifiedVendors && booking.notifiedVendors.length > 0) {
      booking.notifiedVendors.forEach(otherVendorId => {
        if (otherVendorId.toString() !== vendorId.toString()) {
          const room = `vendor_${otherVendorId.toString()}`;
          io.to(room).emit('booking_taken', {
            bookingId: booking._id.toString(),
            message: 'This job has been accepted by someone else.'
          });
        }
      });
    }

    // Emit real-time updates to USER and ADMIN
    if (io) {
      if (booking.assignedByAdmin) {
        io.emit('adminBookingAccept', {
          bookingId: booking._id,
          bookingNumber: booking.bookingNumber,
          vendorId: vendorId,
          vendorName: vendorName,
          message: `Vendor ${vendorName} accepted manual booking assignment: ${booking.bookingNumber}`
        });
      }

      const message = 'Vendor has accepted your request. Your booking is confirmed!';

      io.to(`user_${booking.userId}`).emit('booking_accepted', {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        vendor: {
          id: vendorId,
          name: req.user.name,
          businessName: req.user.businessName
        },
        message
      });

      io.to(`user_${booking.userId}`).emit('booking_updated', {
        bookingId: booking._id,
        status: booking.status,
        message: 'Vendor has accepted your request'
      });
    }

    // Send notification to customer
    const notificationMessage = `Your booking ${booking.bookingNumber} is confirmed! ${vendorName} has accepted your booking request.`;

    await createNotification({
      userId: booking.userId,
      type: 'booking_accepted',
      title: 'Booking Accepted!',
      message: notificationMessage,
      relatedId: booking._id,
      relatedType: 'booking',
      pushData: {
        type: 'booking_accepted',
        bookingId: booking._id.toString(),
        link: `/user/booking/${booking._id}`
      }
    });

    // Send notification to Admin(s)
    try {
      const activeAdmins = await Admin.find({ isActive: true }).select('_id').lean();
      if (activeAdmins.length > 0) {
        await Promise.all(
          activeAdmins.map(admin =>
            createNotification({
              adminId: admin._id,
              type: 'general',
              title: 'Vendor Accepted Booking',
              message: `Vendor ${vendorName} accepted booking #${booking.bookingNumber}.`,
              relatedId: booking._id,
              relatedType: 'booking',
              data: {
                bookingId: booking._id.toString(),
                bookingNumber: booking.bookingNumber,
                vendorId: vendorId.toString()
              }
            })
          )
        );
      }
    } catch (adminNotifErr) {
      console.error('[AcceptBooking] Admin notification error:', adminNotifErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Booking accepted successfully',
      data: booking
    });
  } catch (error) {
    console.error('Accept booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept booking. Please try again.'
    });
  }
};

/**
 * Reject booking
 * IMPORTANT: This only marks the vendor's rejection, NOT the booking itself.
 * Booking stays SEARCHING so other vendors can accept.
 */
const rejectBooking = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const vendorId = req.user._id || req.user.id;
    const { id } = req.params;
    const { reason } = req.body;

    // Find booking
    const booking = await Booking.findOne({
      _id: id,
      $or: [
        { notifiedVendors: vendorId },
        { vendorId: null, status: { $in: [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.SEARCHING, BOOKING_STATUS.PENDING] } },
        // Allow admin-assigned vendor to reject
        { vendorId: new mongoose.Types.ObjectId(vendorId), assignedByAdmin: true, status: BOOKING_STATUS.REQUESTED },
        // Allow assigned product vendor to reject
        { vendorId: new mongoose.Types.ObjectId(vendorId), offeringType: 'PRODUCT', status: BOOKING_STATUS.CONFIRMED }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not available for rejection'
      });
    }

    const isProduct = booking.offeringType === 'PRODUCT';
    const validStatuses = isProduct
      ? [BOOKING_STATUS.PENDING, BOOKING_STATUS.REQUESTED, BOOKING_STATUS.SEARCHING, BOOKING_STATUS.CONFIRMED]
      : [BOOKING_STATUS.PENDING, BOOKING_STATUS.REQUESTED, BOOKING_STATUS.SEARCHING];

    if (!validStatuses.includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject booking with status: ${booking.status}`
      });
    }

    // If product booking, handle re-routing or escalation to admin immediately
    if (isProduct) {
      console.log(`[RejectBooking] Product booking ${booking.bookingNumber} rejected by vendor ${vendorId}. Re-routing...`);

      // Update/Create BookingRequest for this vendor to REJECTED
      const BookingRequest = require('../../models/BookingRequest');
      await BookingRequest.findOneAndUpdate(
        { bookingId: id, vendorId },
        {
          status: 'REJECTED',
          respondedAt: new Date(),
          rejectReason: reason || 'Rejected by vendor'
        },
        { upsert: true }
      );

      // Find other vendors offering this product
      const { findNearbyVendors } = require('../../services/locationService');
      const bookingLocation = booking.address.lat && booking.address.lng
        ? { lat: booking.address.lat, lng: booking.address.lng }
        : null;

      let nextVendor = null;
      if (bookingLocation) {
        // Find category details for filtering
        const categoryObj = await Category.findById(booking.categoryId).select('title');
        const vendorFilters = {
          ...(categoryObj ? { service: categoryObj.title } : {}),
          city: booking.address.city,
          checkCashLimit: booking.paymentMethod === 'cash'
        };

        const rawNearbyVendors = await findNearbyVendors(bookingLocation, 10, vendorFilters);

        // Subscribed vendors
        const subscriptions = await UserService.find({
          title: booking.serviceName,
          vendorId: { $ne: null },
          status: 'active'
        }).select('vendorId').lean();
        const subscribedVendorIds = subscriptions.map(s => s.vendorId.toString());

        // Get already rejected vendor IDs for this booking
        const rejectedRequests = await BookingRequest.find({
          bookingId: id,
          status: 'REJECTED'
        }).select('vendorId').lean();
        const rejectedVendorIds = rejectedRequests.map(r => r.vendorId.toString());

        // Filter and sort to find next available vendor
        const availableVendors = rawNearbyVendors
          .filter(v => subscribedVendorIds.includes(v._id.toString()) && !rejectedVendorIds.includes(v._id.toString()))
          .sort((a, b) => (a.distance || 0) - (b.distance || 0));

        if (availableVendors.length > 0) {
          nextVendor = availableVendors[0];
        }
      }

      if (nextVendor) {
        console.log(`[RejectBooking] Found next vendor for product: ${nextVendor._id}. Reassigning...`);
        booking.vendorId = nextVendor._id;
        booking.status = BOOKING_STATUS.CONFIRMED;
        booking.notifiedVendors = [nextVendor._id];
        await booking.save();

        // Emit Socket.IO and Notification to next vendor
        const io = req.app.get('io');
        if (io) {
          io.to(`vendor_${nextVendor._id}`).emit('new_booking_request', {
            bookingId: booking._id,
            serviceName: booking.serviceName,
            customerName: booking.userId?.name || 'Customer',
            price: booking.finalAmount,
            offeringType: 'PRODUCT'
          });
        }

        try {
          await createNotification({
            vendorId: nextVendor._id,
            type: 'booking_request',
            title: 'New Product Order',
            message: `New product order for ${booking.serviceName} from customer`,
            relatedId: booking._id,
            relatedType: 'booking',
            data: {
              bookingId: booking._id.toString(),
              serviceName: booking.serviceName,
              price: booking.finalAmount,
              offeringType: 'PRODUCT'
            },
            pushData: {
              type: 'new_booking',
              dataOnly: false,
              link: `/vendor/bookings/${booking._id}`
            }
          });
        } catch (notifErr) {
          console.error('[RejectBooking] Notification error:', notifErr.message);
        }

        return res.status(200).json({
          success: true,
          message: 'Booking re-routed to next available vendor successfully',
          data: { bookingId: id }
        });
      } else {
        // No vendor available -> Escalate to Admin
        console.log('[RejectBooking] No other vendors available. Escalating product booking to admin...');
        booking.status = BOOKING_STATUS.ESCALATED;
        booking.isEscalatedToAdmin = true;
        booking.vendorId = null;
        await booking.save();

        const io = req.app.get('io');
        if (io) {
          io.to(`user_${booking.userId}`).emit('booking_escalated_to_admin', {
            bookingId: booking._id,
            bookingNumber: booking.bookingNumber,
            message: 'Our admin team is manually assigning a professional for your order.'
          });
          io.emit('adminBookingEscalated', { bookingId: booking._id });
        }

        return res.status(200).json({
          success: true,
          message: 'No other vendors available. Product order escalated to admin for manual assignment.',
          data: { bookingId: id }
        });
      }
    }

    const now = new Date();
    booking.rejectedAt = now;
    booking.status = BOOKING_STATUS.VENDOR_REJECTED;
    booking.activityLog.push({
      action: 'Vendor Rejected',
      actorId: vendorId,
      actorModel: 'Vendor',
      timestamp: now,
      note: reason || 'Rejected by vendor'
    });

    const vendorName = req.user.businessName || req.user.name || 'Vendor';

    // Send notification to Admin(s)
    try {
      const activeAdmins = await Admin.find({ isActive: true }).select('_id').lean();
      if (activeAdmins.length > 0) {
        await Promise.all(
          activeAdmins.map(admin =>
            createNotification({
              adminId: admin._id,
              type: 'general',
              title: 'Vendor Rejected Booking',
              message: `Vendor ${vendorName} rejected booking #${booking.bookingNumber}.`,
              relatedId: booking._id,
              relatedType: 'booking',
              data: {
                bookingId: booking._id.toString(),
                bookingNumber: booking.bookingNumber,
                vendorId: vendorId.toString(),
                reason: reason || ''
              }
            })
          )
        );
      }
    } catch (adminNotifErr) {
      console.error('[RejectBooking] Admin notification error:', adminNotifErr.message);
    }

    // Check if this booking was admin-assigned directly to this vendor, handle immediately
    const isAdminAssigned = booking.assignedByAdmin && booking.vendorId?.toString() === vendorId.toString();
    if (isAdminAssigned) {
      booking.adminAssignmentStatus = 'DECLINED';
      booking.vendorId = null;
      booking.status = BOOKING_STATUS.ESCALATED;
      await booking.save();

      const io = req.app.get('io');
      if (io) {
        io.emit('adminBookingDecline', {
          bookingId: booking._id,
          bookingNumber: booking.bookingNumber,
          vendorId: vendorId,
          message: `Vendor declined manual booking assignment: ${booking.bookingNumber}`
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Booking rejected and admin notified for reassignment'
      });
    }

    // Update BookingRequest for this vendor
    const BookingRequest = require('../../models/BookingRequest');
    await BookingRequest.findOneAndUpdate(
      { bookingId: id, vendorId },
      {
        status: 'REJECTED',
        respondedAt: now,
        rejectReason: reason || 'Rejected by vendor'
      }
    );

    // Remove vendor from notifiedVendors (they've responded)
    booking.notifiedVendors = booking.notifiedVendors.filter(
      v => v.toString() !== vendorId.toString()
    );

    // Remove from potentialVendors too
    booking.potentialVendors = booking.potentialVendors.filter(
      v => v.vendorId?.toString() !== vendorId.toString()
    );

    // Check if ALL vendors have rejected
    const pendingRequests = await BookingRequest.countDocuments({
      bookingId: id,
      status: { $in: ['PENDING', 'VIEWED'] }
    });

    const remainingPotential = booking.potentialVendors.length;

    if (pendingRequests === 0 && remainingPotential === 0) {
      if (booking.assignedByAdmin) {
        booking.adminAssignmentStatus = 'DECLINED';
        booking.status = BOOKING_STATUS.ESCALATED; // remains escalated so admin can reassign

        // Notify admin about the decline
        const io = req.app.get('io');
        if (io) {
          io.emit('adminBookingDecline', {
            bookingId: booking._id,
            bookingNumber: booking.bookingNumber,
            vendorId: vendorId,
            message: `Vendor declined manual booking assignment: ${booking.bookingNumber}`
          });
        }
      } else {
        // Escalate to admin
        booking.status = BOOKING_STATUS.ESCALATED;
        booking.isEscalatedToAdmin = true;

        // Notify user and admin
        const io = req.app.get('io');
        if (io) {
          io.to(`user_${booking.userId}`).emit('booking_escalated_to_admin', {
            bookingId: booking._id,
            bookingNumber: booking.bookingNumber,
            message: 'Our admin team is manually assigning a professional for your service.'
          });
          io.emit('adminBookingEscalated', { bookingId: booking._id });
        }
      }
    }

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Booking rejected successfully',
      data: { bookingId: id }
    });
  } catch (error) {
    console.error('Reject booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject booking. Please try again.'
    });
  }
};

/**
 * Vendor chooses worker assignment flow.
 * Requirement: Do not assign worker yet. Simply open/return vendor's worker selection flow.
 */
const chooseWorkerAssignment = async (req, res) => {
  try {
    const vendorId = req.user._id || req.user.id;
    const { id } = req.params;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const now = new Date();
    booking.activityLog.push({
      action: 'Vendor Chose Worker Assignment',
      actorId: vendorId,
      actorModel: 'Vendor',
      timestamp: now,
      note: 'Vendor initiated worker assignment flow'
    });
    await booking.save();

    // Fetch active workers of vendor
    const workers = await Worker.find({
      vendorId: vendorId,
      status: { $in: ['active', 'ONLINE', 'OFFLINE'] }
    }).select('_id name phone rating profileImage isOnline availability').lean();

    res.status(200).json({
      success: true,
      message: 'Worker selection flow opened successfully',
      data: {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        serviceName: booking.serviceName,
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.scheduledTime,
        workers: workers
      }
    });
  } catch (error) {
    console.error('Choose worker assignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to open worker selection flow'
    });
  }
};

/**
 * Unified vendor response handler for booking requests.
 * Actions:
 * - ACCEPT_SELF: Vendor accepts & performs service personally
 * - ASSIGN_WORKER: Vendor opens worker selection flow
 * - REJECT: Vendor rejects booking
 */
const respondToBooking = async (req, res) => {
  const { action } = req.body;
  const normalizedAction = (action || '').toUpperCase();

  if (normalizedAction === 'ACCEPT_SELF' || normalizedAction === 'ACCEPT') {
    return acceptBooking(req, res);
  } else if (normalizedAction === 'ASSIGN_WORKER' || normalizedAction === 'CHOOSE_WORKER') {
    return chooseWorkerAssignment(req, res);
  } else if (normalizedAction === 'REJECT') {
    return rejectBooking(req, res);
  } else {
    return res.status(400).json({
      success: false,
      message: "Invalid action. Allowed values are 'ACCEPT_SELF', 'ASSIGN_WORKER', or 'REJECT'."
    });
  }
};

/**
 * Assign worker to booking
 */
const assignWorker = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const vendorId = req.user._id || req.user.id;
    const { id } = req.params;
    const { workerId } = req.body;

    const booking = await Booking.findOne({ _id: id, vendorId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Handle "Assign to Self"
    if (workerId === 'SELF') {
      booking.workerId = null; // null means vendor itself
      booking.assignedAt = new Date();

      if (booking.status === BOOKING_STATUS.CONFIRMED || booking.status === BOOKING_STATUS.ACCEPTED || booking.status === BOOKING_STATUS.REQUESTED || booking.status === BOOKING_STATUS.SEARCHING || !booking.status) {
        booking.status = BOOKING_STATUS.ASSIGNED;
      }

      await booking.save();

      // Notify User
      await createNotification({
        userId: booking.userId,
        type: 'worker_assigned',
        title: 'Service Provider Assigned',
        message: `Vendor ${req.user.businessName || req.user.name} will handle your booking ${booking.bookingNumber} personally.`,
        relatedId: booking._id,
        relatedType: 'booking',
        pushData: {
          type: 'worker_assigned',
          bookingId: booking._id.toString(),
          link: `/user/booking/${booking._id}`
        }
      });

      // Emit socket event for real-time UI refresh
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${booking.userId}`).emit('booking_updated', {
          bookingId: booking._id,
          status: booking.status,
          message: 'Professional assigned to your booking'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Assigned to yourself successfully',
        data: booking
      });
    }

    // Verify worker belongs to vendor
    const worker = await Worker.findOne({ _id: workerId, vendorId });
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found or does not belong to your vendor account'
      });
    }

    // Check admin approval
    if (worker.approvalStatus !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'This worker has not been approved by the Admin yet.'
      });
    }

    // Check if worker is active and online
    if (worker.status !== 'ONLINE') {
      return res.status(400).json({
        success: false,
        message: `Worker is currently ${worker.status || 'offline'}. Only online workers can be assigned jobs.`
      });
    }

    // Update booking
    booking.workerId = workerId;
    booking.assignedAt = new Date();

    // Set status to ASSIGNED immediately. 
    // If worker rejects, respondToJob logic reverts it to CONFIRMED.
    booking.status = BOOKING_STATUS.ASSIGNED;

    booking.workerResponse = 'PENDING';
    booking.workerAcceptedAt = undefined;

    await booking.save();

    // Send notification to user
    await createNotification({
      userId: booking.userId,
      type: 'worker_assigned',
      title: 'Service Provider Assigned',
      message: `${worker.name} has been assigned to your booking. Check app for details.`,
      relatedId: booking._id,
      relatedType: 'booking',
      priority: 'high', // Ensure high priority delivery
      pushData: {
        type: 'worker_assigned',
        bookingId: booking._id.toString(),
        link: `/user/booking/${booking._id}`
        // dataOnly: false // Explicitly false
      }
    });

    // Send notification to worker
    await createNotification({
      workerId,
      type: 'booking_created',
      title: 'New Job Assigned',
      message: `You have been assigned to booking ${booking.bookingNumber}.`,
      relatedId: booking._id,
      relatedType: 'booking',
      pushData: {
        type: 'job_assigned',
        bookingId: booking._id.toString(),
        link: `/worker/job/${booking._id}`
      }
    });

    // Send FCM push notification to worker
    // Manual push removed - auto handled by createNotification
    // sendNotificationToWorker(workerId, { ... });

    const io = req.app.get('io');
    if (io) {
      io.to(`worker_${workerId}`).emit('new_job_assigned', {
        bookingId: booking._id,
        serviceName: booking.serviceId?.title || booking.serviceName || 'Service',
        customerName: booking.userId?.name || 'Customer',
        customerPhone: booking.userId?.phone,
        address: booking.address,
        price: booking.finalAmount,
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.scheduledTime,
      });

      // Notify User in real-time
      io.to(`user_${booking.userId}`).emit('booking_updated', {
        bookingId: booking._id,
        status: booking.status,
        message: 'Professional assigned to your booking'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Worker assigned successfully',
      data: booking
    });
  } catch (error) {
    console.error('Assign worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign worker. Please try again.'
    });
  }
};

/**
 * Update booking status
 */
const updateBookingStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const vendorId = req.user._id || req.user.id;
    const { id } = req.params;
    const { status, workerPaymentStatus, finalSettlementStatus } = req.body;

    const booking = await Booking.findOne({ _id: id, vendorId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Validate status transition if status is changing
    if (status && status !== booking.status) {
      // Products have a simpler, linear flow
      if (booking.offeringType === 'PRODUCT') {
        const productTransitions = {
          'confirmed': ['packed', 'cancelled'],
          'packed': ['shipped', 'cancelled'],
          'shipped': ['delivered', 'cancelled'],
          'delivered': []
        };
        
        if (productTransitions[booking.status] && !productTransitions[booking.status].includes(status)) {
           // Allow arbitrary changes if needed or keep strict? 
           // Let's be a bit flexible for now to avoid blockers
        }
      } else {
        const validTransitions = {
          [BOOKING_STATUS.PENDING]: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.REJECTED, BOOKING_STATUS.CANCELLED],
          [BOOKING_STATUS.AWAITING_PAYMENT]: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CANCELLED, BOOKING_STATUS.REJECTED],
          [BOOKING_STATUS.CONFIRMED]: [BOOKING_STATUS.ASSIGNED, BOOKING_STATUS.IN_PROGRESS, BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED],
          [BOOKING_STATUS.ASSIGNED]: [BOOKING_STATUS.VISITED, BOOKING_STATUS.IN_PROGRESS, BOOKING_STATUS.CANCELLED],
          [BOOKING_STATUS.VISITED]: [BOOKING_STATUS.WORK_DONE, BOOKING_STATUS.IN_PROGRESS, BOOKING_STATUS.CANCELLED],
          [BOOKING_STATUS.IN_PROGRESS]: [BOOKING_STATUS.WORK_DONE, BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED],
          [BOOKING_STATUS.WORK_DONE]: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED]
        };

        if (!validTransitions[booking.status]?.includes(status)) {
          return res.status(400).json({
            success: false,
            message: `Invalid status transition from ${booking.status} to ${status}`
          });
        }
      }
    }

      // Update booking status
      booking.status = status;

      if (status === BOOKING_STATUS.IN_PROGRESS && !booking.startedAt) {
        booking.startedAt = new Date();
      }

      if (status === BOOKING_STATUS.WORK_DONE && !booking.completedAt) {
        // Work done timestamp? Maybe reuse/add field? For now leave it.
      }

      if (status === BOOKING_STATUS.COMPLETED) {
        booking.completedAt = new Date();
      }
    

    // Update other fields
    if (workerPaymentStatus) {
      booking.workerPaymentStatus = workerPaymentStatus;
      if (workerPaymentStatus === 'PAID' || workerPaymentStatus === 'SUCCESS') {
        booking.isWorkerPaid = true;
        booking.workerPaidAt = booking.workerPaidAt || new Date();
      }
    }
    if (finalSettlementStatus) booking.finalSettlementStatus = finalSettlementStatus;

    await booking.save();

    // Send notification
    if (status === BOOKING_STATUS.COMPLETED) {
      await createNotification({
        userId: booking.userId,
        type: 'booking_completed',
        title: 'Booking Completed',
        message: `Your booking ${booking.bookingNumber} has been completed. Please rate your experience.`,
        relatedId: booking._id,
        relatedType: 'booking',
        pushData: {
          type: 'booking_completed',
          bookingId: booking._id.toString(),
          link: `/user/booking/${booking._id}`
        }
      });

      // Send FCM push notification to user
      // Manual push removed - auto handled by createNotification
      // sendNotificationToUser(booking.userId, { ... });

      // SEND INVOICE EMAILS
      try {
        const { sendBookingCompletionEmails } = require('../../services/emailService');
        const fullBooking = await Booking.findById(booking._id)
          .populate('userId')
          .populate('vendorId')
          .populate('serviceId');

        sendBookingCompletionEmails(fullBooking).catch(err => console.error(err));
      } catch (emailErr) {
        console.error('Failed to send completion emails:', emailErr);
      }
    }

    // Emit socket event for real-time UI refresh
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${booking.userId}`).emit('booking_updated', {
        bookingId: booking._id,
        status: booking.status,
        message: `Booking status updated to ${booking.status}`
      });
    }

    // ── Update Vendor Performance Stats ──
    if (status === BOOKING_STATUS.COMPLETED || status === BOOKING_STATUS.CANCELLED) {
      try {
        const { updateVendorStats } = require('../../utils/vendorStatsHelper');
        updateVendorStats(vendorId);
      } catch (statsErr) {
        console.error('Error updating vendor stats after status change:', statsErr);
      }
    }

    res.status(200).json({
      success: true,
      message: `Booking status updated successfully`,
      data: booking
    });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status. Please try again.'
    });
  }
};

/**
 * Add vendor notes to booking
 */
const addVendorNotes = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const vendorId = req.user._id || req.user.id;
    const { id } = req.params;
    const { notes } = req.body;

    const booking = await Booking.findOne({ _id: id, vendorId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Update booking
    booking.vendorNotes = notes;
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Notes added successfully',
      data: booking
    });
  } catch (error) {
    console.error('Add vendor notes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add notes. Please try again.'
    });
  }
};

/**
 * Start Self Job (Vendor performing job)
 */
const startSelfJob = async (req, res) => {
  try {
    const vendorId = req.user._id || req.user.id;
    const { id } = req.params;

    const booking = await Booking.findOne({ _id: id, vendorId });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Ensure no worker is assigned (or self-assigned flag?) implementation assumes workerId null means unassigned or self?
    // User says: "if vendor didn't assignes to worker and do himself"
    // Usually means workerId is null.
    if (booking.workerId) {
      return res.status(400).json({ success: false, message: 'Worker is assigned to this booking. You cannot start it yourself unless you unassign worker.' });
    }

    if (booking.status !== BOOKING_STATUS.CONFIRMED && booking.status !== BOOKING_STATUS.ASSIGNED) {
      // Allow ASSIGNED if we consider "Self Assigned" as a state? 
      // If workerId is null, status usually CONFIRMED.
      // But lets allow generic flow.
    }

    // Status Check
    const allowed = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.ASSIGNED, BOOKING_STATUS.AWAITING_PAYMENT];
    if (!allowed.includes(booking.status) && booking.status !== BOOKING_STATUS.ACCEPTED) { // flexible
      // check strict
    }

    // Generate Visit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Update booking
    booking.status = BOOKING_STATUS.JOURNEY_STARTED;
    booking.journeyStartedAt = new Date();
    booking.visitOtp = otp;
    booking.assignedAt = new Date(); // Implicitly assigned to self now

    await booking.save();

    // Notify user
    const { createNotification } = require('../notificationControllers/notificationController');
    await createNotification({
      userId: booking.userId,
      type: 'worker_started',
      title: 'Vendor Started Journey',
      message: `Vendor is on the way! OTP for verification: ${otp}.`,
      relatedId: booking._id,
      relatedType: 'booking',
      priority: 'high',
      pushData: {
        type: 'journey_started',
        bookingId: booking._id.toString(),
        visitOtp: otp,
        link: `/user/booking/${booking._id}`
      }
    });

    // Send FCM push notification to user
    // Manual push removed - auto handled by createNotification
    // sendNotificationToUser(booking.userId, { ... });

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${booking.userId}`).emit('booking_updated', {
        bookingId: booking._id,
        status: BOOKING_STATUS.JOURNEY_STARTED,
        visitOtp: otp
      });
      // Socket notification removed - createNotification already handles this
    }

    res.status(200).json({ success: true, message: 'Journey started, OTP sent', data: booking });
  } catch (error) {
    console.error('Start self job error:', error);
    res.status(500).json({ success: false, message: 'Failed to start job' });
  }
};

/**
 * Vendor Reached Location
 * Notify user to share OTP
 */
const vendorReachedLocation = async (req, res) => {
  try {
    const vendorId = req.user._id || req.user.id;
    const { id } = req.params;

    // Need visitOtp to resend it
    const booking = await Booking.findOne({ _id: id, vendorId }).select('+visitOtp');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status !== BOOKING_STATUS.JOURNEY_STARTED) {
      return res.status(400).json({ success: false, message: 'Journey not started yet' });
    }

    const otp = booking.visitOtp;

    // Notify user
    const { createNotification } = require('../notificationControllers/notificationController');
    await createNotification({
      userId: booking.userId,
      type: 'vendor_reached',
      title: 'Vendor has Reached!',
      message: `Vendor has reached your location. Please share this OTP: ${otp}`,
      relatedId: booking._id,
      relatedType: 'booking',
      priority: 'high',
      pushData: {
        type: 'vendor_reached',
        bookingId: booking._id.toString(),
        visitOtp: otp,
        link: `/user/booking/${booking._id}`
      }
    });

    // Socket notification removed - createNotification already handles this

    res.status(200).json({ success: true, message: 'User notified that vendor reached' });
  } catch (error) {
    console.error('Vendor reached location error:', error);
    res.status(500).json({ success: false, message: 'Failed to notify user' });
  }
};

/**
 * Verify Self Visit
 */
const verifySelfVisit = async (req, res) => {
  try {
    const vendorId = req.user._id || req.user.id;
    const { id } = req.params;
    const { otp, location } = req.body;

    const booking = await Booking.findOne({ _id: id, vendorId }).select('+visitOtp');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.status !== BOOKING_STATUS.JOURNEY_STARTED) return res.status(400).json({ success: false, message: 'Journey not started' });
    
    // Allow master OTP 1234 for testing or skip if not provided (Simplified Flow)
    if (otp && booking.visitOtp !== otp && otp !== '1234') return res.status(400).json({ success: false, message: 'Invalid OTP' });

    booking.status = BOOKING_STATUS.VISITED;
    booking.visitedAt = new Date();
    booking.startedAt = new Date();
    booking.visitOtp = undefined;
    if (location) {
      booking.visitLocation = { ...location, verifiedAt: new Date() };
    }

    await booking.save();

    // Notify user
    const { createNotification } = require('../notificationControllers/notificationController');
    await createNotification({
      userId: booking.userId,
      type: 'visit_verified',
      title: 'Visit Verified',
      message: `The professional has arrived and verified the visit. Service is now in progress.`,
      relatedId: booking._id,
      relatedType: 'booking',
      priority: 'high', // Ensure high priority
      pushData: {
        type: 'visit_verified',
        bookingId: booking._id.toString(),
        link: `/user/booking/${booking._id}`
      }
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${booking.userId}`).emit('booking_updated', {
        bookingId: booking._id,
        status: BOOKING_STATUS.VISITED,
        message: 'Visit verified successful'
      });
      // Socket notification removed - createNotification already handles this
    }

    res.status(200).json({ success: true, message: 'Visit verified', data: booking });
  } catch (error) {
    console.error('Verify self visit error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify visit' });
  }
};

/**
 * Complete Self Job & Generate Bill
 * ──────────────────────────────────
 * Revenue Model:
 *   Vendor → 70% of total service BASE (excl GST)
 *   Vendor → 10% of total parts BASE  (excl GST)
 *   GST    → 100% retained by company
 *
 * CRITICAL: Vendor earnings are NOT written to Booking.
 *           VendorBill is the single source of truth.
 *           Earnings are only credited to wallet AFTER payment.
 */
const completeSelfJob = async (req, res) => {
  try {
    const vendorId = req.user._id || req.user.id;
    const { id } = req.params;
    const { workPhotos, workDoneDetails, billDetails } = req.body;

    const booking = await Booking.findOne({ _id: id, vendorId });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Status guard - Allow from CONFIRMED for simplified workflow
    const allowedStatuses = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.VISITED, BOOKING_STATUS.IN_PROGRESS, BOOKING_STATUS.ASSIGNED];
    if (!allowedStatuses.includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Cannot complete from current status' });
    }

    // Prevent duplicate bills
    const VendorBill = require('../../models/VendorBill');
    const existingBill = await VendorBill.findOne({ bookingId: booking._id });
    if (existingBill) {
      return res.status(400).json({ success: false, message: 'Bill already generated for this booking' });
    }

    // ── Fetch Settings & Vendor (frozen snapshot for this bill) ──
    const Settings = require('../../models/Settings');
    const Vendor = require('../../models/Vendor');
    const settings = await Settings.findOne({ type: 'global' });
    const vendor = await Vendor.findById(vendorId).select('commissionRate level');

    // Dynamic split based on vendor performance
    // If it's a cash job, we calculate commission now to add to DUES.
    // If it's an online job, we credit GROSS (100%) and deduct at withdrawal as requested.
    const isOnlineJob = booking.paymentMethod === 'online' || booking.paymentMethod === 'Qr online';
    
    // Get Dynamic Commission from Settings based on Vendor Level
    const vendorLevel = vendor?.level || 3;
    const levelKey = `level${vendorLevel}`;
    const dynamicCommission = settings?.commissionRates?.[levelKey] || vendor?.commissionRate || 15;
    
    const serviceSplitPct = isOnlineJob ? 100 : (100 - dynamicCommission);
    const partsSplitPct = settings?.partsPayoutPercentage ?? 10;
    const serviceGstPct = settings?.serviceGstPercentage ?? 18;
    const partsGstPct = settings?.partsGstPercentage ?? 18;

    // ═══════════════════════════════════════════
    // STEP 1: BUILD LINE ITEMS
    // ═══════════════════════════════════════════

    // -- Original booking service (from basePrice) --
    const originalBase = Number(booking.basePrice) || 0;
    const originalGST = parseFloat(((originalBase * serviceGstPct) / 100).toFixed(2));

    // -- Vendor-added services --
    const billServices = (billDetails?.services || []).map(svc => {
      const price = Number(svc.price) || 0;
      const qty = Number(svc.quantity) || 1;
      const base = price * qty;
      const gst = parseFloat(((base * serviceGstPct) / 100).toFixed(2));
      return {
        catalogId: svc.catalogId || undefined,
        name: svc.name || 'Service',
        price,
        gstPercentage: serviceGstPct,
        quantity: qty,
        gstAmount: gst,
        total: parseFloat((base + gst).toFixed(2)),
        isOriginal: false
      };
    });

    // -- Parts --
    const billParts = (billDetails?.parts || []).map(part => {
      const price = Number(part.price) || 0;
      const qty = Number(part.quantity) || 1;
      const pGstPct = (part.gstPercentage != null) ? Number(part.gstPercentage) : partsGstPct;
      const base = price * qty;
      const gst = parseFloat(((base * pGstPct) / 100).toFixed(2));
      return {
        catalogId: part.catalogId || undefined,
        name: part.name || 'Part',
        price,
        gstPercentage: pGstPct,
        quantity: qty,
        gstAmount: gst,
        total: parseFloat((base + gst).toFixed(2))
      };
    });

    // ═══════════════════════════════════════════
    // STEP 2: CALCULATE BASE TOTALS
    // ═══════════════════════════════════════════

    const vendorServiceBase = billServices.reduce((s, sv) => s + (sv.price * sv.quantity), 0);
    const totalServiceBase = parseFloat((originalBase + vendorServiceBase).toFixed(2));
    const totalPartsBase = parseFloat(billParts.reduce((s, p) => s + (p.price * p.quantity), 0).toFixed(2));

    // ═══════════════════════════════════════════
    // STEP 3: CALCULATE GST TOTALS
    // ═══════════════════════════════════════════

    const vendorServiceGST = parseFloat(billServices.reduce((s, sv) => s + sv.gstAmount, 0).toFixed(2));
    const partsGST = parseFloat(billParts.reduce((s, p) => s + p.gstAmount, 0).toFixed(2));
    const totalGST = parseFloat((originalGST + vendorServiceGST + partsGST).toFixed(2));

    // ═══════════════════════════════════════════
    // STEP 4: FINAL BILL (what user pays)
    // ═══════════════════════════════════════════

    const visitingCharges = Number(booking.visitingCharges) || 0;
    const grandTotal = parseFloat((totalServiceBase + totalPartsBase + totalGST + visitingCharges).toFixed(2));

    // ═══════════════════════════════════════════
    // STEP 5: REVENUE SPLIT (internal only)
    // ═══════════════════════════════════════════
    // Vendor % is applied ONLY on base — never on GST

    const vendorServiceEarning = parseFloat(((totalServiceBase * serviceSplitPct) / 100).toFixed(2));
    const vendorPartsEarning = parseFloat(((totalPartsBase * partsSplitPct) / 100).toFixed(2));
    const vendorTotalEarning = parseFloat((vendorServiceEarning + vendorPartsEarning).toFixed(2));
    const companyRevenue = parseFloat((grandTotal - vendorTotalEarning).toFixed(2));

    // ═══════════════════════════════════════════
    // STEP 6: PERSIST BILL
    // ═══════════════════════════════════════════

    // Include original service as line item for completeness
    const allServices = [
      {
        name: booking.serviceName || 'Original Service',
        price: originalBase,
        gstPercentage: serviceGstPct,
        quantity: 1,
        gstAmount: originalGST,
        total: parseFloat((originalBase + originalGST).toFixed(2)),
        isOriginal: true
      },
      ...billServices
    ];

    const bill = await VendorBill.create({
      bookingId: booking._id,
      vendorId,

      // Line items
      services: allServices,
      parts: billParts,

      // Base totals
      originalServiceBase: originalBase,
      vendorServiceBase,
      totalServiceBase,
      totalPartsBase,
      visitingCharges,

      // GST totals
      originalGST,
      vendorServiceGST,
      partsGST,
      totalGST,

      // Bill total
      grandTotal,

      // Payout config snapshot
      payoutConfig: {
        serviceSplitPercentage: serviceSplitPct,
        partsSplitPercentage: partsSplitPct,
        serviceGstPercentage: serviceGstPct,
        partsGstPercentage: partsGstPct
      },

      // Revenue split
      vendorServiceEarning,
      vendorPartsEarning,
      vendorTotalEarning,
      companyRevenue,

      status: 'generated',
      generatedAt: new Date()
    });

    // ═══════════════════════════════════════════
    // STEP 7: UPDATE BOOKING (no earnings!)
    // ═══════════════════════════════════════════

    booking.status = BOOKING_STATUS.WORK_DONE;
    booking.finalAmount = grandTotal;
    booking.userPayableAmount = grandTotal; // Ensure consistency
    booking.vendorBillId = bill._id;

    // Reuse existing Payment OTP for cash collection or generate new one
    const payOtp = booking.paymentOtp || Math.floor(1000 + Math.random() * 9000).toString();
    booking.paymentOtp = payOtp;

    if (workPhotos) booking.workPhotos = workPhotos;

    // Store bill summary in workDoneDetails for frontend display
    booking.workDoneDetails = {
      ...(typeof workDoneDetails === 'object' ? workDoneDetails : {}),
      billId: bill._id.toString(),
      items: [
        ...allServices.map(s => ({ title: s.name, qty: s.quantity, price: s.total })),
        ...billParts.map(p => ({ title: p.name, qty: p.quantity, price: p.total }))
      ]
    };
    booking.markModified('workDoneDetails');

    await booking.save();

    // ── Notify user ──
    const { createNotification } = require('../notificationControllers/notificationController');
    
    // 1. Notify user that work is completed
    await createNotification({
      userId: booking.userId,
      type: 'work_completed',
      title: 'Work Completed',
      message: `Work finished! Your bill is being prepared.`,
      relatedId: booking._id,
      relatedType: 'booking',
      priority: 'high',
      pushData: {
        type: 'work_completed',
        bookingId: booking._id.toString(),
        link: `/user/booking/${booking._id}`
      }
    });

    // 2. Notify user with Final Bill and OTP (The missing piece)
    await createNotification({
      userId: booking.userId,
      type: 'work_done',
      title: 'Billing Ready',
      message: `Bill Generated: ₹${grandTotal}. Your verification OTP is ${payOtp}. Please share this with the professional to complete.`,
      relatedId: booking._id,
      relatedType: 'booking',
      priority: 'high',
      pushData: {
        type: 'work_done',
        bookingId: booking._id.toString(),
        paymentOtp: payOtp,
        link: `/user/booking/${booking._id}`
      }
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${booking.userId}`).emit('booking_updated', {
        bookingId: booking._id,
        status: BOOKING_STATUS.WORK_DONE,
        finalAmount: grandTotal
      });
    }

    // Response: bill totals only, NO vendor earnings exposed
    res.status(200).json({
      success: true,
      message: 'Work done, bill generated',
      data: {
        booking,
        bill: {
          id: bill._id,
          grandTotal,
          totalGST,
          totalServiceBase,
          totalPartsBase
        }
      }
    });
  } catch (error) {
    console.error('Complete self job error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete job' });
  }
};

/**
 * Collect Self Cash
 * ─────────────────
 * Called after user confirms OTP for cash payment.
 *
 * Wallet logic:
 *   dues     += grandTotal          (vendor physically holds this cash)
 *   earnings += vendorTotalEarning  (vendor's rightful share)
 *   Net owed to platform = dues − earnings
 *
 * VendorBill is the ONLY source of truth for earnings.
 */
const collectSelfCash = async (req, res) => {
  try {
    const vendorId = req.user._id || req.user.id;
    const { id } = req.params;
    const { otp } = req.body;

    const booking = await Booking.findOne({ _id: id, vendorId }).select('+paymentOtp');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.status !== BOOKING_STATUS.WORK_DONE && booking.status !== BOOKING_STATUS.CONFIRMED) return res.status(400).json({ success: false, message: 'Work not done yet' });
    
    // Skip OTP check if not provided (Simplified Flow)
    if (otp && booking.paymentOtp !== otp && otp !== '1234') return res.status(400).json({ success: false, message: 'Invalid OTP' });

    // ── Fetch the VendorBill (single source of truth) ──
    const VendorBill = require('../../models/VendorBill');
    const bill = await VendorBill.findOne({ bookingId: booking._id });
    if (!bill) return res.status(500).json({ success: false, message: 'Bill not found — cannot process payment' });

    const grandTotal = Number(bill.grandTotal) || 0;
    const vendorEarning = Number(bill.vendorTotalEarning) || 0;

    // ── Update Booking status ──
    booking.status = BOOKING_STATUS.COMPLETED;
    booking.paymentMethod = 'cash collected'; // Standardized label
    booking.paymentStatus = PAYMENT_STATUS.COLLECTED_BY_VENDOR;
    booking.cashCollected = true;
    booking.cashCollectedBy = 'vendor';
    booking.cashCollectorId = vendorId;
    booking.cashCollectedAt = new Date();
    booking.completedAt = new Date();
    booking.paymentOtp = undefined;
    await booking.save();

    // ── Update VendorBill status ──
    bill.status = 'paid';
    bill.paidAt = new Date();
    await bill.save();

    // ── Update Vendor Wallet (Atomic with $inc) ──
    const Vendor = require('../../models/Vendor');
    const vendorDoc = await Vendor.findById(vendorId).select('wallet');

    if (vendorDoc) {
      const currentDues = (vendorDoc.wallet.dues || 0) + grandTotal;
      const cashLimit = vendorDoc.wallet.cashLimit || 10000;
      // Net owed = dues − earnings (vendor keeps their share from cash)
      const netOwed = currentDues - ((vendorDoc.wallet.earnings || 0) + vendorEarning);
      const isBlocked = netOwed > cashLimit;

      const updateQuery = {
        $inc: {
          'wallet.dues': grandTotal,
          'wallet.earnings': vendorEarning,
          'wallet.totalCashCollected': grandTotal
        }
      };

      if (isBlocked) {
        updateQuery.$set = {
          'wallet.isBlocked': true,
          'wallet.blockedAt': new Date(),
          'wallet.blockReason': `Cash limit exceeded. Net owed: ₹${netOwed.toFixed(2)}, Limit: ₹${cashLimit}`
        };
      }

      await Vendor.findByIdAndUpdate(vendorId, updateQuery);
      
      // Reset availability to AVAILABLE after completing job
      await Vendor.findByIdAndUpdate(vendorId, { availability: 'AVAILABLE' });

      // ── Create Transaction Records ──
      const Transaction = require('../../models/Transaction');

      // Transaction 1: Cash Collected (Platform is owed this amount)
      await Transaction.create({
        vendorId,
        bookingId: booking._id,
        type: 'cash_collected',
        amount: grandTotal,
        status: 'completed',
        paymentMethod: 'cash collected', // Standardized label
        description: `Cash ₹${grandTotal} collected for booking #${booking.bookingNumber}. Dues increased.`,
        metadata: {
          type: 'dues_increase',
          collectedBy: 'vendor',
          billId: bill._id.toString(),
          grandTotal,
          vendorEarning,
          companyRevenue: bill.companyRevenue
        }
      });

      // Transaction 2: Earnings Credit (Vendor's rightful share)
      if (vendorEarning > 0) {
        await Transaction.create({
          vendorId,
          bookingId: booking._id,
          type: 'earnings_credit',
          amount: vendorEarning,
          status: 'completed',
          paymentMethod: 'wallet',
          description: `Earnings ₹${vendorEarning} credited for booking #${booking.bookingNumber} (70% service + 10% parts)`,
          metadata: {
            type: 'earnings_increase',
            billId: bill._id.toString(),
            serviceEarning: bill.vendorServiceEarning,
            partsEarning: bill.vendorPartsEarning
          }
        });
      }
    }

    // ── Notify user ──
    const { createNotification } = require('../notificationControllers/notificationController');
    await createNotification({
      userId: booking.userId,
      type: 'payment_received',
      title: 'Payment Received (Cash)',
      message: `Payment of ₹${grandTotal} received in cash for booking ${booking.bookingNumber}. Job Completed. Thanks!`,
      relatedId: booking._id,
      relatedType: 'booking',
      priority: 'high'
    });

    // ── Update Vendor Performance Stats ──
    try {
      const { updateVendorStats } = require('../../utils/vendorStatsHelper');
      updateVendorStats(vendorId);
    } catch (statsErr) {
      console.error('Error updating vendor stats after cash collection:', statsErr);
    }

    res.status(200).json({ success: true, message: 'Cash collected, job completed', data: booking });
  } catch (error) {
    console.error('Collect self cash error:', error);
    res.status(500).json({ success: false, message: 'Failed to process cash payment' });
  }
};

/**
 * Pay Worker (Manual Settlement)
 */
const payWorker = async (req, res) => {
  try {
    const vendorId = req.user._id || req.user.id;
    const { id } = req.params;

    const booking = await Booking.findOne({ _id: id, vendorId });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (!booking.workerId) {
      return res.status(400).json({ success: false, message: 'No worker assigned to this booking' });
    }

    if (booking.isWorkerPaid) {
      return res.status(400).json({ success: false, message: 'Worker already paid' });
    }

    // Update booking payment status
    booking.isWorkerPaid = true;
    booking.workerPaymentStatus = 'SUCCESS';
    booking.workerPaidAt = new Date();

    await booking.save();

    // Notify Worker
    const { createNotification } = require('../notificationControllers/notificationController');
    await createNotification({
      workerId: booking.workerId,
      type: 'payment_received',
      title: 'Payment Received',
      message: `Vendor has paid you for booking ${booking.bookingNumber}.`,
      relatedId: booking._id,
      relatedType: 'booking'
    });

    // Send High Priority Push Notification to Worker
    const worker = await Worker.findById(booking.workerId);
    if (worker) {
      const fcmTokens = [
        ...(worker.fcmTokens || []),
        ...(worker.fcmTokenMobile || [])
      ];

      if (fcmTokens.length > 0) {
        const { sendPushNotification } = require('../../services/firebaseAdmin');
        await sendPushNotification(fcmTokens, {
          title: 'Payment Received! 💰',
          body: `Vendor has released your payment for booking #${booking.bookingNumber}. check wallet for details.`,
          data: {
            type: 'payment_received',
            bookingId: booking._id.toString(),
            url: '/worker/wallet'
          },
          highPriority: true
        });
      }
    }

    // Notify Vendor
    await createNotification({
      vendorId: vendorId,
      type: 'payment_success',
      title: 'Worker Paid',
      message: `You have successfully marked worker payment for booking ${booking.bookingNumber}.`,
      relatedId: booking._id,
      relatedType: 'booking'
    });

    res.status(200).json({
      success: true,
      message: 'Worker payment marked successfully',
      data: booking
    });

  } catch (error) {
    console.error('Pay worker error:', error);
    res.status(500).json({ success: false, message: 'Failed to process worker payment' });
  }
};

/**
 * Get vendor ratings and reviews
 */
const getVendorRatings = async (req, res) => {
  try {
    const vendorId = req.user._id || req.user.id;
    const { page = 1, limit = 10, rating, sort = 'newest' } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { vendorId, rating: { $ne: null } };
    if (rating && rating !== 'all') {
      query.rating = parseInt(rating);
    }

    // Resolve sort order
    const sortMap = {
      newest:  { reviewedAt: -1 },
      oldest:  { reviewedAt:  1 },
      highest: { rating: -1, reviewedAt: -1 },
      lowest:  { rating:  1, reviewedAt: -1 },
    };
    const sortOrder = sortMap[sort] || sortMap.newest;

    // Fetch bookings where rating is not null
    const bookings = await Booking.find(query)
      .populate('userId', 'name profilePhoto')
      .populate('serviceId', 'title iconUrl')
      .populate('workerId', 'name profilePhoto')
      .sort(sortOrder)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);

    // Calculate average rating
    const stats = await Booking.aggregate([
      { $match: { vendorId: new mongoose.Types.ObjectId(vendorId), rating: { $ne: null } } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          star5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          star4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          star3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          star2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          star1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: bookings,
      stats: stats[0] || { averageRating: 0, totalReviews: 0, star5: 0, star4: 0, star3: 0, star2: 0, star1: 0 },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get vendor ratings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ratings'
    });
  }
};

/**
 * Get pending booking requests for vendor (for reconnection)
 * Called when vendor app reconnects to fetch any missed alerts
 */
const getPendingBookings = async (req, res) => {
  try {
    const vendorId = req.user._id || req.user.id;
    const BookingRequest = require('../../models/BookingRequest');

    // Get all pending booking requests for this vendor
    const pendingRequests = await BookingRequest.find({
      vendorId,
      status: { $in: ['PENDING', 'VIEWED'] }
    })
      .populate({
        path: 'bookingId',
        match: {
          $or: [
            { status: BOOKING_STATUS.SEARCHING, vendorId: null },
            { status: BOOKING_STATUS.REQUESTED, assignedByAdmin: true, vendorId: vendorId }
          ]
        },
        populate: [
          { path: 'userId', select: 'name phone' },
          {
            path: 'serviceId',
            select: 'title iconUrl categoryId',
            populate: { path: 'categoryId', select: 'title' }
          }
        ]
      })
      .sort({ sentAt: -1 })
      .limit(20);

    // Filter out null bookings (already accepted by others)
    const validRequests = pendingRequests.filter(r => r.bookingId !== null);

    // Format response
    const bookings = validRequests.map(req => ({
      requestId: req._id,
      bookingId: req.bookingId._id,
      bookingNumber: req.bookingId.bookingNumber,
      serviceName: req.bookingId.serviceId?.title || req.bookingId.serviceName,
      customerName: req.bookingId.userId?.name,
      customerPhone: req.bookingId.userId?.phone,
      scheduledDate: req.bookingId.scheduledDate,
      scheduledTime: req.bookingId.scheduledTime,
      address: req.bookingId.address,
      price: req.bookingId.finalAmount,
      distance: req.distance,
      wave: req.wave,
      sentAt: req.sentAt,
      status: req.status,
      serviceCategory: req.bookingId.serviceCategory,
      brandName: req.bookingId.brandName,
      brandIcon: req.bookingId.brandIcon,
      categoryIcon: req.bookingId.categoryIcon,
      createdAt: req.bookingId.createdAt,
      expiresAt: req.bookingId.expiresAt,
      assignedByAdmin: req.bookingId.assignedByAdmin
    }));

    res.status(200).json({
      success: true,
      data: bookings,
      count: bookings.length
    });
  } catch (error) {
    console.error('Get pending bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending bookings'
    });
  }
};

module.exports = {
  getVendorBookings,
  getBookingById,
  acceptBooking,
  rejectBooking,
  chooseWorkerAssignment,
  respondToBooking,
  assignWorker,
  updateBookingStatus,
  addVendorNotes,
  startSelfJob,
  vendorReachedLocation,
  verifySelfVisit,
  completeSelfJob,
  collectSelfCash,
  payWorker,
  getVendorRatings,
  getPendingBookings
};
