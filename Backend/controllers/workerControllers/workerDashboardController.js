const Booking = require('../../models/Booking');
const ProductOrder = require('../../models/ProductOrder');
const Worker = require('../../models/Worker');
const Review = require('../../models/Review');
const { BOOKING_STATUS } = require('../../utils/constants');

/**
 * Get worker dashboard statistics
 */
const getDashboardStats = async (req, res) => {
  try {
    const workerId = req.user.id;

    // 1. Get Worker Profile
    const worker = await Worker.findById(workerId);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    const completedStatuses = [
      'completed', 'COMPLETED',
      'work_done', 'WORK_DONE',
      'delivered', 'DELIVERED',
      'delivered_by_worker', 'DELIVERED_BY_WORKER',
      'paid', 'PAID',
      'worker_paid', 'WORKER_PAID'
    ];

    const pendingStatuses = [
      'assigned', 'ASSIGNED',
      'pending', 'PENDING',
      'requested', 'REQUESTED',
      'placed', 'PLACED',
      'preparing', 'PREPARING'
    ];

    const activeStatuses = [
      'accepted', 'ACCEPTED',
      'confirmed', 'CONFIRMED',
      'visited', 'VISITED',
      'in_progress', 'IN_PROGRESS',
      'journey_started', 'JOURNEY_STARTED',
      'on_the_way', 'ON_THE_WAY',
      'out_for_delivery', 'OUT_FOR_DELIVERY',
      'delivering', 'DELIVERING',
      'started', 'STARTED'
    ];

    // 2. Calculate Total Earnings (Bookings + Product Orders)
    const [bookingEarnings, productEarnings] = await Promise.all([
      Booking.aggregate([
        {
          $match: {
            workerId: worker._id,
            status: { $in: completedStatuses }
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
            status: { $in: completedStatuses }
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

    const totalEarnings = (bookingEarnings[0]?.total || 0) + (productEarnings[0]?.total || 0);

    // 3. Count Pending / Assigned Jobs
    const [pendingBookingsCount, pendingProductOrdersCount] = await Promise.all([
      Booking.countDocuments({
        workerId: worker._id,
        status: { $in: pendingStatuses }
      }),
      ProductOrder.countDocuments({
        $or: [{ workerId: worker._id }, { assignedWorkerId: worker._id }],
        status: { $in: pendingStatuses }
      })
    ]);
    const pendingJobsCount = pendingBookingsCount + pendingProductOrdersCount;

    // 4. Count Active / In Progress Jobs
    const [activeBookingsCount, activeProductOrdersCount] = await Promise.all([
      Booking.countDocuments({
        workerId: worker._id,
        status: { $in: activeStatuses }
      }),
      ProductOrder.countDocuments({
        $or: [{ workerId: worker._id }, { assignedWorkerId: worker._id }],
        status: { $in: activeStatuses }
      })
    ]);
    const activeJobsCount = activeBookingsCount + activeProductOrdersCount;

    // 5. Count Completed Jobs
    const [completedBookingsCount, completedProductOrdersCount] = await Promise.all([
      Booking.countDocuments({
        workerId: worker._id,
        status: { $in: completedStatuses }
      }),
      ProductOrder.countDocuments({
        $or: [{ workerId: worker._id }, { assignedWorkerId: worker._id }],
        status: { $in: completedStatuses }
      })
    ]);
    const completedJobsCount = completedBookingsCount + completedProductOrdersCount;

    // 6. Calculate Average Rating dynamically from Review model
    const reviewStats = await Review.aggregate([
      {
        $match: {
          workerId: worker._id,
          status: 'active'
        }
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    const averageRating = (reviewStats.length > 0 && typeof reviewStats[0].avgRating === 'number')
      ? parseFloat(reviewStats[0].avgRating.toFixed(1))
      : (typeof worker.rating === 'number' && worker.rating > 0 ? worker.rating : 5.0);

    const totalReviews = reviewStats.length > 0 ? reviewStats[0].totalReviews : (worker.totalRatings || 0);

    // Fetch recent reviews
    const workerReviews = await Review.find({ workerId: worker._id, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'name profilePhoto');

    // 7. Get Recent Jobs (Bookings + Product Orders)
    const [recentBookingsDocs, recentProductOrdersDocs] = await Promise.all([
      Booking.find({ workerId: worker._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('userId', 'name phone')
        .populate('serviceId', 'title categoryName'),
      ProductOrder.find({ $or: [{ workerId: worker._id }, { assignedWorkerId: worker._id }] })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('userId', 'name phone')
    ]);

    const formattedBookings = recentBookingsDocs.map(b => ({
      ...b.toObject(),
      isProductOrder: false
    }));

    const formattedProductOrders = recentProductOrdersDocs.map(p => ({
      ...p.toObject(),
      isProductOrder: true,
      serviceName: p.items?.map(i => i.title || i.name).join(', ') || 'Parts Delivery',
      finalAmount: p.financialBreakdown?.totalAmount || p.totalAmount || 0,
      address: p.deliveryAddress
    }));

    const recentJobs = [...formattedBookings, ...formattedProductOrders]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 100);

    // Calculate active physical cash collected on field pending handover to vendor
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
            total: { $sum: { $ifNull: ["$financialBreakdown.totalAmount", "$totalAmount"] } }
          }
        }
      ])
    ]);

    const salaryOwed = worker.wallet?.balance || 0;

    res.status(200).json({
      success: true,
      data: {
        totalEarnings,
        receivedSalary: salaryOwed,
        salaryOwed,
        cashCollectedOnField,
        pendingJobs: pendingJobsCount,
        activeJobs: activeJobsCount,
        completedJobs: completedJobsCount,
        rating: averageRating,
        totalReviews,
        reviewsList: workerReviews
      }
    });
  } catch (error) {
    console.error('Get worker dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
};

/**
 * Get Paginated Worker Reviews & Rating Distribution
 */
const getWorkerReviews = async (req, res) => {
  try {
    const workerId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 6;
    const ratingFilter = req.query.rating;
    const skip = (page - 1) * limit;

    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Build filter query
    const matchQuery = {
      workerId: worker._id,
      status: 'active'
    };

    if (ratingFilter && ratingFilter !== 'ALL') {
      const targetStar = parseInt(ratingFilter, 10);
      if (!isNaN(targetStar)) {
        matchQuery.rating = targetStar;
      }
    }

    // 1. Overall stats & counts breakdown
    const allWorkerReviews = await Review.find({ workerId: worker._id, status: 'active' });
    const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sumRating = 0;

    allWorkerReviews.forEach(r => {
      const star = Math.round(r.rating || 5);
      if (ratingCounts[star] !== undefined) ratingCounts[star]++;
      sumRating += (r.rating || 0);
    });

    const totalReviews = allWorkerReviews.length;
    const avgRating = totalReviews > 0 ? parseFloat((sumRating / totalReviews).toFixed(1)) : (worker.rating || 0);

    // 2. Fetch Paginated Reviews
    const reviews = await Review.find(matchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name profilePhoto')
      .populate('serviceId', 'title categoryName');

    const totalFilteredCount = await Review.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalFilteredCount / limit) || 1;

    res.status(200).json({
      success: true,
      data: {
        reviews,
        stats: {
          avgRating,
          totalReviews,
          ratingCounts
        },
        pagination: {
          currentPage: page,
          totalPages,
          totalFilteredCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit
        }
      }
    });

  } catch (error) {
    console.error('Get worker reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews'
    });
  }
};

module.exports = {
  getDashboardStats,
  getWorkerReviews
};
