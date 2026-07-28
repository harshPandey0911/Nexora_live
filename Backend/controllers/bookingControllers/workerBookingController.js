const Booking = require('../../models/Booking');
const ProductOrder = require('../../models/ProductOrder');
const { validationResult } = require('express-validator');
const { BOOKING_STATUS, PAYMENT_STATUS } = require('../../utils/constants');

/**
 * Get assigned jobs for worker
 */
const getAssignedJobs = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { status, page = 1, limit = 50 } = req.query;

    // Build query for service bookings
    const query = { workerId };
    if (status) {
      query.status = status;
    }
    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get service bookings
    const bookings = await Booking.find(query)
      .populate('userId', 'name phone email')
      .populate('vendorId', 'name businessName phone')
      .populate('serviceId', 'title iconUrl')
      .populate('categoryId', 'title slug')
      .sort({ createdAt: -1, scheduledDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Also get product orders assigned to this worker
    const productOrderQuery = { workerId };
    if (status) {
      // Map booking statuses to product order statuses where applicable
      const statusMap = {
        'ASSIGNED': 'ACCEPTED',
        'CONFIRMED': 'ACCEPTED',
      };
      productOrderQuery.status = statusMap[status?.toUpperCase()] || status;
    }

    const productOrders = await ProductOrder.find(productOrderQuery)
      .populate('userId', 'name phone email')
      .populate('vendorId', 'name businessName phone')
      .sort({ createdAt: -1 });

    // Normalize product orders to match booking shape for frontend compatibility
    const normalizedProductOrders = productOrders.map(order => ({
      _id: order._id,
      isProductOrder: true,
      orderId: order.orderId,
      serviceName: order.items?.[0]?.title || 'Product Delivery',
      status: order.status === 'ACCEPTED' ? 'ASSIGNED' : order.status,
      finalAmount: order.financialBreakdown?.totalAmount || 0,
      price: order.financialBreakdown?.totalAmount || 0,
      userId: order.userId,
      vendorId: order.vendorId,
      address: order.deliveryAddress
        ? {
            addressLine1: order.deliveryAddress.addressLine1 || '',
            city: order.deliveryAddress.city || '',
            pincode: order.deliveryAddress.pincode || ''
          }
        : null,
      contactDetails: order.contactDetails,
      items: order.items,
      scheduledDate: null,
      scheduledTime: null,
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,
      financialBreakdown: order.financialBreakdown,
      deliveryAddress: order.deliveryAddress
    }));

    // Merge and sort by createdAt
    const allJobs = [...bookings, ...normalizedProductOrders]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    // Get total count
    const total = allJobs.length;

    res.status(200).json({
      success: true,
      data: allJobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get assigned jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jobs. Please try again.'
    });
  }
};


/**
 * Get job details by ID
 */
const getJobById = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { id } = req.params;

    const booking = await Booking.findOne({ _id: id, workerId })
      .populate('userId', 'name phone email')
      .populate('vendorId', 'name businessName phone email address')
      .populate('serviceId', 'title description iconUrl images')
      .populate('categoryId', 'title slug');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job. Please try again.'
    });
  }
};

/**
 * Update job status
 */
const updateJobStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const workerId = req.user.id;
    const { id } = req.params;
    const { status, finalSettlementStatus, workerPaymentStatus } = req.body;

    const booking = await Booking.findOne({ _id: id, workerId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Validate status transition if status is changing
    if (status && status !== booking.status) {
      const validTransitions = {
        [BOOKING_STATUS.ASSIGNED]: [BOOKING_STATUS.VISITED, BOOKING_STATUS.IN_PROGRESS],
        [BOOKING_STATUS.CONFIRMED]: [BOOKING_STATUS.ASSIGNED, BOOKING_STATUS.IN_PROGRESS],
        [BOOKING_STATUS.VISITED]: [BOOKING_STATUS.WORK_DONE, BOOKING_STATUS.COMPLETED],
        [BOOKING_STATUS.IN_PROGRESS]: [BOOKING_STATUS.WORK_DONE, BOOKING_STATUS.COMPLETED],
        [BOOKING_STATUS.WORK_DONE]: [BOOKING_STATUS.COMPLETED],
        [BOOKING_STATUS.JOURNEY_STARTED]: [BOOKING_STATUS.VISITED, BOOKING_STATUS.IN_PROGRESS]
      };

      if (!validTransitions[booking.status]?.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status transition from ${booking.status} to ${status}`
        });
      }

      // Update booking status
      booking.status = status;

      if (status === BOOKING_STATUS.IN_PROGRESS && !booking.startedAt) {
        booking.startedAt = new Date();
      }

      if (status === BOOKING_STATUS.VISITED && !booking.startedAt) {
        booking.startedAt = new Date();
      }

      if (status === BOOKING_STATUS.COMPLETED) {
        booking.completedAt = new Date();
      }

      // Emit socket event for real-time update to user
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${booking.userId}`).emit('booking_updated', {
          bookingId: booking._id,
          status: booking.status,
          message: `Job status updated to ${booking.status}`
        });
      }

      // Add Push Notification for User
      const { createNotification } = require('../notificationControllers/notificationController');

      if (status === BOOKING_STATUS.IN_PROGRESS) {
        await createNotification({
          userId: booking.userId,
          type: 'work_started',
          title: 'Work In Progress',
          message: 'Professional has started working on your service.',
          relatedId: booking._id,
          relatedType: 'booking',
          priority: 'high',
          pushData: { type: 'in_progress', bookingId: booking._id.toString(), link: `/user/booking/${booking._id}` }
        });
      }

    }

    // Update additional fields
    if (finalSettlementStatus) booking.finalSettlementStatus = finalSettlementStatus;
    if (workerPaymentStatus) {
      booking.workerPaymentStatus = workerPaymentStatus;
      if (workerPaymentStatus === 'PAID' || workerPaymentStatus === 'SUCCESS') {
        booking.isWorkerPaid = true;
        booking.workerPaidAt = booking.workerPaidAt || new Date();
      }
    }

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Job status updated successfully',
      data: booking
    });
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job status. Please try again.'
    });
  }
};

/**
 * Mark job as started (Journey Started)
 */
const startJob = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { id } = req.params;

    const booking = await Booking.findOne({ _id: id, workerId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (booking.status !== BOOKING_STATUS.ASSIGNED && booking.status !== BOOKING_STATUS.CONFIRMED && booking.status !== BOOKING_STATUS.ACCEPTED) {
      return res.status(400).json({
        success: false,
        message: `Cannot start journey with status: ${booking.status}`
      });
    }

    // Generate Visit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Update booking
    booking.status = BOOKING_STATUS.JOURNEY_STARTED;
    booking.journeyStartedAt = new Date();
    booking.visitOtp = otp; // In production, hash this!

    await booking.save();

    // Notify user with OTP
    const { createNotification } = require('../notificationControllers/notificationController');
    await createNotification({
      userId: booking.userId,
      type: 'worker_started',
      title: 'Worker Started Journey',
      message: `Worker is on the way! specific OTP for site visit verification is: ${otp}. Please share this with worker upon arrival.`,
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

    // Notify vendor
    await createNotification({
      vendorId: booking.vendorId,
      type: 'worker_started',
      title: 'Worker Started Journey',
      message: `Your worker has started the journey for booking ${booking.bookingNumber}.`,
      relatedId: booking._id,
      relatedType: 'booking',
      pushData: {
        type: 'journey_started',
        bookingId: booking._id.toString(),
        link: `/vendor/bookings/${booking._id}`
      }
    });

    // Explicitly emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${booking.userId}`).emit('booking_updated', {
        bookingId: booking._id,
        status: BOOKING_STATUS.JOURNEY_STARTED,
        visitOtp: otp
      });

      // Socket notification removed - createNotification already handles this
    }

    res.status(200).json({
      success: true,
      message: 'Journey started, OTP sent to user',
      data: booking
    });
  } catch (error) {
    console.error('Start job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start job. Please try again.'
    });
  }
};

/**
 * Worker Reached Location
 * Notify user to share OTP
 */
const workerReachedLocation = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { id } = req.params;

    // Need visitOtp to resend it
    const booking = await Booking.findOne({ _id: id, workerId }).select('+visitOtp');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Job not found' });
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
      title: 'Professional has Reached!',
      message: `Professional has reached your location. Please share this OTP: ${otp}`,
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

    res.status(200).json({ success: true, message: 'User notified that professional reached' });
  } catch (error) {
    console.error('Worker reached location error:', error);
    res.status(500).json({ success: false, message: 'Failed to notify user' });
  }
};

/**
 * Verify Site Visit with OTP
 */
const verifyVisit = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { id } = req.params;
    const { otp, location } = req.body;

    // Use query to select visitOtp which is usually hidden
    const booking = await Booking.findOne({ _id: id, workerId }).select('+visitOtp');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (booking.status !== BOOKING_STATUS.JOURNEY_STARTED) {
      return res.status(400).json({ success: false, message: 'Worker has not started journey yet' });
    }

    if (booking.visitOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Update status
    booking.status = BOOKING_STATUS.VISITED;
    booking.visitedAt = new Date();
    booking.startedAt = new Date(); // Legacy compatibility
    booking.visitOtp = undefined; // Clear OTP
    if (location) {
      booking.visitLocation = {
        ...location,
        verifiedAt: new Date()
      };
    }

    await booking.save();

    // Notify user
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

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${booking.userId}`).emit('booking_updated', {
        bookingId: booking._id,
        status: booking.status,
        message: 'Visit verified successful'
      });
      // Socket notification removed - createNotification already handles this
    }

    res.status(200).json({
      success: true,
      message: 'Site visit verified successfully',
      data: booking
    });
  } catch (error) {
    console.error('Verify visit error:', error);
    res.status(500).json({ success: false, message: 'Failed to verifying visit' });
  }
};

/**
 * Mark job as completed (Work Done) & Generate Payment OTP
 */
const completeJob = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { id } = req.params;
    const { workPhotos, workDoneDetails } = req.body;

    const booking = await Booking.findOne({ _id: id, workerId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (booking.status !== BOOKING_STATUS.VISITED && booking.status !== BOOKING_STATUS.IN_PROGRESS) {
      return res.status(400).json({
        success: false,
        message: `Cannot complete job with status: ${booking.status}`
      });
    }

    // Update booking
    booking.status = BOOKING_STATUS.WORK_DONE;

    // Reuse existing Payment OTP or generate new one
    const payOtp = booking.paymentOtp || Math.floor(1000 + Math.random() * 9000).toString();
    booking.paymentOtp = payOtp;

    if (workPhotos && Array.isArray(workPhotos)) {
      booking.workPhotos = workPhotos;
    }
    if (workDoneDetails) {
      booking.workDoneDetails = workDoneDetails;
    }

    await booking.save();

    // Notify user
    const { createNotification } = require('../notificationControllers/notificationController');

    // 1. Notify user that work is completed and billing is being prepared
    await createNotification({
      userId: booking.userId,
      type: 'work_completed',
      title: 'Work Completed',
      message: `Work finished!  Please wait for the bill expert is preparing !`,
      relatedId: booking._id,
      relatedType: 'booking',
      priority: 'high',
      pushData: {
        type: 'work_completed',
        bookingId: booking._id.toString(),
        link: `/user/booking/${booking._id}`
      }
    });

    // 2. Notify user with Final Bill and OTP
    await createNotification({
      userId: booking.userId,
      type: 'work_done',
      title: 'Billing Ready',
      message: `Bill Generated: ₹${booking.finalAmount}. Your verification OTP is ${payOtp}. Please verify and share OTP to complete.`,
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

    // Notify vendor
    await createNotification({
      vendorId: booking.vendorId,
      type: 'worker_completed',
      title: 'Work Done',
      message: `Your worker has marked work as done for booking ${booking.bookingNumber}.`,
      relatedId: booking._id,
      relatedType: 'booking',
      pushData: {
        type: 'worker_completed',
        bookingId: booking._id.toString(),
        link: `/vendor/bookings/${booking._id}`
      }
    });

    // Explicitly emit socket event to ensure user gets real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${booking.userId}`).emit('booking_updated', {
        bookingId: booking._id,
        status: BOOKING_STATUS.WORK_DONE
      });

      // Socket notification removed - createNotification already handles this
    }

    res.status(200).json({
      success: true,
      message: 'Work done marked, OTP sent to user',
      data: booking
    });
  } catch (error) {
    console.error('Complete job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete job. Please try again.'
    });
  }
};

/**
 * Collect Cash & Complete Booking
 * Uses VendorBill as the single source of truth for earnings.
 */
const collectCash = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { id } = req.params;
    const { otp } = req.body;

    const booking = await Booking.findOne({ _id: id, workerId }).select('+paymentOtp');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (booking.status !== BOOKING_STATUS.WORK_DONE) {
      return res.status(400).json({ success: false, message: 'Work is not marked as done yet' });
    }

    if (booking.paymentOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Fetch VendorBill (single source of truth)
    const VendorBill = require('../../models/VendorBill');
    const bill = await VendorBill.findOne({ bookingId: booking._id });
    if (!bill) {
      return res.status(500).json({ success: false, message: 'Bill not found — cannot process payment' });
    }

    const grandTotal = Number(bill.grandTotal) || 0;
    const vendorEarning = Number(bill.vendorTotalEarning) || 0;

    // Update Booking Status
    booking.status = BOOKING_STATUS.COMPLETED;
    booking.paymentMethod = 'cash collected'; // Standardized label
    booking.paymentStatus = PAYMENT_STATUS.COLLECTED_BY_VENDOR;
    booking.cashCollected = true;
    booking.cashCollectedBy = 'worker';
    booking.cashCollectorId = workerId;
    booking.cashCollectedAt = new Date();
    booking.completedAt = new Date();
    booking.paymentOtp = undefined;
    await booking.save();

    // Mark bill as paid
    bill.status = 'paid';
    bill.paidAt = new Date();
    await bill.save();

    // Update Vendor Wallet
    const Vendor = require('../../models/Vendor');
    if (booking.vendorId) {
      const vendorDoc = await Vendor.findById(booking.vendorId).select('wallet');
      if (vendorDoc) {
        const currentDues = (vendorDoc.wallet.dues || 0) + grandTotal;
        const cashLimit = vendorDoc.wallet.cashLimit || 10000;
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

        await Vendor.findByIdAndUpdate(booking.vendorId, updateQuery);

        // Create Transactions
        const Transaction = require('../../models/Transaction');

        // 1. Cash Collected
        await Transaction.create({
          vendorId: booking.vendorId,
          bookingId: booking._id,
          workerId,
          type: 'cash_collected',
          amount: grandTotal,
          status: 'completed',
          paymentMethod: 'cash collected', // Standardized label
          description: `Cash ₹${grandTotal} collected by worker for booking #${booking.bookingNumber}`,
          metadata: {
            type: 'dues_increase',
            collectedBy: 'worker',
            billId: bill._id.toString(),
            grandTotal,
            vendorEarning,
            companyRevenue: bill.companyRevenue
          }
        });

        // 2. Earnings Credit
        if (vendorEarning > 0) {
          await Transaction.create({
            vendorId: booking.vendorId,
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
    }

    // Notify User
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

    res.status(200).json({
      success: true,
      message: 'Cash collected and job completed',
      data: booking
    });

  } catch (error) {
    console.error('Collect cash error:', error);
    res.status(500).json({ success: false, message: 'Failed to collect cash' });
  }
};

/**
 * Add worker notes to booking
 */
const addWorkerNotes = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const workerId = req.user.id;
    const { id } = req.params;
    const { notes } = req.body;

    const booking = await Booking.findOne({ _id: id, workerId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Update booking
    booking.workerNotes = notes;

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Notes added successfully',
      data: booking
    });
  } catch (error) {
    console.error('Add worker notes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add notes. Please try again.'
    });
  }
};

/**
 * Respond to job (Accept/Reject)
 */
const respondToJob = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { id } = req.params;
    const { status } = req.body; // 'ACCEPTED' or 'REJECTED'

    // First try to find a service booking
    const booking = await Booking.findOne({ _id: id, workerId });

    // If not a service booking, check if it's a product order delivery task
    if (!booking) {
      const productOrder = await ProductOrder.findOne({ _id: id, workerId });

      if (!productOrder) {
        return res.status(404).json({ success: false, message: 'Job not found' });
      }

      // Handle product order accept/reject
      if (status === 'ACCEPTED') {
        productOrder.workerResponse = 'ACCEPTED';
        productOrder.workerAcceptedAt = new Date();
        await productOrder.save();

        const io = req.app.get('io') || require('../../sockets').getIO();
        if (io) {
          io.to(`vendor_${productOrder.vendorId}`).emit('worker_job_accepted', {
            bookingId: productOrder._id,
            bookingNumber: productOrder.orderId,
            workerId: workerId
          });
        }

        return res.status(200).json({ success: true, message: 'Product delivery task accepted', data: productOrder });

      } else if (status === 'REJECTED') {
        productOrder.workerId = null;
        productOrder.workerResponse = 'REJECTED';
        await productOrder.save();

        const io = req.app.get('io') || require('../../sockets').getIO();
        if (io) {
          io.to(`vendor_${productOrder.vendorId}`).emit('worker_job_rejected', {
            bookingId: productOrder._id,
            bookingNumber: productOrder.orderId,
            workerId: workerId
          });
        }

        return res.status(200).json({ success: true, message: 'Product delivery task rejected', data: productOrder });
      }

      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    // Idempotency check: If already in desired state, return success without re-notifying
    if (status === 'ACCEPTED' && booking.workerResponse === 'ACCEPTED') {
      return res.status(200).json({ success: true, message: 'Job already accepted', data: booking });
    }

    if (status === 'REJECTED' && booking.workerResponse === 'REJECTED') {
      return res.status(200).json({ success: true, message: 'Job already rejected', data: booking });
    }

    if (status === 'ACCEPTED') {
      booking.status = BOOKING_STATUS.ASSIGNED;
      booking.workerAcceptedAt = new Date();
      booking.workerResponse = 'ACCEPTED';

      const { createNotification } = require('../notificationControllers/notificationController');

      // Notify Vendor
      await createNotification({
        vendorId: booking.vendorId,
        type: 'job_accepted',
        title: 'Worker Accepted Job',
        message: `Worker has accepted job ${booking.bookingNumber}`,
        relatedId: booking._id,
        relatedType: 'booking'
      });

      // Notify User
      await createNotification({
        userId: booking.userId,
        type: 'worker_accepted',
        title: 'Worker Confirmed',
        message: 'The assigned professional has accepted your booking.',
        relatedId: booking._id,
        relatedType: 'booking',
        priority: 'high',
        pushData: { type: 'worker_accepted', bookingId: booking._id.toString(), link: `/user/booking/${booking._id}` }
      });

      // Real-time socket emissions
      const io = req.app.get('io');
      if (io) {
        io.to(`vendor_${booking.vendorId}`).emit('worker_job_accepted', {
          bookingId: booking._id,
          bookingNumber: booking.bookingNumber,
          workerId: workerId
        });
        io.to(`user_${booking.userId}`).emit('booking_updated', {
          bookingId: booking._id,
          status: booking.status,
          message: 'Worker has accepted assignment'
        });
      }

    } else if (status === 'REJECTED') {
      booking.workerId = null;
      booking.workerResponse = 'REJECTED';
      booking.rejectedWorkerId = workerId;
      booking.status = BOOKING_STATUS.CONFIRMED; // Revert to unassigned state

      const { createNotification } = require('../notificationControllers/notificationController');
      await createNotification({
        vendorId: booking.vendorId,
        type: 'job_rejected',
        title: 'Worker Declined Job',
        message: `Worker declined job ${booking.bookingNumber}`,
        relatedId: booking._id,
        relatedType: 'booking'
      });

      // Real-time socket emissions
      const io = req.app.get('io');
      if (io) {
        io.to(`vendor_${booking.vendorId}`).emit('worker_job_rejected', {
          bookingId: booking._id,
          bookingNumber: booking.bookingNumber,
          workerId: workerId
        });
        io.to(`user_${booking.userId}`).emit('booking_updated', {
          bookingId: booking._id,
          status: booking.status,
          message: 'Worker declined assignment'
        });
      }
    }

    await booking.save();
    res.status(200).json({ success: true, message: `Job ${status.toLowerCase()}`, data: booking });

  } catch (error) {
    console.error('Respond job error:', error);
    res.status(500).json({ success: false, message: 'Failed to respond to job' });
  }
};


/**
 * Get product order detail for worker
 */
const getProductOrderById = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { id } = req.params;

    const order = await ProductOrder.findOne({ _id: id, workerId })
      .populate('userId', 'name phone email')
      .populate('vendorId', 'name businessName phone');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Product order not found' });
    }

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error('Get product order by id error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch product order' });
  }
};

/**
 * Update product order status (PACKING / OUT_FOR_DELIVERY)
 */
const updateProductOrderStatus = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['PACKING', 'OUT_FOR_DELIVERY'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Allowed: PACKING, OUT_FOR_DELIVERY' });
    }

    const order = await ProductOrder.findOne({ _id: id, workerId })
      .populate('userId', 'name phone')
      .populate('vendorId', 'name businessName');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Product order not found' });
    }

    order.status = status;
    if (status === 'OUT_FOR_DELIVERY') {
      order.dispatchedAt = new Date();
    }
    await order.save();

    // Status-specific message config
    const statusConfig = {
      PACKING: {
        userTitle: '📦 Order is Being Packed',
        userMsg: `Your order #${order.orderId} is being packed and will be dispatched soon.`,
        vendorTitle: '📦 Order Packing Started',
        vendorMsg: `Delivery boy started packing order #${order.orderId}.`,
      },
      OUT_FOR_DELIVERY: {
        userTitle: '🚚 Order Out for Delivery!',
        userMsg: `Your order #${order.orderId} is on the way! Delivery expected shortly.`,
        vendorTitle: '🚚 Order Out for Delivery',
        vendorMsg: `Order #${order.orderId} is now out for delivery.`,
      }
    };
    const cfg = statusConfig[status];

    // Socket notifications
    const io = req.app.get('io') || require('../../sockets').getIO();
    if (io) {
      const payload = { orderId: order._id, customOrderId: order.orderId, status: order.status };
      io.to(`user_${order.userId._id || order.userId}`).emit('product_order_status_update', payload);
      io.to(`vendor_${order.vendorId._id || order.vendorId}`).emit('product_order_status_update', payload);
    }

    // In-app notifications
    try {
      const { createNotification } = require('../notificationControllers/notificationController');
      await Promise.all([
        createNotification({
          userId: order.userId._id || order.userId,
          type: 'order_status_update',
          title: cfg.userTitle,
          message: cfg.userMsg,
          relatedId: order._id,
          relatedType: 'productOrder',
          priority: 'high'
        }),
        createNotification({
          vendorId: order.vendorId._id || order.vendorId,
          type: 'order_status_update',
          title: cfg.vendorTitle,
          message: cfg.vendorMsg,
          relatedId: order._id,
          relatedType: 'productOrder'
        })
      ]);
    } catch (notifErr) {
      console.error('[updateProductOrderStatus] Notification error (non-critical):', notifErr.message);
    }

    // Push notification to user via FCM
    try {
      const { sendNotificationToUser } = require('../../services/firebaseAdmin');
      sendNotificationToUser((order.userId._id || order.userId).toString(), {
        title: cfg.userTitle,
        body: cfg.userMsg
      }).catch(err => console.error('[updateProductOrderStatus] FCM error:', err));
    } catch (fcmErr) {
      // FCM optional, ignore
    }

    return res.status(200).json({ success: true, message: `Order status updated to ${status}`, data: order });
  } catch (error) {
    console.error('Update product order status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update status' });
  }
};

/**
 * Initiate delivery OTP — generates OTP and sends to user
 */
const initiateDeliveryOtp = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { id } = req.params;

    const order = await ProductOrder.findOne({ _id: id, workerId })
      .populate('userId', 'name phone email');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Product order not found' });
    }

    if (order.paymentMethod === 'online' && order.paymentStatus !== 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'Cannot generate OTP! Online payment is pending. Customer must pay online first.'
      });
    }

    if (order.status !== 'OUT_FOR_DELIVERY') {
      return res.status(400).json({ success: false, message: 'Order must be OUT_FOR_DELIVERY to initiate delivery OTP' });
    }

    // Generate 4-digit OTP
    const otp = String(Math.floor(1000 + Math.random() * 9000));
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min expiry

    order.deliveryOtp = otp;
    order.deliveryOtpExpiry = otpExpiry;
    await order.save();

    // Send OTP to user via socket notification
    const io = req.app.get('io') || require('../../sockets').getIO();
    if (io) {
      io.to(`user_${order.userId._id || order.userId}`).emit('product_delivery_otp', {
        orderId: order._id,
        customOrderId: order.orderId,
        otp,
        message: `Your delivery OTP for order #${order.orderId} is: ${otp}. Share with the delivery person.`
      });
    }

    // Also create an in-app notification for user
    try {
      const { createNotification } = require('../notificationControllers/notificationController');
      await createNotification({
        userId: order.userId._id || order.userId,
        type: 'delivery_otp',
        title: '📦 Delivery OTP',
        message: `Your delivery OTP for order #${order.orderId} is: ${otp}. Share with the delivery person. Valid for 15 minutes.`,
        relatedId: order._id,
        relatedType: 'productOrder',
        priority: 'high'
      });
    } catch (notifErr) {
      console.error('[initiateDeliveryOtp] Notification error (non-critical):', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'OTP sent to customer successfully',
      data: { otpSent: true, expiresAt: otpExpiry }
    });
  } catch (error) {
    console.error('Initiate delivery OTP error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate delivery OTP' });
  }
};

/**
 * Verify delivery OTP — marks order as DELIVERED
 */
const verifyDeliveryOtp = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { id } = req.params;
    const { otp } = req.body;

    if (!otp || otp.length !== 4) {
      return res.status(400).json({ success: false, message: 'Please provide a valid 4-digit OTP' });
    }

    const order = await ProductOrder.findOne({ _id: id, workerId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Product order not found' });
    }

    if (order.paymentMethod === 'online' && order.paymentStatus !== 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'Cannot deliver order! Online payment is pending. Ask customer to pay online first.'
      });
    }

    if (!order.deliveryOtp) {
      return res.status(400).json({ success: false, message: 'No delivery OTP generated. Please initiate OTP first.' });
    }

    if (new Date() > order.deliveryOtpExpiry) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please generate a new OTP.' });
    }

    if (order.deliveryOtp !== String(otp)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please check with the customer.' });
    }

    // Mark as DELIVERED
    order.status = 'DELIVERED';
    order.deliveredAt = new Date();
    order.deliveryOtp = null; // Clear OTP after use
    order.deliveryOtpExpiry = null;

    if (order.paymentMethod === 'cod') {
      order.paymentStatus = 'COD_COLLECTED';
    }

    await order.save();

    // Update vendor wallet earnings
    const Vendor = require('../../models/Vendor');
    const vendor = await Vendor.findById(order.vendorId);
    if (vendor) {
      if (!vendor.wallet) vendor.wallet = {};
      vendor.wallet.earnings = (vendor.wallet.earnings || 0) + (order.financialBreakdown?.vendorEarnings || 0);
      vendor.completedJobs = (vendor.completedJobs || 0) + 1;
      await vendor.save();
    }

    // Notify user and vendor via socket
    const io = req.app.get('io') || require('../../sockets').getIO();
    if (io) {
      io.to(`user_${order.userId}`).emit('product_order_status_update', {
        orderId: order._id,
        customOrderId: order.orderId,
        status: 'DELIVERED',
        paymentStatus: order.paymentStatus
      });
      io.to(`vendor_${order.vendorId}`).emit('product_order_delivered', {
        orderId: order._id,
        customOrderId: order.orderId,
        workerId
      });
    }

    // In-app notification to user
    try {
      const { createNotification } = require('../notificationControllers/notificationController');
      await createNotification({
        userId: order.userId,
        type: 'order_delivered',
        title: '✅ Order Delivered!',
        message: `Your order #${order.orderId} has been delivered successfully!`,
        relatedId: order._id,
        relatedType: 'productOrder',
        priority: 'high'
      });
    } catch (notifErr) {
      console.error('[verifyDeliveryOtp] Notification error (non-critical):', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Order delivered successfully!',
      data: order
    });
  } catch (error) {
    console.error('Verify delivery OTP error:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify delivery OTP' });
  }
};

module.exports = {
  getAssignedJobs,
  getJobById,
  updateJobStatus,
  startJob,
  completeJob,
  addWorkerNotes,
  verifyVisit,
  workerReachedLocation,
  collectCash,
  respondToJob,
  getProductOrderById,
  updateProductOrderStatus,
  initiateDeliveryOtp,
  verifyDeliveryOtp
};
