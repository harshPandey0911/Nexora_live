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
    let bookings = await Booking.find(query)
      .populate('userId', 'name phone email')
      .populate('vendorId', 'name businessName phone')
      .populate('serviceId', 'title iconUrl')
      .populate('categoryId', 'title slug')
      .populate('workerId', 'name phone')
      .populate({ path: 'activityLog.actorId', select: 'name businessName phone' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    let total = await Booking.countDocuments(query);

    // If MANUAL_ASSIGNMENT filter is active, also include Escalated / Pending Product Orders
    if (status && status.toUpperCase() === 'MANUAL_ASSIGNMENT') {
      const ProductOrder = require('../../models/ProductOrder');
      const escalatedProductOrders = await ProductOrder.find({
        $or: [
          { status: 'ESCALATED' },
          { isEscalatedToAdmin: true },
          { status: 'PENDING_ACCEPTANCE', vendorId: null }
        ]
      })
        .populate('userId', 'name phone email')
        .populate('vendorId', 'name businessName phone')
        .populate('workerId', 'name phone')
        .sort({ createdAt: -1 })
        .lean();

      // Transform ProductOrders to match Booking interface format for admin UI
      const formattedProductOrders = escalatedProductOrders.map(pOrder => ({
        _id: pOrder._id,
        id: pOrder._id,
        bookingNumber: pOrder.orderId,
        serviceName: pOrder.items?.[0]?.title ? `${pOrder.items[0].title}${pOrder.items.length > 1 ? ` +${pOrder.items.length - 1} items` : ''}` : 'Product Order',
        serviceCategory: 'Product Order',
        status: pOrder.status === 'ESCALATED' ? 'escalated' : pOrder.status.toLowerCase(),
        adminAssignmentStatus: pOrder.status === 'ESCALATED' ? 'NEEDS_ASSIGNMENT' : 'PENDING',
        userId: pOrder.userId,
        vendorId: pOrder.vendorId,
        workerId: pOrder.workerId,
        finalAmount: pOrder.financialBreakdown?.totalAmount || 0,
        totalAmount: pOrder.financialBreakdown?.totalAmount || 0,
        address: {
          addressLine1: `${pOrder.deliveryAddress?.addressLine1 || ''}, ${pOrder.deliveryAddress?.city || ''}`,
          city: pOrder.deliveryAddress?.city,
          lat: pOrder.deliveryAddress?.lat,
          lng: pOrder.deliveryAddress?.lng
        },
        scheduledDate: pOrder.createdAt,
        scheduledTime: 'ASAP / Immediate',
        createdAt: pOrder.createdAt,
        isProductOrder: true,
        offeringType: 'PRODUCT'
      }));

      bookings = [...formattedProductOrders, ...bookings];
      total += formattedProductOrders.length;
    }

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

    let bookingDoc = await Booking.findById(id)
      .populate('userId', 'name phone email addresses')
      .populate('vendorId', 'name businessName phone email address')
      .populate('serviceId', 'title description iconUrl images')
      .populate('categoryId', 'title slug')
      .populate('workerId', 'name phone rating totalJobs completedJobs')
      .populate('vendorBillId')
      .populate({ path: 'activityLog.actorId', select: 'name businessName phone' })
      .lean();

    if (!bookingDoc) {
      const ProductOrder = require('../../models/ProductOrder');
      const pOrder = await ProductOrder.findById(id)
        .populate('userId', 'name phone email addresses')
        .populate('vendorId', 'name businessName phone email address')
        .populate('workerId', 'name phone rating totalJobs completedJobs')
        .lean();

      if (pOrder) {
        bookingDoc = {
          _id: pOrder._id,
          id: pOrder._id,
          bookingNumber: pOrder.orderId,
          serviceName: pOrder.items?.[0]?.title ? `${pOrder.items[0].title}${pOrder.items.length > 1 ? ` +${pOrder.items.length - 1} items` : ''}` : 'Product Order',
          serviceCategory: 'Product Order',
          status: pOrder.status === 'ESCALATED' ? 'escalated' : pOrder.status.toLowerCase(),
          adminAssignmentStatus: pOrder.status === 'ESCALATED' ? 'NEEDS_ASSIGNMENT' : 'PENDING',
          userId: pOrder.userId,
          vendorId: pOrder.vendorId,
          workerId: pOrder.workerId,
          finalAmount: pOrder.financialBreakdown?.totalAmount || 0,
          totalAmount: pOrder.financialBreakdown?.totalAmount || 0,
          address: {
            addressLine1: `${pOrder.deliveryAddress?.addressLine1 || ''}, ${pOrder.deliveryAddress?.city || ''}`,
            city: pOrder.deliveryAddress?.city,
            lat: pOrder.deliveryAddress?.lat,
            lng: pOrder.deliveryAddress?.lng
          },
          scheduledDate: pOrder.createdAt,
          scheduledTime: 'ASAP / Immediate',
          createdAt: pOrder.createdAt,
          isProductOrder: true,
          offeringType: 'PRODUCT'
        };
      }
    }

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
 * Get category-restricted eligible vendors for manual assignment by Admin
 */
const getEligibleVendorsForAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    let booking = await Booking.findById(id).lean();
    if (!booking) {
      const ProductOrder = require('../../models/ProductOrder');
      const pOrder = await ProductOrder.findById(id).lean();
      if (pOrder) {
        booking = {
          _id: pOrder._id,
          serviceCategory: 'Product Order',
          bookedItems: pOrder.items,
          serviceName: pOrder.items?.[0]?.title || 'Product Order',
          address: pOrder.deliveryAddress
        };
      }
    }

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const Vendor = require('../../models/Vendor');
    const UserService = require('../../models/UserService');
    const Category = require('../../models/Category');

    // Extract booking category
    const bookingCategory = (booking.serviceCategory || '').trim();
    const categoryRegex = new RegExp(bookingCategory, 'i');

    // Find all category IDs matching booking category name
    const matchedCats = await Category.find({ title: categoryRegex }).select('_id').lean();
    const matchedCatIds = matchedCats.map(c => c._id);

    // Extract all required service titles from bookedItems (or serviceName)
    const requiredTitles = [];
    if (Array.isArray(booking.bookedItems) && booking.bookedItems.length > 0) {
      booking.bookedItems.forEach(item => {
        const title = item.card?.title || item.title || item.serviceName;
        if (title && title.trim() && !requiredTitles.includes(title.trim())) {
          requiredTitles.push(title.trim());
        }
      });
    }
    if (requiredTitles.length === 0 && booking.serviceName) {
      requiredTitles.push(booking.serviceName.trim());
    }

    // Find all active subscriptions matching item title or category
    const titleRegexes = requiredTitles.map(t => new RegExp(t.replace(/\s+/g, '\\s*'), 'i'));
    const categorySubscriptions = await UserService.find({
      $or: [
        { categoryId: { $in: matchedCatIds } },
        { category: categoryRegex },
        { title: categoryRegex },
        { title: { $in: titleRegexes } }
      ],
      status: 'active'
    }).select('vendorId title category').lean();

    const categoryVendorIds = Array.from(new Set(categorySubscriptions.map(s => s.vendorId?.toString()).filter(Boolean)));

    // Fallback: If no vendorId found in subscriptions, search all approved vendors
    let query = {
      approvalStatus: 'approved',
      isActive: { $ne: false }
    };

    if (categoryVendorIds.length > 0) {
      query._id = { $in: categoryVendorIds };
    }

    let categoryVendors = await Vendor.find(query)
      .select('name businessName email phone address profilePhoto rating level isOnline availability')
      .lean();

    // If city filtering resulted in 0 vendors, fallback to all approved vendors without city restriction
    if ((!categoryVendors || categoryVendors.length === 0) && categoryVendorIds.length > 0) {
      categoryVendors = await Vendor.find({ _id: { $in: categoryVendorIds }, approvalStatus: 'approved', isActive: { $ne: false } })
        .select('name businessName email phone address profilePhoto rating level isOnline availability')
        .lean();
    }

    if (!categoryVendors || categoryVendors.length === 0) {
      // Ultimate fallback for product orders: show all approved active vendors in admin panel
      categoryVendors = await Vendor.find({ approvalStatus: 'approved', isActive: { $ne: false } })
        .select('name businessName email phone address profilePhoto rating level isOnline availability')
        .lean();
    }

    // Separate into Fully Qualified (All Items) vs Category Qualified
    const vendorIdSets = await Promise.all(
      requiredTitles.map(async (title) => {
        const titleRegex = new RegExp(title.replace(/\s+/g, '\\s*'), 'i');
        const subs = await UserService.find({
          vendorId: { $in: categoryVendorIds },
          title: titleRegex,
          status: 'active'
        }).select('vendorId').lean();
        return new Set(subs.map(s => s.vendorId?.toString()).filter(Boolean));
      })
    );

    const tier1Set = new Set(
      vendorIdSets.length > 0
        ? Array.from(vendorIdSets[0]).filter(vId => vendorIdSets.every(set => set.has(vId)))
        : []
    );

    const tier1 = [];
    const tier2 = [];

    categoryVendors.forEach(v => {
      const vId = v._id.toString();
      if (tier1Set.has(vId)) {
        tier1.push({ ...v, tier: 1, qualification: 'Fully Qualified (All Items)' });
      } else {
        tier2.push({ ...v, tier: 2, qualification: 'Category Qualified' });
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        requiredTitles,
        serviceCategory: booking.serviceCategory,
        vendors: {
          tier1_fullyQualified: tier1,
          tier2_categoryQualified: tier2,
          categoryVendorsCount: categoryVendors.length
        }
      }
    });
  } catch (error) {
    console.error('getEligibleVendorsForAssignment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch eligible vendors' });
  }
};

/**
 * Manually assign a vendor to an escalated/searching booking
 */
const assignVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId, forceAssign, confirmMismatch } = req.body;

    if (!vendorId) {
      return res.status(400).json({ success: false, message: 'Vendor ID is required' });
    }

    let booking = await Booking.findById(id);
    if (!booking) {
      const ProductOrder = require('../../models/ProductOrder');
      const Vendor = require('../../models/Vendor');
      const pOrder = await ProductOrder.findById(id);
      if (pOrder) {
        const assignedVendor = await Vendor.findById(vendorId);
        if (!assignedVendor) {
          return res.status(404).json({ success: false, message: 'Vendor not found' });
        }
        pOrder.vendorId = vendorId;
        pOrder.status = 'PENDING_ACCEPTANCE';
        pOrder.isEscalatedToAdmin = false;
        await pOrder.save();

        // Socket emit to vendor and user
        const io = req.app.get('io');
        if (io) {
          io.to(`vendor_${vendorId}`).emit('new_product_order_alert', {
            orderId: pOrder._id,
            customOrderId: pOrder.orderId,
            items: pOrder.items,
            totalAmount: pOrder.financialBreakdown?.totalAmount,
            assignedByAdmin: true
          });
          io.to(`user_${pOrder.userId}`).emit('product_order_status_update', {
            orderId: pOrder._id,
            status: 'ACCEPTED',
            vendor: assignedVendor
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Product Order assigned to vendor successfully by Admin',
          data: pOrder
        });
      }

      return res.status(404).json({ success: false, message: 'Booking or Product Order not found' });
    }

    // Capability Check Safeguard:
    if (!forceAssign && !confirmMismatch) {
      const UserService = require('../../models/UserService');
      const requiredTitles = [];
      if (Array.isArray(booking.bookedItems) && booking.bookedItems.length > 0) {
        booking.bookedItems.forEach(item => {
          const title = item.card?.title || item.title || item.serviceName;
          if (title && title.trim() && !requiredTitles.includes(title.trim())) {
            requiredTitles.push(title.trim());
          }
        });
      }
      if (requiredTitles.length === 0 && booking.serviceName) {
        requiredTitles.push(booking.serviceName.trim());
      }

      // Check if assigned vendor has subscriptions
      const vendorSubs = await UserService.find({
        vendorId,
        status: 'active'
      }).select('title category').lean();

      const vendorSubTitles = vendorSubs.map(s => s.title?.toLowerCase().replace(/\s+/g, ''));
      const vendorSubCats = vendorSubs.map(s => s.category?.toLowerCase());
      const bookingCat = (booking.serviceCategory || '').toLowerCase();

      const hasAllTitles = requiredTitles.every(t =>
        vendorSubTitles.includes(t.toLowerCase().replace(/\s+/g, ''))
      );
      const hasCategory = vendorSubCats.includes(bookingCat) || vendorSubTitles.some(t => t.includes(bookingCat));

      if (!hasAllTitles && !hasCategory) {
        const Vendor = require('../../models/Vendor');
        const vDoc = await Vendor.findById(vendorId).select('name businessName').lean();
        const vName = vDoc?.businessName || vDoc?.name || 'Selected Vendor';
        return res.status(400).json({
          success: false,
          requireConfirmation: true,
          message: `Warning: ${vName} does not hold an active subscription for "${booking.serviceName}". Set forceAssign=true in payload to confirm override.`
        });
      }
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
  assignVendor,
  getEligibleVendorsForAssignment
};

