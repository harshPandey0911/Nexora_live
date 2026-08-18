const Worker = require('../../models/Worker');
const Transaction = require('../../models/Transaction');
const Booking = require('../../models/Booking');
const ProductOrder = require('../../models/ProductOrder');

const completedStatuses = [
  'completed', 'COMPLETED',
  'work_done', 'WORK_DONE',
  'delivered', 'DELIVERED',
  'delivered_by_worker', 'DELIVERED_BY_WORKER',
  'paid', 'PAID',
  'worker_paid', 'WORKER_PAID'
];

/**
 * Get worker wallet with ledger balance
 */
const getWallet = async (req, res) => {
  try {
    const workerId = req.user.id;
    const worker = await Worker.findById(workerId);

    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    // Calculate total active physical cash collected on field pending handover to vendor
    const [cashBookingsResult, cashProductOrdersResult] = await Promise.all([
      Booking.aggregate([
        {
          $match: {
            workerId: worker._id,
            status: { $in: completedStatuses },
            cashHandedOverAt: null,
            isWorkerPaid: { $ne: true },
            workerPaymentStatus: { $ne: 'PAID' }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ["$finalAmount", "$userPayableAmount", "$basePrice"] } }
          }
        }
      ]),
      ProductOrder.aggregate([
        {
          $match: {
            $or: [{ workerId: worker._id }, { assignedWorkerId: worker._id }],
            status: { $in: completedStatuses },
            cashHandedOverAt: null,
            isWorkerPaid: { $ne: true },
            workerPaymentStatus: { $ne: 'PAID' }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ["$financialBreakdown.totalAmount", "$totalAmount"] } }
          }
        }
      ])
    ]);

    const cashCollectedOnField = (cashBookingsResult[0]?.total || 0) + (cashProductOrdersResult[0]?.total || 0);

    // Calculate pending unpaid salary owed to worker by vendor
    const [unpaidSalaryResult, unpaidProductSalaryResult] = await Promise.all([
      Booking.aggregate([
        {
          $match: {
            workerId: worker._id,
            status: { $in: completedStatuses },
            isWorkerPaid: { $ne: true },
            workerPaymentStatus: { $ne: 'PAID' }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ["$vendorEarnings", "$finalAmount"] } }
          }
        }
      ]),
      ProductOrder.aggregate([
        {
          $match: {
            $or: [{ workerId: worker._id }, { assignedWorkerId: worker._id }],
            status: { $in: completedStatuses },
            isWorkerPaid: { $ne: true },
            workerPaymentStatus: { $ne: 'PAID' }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ["$financialBreakdown.deliveryCharge", "$deliveryCharge", "$financialBreakdown.totalAmount", "$totalAmount"] } }
          }
        }
      ])
    ]);

    // Salary Owed reflects accumulated vendor payouts added when vendor pays worker (resets on Pay & Reset)
    const salaryOwed = worker.wallet?.balance || 0;

    res.status(200).json({
      success: true,
      data: {
        balance: salaryOwed,
        receivedSalary: salaryOwed,
        salaryOwed,
        cashCollectedOnField
      }
    });

  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch wallet info' });
  }
};

/**
 * Get worker transactions
 */
const getTransactions = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { page = 1, limit = 20, type } = req.query;

    const query = { workerId };

    // Filter by type if provided
    if (type && type !== 'all') {
      query.type = type;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [dbTransactions, completedBookings, completedProductOrders] = await Promise.all([
      Transaction.find(query).sort({ createdAt: -1 }),
      Booking.find({ workerId, status: { $in: completedStatuses } }).populate('userId', 'name'),
      ProductOrder.find({
        $or: [{ workerId }, { assignedWorkerId: workerId }],
        status: { $in: completedStatuses }
      }).populate('userId', 'name')
    ]);

    // Map completed bookings & product orders into transaction objects
    const jobTxns = [
      ...completedBookings.map(b => ({
        _id: b._id,
        type: 'worker_payment',
        amount: b.vendorEarnings || b.finalAmount || 0,
        status: b.isWorkerPaid ? 'SUCCESS' : 'PENDING',
        description: `Service Payment: ${b.serviceName || 'Booking'}`,
        createdAt: b.updatedAt || b.createdAt,
        metadata: { bookingId: b._id, customerName: b.userId?.name || 'Customer' }
      })),
      ...completedProductOrders.map(p => ({
        _id: p._id,
        type: 'worker_payment',
        amount: p.financialBreakdown?.totalAmount || p.totalAmount || 0,
        status: p.isWorkerPaid ? 'SUCCESS' : 'PENDING',
        description: `Delivery Order: ${p.items?.[0]?.title || 'Parts Delivery'}`,
        createdAt: p.updatedAt || p.createdAt,
        metadata: { orderId: p._id, customerName: p.userId?.name || 'Customer' }
      }))
    ];

    // Avoid duplicate entries if a Transaction model entry already exists for a booking/order
    const existingRelatedIds = new Set(dbTransactions.map(t => String(t.bookingId || t.relatedId || t._id)));
    const uniqueJobTxns = jobTxns.filter(j => !existingRelatedIds.has(String(j._id)));

    let allTransactions = [...dbTransactions, ...uniqueJobTxns];

    if (type && type !== 'all') {
      allTransactions = allTransactions.filter(t => t.type === type);
    }

    allTransactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = allTransactions.length;
    const paginated = allTransactions.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      data: paginated,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
  }
};

const { sendPushNotification } = require('../../services/firebaseAdmin');

/**
 * Request payout from vendor for a specific booking
 */
const requestPayout = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { bookingId } = req.body;
    const worker = await Worker.findById(workerId);

    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'Booking ID is required' });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      workerId: workerId,
      status: 'completed',
      workerPaymentStatus: 'PENDING'
    }).populate('vendorId'); // Ensure vendor is populated to access tokens

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found or already paid' });
    }

    if (!booking.vendorId) {
      return res.status(400).json({ success: false, message: 'No vendor associated with this booking' });
    }

    const vendor = booking.vendorId;
    const message = `Worker ${worker.name} has requested payment for Booking #${booking.bookingNumber}.`;
    const title = '💸 Payout Request';

    // Use createNotification helper for proper notification delivery
    const { createNotification } = require('../notificationControllers/notificationController');
    await createNotification({
      vendorId: vendor._id,
      type: 'payout_requested',
      title: title,
      message: message,
      relatedId: booking._id,
      relatedType: 'booking',
      priority: 'high',
      pushData: {
        type: 'payout_requested',
        bookingId: booking._id.toString(),
        link: `/vendor/booking/${booking._id}`
      }
    });

    res.status(200).json({ success: true, message: 'Payment request sent to vendor' });

  } catch (error) {
    console.error('Request payout error:', error);
    res.status(500).json({ success: false, message: 'Failed to send payout request' });
  }
};

module.exports = {
  getWallet,
  getTransactions,
  requestPayout
};
