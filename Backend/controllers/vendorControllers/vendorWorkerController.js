const Worker = require('../../models/Worker');
const Booking = require('../../models/Booking');
const { validationResult } = require('express-validator');
const cloudinaryService = require('../../services/cloudinaryService');
const { WORKER_STATUS, BOOKING_STATUS } = require('../../utils/constants');

/**
 * Get vendor's workers
 */
const getVendorWorkers = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;

    // Build query
    let query = {};
    if (status === 'past') {
      query = {
        previousVendorIds: vendorId,
        vendorId: { $ne: vendorId }
      };
    } else {
      query = { vendorId };
      if (status && status !== 'all') {
        query.status = status;
      }
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get workers
    const workers = await Worker.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Dynamically compute completedJobs count & salary owed for each worker from Booking collection
    const workerIds = workers.map(w => w._id);
    const [completedStats, salaryOwedStats] = await Promise.all([
      Booking.aggregate([
        {
          $match: {
            workerId: { $in: workerIds },
            status: { $in: ['completed', 'COMPLETED', 'work_done', 'WORK_DONE', 'paid', 'closed', 'settlement_pending', 'worker_paid'] }
          }
        },
        {
          $group: {
            _id: '$workerId',
            count: { $sum: 1 }
          }
        }
      ]),
      Booking.aggregate([
        {
          $match: {
            workerId: { $in: workerIds },
            status: { $in: ['completed', 'COMPLETED', 'work_done', 'WORK_DONE'] },
            isWorkerPaid: { $ne: true },
            workerPaymentStatus: { $ne: 'PAID' }
          }
        },
        {
          $group: {
            _id: '$workerId',
            totalOwed: { $sum: { $ifNull: ['$finalAmount', '$basePrice'] } }
          }
        }
      ])
    ]);

    const completedMap = {};
    completedStats.forEach(stat => {
      completedMap[stat._id.toString()] = stat.count;
    });

    const salaryOwedMap = {};
    salaryOwedStats.forEach(stat => {
      salaryOwedMap[stat._id.toString()] = stat.totalOwed;
    });

    const mappedWorkers = workers.map(w => ({
      ...w,
      id: w._id,
      completedJobs: completedMap[w._id.toString()] || w.completedJobs || 0,
      salaryOwed: salaryOwedMap[w._id.toString()] !== undefined
        ? salaryOwedMap[w._id.toString()]
        : (w.wallet?.balance || 0)
    }));

    // Get total count
    const total = await Worker.countDocuments(query);

    res.status(200).json({
      success: true,
      data: mappedWorkers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get vendor workers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workers. Please try again.'
    });
  }
};

/**
 * Add worker
 */
const addWorker = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const vendorId = req.user.id;
    const {
      name,
      email,
      phone,
      password,
      aadhar,
      serviceCategories,
      address,
      profilePhoto
    } = req.body;

    // Upload Aadhar document to Cloudinary if it's a base64 string
    let aadharUrl = aadhar && aadhar.document ? aadhar.document : null;
    if (aadharUrl && aadharUrl.startsWith('data:')) {
      const uploadRes = await cloudinaryService.uploadFile(aadharUrl, { folder: 'workers/documents' });
      if (uploadRes.success) aadharUrl = uploadRes.url;
    }

    // Check if worker already exists
    let worker = await Worker.findOne({ phone });

    if (worker) {
      // If worker exists but has no vendor, link them and update details
      if (!worker.vendorId) {
        worker.vendorId = vendorId;
        worker.name = name;
        worker.email = email;
        if (password) worker.password = password;
        if (profilePhoto) worker.profilePhoto = profilePhoto;
        if (aadhar) {
          worker.aadhar = {
            number: aadhar.number,
            document: aadharUrl
          };
        }
        if (serviceCategories) worker.serviceCategories = serviceCategories;
        if (address) worker.address = address;
        worker.status = WORKER_STATUS.ACTIVE;

        await worker.save();

        return res.status(200).json({
          success: true,
          message: 'Existing worker successfully linked to your account',
          data: worker
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Worker with this phone number is already registered with a vendor'
      });
    }

    // Build location object if coordinates are present in address
    const workerLocation = (address && address.lat !== undefined && address.lng !== undefined) ? {
      lat: Number(address.lat),
      lng: Number(address.lng),
      updatedAt: new Date()
    } : undefined;

    // Create worker
    worker = await Worker.create({
      name,
      email: (email && email.trim()) ? email.trim().toLowerCase() : undefined, // Handle empty string as undefined for sparse index
      phone,
      password,
      profilePhoto: profilePhoto || null,
      aadhar: {
        number: aadhar?.number || '',
        document: aadharUrl || null
      },
      vendorId,
      serviceCategories: serviceCategories || [],
      address: address || {},
      location: workerLocation,
      approvalStatus: 'pending',
      status: WORKER_STATUS.OFFLINE
    });

    res.status(201).json({
      success: true,
      message: 'Worker added successfully',
      data: worker
    });
  } catch (error) {
    console.error('Add worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add worker. Please try again.'
    });
  }
};

/**
 * Link existing worker by phone
 */
const linkWorker = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    let worker = await Worker.findOne({ phone });

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'No worker found with this phone number'
      });
    }

    if (worker.vendorId && worker.vendorId.toString() === vendorId) {
      return res.status(400).json({
        success: false,
        message: 'Worker is already linked to your account'
      });
    }

    if (worker.vendorId) {
      return res.status(400).json({
        success: false,
        message: 'Worker is already linked to another vendor'
      });
    }

    worker.vendorId = vendorId;
    worker.status = WORKER_STATUS.ACTIVE;
    await worker.save();

    res.status(200).json({
      success: true,
      message: 'Worker linked successfully',
      data: worker
    });

  } catch (error) {
    console.error('Link worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to link worker'
    });
  }
};

/**
 * Update worker details
 */
const updateWorker = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const vendorId = req.user.id;
    const { id } = req.params;
    const updateData = req.body;

    // Verify worker belongs to vendor
    const worker = await Worker.findOne({ _id: id, vendorId });

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found or does not belong to your vendor account'
      });
    }

    // Update fields
    if (updateData.name) worker.name = updateData.name;
    if (updateData.email !== undefined) worker.email = updateData.email || undefined;
    if (updateData.serviceCategories) worker.serviceCategories = updateData.serviceCategories;
    if (updateData.address) {
      worker.address = { ...worker.address, ...updateData.address };
      if (updateData.address.lat !== undefined && updateData.address.lng !== undefined) {
        worker.location = {
          lat: Number(updateData.address.lat),
          lng: Number(updateData.address.lng),
          updatedAt: new Date()
        };
      }
    }
    if (updateData.status) worker.status = updateData.status;

    // Update Aadhar if provided
    if (updateData.aadhar) {
      let aadharUrl = updateData.aadhar.document || worker.aadhar?.document;
      if (aadharUrl && aadharUrl.startsWith('data:')) {
        const uploadRes = await cloudinaryService.uploadFile(aadharUrl, { folder: 'workers/documents' });
        if (uploadRes.success) aadharUrl = uploadRes.url;
      }
      worker.aadhar = {
        number: updateData.aadhar.number || worker.aadhar?.number,
        document: aadharUrl
      };
    }

    // Update Profile Photo if provided
    if (updateData.profilePhoto !== undefined) {
      let photoUrl = updateData.profilePhoto;
      if (photoUrl && photoUrl.startsWith('data:')) {
        const uploadRes = await cloudinaryService.uploadFile(photoUrl, { folder: 'workers/profiles' });
        if (uploadRes.success) photoUrl = uploadRes.url;
      }
      worker.profilePhoto = photoUrl;
    }

    await worker.save();

    res.status(200).json({
      success: true,
      message: 'Worker updated successfully',
      data: worker
    });
  } catch (error) {
    console.error('Update worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update worker. Please try again.'
    });
  }
};

/**
 * Remove worker
 */
const removeWorker = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { id } = req.params;

    // Verify worker belongs to vendor
    const worker = await Worker.findOne({ _id: id, vendorId });

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found or does not belong to your vendor account'
      });
    }

    // Check if worker has active bookings
    const activeBookings = await Booking.countDocuments({
      workerId: id,
      status: { $in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.IN_PROGRESS] }
    });

    if (activeBookings > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot remove worker with ${activeBookings} active booking(s)`
      });
    }

    // Remove worker (soft delete by setting status to inactive)
    worker.status = WORKER_STATUS.INACTIVE;
    if (worker.vendorId) {
      if (!worker.previousVendorIds) worker.previousVendorIds = [];
      if (!worker.previousVendorIds.some(vId => vId.toString() === worker.vendorId.toString())) {
        worker.previousVendorIds.push(worker.vendorId);
      }
    }
    worker.vendorId = null; // Unassign from vendor
    await worker.save();

    res.status(200).json({
      success: true,
      message: 'Worker removed successfully'
    });
  } catch (error) {
    console.error('Remove worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove worker. Please try again.'
    });
  }
};

/**
 * Get worker performance stats
 */
const getWorkerPerformance = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { id } = req.params;

    // Verify worker belongs to vendor
    const worker = await Worker.findOne({ _id: id, vendorId });

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found or does not belong to your vendor account'
      });
    }

    // Get booking stats
    const stats = await Booking.aggregate([
      {
        $match: { workerId: id }
      },
      {
        $group: {
          _id: null,
          totalJobs: { $sum: 1 },
          completedJobs: {
            $sum: {
              $cond: [{ $eq: ['$status', BOOKING_STATUS.COMPLETED] }, 1, 0]
            }
          },
          totalRevenue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', BOOKING_STATUS.COMPLETED] },
                    { $eq: ['$paymentStatus', 'success'] }
                  ]
                },
                '$finalAmount',
                0
              ]
            }
          },
          averageRating: { $avg: '$rating' }
        }
      }
    ]);

    const performance = stats[0] || {
      totalJobs: 0,
      completedJobs: 0,
      totalRevenue: 0,
      averageRating: 0
    };

    res.status(200).json({
      success: true,
      data: {
        worker: {
          id: worker._id,
          name: worker.name,
          phone: worker.phone,
          rating: worker.rating || 0
        },
        performance: {
          ...performance,
          completionRate: performance.totalJobs
            ? ((performance.completedJobs / performance.totalJobs) * 100).toFixed(2)
            : 0,
          averageRating: performance.averageRating
            ? performance.averageRating.toFixed(2)
            : 0
        }
      }
    });
  } catch (error) {
    console.error('Get worker performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch worker performance. Please try again.'
    });
  }
};

/**
 * Get single worker by ID
 */
const getVendorWorkerById = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { id } = req.params;

    const worker = await Worker.findOne({ _id: id, vendorId });

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found or does not belong to your vendor account'
      });
    }

    res.status(200).json({
      success: true,
      data: worker
    });
  } catch (error) {
    console.error('Get worker by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch worker details'
    });
  }
};

/**
 * Pay & Reset Worker Salary
 */
const payAndResetWorkerSalary = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { id: workerId } = req.params;
    const { amount, paymentMethod = 'cash', notes = '', transactionId = null } = req.body;

    const worker = await Worker.findOne({ _id: workerId, vendorId });
    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found or does not belong to vendor' });
    }

    // Find all completed unpaid bookings for this worker under this vendor
    const unpaidBookings = await Booking.find({
      workerId: worker._id,
      vendorId: vendorId,
      status: { $in: ['completed', 'COMPLETED', 'work_done', 'WORK_DONE'] },
      isWorkerPaid: { $ne: true },
      workerPaymentStatus: { $ne: 'PAID' }
    });

    const totalUnpaidOwed = unpaidBookings.reduce((sum, b) => sum + (b.finalAmount || b.basePrice || 0), 0);
    const effectiveWorkerBalance = worker.wallet?.balance || 0;

    if (totalUnpaidOwed <= 0 && effectiveWorkerBalance <= 0 && (!amount || Number(amount) <= 0)) {
      return res.status(400).json({
        success: false,
        message: `No pending salary owed for ${worker.name}. All completed jobs have already been settled.`
      });
    }

    const payoutAmount = (amount !== undefined && !isNaN(amount) && Number(amount) > 0) 
      ? Number(amount) 
      : (totalUnpaidOwed || effectiveWorkerBalance);

    // Mark unpaid bookings as paid
    const bookingIdsToUpdate = unpaidBookings.map(b => b._id);
    if (bookingIdsToUpdate.length > 0) {
      await Booking.updateMany(
        { _id: { $in: bookingIdsToUpdate } },
        {
          $set: {
            isWorkerPaid: true,
            workerPaymentStatus: 'PAID',
            workerPaidAt: new Date()
          }
        }
      );
    }

    // Reset worker wallet balance to 0
    if (!worker.wallet) worker.wallet = { balance: 0 };
    worker.wallet.balance = Math.max(0, (worker.wallet.balance || 0) - payoutAmount);
    await worker.save();

    // Map payment method to valid enum
    const validPaymentMethod = ['cash', 'bank_transfer', 'upi', 'wallet', 'razorpay', 'online'].includes(paymentMethod)
      ? paymentMethod
      : 'cash';

    const methodLabel = validPaymentMethod === 'upi' ? 'UPI' : validPaymentMethod === 'bank_transfer' ? 'Bank Transfer' : 'Cash Handover';
    const settledJobCount = bookingIdsToUpdate.length;
    const richDescription = `Salary Payout of ₹${payoutAmount.toLocaleString('en-IN')} via ${methodLabel}. Reset ${settledJobCount} completed booking(s). ${notes ? `(${notes})` : ''}`.trim();

    // Create Transaction record safely
    try {
      const Transaction = require('../../models/Transaction');
      const transaction = new Transaction({
        vendorId,
        workerId: worker._id,
        type: 'worker_payment',
        amount: payoutAmount,
        status: 'completed',
        paymentMethod: validPaymentMethod,
        description: richDescription,
        referenceId: transactionId || null,
        metadata: {
          notes,
          transactionId,
          resetByVendor: true,
          settledJobCount,
          settledAmount: payoutAmount
        }
      });
      await transaction.save();
    } catch (txnError) {
      console.error('Failed to create transaction record for salary settlement:', txnError);
    }

    // Format timing string for worker notification
    const now = new Date();
    const formattedTimeStr = now.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Send notifications to worker safely
    try {
      const { createNotification } = require('../notificationControllers/notificationController');
      await createNotification({
        workerId: worker._id,
        type: 'payment_received',
        title: '💰 Salary Paid & Settled',
        message: `Vendor paid you ₹${payoutAmount.toLocaleString('en-IN')} on ${formattedTimeStr}. Your salary balance is reset to ₹0.`,
        relatedId: worker._id,
        relatedType: 'worker',
        priority: 'high',
        pushData: {
          type: 'salary_settled',
          amount: payoutAmount,
          time: formattedTimeStr,
          link: '/worker/wallet'
        }
      });
    } catch (notifErr) {
      console.error('Failed to send notification for salary settlement:', notifErr);
    }

    // Send push notification if FCM available
    try {
      const fcmTokens = [
        ...(worker.fcmTokens || []),
        ...(worker.fcmTokenMobile || [])
      ];
      if (fcmTokens.length > 0) {
        const { sendPushNotification } = require('../../services/firebaseAdmin');
        await sendPushNotification(fcmTokens, {
          title: 'Salary Settled & Reset! 💰',
          body: `₹${payoutAmount.toLocaleString('en-IN')} paid on ${formattedTimeStr}. Salary balance reset to ₹0.`,
          data: { type: 'salary_settled', time: formattedTimeStr, url: '/worker/wallet' },
          highPriority: true
        });
      }
    } catch (fcmErr) {
      console.error('Failed to send push notification:', fcmErr);
    }

    // Real-time socket event
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`worker_${worker._id}`).emit('salary_settled', {
          amount: payoutAmount,
          salaryOwed: 0,
          time: formattedTimeStr,
          message: `Salary of ₹${payoutAmount.toLocaleString('en-IN')} paid on ${formattedTimeStr}`
        });
      }
    } catch (socketErr) {
      console.error('Failed to emit socket event:', socketErr);
    }

    res.status(200).json({
      success: true,
      message: `Salary of ₹${payoutAmount.toLocaleString('en-IN')} paid and balance reset to ₹0 successfully!`,
      data: {
        workerId: worker._id,
        payoutAmount,
        remainingSalaryOwed: 0
      }
    });

  } catch (error) {
    console.error('Pay and reset worker salary error:', error);
    res.status(500).json({ success: false, message: 'Failed to settle and reset worker salary' });
  }
};

/**
 * Get salary payment history for a specific worker
 */
const getWorkerPaymentHistory = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { id: workerId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const Transaction = require('../../models/Transaction');
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      workerId,
      vendorId,
      type: 'worker_payment',
      $or: [
        { 'metadata.resetByVendor': true },
        { description: { $regex: /settlement|reset/i } }
      ]
    };

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(query);

    res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get worker payment history error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch worker payment history' });
  }
};

module.exports = {
  getVendorWorkers,
  getVendorWorkerById,
  addWorker,
  linkWorker,
  updateWorker,
  removeWorker,
  getWorkerPerformance,
  payAndResetWorkerSalary,
  getWorkerPaymentHistory
};

