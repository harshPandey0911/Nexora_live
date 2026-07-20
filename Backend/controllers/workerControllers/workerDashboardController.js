const Booking = require('../../models/Booking');
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

    // 2. Calculate Total Earnings
    const earningStats = await Booking.aggregate([
      {
        $match: {
          workerId: worker._id,
          status: { $in: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.WORK_DONE] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$vendorEarnings", "$finalAmount"] } }
        }
      }
    ]);

    const totalEarnings = earningStats.length > 0 ? earningStats[0].total : 0;

    // 3. Count Pending / Assigned Jobs
    const pendingJobsCount = await Booking.countDocuments({
      workerId: worker._id,
      status: {
        $in: [
          BOOKING_STATUS.ASSIGNED,
          BOOKING_STATUS.PENDING,
          'REQUESTED'
        ]
      }
    });

    // 4. Count Active / In Progress Jobs
    const activeJobsCount = await Booking.countDocuments({
      workerId: worker._id,
      status: {
        $in: [
          BOOKING_STATUS.ACCEPTED,
          BOOKING_STATUS.CONFIRMED,
          BOOKING_STATUS.VISITED,
          BOOKING_STATUS.IN_PROGRESS,
          'JOURNEY_STARTED'
        ]
      }
    });

    // 5. Count Completed Jobs
    const completedJobsCount = await Booking.countDocuments({
      workerId: worker._id,
      status: { $in: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.WORK_DONE] }
    });

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
      : (typeof worker.rating === 'number' ? worker.rating : 0);

    const totalReviews = reviewStats.length > 0 ? reviewStats[0].totalReviews : (worker.totalRatings || 0);

    // Fetch recent reviews
    const workerReviews = await Review.find({ workerId: worker._id, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'name profilePhoto');

    // 7. Get Recent Jobs
    const recentJobs = await Booking.find({ workerId: worker._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'name phone')
      .populate('serviceId', 'title categoryName');

    res.status(200).json({
      success: true,
      data: {
        totalEarnings,
        pendingJobs: pendingJobsCount,
        activeJobs: activeJobsCount,
        completedJobs: completedJobsCount,
        rating: averageRating,
        totalReviews,
        reviewsList: workerReviews,
        recentJobs
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
