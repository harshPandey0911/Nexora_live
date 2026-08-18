const User = require('../../models/User');
const Vendor = require('../../models/Vendor');
const Worker = require('../../models/Worker');
const Booking = require('../../models/Booking');
const Withdrawal = require('../../models/Withdrawal');
const Settlement = require('../../models/Settlement');
const Scrap = require('../../models/Scrap');
const { BOOKING_STATUS, PAYMENT_STATUS, VENDOR_STATUS } = require('../../utils/constants');

/**
 * Get overall dashboard stats
 */
const getDashboardStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = end;
      }
    }

    // Revenue date filter
    const revenueDateFilter = {};
    if (startDate || endDate) {
      revenueDateFilter.createdAt = {};
      if (startDate) revenueDateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        revenueDateFilter.createdAt.$lte = end;
      }
    }

    // Execute all dashboard queries concurrently using Promise.all for high performance
    const [
      totalUsers,
      totalVendors,
      totalWorkers,
      totalBookings,
      pendingBookings,
      completedBookings,
      cancelledBookings,
      revenueResult,
      pendingVendors,
      approvedVendors,
      pendingWorkers,
      pendingWithdrawals,
      pendingSettlementsCount,
      pendingScraps,
      manualAssignmentBookings,
      recentActivityDocs
    ] = await Promise.all([
      User.countDocuments(dateFilter),
      Vendor.countDocuments(dateFilter),
      Worker.countDocuments(dateFilter),
      Booking.countDocuments(dateFilter),
      Booking.countDocuments({
        ...dateFilter,
        status: { $nin: ['completed', 'COMPLETED', 'cancelled', 'CANCELLED'] }
      }),
      Booking.countDocuments({
        ...dateFilter,
        status: { $in: ['completed', 'COMPLETED', 'work_done', 'WORK_DONE'] }
      }),
      Booking.countDocuments({
        ...dateFilter,
        status: { $in: ['cancelled', 'CANCELLED'] }
      }),
      Booking.aggregate([
        {
          $match: {
            status: { $in: ['completed', 'COMPLETED', 'work_done', 'WORK_DONE'] },
            ...revenueDateFilter
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $ifNull: ['$finalAmount', '$basePrice'] } },
            totalBookings: { $sum: 1 }
          }
        }
      ]),
      Vendor.countDocuments({ approvalStatus: VENDOR_STATUS.PENDING }),
      Vendor.countDocuments({ approvalStatus: VENDOR_STATUS.APPROVED }),
      Worker.countDocuments({ approvalStatus: 'pending' }),
      Withdrawal.countDocuments({ status: 'pending' }),
      Settlement.countDocuments({ status: 'pending' }),
      Scrap.countDocuments({ status: 'pending' }),
      // Count bookings that need manual vendor assignment (escalated)
      Booking.countDocuments({
        status: { $in: ['escalated', 'ESCALATED', 'vendor_declined', 'VENDOR_DECLINED'] }
      }),
      Booking.find(dateFilter)
        .populate('userId', 'name phone')
        .populate('vendorId', 'name businessName')
        .populate('serviceId', 'title')
        .sort({ createdAt: -1 })
        .limit(20)
    ]);

    const revenue = (revenueResult && revenueResult.length > 0)
      ? revenueResult[0]
      : { totalRevenue: 0, totalBookings: 0 };

    const platformCommission = Math.round((revenue.totalRevenue || 0) * 0.10);

    const recentBookings = (recentActivityDocs || []).map(b => ({
      id: b.bookingNumber || b._id,
      _id: b._id,
      status: b.status,
      user: { name: b.userId?.name || 'Customer' },
      serviceType: b.serviceId?.title || b.serviceName,
      price: b.finalAmount || b.basePrice || 0,
      createdAt: b.createdAt,
      acceptedAt: b.acceptedAt,
      assignedAt: b.assignedAt,
      visitedAt: b.visitedAt,
      completedAt: b.completedAt,
      workerPaymentStatus: b.workerPaymentStatus
    }));

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalVendors,
          totalWorkers,
          totalBookings,
          pendingBookings,
          completedBookings,
          cancelledBookings,
          totalRevenue: revenue.totalRevenue || 0,
          platformCommission,
          pendingVendors,
          approvedVendors,
          pendingWorkers,
          pendingWithdrawals,
          pendingSettlements: pendingSettlementsCount,
          pendingScraps,
          manualAssignmentBookings
        },
        recentBookings
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats. Please try again.'
    });
  }
};

/**
 * Get revenue analytics
 */
const getRevenueAnalytics = async (req, res) => {
  try {
    const { period = 'monthly', startDate, endDate } = req.query;

    let groupFormat = '%Y-%m';
    if (period === 'daily') {
      groupFormat = '%Y-%m-%d';
    } else if (period === 'weekly') {
      groupFormat = '%Y-%W';
    }

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.completedAt = {};
      if (startDate) dateFilter.completedAt.$gte = new Date(startDate);
      if (endDate) dateFilter.completedAt.$lte = new Date(endDate);
    }

    // Revenue analytics
    const revenueData = await Booking.aggregate([
      {
        $match: {
          status: { $in: ['completed', 'COMPLETED', 'work_done', 'WORK_DONE'] }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupFormat,
              date: { $ifNull: ['$completedAt', '$createdAt'] }
            }
          },
          revenue: { $sum: { $ifNull: ['$finalAmount', '$basePrice'] } },
          bookings: { $sum: 1 },
          platformCommission: { $sum: { $multiply: [{ $ifNull: ['$finalAmount', '$basePrice'] }, 0.10] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        period,
        revenueData
      }
    });
  } catch (error) {
    console.error('Get revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue analytics. Please try again.'
    });
  }
};

/**
 * Get booking trends
 */
const getBookingTrends = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Daily booking trends
    const trends = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', BOOKING_STATUS.COMPLETED] }, 1, 0]
            }
          },
          cancelled: {
            $sum: {
              $cond: [{ $eq: ['$status', BOOKING_STATUS.CANCELLED] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        days: parseInt(days),
        trends
      }
    });
  } catch (error) {
    console.error('Get booking trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking trends. Please try again.'
    });
  }
};

/**
 * Get user growth metrics
 */
const getUserGrowthMetrics = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // User growth
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Vendor growth
    const vendorGrowth = await Vendor.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        days: parseInt(days),
        userGrowth,
        vendorGrowth
      }
    });
  } catch (error) {
    console.error('Get user growth metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user growth metrics. Please try again.'
    });
  }
};

module.exports = {
  getDashboardStats,
  getRevenueAnalytics,
  getBookingTrends,
  getUserGrowthMetrics
};

