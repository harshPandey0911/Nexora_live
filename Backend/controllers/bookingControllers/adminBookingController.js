const Booking = require('../../models/Booking');
const User = require('../../models/User');
const { validationResult } = require('express-validator');
const { BOOKING_STATUS } = require('../../utils/constants');

/**
 * Get all bookings with filters and search
 */
const getAllBookings = async (req, res) => {
  try {
    const {
      status,
      paymentStatus,
      userId,
      vendorId,
      workerId,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    const conditions = [];

    if (status) {
      if (status.toUpperCase() === 'MANUAL_ASSIGNMENT') {
        // Show ALL admin-assigned bookings across full lifecycle (escalated → confirmed → work_done)
        conditions.push({
          $or: [
            { status: 'escalated' },                                          // Not yet assigned by admin
            { status: 'requested', assignedByAdmin: true },                   // Assigned, vendor hasn't responded
            { status: 'confirmed', assignedByAdmin: true },                   // Vendor accepted
            { status: 'awaiting_payment', assignedByAdmin: true },
            { status: 'assigned', assignedByAdmin: true },                    // Worker assigned
            { status: 'journey_started', assignedByAdmin: true },             // Worker on way
            { status: 'visited', assignedByAdmin: true },                     // Worker arrived
            { status: 'in_progress', assignedByAdmin: true },                 // Work in progress
            { status: 'work_done', assignedByAdmin: true }                    // Work done (awaiting completion)
          ]
        });
      } else {
        conditions.push({ status: status.toLowerCase() });
      }
    }
    if (paymentStatus) conditions.push({ paymentStatus });
    if (userId) conditions.push({ userId });
    if (vendorId) conditions.push({ vendorId });
    if (workerId) conditions.push({ workerId });

    if (startDate || endDate) {
      const dateQuery = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateQuery.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery.$lte = end;
      }
      conditions.push({ scheduledDate: dateQuery });
    }

    // Search by booking number, service name, or customer details
    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      const userIds = users.map(u => u._id);

      conditions.push({
        $or: [
          { bookingNumber: { $regex: search, $options: 'i' } },
          { serviceName: { $regex: search, $options: 'i' } },
          { userId: { $in: userIds } }
        ]
      });
    }

    const query = conditions.length > 0 ? { $and: conditions } : {};

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get bookings
    const bookings = await Booking.find(query)
      .populate('userId', 'name phone email')
      .populate('vendorId', 'name businessName phone')
      .populate('serviceId', 'title iconUrl')
      .populate('categoryId', 'title slug')
      .populate('workerId', 'name phone')
      .populate({ path: 'activityLog.actorId', select: 'name businessName phone' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Booking.countDocuments(query);

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
    console.error('Get all bookings error:', error);
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
    const { id } = req.params;

    const bookingDoc = await Booking.findById(id)
      .populate('userId', 'name phone email addresses')
      .populate('vendorId', 'name businessName phone email address')
      .populate('serviceId', 'title description iconUrl images')
      .populate('categoryId', 'title slug')
      .populate('workerId', 'name phone rating totalJobs completedJobs')
      .populate('vendorBillId')
      .populate({ path: 'activityLog.actorId', select: 'name businessName phone' })
      .lean();

    if (!bookingDoc) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const BookingRequest = require('../../models/BookingRequest');
    const bookingRequests = await BookingRequest.find({ bookingId: id })
      .populate('vendorId', 'name businessName phone')
      .lean();

    bookingDoc.bookingRequests = bookingRequests;

    res.status(200).json({
      success: true,
      data: bookingDoc
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
 * Cancel booking (admin)
 */
const cancelBooking = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { cancellationReason } = req.body;

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status === BOOKING_STATUS.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    if (booking.status === BOOKING_STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed booking'
      });
    }

    // Update booking
    booking.status = BOOKING_STATUS.CANCELLED;
    booking.cancelledAt = new Date();
    booking.cancelledBy = 'admin';
    booking.cancellationReason = cancellationReason || 'Cancelled by admin';

    await booking.save();

    // ── Update Vendor Performance Stats ──
    if (booking.vendorId) {
      try {
        const { updateVendorStats } = require('../../utils/vendorStatsHelper');
        updateVendorStats(booking.vendorId);
      } catch (statsErr) {
        console.error('Error updating vendor stats after admin cancellation:', statsErr);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking. Please try again.'
    });
  }
};

/**
 * Get booking analytics
 */
const getBookingAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Total bookings
    const totalBookings = await Booking.countDocuments(dateFilter);

    // Bookings by status
    const bookingsByStatus = await Booking.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Bookings by payment status
    const bookingsByPaymentStatus = await Booking.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$finalAmount' }
        }
      }
    ]);

    // Revenue analytics
    const revenueStats = await Booking.aggregate([
      {
        $match: {
          ...dateFilter,
          paymentStatus: 'success'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$finalAmount' },
          totalBookings: { $sum: 1 },
          averageBookingValue: { $avg: '$finalAmount' }
        }
      }
    ]);

    // Daily bookings trend (last 30 days)
    const dailyTrend = await Booking.aggregate([
      {
        $match: {
          ...dateFilter,
          createdAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$finalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalBookings,
        bookingsByStatus: bookingsByStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        bookingsByPaymentStatus: bookingsByPaymentStatus.reduce((acc, item) => {
          acc[item._id] = {
            count: item.count,
            totalAmount: item.totalAmount
          };
          return acc;
        }, {}),
        revenue: revenueStats[0] || {
          totalRevenue: 0,
          totalBookings: 0,
          averageBookingValue: 0
        },
        dailyTrend
      }
    });
  } catch (error) {
    console.error('Get booking analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics. Please try again.'
    });
  }
};

/**
 * Manually assign a vendor to an escalated/searching booking
 */
const assignVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId } = req.body;

    if (!vendorId) {
      return res.status(400).json({ success: false, message: 'Vendor ID is required' });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Assign vendor and update statuses
    booking.vendorId = vendorId;
    booking.assignedByAdmin = true;
    booking.adminAssignmentStatus = 'PENDING';
    booking.status = BOOKING_STATUS.REQUESTED;
    booking.expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min window for vendor to accept

    const BookingRequest = require('../../models/BookingRequest');
    
    // Clean up old requests
    await BookingRequest.deleteMany({ bookingId: id });
    
    await BookingRequest.create({
      bookingId: id,
      vendorId: vendorId,
      status: 'PENDING',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    });

    await booking.save();

    // Calculate distance between assigned vendor and booking location
    let calculatedDist = 1.8;
    try {
      const Vendor = require('../../models/Vendor');
      const assignedVendor = await Vendor.findById(vendorId).select('location address').lean();
      if (assignedVendor?.location?.lat && assignedVendor?.location?.lng && booking.address?.lat && booking.address?.lng) {
        const { calculateDistance } = require('../../services/locationService');
        const d = calculateDistance(assignedVendor.location, booking.address);
        if (d && !isNaN(d)) calculatedDist = Math.round(d * 10) / 10;
      }
    } catch (dErr) {
      console.warn('Distance calc warning in assignVendor:', dErr.message);
    }

    // Notify Vendor via sockets
    const io = req.app.get('io');
    if (io) {
      io.to(`vendor_${vendorId}`).emit('new_booking_request', {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        serviceName: booking.serviceName,
        customerName: booking.customerName || 'Authorized Client',
        customerPhone: booking.customerPhone || '',
        address: booking.address || { addressLine1: booking.location?.address || 'Location shared' },
        distance: `${calculatedDist} km`,
        price: booking.finalAmount,
        vendorEarnings: booking.finalAmount * 0.9,
        serviceCategory: booking.serviceCategory || 'Nexora Service',
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.timeSlot?.time || 'ASAP',
        createdAt: booking.createdAt,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min window
        assignedByAdmin: true,
        playSound: true,
        message: 'New manual booking assignment from admin!'
      });

      io.to(`user_${booking.userId}`).emit('booking_updated', {
        bookingId: booking._id,
        status: booking.status,
        message: 'Vendor has been assigned by Admin'
      });
    }

    // Create database notification and trigger FCM push notification
    try {
      const { createNotification } = require('../notificationControllers/notificationController');
      const userObj = await User.findById(booking.userId).select('name phone');
      await createNotification({
        vendorId: vendorId,
        type: 'booking_request',
        title: 'New Booking Request',
        message: `New manual booking assignment for ${booking.serviceName} from Admin`,
        relatedId: booking._id,
        relatedType: 'booking',
        data: {
          bookingId: booking._id.toString(),
          serviceName: booking.serviceName,
          customerName: userObj?.name || 'Customer',
          customerPhone: userObj?.phone || '',
          scheduledDate: booking.scheduledDate,
          scheduledTime: booking.timeSlot?.time || 'ASAP',
          location: booking.address || { addressLine1: booking.location?.address || 'Location shared' },
          price: booking.finalAmount,
          assignedByAdmin: true
        },
        pushData: {
          type: 'new_booking',
          dataOnly: false,
          link: `/vendor/bookings/${booking._id}`
        }
      });
    } catch (notifError) {
      console.error('[AssignVendor] Notification error:', notifError.message);
    }

    res.status(200).json({
      success: true,
      message: 'Vendor assigned successfully',
      data: booking
    });
  } catch (error) {
    console.error('Assign vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign vendor'
    });
  }
};

module.exports = {
  getAllBookings,
  getBookingById,
  cancelBooking,
  getBookingAnalytics,
  assignVendor
};

