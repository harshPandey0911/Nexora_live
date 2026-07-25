const Worker = require('../../models/Worker');
const Booking = require('../../models/Booking');
const Transaction = require('../../models/Transaction');
const Review = require('../../models/Review');
const { validationResult } = require('express-validator');
const { WORKER_STATUS, BOOKING_STATUS, VENDOR_STATUS } = require('../../utils/constants');
const { createNotification } = require('../notificationControllers/notificationController');

/**
 * Get all workers with filters and pagination
 */
const getAllWorkers = async (req, res) => {
  try {
    const {
      search,
      approvalStatus,
      isActive,
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    const query = {};

    if (approvalStatus) {
      query.approvalStatus = approvalStatus;
    }
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Search by name, email, phone
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { serviceCategory: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get workers with populated vendor details
    const workers = await Worker.find(query)
      .select('-password')
      .populate('vendorId', 'name businessName phone serviceCategories category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Worker.countDocuments(query);

    res.status(200).json({
      success: true,
      data: workers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all workers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workers. Please try again.'
    });
  }
};

/**
 * Get worker details
 */
const getWorkerDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const worker = await Worker.findById(id).select('-password');

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Get worker booking stats
    const jobStats = await Booking.aggregate([
      {
        $match: { workerId: worker._id }
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
          // Assuming workers might get paid or we just track job value
          totalJobValue: {
            $sum: '$finalAmount'
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        worker,
        stats: jobStats[0] || {
          totalJobs: 0,
          completedJobs: 0,
          totalJobValue: 0
        }
      }
    });
  } catch (error) {
    console.error('Get worker details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch worker details. Please try again.'
    });
  }
};

/**
 * Approve worker registration
 */
const approveWorker = async (req, res) => {
  try {
    const { id } = req.params;

    const worker = await Worker.findById(id);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    worker.approvalStatus = 'approved';
    worker.isActive = true;
    await worker.save();

    // Send notification to worker
    /*
    // Note: Assuming notification system supports 'worker' type or we treat them as users for now
    await createNotification({
      userId: worker._id, // Use userId for workers too? or need separate workerId field in notification
      type: 'worker_approved',
      title: 'Worker Registration Approved',
      message: 'Your worker registration has been approved.',
      relatedId: worker._id,
      relatedType: 'worker'
    });
    */

    res.status(200).json({
      success: true,
      message: 'Worker approved successfully',
      data: worker
    });
  } catch (error) {
    console.error('Approve worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve worker. Please try again.'
    });
  }
};

/**
 * Reject worker registration
 */
const rejectWorker = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const worker = await Worker.findById(id);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    worker.approvalStatus = 'rejected';
    worker.isActive = false;
    // worker.rejectedReason = reason; // If we want to store reason
    await worker.save();

    res.status(200).json({
      success: true,
      message: 'Worker rejected successfully',
      data: worker
    });
  } catch (error) {
    console.error('Reject worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject worker. Please try again.'
    });
  }
};

/**
 * Suspend worker
 */
const suspendWorker = async (req, res) => {
  try {
    const { id } = req.params;

    const worker = await Worker.findById(id);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    worker.approvalStatus = 'suspended';
    worker.isActive = false;
    await worker.save();

    res.status(200).json({
      success: true,
      message: 'Worker suspended successfully',
      data: worker
    });
  } catch (error) {
    console.error('Suspend worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to suspend worker. Please try again.'
    });
  }
};

/**
 * Get worker jobs
 */
const getWorkerJobs = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { workerId: id };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const jobs = await Booking.find(query)
      .populate('userId', 'name phone')
      .populate('serviceId', 'title iconUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get worker jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch worker jobs.'
    });
  }
};

/**
 * Get worker earnings
 */
const getWorkerEarnings = async (req, res) => {
  // Placeholder for now, can be expanded if we track granular worker earnings
  res.status(200).json({
    success: true,
    data: {
      totalEarnings: 0
    }
  });
};

/**
 * Pay worker manually
 */
const payWorker = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reference, notes } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid amount'
      });
    }

    const worker = await Worker.findById(id);
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Update wallet balance
    // Assuming balance is amount owed to Admin? 
    // Usually admin pays worker, so worker balance increases or decreases?
    // In this system, vendor owes admin (negative balance).
    // For workers, positive balance probably means earnings they can withdraw.
    // If admin pays them, it should reduce their pending balance or just reflect as a transaction.
    // If the user says "pay worker", it usually means adding money to their wallet or clearing dues.

    if (!worker.wallet) worker.wallet = { balance: 0 };
    worker.wallet.balance += parseFloat(amount);

    await worker.save();

    res.status(200).json({
      success: true,
      message: `Successfully recorded payment of ₹${amount} to ${worker.name}`,
      data: {
        balance: worker.wallet.balance
      }
    });
  } catch (error) {
    console.error('Pay worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process payment. Please try again.'
    });
  }
};

/**
 * Get all worker jobs (global)
 */
const getAllWorkerJobs = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;

    const query = { workerId: { $exists: true, $ne: null } };
    if (status) {
      query.status = status;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // If search is provided, we need to find workers by name first
    if (search) {
      const workers = await Worker.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      const workerIds = workers.map(w => w._id);
      query.workerId = { $in: workerIds };
    }

    const jobs = await Booking.find(query)
      .populate('workerId', 'name phone profileImage')
      .populate('userId', 'name phone')
      .populate('serviceId', 'title iconUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all worker jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch all worker jobs.'
    });
  }
};

/**
 * Get worker payments summary
 */
const getWorkerPaymentsSummary = async (req, res) => {
  try {
    // For now, return workers with non-zero balances or recent job activity
    const workers = await Worker.find({
      'wallet.balance': { $exists: true }
    })
      .select('name phone wallet email serviceCategory approvalStatus')
      .sort({ 'wallet.balance': -1 });

    res.status(200).json({
      success: true,
      data: workers
    });
  } catch (error) {
    console.error('Get worker payments summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch worker payments summary.'
    });
  }
};

/**
 * Toggle worker active status
 */
const toggleWorkerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body; // Expecting { isActive: true/false }

    const worker = await Worker.findById(id);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    worker.isActive = isActive;
    await worker.save();

    res.status(200).json({
      success: true,
      message: `Worker ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: worker
    });
  } catch (error) {
    console.error('Toggle worker status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update worker status'
    });
  }
};

/**
 * Delete worker details
 */
const deleteWorker = async (req, res) => {
  try {
    const { id } = req.params;

    const worker = await Worker.findByIdAndDelete(id);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Worker deleted successfully'
    });
  } catch (error) {
    console.error('Delete worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete worker'
    });
  }
};

/**
 * Get Worker Salary Ledgers & Payout History
 */
const getWorkerSalaryLedgers = async (req, res) => {
  try {
    const { search, paymentMethod, statusFilter, page = 1, limit = 15 } = req.query;
    const Vendor = require('../../models/Vendor');

    const searchTrim = search ? search.trim() : '';
    const searchRegex = searchTrim ? new RegExp(searchTrim, 'i') : null;

    // 1. Calculate per-vendor monthly salary payout summaries for ALL vendors
    const vendorQuery = searchRegex
      ? {
          $or: [
            { name: searchRegex },
            { businessName: searchRegex },
            { phone: searchRegex }
          ]
        }
      : {};

    const allVendors = await Vendor.find(vendorQuery).select('name businessName phone category createdAt');
    const vendorPayoutSummaries = [];

    for (const v of allVendors) {
      // Find all workers under this vendor
      const workers = await Worker.find({ vendorId: v._id }).select('_id name phone wallet completedJobs');
      const workerIds = workers.map(w => w._id);
      if (workerIds.length === 0) continue;

      // Find unpaid completed bookings for these workers
      const unpaidBookings = await Booking.find({
        workerId: { $in: workerIds },
        status: { $in: ['completed', 'COMPLETED', 'work_done', 'WORK_DONE'] },
        isWorkerPaid: { $ne: true },
        workerPaymentStatus: { $ne: 'PAID' }
      }).select('_id workerId finalAmount basePrice');

      const unpaidMap = {};
      unpaidBookings.forEach(b => {
        const wId = b.workerId.toString();
        unpaidMap[wId] = (unpaidMap[wId] || 0) + (b.finalAmount || b.basePrice || 0);
      });

      const workerBreakdown = workers.map(w => {
        const wId = w._id.toString();
        const owed = unpaidMap[wId] !== undefined ? unpaidMap[wId] : (w.wallet?.balance || 0);
        return {
          _id: w._id,
          name: w.name,
          phone: w.phone,
          completedJobs: w.completedJobs || 0,
          salaryOwed: owed,
          walletBalance: w.wallet?.balance || 0
        };
      });

      const pendingOwed = workerBreakdown.reduce((sum, w) => sum + w.salaryOwed, 0);

      // Find total salary paid by this vendor in history
      const paidTxns = await Transaction.aggregate([
        {
          $match: {
            vendorId: v._id,
            type: 'worker_payment',
            $or: [
              { 'metadata.resetByVendor': true },
              { description: { $regex: /settlement|reset|salary payout/i } }
            ]
          }
        },
        { $group: { _id: null, totalPaid: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]);

      const totalSalaryPaid = paidTxns[0]?.totalPaid || 0;
      const totalPayoutCount = paidTxns[0]?.count || 0;

      vendorPayoutSummaries.push({
        vendorId: v._id,
        vendorName: v.name,
        businessName: v.businessName || '',
        phone: v.phone || '',
        workerCount: workers.length,
        pendingSalaryOwed: pendingOwed,
        totalSalaryPaid,
        totalPayoutCount,
        workerBreakdown,
        status: pendingOwed > 0 ? 'PAYOUT_DUE' : 'SETTLED'
      });
    }

    let filteredSummaries = vendorPayoutSummaries;
    if (statusFilter === 'due') {
      filteredSummaries = vendorPayoutSummaries.filter(s => s.pendingSalaryOwed > 0);
    } else if (statusFilter === 'settled') {
      filteredSummaries = vendorPayoutSummaries.filter(s => s.pendingSalaryOwed === 0);
    }
    filteredSummaries.sort((a, b) => b.pendingSalaryOwed - a.pendingSalaryOwed);

    // 2. Query Transaction History Audit Log
    const txnQuery = {
      type: 'worker_payment',
      $or: [
        { 'metadata.resetByVendor': true },
        { description: { $regex: /settlement|reset|salary payout/i } }
      ]
    };

    if (paymentMethod && paymentMethod !== 'all') {
      txnQuery.paymentMethod = paymentMethod;
    }

    if (searchRegex) {
      const matchingWorkers = await Worker.find({
        $or: [{ name: searchRegex }, { phone: searchRegex }, { email: searchRegex }]
      }).select('_id');

      const matchingVendors = await Vendor.find({
        $or: [{ name: searchRegex }, { businessName: searchRegex }, { phone: searchRegex }]
      }).select('_id');

      const workerIds = matchingWorkers.map(w => w._id);
      const vendorIds = matchingVendors.map(v => v._id);

      txnQuery.$and = [
        {
          $or: [
            { workerId: { $in: workerIds } },
            { vendorId: { $in: vendorIds } },
            { referenceId: searchRegex }
          ]
        }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await Transaction.find(txnQuery)
      .populate('workerId', 'name phone email wallet bankDetails serviceCategory')
      .populate('vendorId', 'name businessName phone category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalTxns = await Transaction.countDocuments(txnQuery);

    // Platform Level Stats
    const statsResult = await Transaction.aggregate([
      {
        $match: {
          type: 'worker_payment',
          $or: [
            { 'metadata.resetByVendor': true },
            { description: { $regex: /settlement|reset|salary payout/i } }
          ]
        }
      },
      { $group: { _id: null, totalPaid: { $sum: '$amount' } } }
    ]);

    const globalTotalSalaryPaid = statsResult[0]?.totalPaid || 0;
    const globalTotalPendingOwed = vendorPayoutSummaries.reduce((sum, v) => sum + v.pendingSalaryOwed, 0);

    res.status(200).json({
      success: true,
      data: transactions,
      vendorSummaries: filteredSummaries,
      stats: {
        totalSalaryPaid: globalTotalSalaryPaid,
        totalPendingOwed: globalTotalPendingOwed,
        totalSettlementsCount: totalTxns,
        vendorSalaryBreakdown: vendorPayoutSummaries
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalTxns,
        pages: Math.ceil(totalTxns / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get worker salary ledgers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch salary ledgers'
    });
  }
};

/**
 * Admin Manual Salary / Wallet Adjustment
 */
const adjustWorkerSalary = async (req, res) => {
  try {
    const { id: workerId } = req.params;
    const { amount, adjustmentType = 'credit', reason = '' } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount greater than 0 is required' });
    }

    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    const numericAmount = Number(amount);

    // Compute active worker salary owed (unpaid completed bookings or wallet balance)
    const unpaidBookings = await Booking.find({
      workerId: worker._id,
      status: { $in: ['completed', 'COMPLETED', 'work_done', 'WORK_DONE'] },
      isWorkerPaid: { $ne: true },
      workerPaymentStatus: { $ne: 'PAID' }
    });

    const unpaidJobTotal = unpaidBookings.reduce((sum, b) => sum + (b.finalAmount || b.basePrice || 0), 0);
    const oldBalance = unpaidBookings.length > 0 ? unpaidJobTotal : (worker.wallet?.balance || 0);

    if (adjustmentType === 'debit' && numericAmount > oldBalance) {
      return res.status(400).json({
        success: false,
        message: `Cannot debit ₹${numericAmount.toLocaleString('en-IN')}. Maximum debitable balance for ${worker.name} is ₹${oldBalance.toLocaleString('en-IN')}.`
      });
    }

    let newBalance = oldBalance;

    if (adjustmentType === 'credit') {
      newBalance = oldBalance + numericAmount;
    } else if (adjustmentType === 'debit') {
      newBalance = Math.max(0, oldBalance - numericAmount);
    } else if (adjustmentType === 'reset') {
      newBalance = 0;
    }

    worker.wallet = {
      ...(worker.wallet || {}),
      balance: newBalance
    };
    await worker.save();

    // Audit Transaction Record
    const auditTxn = new Transaction({
      workerId: worker._id,
      vendorId: worker.vendorId || null,
      type: 'worker_payment',
      amount: numericAmount,
      status: 'completed',
      paymentMethod: 'system',
      description: `Admin Salary Adjustment (${adjustmentType.toUpperCase()} ₹${numericAmount.toLocaleString('en-IN')}) - Reason: ${reason || 'Manual Adjustment'}`,
      balanceBefore: oldBalance,
      balanceAfter: newBalance,
      metadata: {
        adjustedByAdmin: true,
        adjustmentType,
        reason,
        adminId: req.user.id
      }
    });
    await auditTxn.save();

    res.status(200).json({
      success: true,
      message: `Worker wallet balance successfully adjusted (${adjustmentType})`,
      data: {
        workerId: worker._id,
        workerName: worker.name,
        oldBalance,
        newBalance,
        transaction: auditTxn
      }
    });
  } catch (error) {
    console.error('Adjust worker salary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to adjust worker salary'
    });
  }
};

/**
 * Get Worker Disputes & Rating Moderation Queue
 */
const getWorkerDisputes = async (req, res) => {
  try {
    const { status = 'all', page = 1, limit = 15 } = req.query;

    // Fetch low rating reviews (< 3 stars) involving workers
    const reviewsQuery = { rating: { $lte: 2 } };
    const lowReviews = await Review.find(reviewsQuery)
      .populate('workerId', 'name phone email serviceCategory')
      .populate('userId', 'name phone')
      .populate('bookingId', 'bookingId status totalAmount serviceName')
      .sort({ createdAt: -1 })
      .limit(20);

    // Fetch dispute bookings where status is disputed or canceled with worker involved
    const disputedBookings = await Booking.find({
      workerId: { $ne: null },
      $or: [
        { status: { $in: ['CANCELLED', 'cancelled', 'DISPUTED', 'disputed'] } },
        { isWorkerPaid: false, status: { $in: ['COMPLETED', 'completed'] } }
      ]
    })
      .populate('workerId', 'name phone serviceCategory wallet')
      .populate('vendorId', 'name businessName phone')
      .populate('userId', 'name phone')
      .sort({ updatedAt: -1 })
      .limit(20);

    res.status(200).json({
      success: true,
      data: {
        lowRatingReviews: lowReviews,
        disputedBookings
      },
      stats: {
        flaggedReviewsCount: lowReviews.length,
        disputedBookingsCount: disputedBookings.length
      }
    });
  } catch (error) {
    console.error('Get worker disputes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch worker disputes'
    });
  }
};

/**
 * Resolve Worker Dispute
 */
const resolveWorkerDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { resolutionAction, resolutionNotes = '' } = req.body;

    const booking = await Booking.findById(disputeId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking dispute record not found' });
    }

    booking.adminResolution = {
      action: resolutionAction || 'dismiss',
      notes: resolutionNotes,
      resolvedAt: new Date(),
      resolvedBy: req.user.id
    };
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Dispute successfully resolved',
      data: booking
    });
  } catch (error) {
    console.error('Resolve worker dispute error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve dispute'
    });
  }
};

/**
 * Moderate Worker Review / Rating
 */
const moderateWorkerRating = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { action = 'dismiss', reason = '' } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review record not found' });
    }

    if (action === 'dismiss' || action === 'hide') {
      review.isModerated = true;
      review.isApproved = false;
      review.moderationReason = reason || 'Dismissed by Admin as unfair review';
      await review.save();
    }

    res.status(200).json({
      success: true,
      message: `Worker review ${action === 'dismiss' ? 'dismissed' : 'moderated'} successfully`,
      data: review
    });
  } catch (error) {
    console.error('Moderate worker rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to moderate rating'
    });
  }
};

module.exports = {
  getAllWorkers,
  getWorkerDetails,
  approveWorker,
  rejectWorker,
  suspendWorker,
  getWorkerJobs,
  getWorkerEarnings,
  payWorker,
  getAllWorkerJobs,
  getWorkerPaymentsSummary,
  toggleWorkerStatus,
  deleteWorker,
  getWorkerSalaryLedgers,
  adjustWorkerSalary,
  getWorkerDisputes,
  resolveWorkerDispute,
  moderateWorkerRating
};
