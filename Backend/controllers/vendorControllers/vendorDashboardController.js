const mongoose = require('mongoose');
const Booking = require('../../models/Booking');
const VendorBill = require('../../models/VendorBill');
const Worker = require('../../models/Worker');
const Service = require('../../models/UserService');
const Settings = require('../../models/Settings');
const Vendor = require('../../models/Vendor');
const { BOOKING_STATUS, PAYMENT_STATUS, WORKER_STATUS } = require('../../utils/constants');

/**
 * Get vendor dashboard stats
 */
const getDashboardStats = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const vId = new mongoose.Types.ObjectId(vendorId);

    // ── Get categories from req.user (from auth middleware) ──
    const vendorCategories = [
      ...(Array.isArray(req.user.categories) ? req.user.categories : []),
      ...(Array.isArray(req.user.service) ? req.user.service : [])
    ];

    // ─── SINGLE PARALLEL BLAST ───────────────────────────────────────────────
    const [bookingData, workersOnline, earningsResult] = await Promise.all([
      // 1. ALL BOOKING DATA (Counts + Recent List + Rating) in ONE round-trip
      Booking.aggregate([
        {
          $facet: {
            // General Stats
            counts: [
              {
                $match: {
                  $or: [
                    { vendorId: vId, status: { $ne: BOOKING_STATUS.AWAITING_PAYMENT } },
                    {
                      vendorId: null,
                      status: { $in: [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.SEARCHING] },
                      'potentialVendors.vendorId': vId
                    }
                  ]
                }
              },
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  completed: { $sum: { $cond: [{ $in: ['$status', [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.DELIVERED]] }, 1, 0] } },
                  confirmedCount: { $sum: { $cond: [{ $in: ['$status', [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.ACCEPTED]] }, 1, 0] } },
                  cancelledCount: { $sum: { $cond: [{ $in: ['$status', [BOOKING_STATUS.CANCELLED, BOOKING_STATUS.REJECTED]] }, 1, 0] } },
                  processingCount: { 
                    $sum: { 
                      $cond: [
                        { $in: ['$status', [
                          BOOKING_STATUS.REQUESTED, BOOKING_STATUS.SEARCHING, BOOKING_STATUS.PACKED,
                          BOOKING_STATUS.SHIPPED, BOOKING_STATUS.OUT_FOR_DELIVERY,
                          BOOKING_STATUS.ASSIGNED, BOOKING_STATUS.JOURNEY_STARTED, BOOKING_STATUS.VISITED, 
                          BOOKING_STATUS.IN_PROGRESS, BOOKING_STATUS.WORK_DONE, BOOKING_STATUS.PENDING,
                          'started', 'reached', 'on_the_way'
                        ]] }, 1, 0
                      ] 
                    } 
                  }
                }
              }
            ],
            // Average Rating
            rating: [
              { $match: { vendorId: vId, rating: { $ne: null } } },
              { $group: { _id: null, avg: { $avg: '$rating' } } }
            ],
            // Recent Bookings List (Optimized Projection)
            recent: [
              {
                $match: {
                  $or: [
                    { vendorId: vId, status: { $ne: BOOKING_STATUS.AWAITING_PAYMENT } },
                    {
                      vendorId: null,
                      status: { $in: [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.SEARCHING] },
                      'potentialVendors.vendorId': vId
                    }
                  ]
                }
              },
              { $sort: { createdAt: -1 } },
              { $limit: 15 },
              {
                $project: {
                  _id: 1,
                  bookingNumber: 1,
                  status: 1,
                  serviceName: 1,
                  scheduledDate: 1,
                  scheduledTime: 1,
                  finalAmount: 1,
                  vendorEarnings: 1,
                  'address.addressLine1': 1,
                  userId: 1,
                  workerId: 1,
                  rejectedWorkerId: 1,
                  workerResponse: 1,
                  serviceId: 1,
                  potentialVendors: 1,
                  serviceCategory: 1,
                  brandName: 1,
                  brandIcon: 1,
                  categoryIcon: 1,
                  createdAt: 1,
                  expiresAt: 1,
                  offeringType: 1
                }
              }
            ]
          }
        }
      ]),

      // 2. Workers online count
      Worker.countDocuments({ vendorId: vId, status: WORKER_STATUS.ONLINE }),

      // 3. Earnings (Simplified)
      VendorBill.aggregate([
        { $match: { vendorId: vId, status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$vendorTotalEarning' } } }
      ])
    ]);

    // ─── UNPACK & POPULATE ──────────────────────────────────────────────────
    const facet = bookingData[0];
    const counts = facet.counts?.[0] || { total: 0, completed: 0, inProgress: 0, pending: 0 };
    const recentBookings = facet.recent || [];
    const rating = facet.rating?.[0]?.avg || req.user.rating || 0;
    const vendorEarnings = earningsResult[0]?.total || 0;

    // Minimal population for recent bookings (Lean)
    await Booking.populate(recentBookings, [
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

    // 5. Fetch Global Settings for Timing
    const globalSettings = await Settings.findOne({ type: 'global' }).lean();

    // 6. Fetch fresh vendor data for stats
    const vendorProfile = await Vendor.findById(vendorId).select('performanceScore level commissionRate isOnline availability');

    res.status(200).json({
      success: true,
      data: {
        config: {
          maxSearchTime: globalSettings?.maxSearchTime || 5, // mins
          waveDuration: globalSettings?.waveDuration || 60  // secs
        },
        stats: {
          totalBookings: counts.total,
          completedBookings: counts.completed,
          inProgressBookings: counts.processingCount || 0,
          confirmedBookings: counts.confirmedCount || 0,
          cancelledBookings: counts.cancelledCount || 0,
          totalRevenue: vendorEarnings,
          vendorEarnings: vendorEarnings,
          rating: parseFloat(rating.toFixed(1)),
          isOnline: vendorProfile?.isOnline ?? req.user.isOnline,
          performanceScore: vendorProfile?.performanceScore || 0,
          level: vendorProfile?.level || 3,
          commissionRate: vendorProfile?.commissionRate || 15,
          commissionRates: globalSettings?.commissionRates || { level1: 10, level2: 15, level3: 20 },
          platformFeeRates: globalSettings?.platformFeeRates || { level1: 0.5, level2: 1.0, level3: 2.0 }
        },
        recentBookings
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
  }
};

/**
 * Get revenue analytics
 */
const getRevenueAnalytics = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const vId = new mongoose.Types.ObjectId(vendorId);
    const { period = 'monthly' } = req.query; // daily, weekly, monthly

    let groupFormat = '%Y-%m-%d';
    if (period === 'weekly') {
      groupFormat = '%Y-%U'; // Year-Week (U is 0-53)
    } else if (period === 'monthly') {
      groupFormat = '%Y-%m'; // Year-Month
    }

    // 1. Chart Data
    const revenueData = await VendorBill.aggregate([
      {
        $match: {
          vendorId: vId,
          status: 'paid',
          paidAt: { $ne: null }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupFormat,
              date: '$paidAt'
            }
          },
          amount: { $sum: '$vendorTotalEarning' },
          bookings: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', amount: 1, bookings: 1, _id: 0 } }
    ]);

    // 2. Totals
    const now = new Date();
    const startOfToday = new Date(now.setHours(0,0,0,0));
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [allTime, today, week, month] = await Promise.all([
      VendorBill.aggregate([{ $match: { vendorId: vId, status: 'paid' } }, { $group: { _id: null, total: { $sum: '$vendorTotalEarning' } } }]),
      VendorBill.aggregate([{ $match: { vendorId: vId, status: 'paid', paidAt: { $gte: startOfToday } } }, { $group: { _id: null, total: { $sum: '$vendorTotalEarning' } } }]),
      VendorBill.aggregate([{ $match: { vendorId: vId, status: 'paid', paidAt: { $gte: startOfWeek } } }, { $group: { _id: null, total: { $sum: '$vendorTotalEarning' } } }]),
      VendorBill.aggregate([{ $match: { vendorId: vId, status: 'paid', paidAt: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$vendorTotalEarning' } } }])
    ]);

    // 3. History
    const history = await VendorBill.find({ vendorId: vId, status: 'paid' })
      .sort({ paidAt: -1 })
      .limit(10)
      .lean();

    const mappedHistory = history.map(h => ({
      id: h._id,
      description: h.bookingId ? `Job #${h.bookingId.toString().slice(-6)}` : 'Manual Adjustment',
      type: 'earning',
      date: h.paidAt,
      amount: h.vendorTotalEarning,
      isDeduction: false
    }));

    res.status(200).json({
      success: true,
      data: {
        totals: {
          total: allTime[0]?.total || 0,
          today: today[0]?.total || 0,
          week: week[0]?.total || 0,
          month: month[0]?.total || 0
        },
        breakdown: {
          totalEarnings: allTime[0]?.total || 0,
          totalDeductions: 0,
          totalBonuses: 0
        },
        chartData: revenueData,
        history: mappedHistory
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
 * Get worker performance
 */
const getWorkerPerformance = async (req, res) => {
  try {
    const vendorId = req.user.id;

    // Get workers for this vendor
    const workers = await Worker.find({ vendorId })
      .select('name phone rating totalJobs completedJobs');

    // Get booking stats per worker
    const workerStats = await Booking.aggregate([
      {
        $match: {
          vendorId: vendorId,
          workerId: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$workerId',
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
                    { $eq: ['$paymentStatus', PAYMENT_STATUS.SUCCESS] }
                  ]
                },
                '$finalAmount',
                0
              ]
            }
          }
        }
      }
    ]);

    // Combine worker data with stats
    const performance = workers.map(worker => {
      const stats = workerStats.find(s => s._id.toString() === worker._id.toString());
      return {
        workerId: worker._id,
        name: worker.name,
        phone: worker.phone,
        rating: worker.rating || 0,
        totalJobs: stats?.totalJobs || 0,
        completedJobs: stats?.completedJobs || 0,
        totalRevenue: stats?.totalRevenue || 0,
        completionRate: stats?.totalJobs
          ? ((stats.completedJobs / stats.totalJobs) * 100).toFixed(2)
          : 0
      };
    });

    res.status(200).json({
      success: true,
      data: performance
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
 * Get service performance metrics
 */
const getServicePerformance = async (req, res) => {
  try {
    const vendorId = req.user.id;

    // Get service stats
    const serviceStats = await Booking.aggregate([
      {
        $match: {
          vendorId: vendorId
        }
      },
      {
        $group: {
          _id: '$serviceId',
          totalBookings: { $sum: 1 },
          completedBookings: {
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
                    { $eq: ['$paymentStatus', PAYMENT_STATUS.SUCCESS] }
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

    // Populate service details
    const serviceIds = serviceStats.map(s => s._id);
    const services = await Service.find({ _id: { $in: serviceIds } })
      .select('title iconUrl slug');

    const performance = serviceStats.map(stat => {
      const service = services.find(s => s._id.toString() === stat._id.toString());
      return {
        serviceId: stat._id,
        serviceName: service?.title || 'Unknown Service',
        iconUrl: service?.iconUrl,
        totalBookings: stat.totalBookings,
        completedBookings: stat.completedBookings,
        totalRevenue: stat.totalRevenue,
        averageRating: stat.averageRating ? stat.averageRating.toFixed(2) : null,
        completionRate: stat.totalBookings
          ? ((stat.completedBookings / stat.totalBookings) * 100).toFixed(2)
          : 0
      };
    });

    res.status(200).json({
      success: true,
      data: performance
    });
  } catch (error) {
    console.error('Get service performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service performance. Please try again.'
    });
  }
};

module.exports = {
  getDashboardStats,
  getRevenueAnalytics,
  getWorkerPerformance,
  getServicePerformance
};

