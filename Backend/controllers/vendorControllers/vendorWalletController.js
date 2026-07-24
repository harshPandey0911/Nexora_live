const Vendor = require('../../models/Vendor');
const Transaction = require('../../models/Transaction');
const Settlement = require('../../models/Settlement');
const Withdrawal = require('../../models/Withdrawal');
const Booking = require('../../models/Booking');
const Worker = require('../../models/Worker');
const User = require('../../models/User');
const { uploadPaymentScreenshot } = require('../../utils/cloudinaryUpload');

/**
 * Get vendor wallet with ledger balance
 * Get vendor wallet with ledger details
 * dues = Amount owed to admin
 * earnings = Amount admin owes vendor
 */
const getWallet = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const vendor = await Vendor.findById(vendorId).select('wallet name businessName');

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const dues = vendor.wallet?.dues || 0;
    const earnings = vendor.wallet?.earnings || 0;
    const totalWithdrawn = vendor.wallet?.totalWithdrawn || 0;

    // Get pending settlements count
    const pendingSettlements = await Settlement.countDocuments({
      vendorId,
      status: 'pending'
    });

    // Get total cash collected (sum of all cash_collected transactions)
    const cashCollectedResult = await Transaction.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          type: 'cash_collected',
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    // Get total settled amount
    const settledResult = await Transaction.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          type: 'settlement',
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const totalCashCollected = cashCollectedResult[0]?.total || 0;
    const totalSettled = settledResult[0]?.total || 0;

    res.status(200).json({
      success: true,
      data: {
        dues,
        earnings,
        amountDue: dues, // Clarification for frontend but 'dues' is self-explanatory
        balance: earnings - dues, // Net position for reference (optional)
        totalWithdrawn,
        totalCashCollected,
        totalSettled,
        pendingSettlements,
        cashLimit: vendor.wallet?.cashLimit || 10000,
        vendor: {
          name: vendor.name,
          businessName: vendor.businessName
        }
      }
    });
  } catch (error) {
    console.error('Get vendor wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet'
    });
  }
};

/**
 * Get vendor transactions/ledger
 */
const getTransactions = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { page = 1, limit = 50, type, status } = req.query;

    const query = { vendorId };
    if (type) query.type = type;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('bookingId', 'bookingNumber serviceName scheduledDate');

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
    console.error('Get vendor transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions'
    });
  }
};

/**
 * Record cash collection from customer
 * Uses VendorBill as the single source of truth for earnings.
 */
const recordCashCollection = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const bookingId = req.body.bookingId;
    const amount = Number(req.body.amount);
    const notes = req.body.notes;

    if (!bookingId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and valid amount are required'
      });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // Verify booking belongs to this vendor
    const booking = await Booking.findOne({
      _id: bookingId,
      vendorId
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or does not belong to this vendor'
      });
    }

    // Fetch VendorBill (single source of truth for earnings)
    const VendorBill = require('../../models/VendorBill');
    const bill = await VendorBill.findOne({ bookingId: booking._id });

    let vendorEarning = 0;
    const grandTotal = amount;

    if (bill) {
      vendorEarning = bill.vendorTotalEarning;
      bill.status = 'paid';
      bill.paidAt = new Date();
      await bill.save();
    }

    // Atomic wallet update
    const currentDues = (vendor.wallet.dues || 0) + grandTotal;
    const currentEarnings = (vendor.wallet.earnings || 0) + vendorEarning;
    const cashLimit = vendor.wallet.cashLimit || 10000;
    const netOwed = currentDues - currentEarnings;

    const updateQuery = {
      $inc: {
        'wallet.dues': grandTotal,
        'wallet.earnings': vendorEarning,
        'wallet.totalCashCollected': grandTotal
      }
    };

    if (netOwed > cashLimit) {
      updateQuery.$set = {
        'wallet.isBlocked': true,
        'wallet.blockedAt': new Date(),
        'wallet.blockReason': `Cash limit exceeded. Net owed: ₹${netOwed.toFixed(2)}, Limit: ₹${cashLimit}`
      };

      // Notify admins
      try {
        const { createNotification } = require('../notificationControllers/notificationController');
        const Admin = require('../../models/Admin');

        const admins = await Admin.find({ isActive: true }).select('_id');

        for (const admin of admins) {
          await createNotification({
            adminId: admin._id,
            type: 'vendor_cash_limit_exceeded',
            title: '⚠️ Cash Limit Exceeded',
            message: `${vendor.businessName || vendor.name} exceeded cash limit! Net owed: ₹${netOwed.toFixed(2)}, Limit: ₹${cashLimit}`,
            relatedId: vendor._id,
            relatedType: 'vendor',
            data: {
              vendorId: vendor._id,
              vendorName: vendor.businessName || vendor.name,
              netOwed,
              cashLimit
            },
            pushData: {
              type: 'admin_alert',
              link: '/admin/settlements'
            }
          });
        }
        console.log(`[CashLimit] Notified ${admins.length} admins: ${vendor.name} exceeded limit`);
      } catch (notifyErr) {
        console.error('[CashLimit] Failed to notify admins:', notifyErr);
      }
    }

    await Vendor.findByIdAndUpdate(vendorId, updateQuery);
    
    // Update booking status
    booking.status = 'completed';
    booking.paymentStatus = 'collected by vendor';
    booking.paymentMethod = 'cash collected';
    booking.completedAt = new Date();
    await booking.save();

    // Create transaction record for Cash Collection
    const transaction = await Transaction.create({
      vendorId,
      bookingId,
      type: 'cash_collected',
      amount: grandTotal,
      status: 'completed',
      paymentMethod: 'cash collected',
      description: `Cash ₹${grandTotal} collected. Dues increased.`,
      metadata: {
        notes,
        type: 'dues_increase',
        billId: bill?._id?.toString(),
        vendorEarning,
        companyRevenue: bill?.companyRevenue
      }
    });

    // Create earnings credit transaction
    if (vendorEarning > 0) {
      await Transaction.create({
        vendorId,
        bookingId,
        type: 'earnings_credit',
        amount: vendorEarning,
        status: 'completed',
        paymentMethod: 'system',
        description: `Earnings ₹${vendorEarning} credited for booking #${booking.bookingNumber}`,
        metadata: {
          type: 'earnings_increase',
          billId: bill?._id?.toString(),
          serviceEarning: bill?.vendorServiceEarning,
          partsEarning: bill?.vendorPartsEarning
        }
      });
    }

    // Update booking payment status
    booking.paymentStatus = 'paid';
    booking.paymentMethod = 'cash';
    await booking.save();

    const newDues = currentDues;
    const newEarnings = currentEarnings;
    const newBalance = newEarnings - newDues;

    res.status(200).json({
      success: true,
      message: 'Cash collection recorded successfully',
      data: {
        transaction,
        newBalance,
        amountDue: newDues
      }
    });
  } catch (error) {
    console.error('Record cash collection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record cash collection'
    });
  }
};

/**
 * Request settlement (vendor pays admin to clear negative balance)
 */
const requestSettlement = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { amount, paymentMethod, paymentReference, paymentProof, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const currentDues = vendor.wallet?.dues || 0;

    if (amount > currentDues) {
      return res.status(400).json({
        success: false,
        message: `Settlement amount (₹${amount}) cannot exceed current dues (₹${currentDues})`
      });
    }

    // Check for existing pending settlement
    const existingPending = await Settlement.findOne({
      vendorId,
      status: 'pending'
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending settlement request. Please wait for it to be processed.'
      });
    }

    // Create settlement request
    const settlement = await Settlement.create({
      vendorId,
      amount,
      balanceBefore: currentDues,
      balanceAfter: currentDues - amount, // Dues will decrease
      paymentMethod: paymentMethod || 'upi',
      paymentReference,
      paymentProof,
      vendorNotes: notes,
      status: 'pending'
    });

    // 🔔 NOTIFY ALL ADMINS about settlement request
    try {
      const { createNotification } = require('../notificationControllers/notificationController');
      const Admin = require('../../models/Admin');

      const admins = await Admin.find({ isActive: true }).select('_id');

      for (const admin of admins) {
        await createNotification({
          adminId: admin._id,
          type: 'vendor_settlement_request',
          title: '💰 Settlement Request',
          message: `${vendor.businessName || vendor.name} submitted settlement of ₹${amount}`,
          relatedId: settlement._id,
          relatedType: 'settlement',
          data: {
            vendorId: vendor._id,
            vendorName: vendor.businessName || vendor.name,
            amount,
            settlementId: settlement._id
          },
          pushData: {
            type: 'admin_alert',
            link: '/admin/settlements'
          }
        });
      }
      console.log(`[Settlement] Notified ${admins.length} admins about settlement request from ${vendor.name}`);
    } catch (notifyErr) {
      console.error('[Settlement] Failed to notify admins:', notifyErr);
    }

    res.status(200).json({
      success: true,
      message: 'Settlement request submitted successfully. Pending admin approval.',
      data: settlement
    });
  } catch (error) {
    console.error('Request settlement error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit settlement request'
    });
  }
};

/**
 * Request Withdrawal (Vendor requests payout of earnings)
 */
const requestWithdrawal = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { amount, bankDetails, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    if (!bankDetails) {
      return res.status(400).json({ success: false, message: 'Bank details are required for withdrawal' });
    }

    const { accountHolderName, bankName, accountNumber, ifscCode } = bankDetails;

    if (!accountHolderName || accountHolderName.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Account Holder Name must be at least 3 characters long' });
    }

    if (!bankName || bankName.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Valid Bank Name is required' });
    }

    const cleanAccNo = String(accountNumber || '').replace(/[^0-9]/g, '');
    if (!cleanAccNo || cleanAccNo.length < 9 || cleanAccNo.length > 18) {
      return res.status(400).json({ success: false, message: 'Bank Account Number must be between 9 and 18 numeric digits' });
    }

    const cleanIfsc = String(ifscCode || '').toUpperCase().trim();
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(cleanIfsc)) {
      return res.status(400).json({ success: false, message: 'Invalid IFSC Code format (e.g. SBIN0001234)' });
    }

    // Format sanitized bank details
    const sanitizedBankDetails = {
      accountHolderName: accountHolderName.trim(),
      bankName: bankName.trim(),
      accountNumber: cleanAccNo,
      ifscCode: cleanIfsc,
      upiId: bankDetails.upiId ? bankDetails.upiId.trim() : ''
    };

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const currentEarnings = vendor.wallet?.earnings || 0;

    // Check pending withdrawals?
    const pendingWithdrawals = await Withdrawal.aggregate([
      { $match: { vendorId: vendor._id, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const pendingAmount = pendingWithdrawals[0]?.total || 0;
    const availableEarnings = currentEarnings - pendingAmount;

    if (amount > availableEarnings) {
      return res.status(400).json({
        success: false,
        message: `Insufficient earnings. Available: ₹${availableEarnings} (Pending: ₹${pendingAmount})`
      });
    }

    const withdrawal = await Withdrawal.create({
      vendorId,
      amount,
      bankDetails: sanitizedBankDetails,
      adminNotes: notes,
      status: 'pending'
    });

    // 🔔 NOTIFY ALL ADMINS about withdrawal request
    try {
      const { createNotification } = require('../notificationControllers/notificationController');
      const Admin = require('../../models/Admin');

      const admins = await Admin.find({ isActive: true }).select('_id');

      for (const admin of admins) {
        await createNotification({
          adminId: admin._id,
          type: 'vendor_withdrawal_request',
          title: '💸 Withdrawal Request',
          message: `${vendor.businessName || vendor.name} requested withdrawal of ₹${amount}`,
          relatedId: withdrawal._id,
          relatedType: 'withdrawal',
          data: {
            vendorId: vendor._id,
            vendorName: vendor.businessName || vendor.name,
            amount,
            withdrawalId: withdrawal._id
          },
          pushData: {
            type: 'admin_alert',
            link: '/admin/settlements'
          }
        });
      }
      console.log(`[Withdrawal] Notified ${admins.length} admins about withdrawal request from ${vendor.name}`);
    } catch (notifyErr) {
      console.error('[Withdrawal] Failed to notify admins:', notifyErr);
    }

    res.status(200).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: withdrawal
    });

  } catch (error) {
    console.error('Request withdrawal error:', error);
    res.status(500).json({ success: false, message: 'Failed to request withdrawal' });
  }
};

/**
 * Get vendor's settlement history
 */
const getSettlements = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    const query = { vendorId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const settlements = await Settlement.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Settlement.countDocuments(query);

    res.status(200).json({
      success: true,
      data: settlements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get settlements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settlements'
    });
  }
};

/**
 * Get wallet summary for dashboard
 */
const getWalletSummary = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const vendor = await Vendor.findById(vendorId).select('wallet');

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const balance = vendor.wallet?.balance || 0;

    // Get today's cash collections
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCollections = await Transaction.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          type: 'cash_collected',
          createdAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get this week's collections
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const weekCollections = await Transaction.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          type: 'cash_collected',
          createdAt: { $gte: weekStart }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        dues: vendor.wallet?.dues || 0,
        earnings: vendor.wallet?.earnings || 0,
        amountDue: vendor.wallet?.dues || 0,
        today: {
          amount: todayCollections[0]?.total || 0,
          count: todayCollections[0]?.count || 0
        },
        thisWeek: {
          amount: weekCollections[0]?.total || 0,
          count: weekCollections[0]?.count || 0
        }
      }
    });
  } catch (error) {
    console.error('Get wallet summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet summary'
    });
  }
};

/**
 * Pay worker for a booking
 */
const payWorker = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { bookingId, amount, notes, transactionId, screenshot, paymentMethod = 'cash' } = req.body;

    if (!bookingId || !amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid booking ID and amount are required'
      });
    }

    const booking = await Booking.findOne({ _id: bookingId, vendorId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not authorized'
      });
    }

    if (!booking.workerId) {
      return res.status(400).json({
        success: false,
        message: 'No worker assigned to this booking'
      });
    }

    if (booking.workerPaymentStatus === 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'Worker already paid for this booking'
      });
    }

    const worker = await Worker.findById(booking.workerId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Upload screenshot to Cloudinary if provided
    let screenshotUrl = null;
    if (screenshot) {
      try {
        // Check if screenshot is base64
        if (screenshot.startsWith('data:image')) {
          screenshotUrl = await uploadPaymentScreenshot(screenshot, bookingId);
          console.log('Payment screenshot uploaded to Cloudinary:', screenshotUrl);
        } else {
          // If already a URL, use it as is
          screenshotUrl = screenshot;
        }
      } catch (uploadError) {
        console.error('Failed to upload payment screenshot:', uploadError);
        // Continue without screenshot rather than failing the entire payment
        screenshotUrl = null;
      }
    }

    // Record Transaction
    const transaction = new Transaction({
      vendorId,
      workerId: worker._id,
      bookingId: booking._id,
      type: 'worker_payment',
      amount: parseFloat(amount),
      status: 'completed',
      paymentMethod: paymentMethod || 'cash',
      description: `Payment for booking #${booking.bookingNumber}. ${notes || ''}`,
      referenceId: transactionId || null,
      metadata: {
        notes,
        transactionId,
        screenshot: screenshotUrl, // Store Cloudinary URL instead of base64
        paymentMethod
      }
    });

    // Update Worker balance (optional - depends on if we track worker earnings in wallet)
    if (!worker.wallet) worker.wallet = { balance: 0 };
    worker.wallet.balance += parseFloat(amount);

    // Update Booking
    booking.workerPaymentStatus = 'PAID';
    booking.isWorkerPaid = true;
    booking.workerPaidAt = new Date();
    booking.status = 'completed'; // Job is fully done and paid
    booking.completedAt = booking.completedAt || new Date();

    await Promise.all([
      transaction.save(),
      worker.save(),
      booking.save()
    ]);

    // Notify worker about payment
    const { createNotification } = require('../notificationControllers/notificationController');
    await createNotification({
      workerId: worker._id,
      type: 'payment_received',
      title: '💰 Payment Received',
      message: `You received ₹${amount.toLocaleString()} from ${booking.vendorId?.businessName || 'vendor'} for booking #${booking.bookingNumber}`,
      relatedId: booking._id,
      relatedType: 'booking',
      priority: 'high',
      pushData: {
        type: 'payment_received',
        bookingId: booking._id.toString(),
        amount: parseFloat(amount),
        link: `/worker/wallet`
      }
    });

    res.status(200).json({
      success: true,
      message: `Payment of ₹${amount} recorded for ${worker.name}`,
      data: {
        bookingId: booking._id,
        workerName: worker.name,
        amount: parseFloat(amount),
        screenshotUploaded: !!screenshotUrl
      }
    });
  } catch (error) {
    console.error('Pay worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment'
    });
  }
};

/**
 * Get vendor's withdrawal history
 */
const getWithdrawals = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    const query = { vendorId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const withdrawals = await Withdrawal.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Withdrawal.countDocuments(query);

    res.status(200).json({
      success: true,
      data: withdrawals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get withdrawals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch withdrawals'
    });
  }
};

/**
 * Get comprehensive earnings analytics (Charts & Breakdowns)
 */
const getEarningsAnalytics = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const vendorId = new mongoose.Types.ObjectId(req.user.id);
    const { period = 'monthly', filter = 'all' } = req.query; // period for chart grouping

    // Time ranges
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    
    const monthStart = new Date(now);
    monthStart.setMonth(now.getMonth() - 1);
    monthStart.setHours(0, 0, 0, 0);

    // Earning Types
    const earningTypes = ['credit', 'commission', 'earnings_credit'];
    const deductionTypes = ['debit', 'penalty', 'tds_deduction', 'platform_fee', 'convenience_fee'];
    const bonusTypes = ['bonus']; // If you introduce a 'bonus' type later

    // 1. Get Totals (Today, Week, Month, All-Time)
    // We will aggregate all 'earning' transactions
    const totalsAggregation = await Transaction.aggregate([
      {
        $match: {
          vendorId: vendorId,
          type: { $in: earningTypes },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          today: {
            $sum: { $cond: [{ $gte: ['$createdAt', todayStart] }, '$amount', 0] }
          },
          week: {
            $sum: { $cond: [{ $gte: ['$createdAt', weekStart] }, '$amount', 0] }
          },
          month: {
            $sum: { $cond: [{ $gte: ['$createdAt', monthStart] }, '$amount', 0] }
          }
        }
      }
    ]);

    const totals = totalsAggregation[0] || { total: 0, today: 0, week: 0, month: 0 };

    // 2. Get Breakdowns (Bonuses, Deductions, Commissions)
    let dateFilter = {};
    if (filter === 'today') dateFilter = { $gte: todayStart };
    else if (filter === 'week') dateFilter = { $gte: weekStart };
    else if (filter === 'month') dateFilter = { $gte: monthStart };

    const breakdownMatch = {
      vendorId: vendorId,
      status: 'completed'
    };
    if (filter !== 'all') {
      breakdownMatch.createdAt = dateFilter;
    }

    const breakdownsAggregation = await Transaction.aggregate([
      { $match: breakdownMatch },
      {
        $group: {
          _id: null,
          totalEarnings: {
            $sum: { $cond: [{ $in: ['$type', earningTypes] }, '$amount', 0] }
          },
          totalDeductions: {
            $sum: { $cond: [{ $in: ['$type', deductionTypes] }, '$amount', 0] }
          },
          totalBonuses: {
            // For now, assume any 'credit' with 'bonus' in description is a bonus
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$type', 'credit'] },
                    { $regexMatch: { input: { $toLower: '$description' }, regex: 'bonus' } }
                  ]
                },
                '$amount',
                0
              ]
            }
          }
        }
      }
    ]);

    const breakdown = breakdownsAggregation[0] || { totalEarnings: 0, totalDeductions: 0, totalBonuses: 0 };

    // 3. Get Chart Data
    let groupFormat = '%Y-%m-%d'; // default daily
    if (period === 'weekly') groupFormat = '%Y-%W';
    else if (period === 'monthly') groupFormat = '%Y-%m';

    const chartData = await Transaction.aggregate([
      {
        $match: {
          vendorId: vendorId,
          type: { $in: earningTypes },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: groupFormat, date: '$createdAt' }
          },
          amount: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 30 } // Limit to last 30 points
    ]);

    // 4. Recent History (Combined Earnings & Deductions)
    const history = await Transaction.find(breakdownMatch)
      .sort({ createdAt: -1 })
      .limit(20)
      .select('type amount description createdAt status');

    res.status(200).json({
      success: true,
      data: {
        totals,
        breakdown,
        chartData: chartData.map(d => ({ date: d._id, amount: d.amount })),
        history: history.map(h => ({
          id: h._id,
          type: h.type,
          amount: h.amount,
          description: h.description,
          date: h.createdAt,
          isDeduction: deductionTypes.includes(h.type)
        }))
      }
    });

  } catch (error) {
    console.error('Get earnings analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch earnings analytics'
    });
  }
};

module.exports = {
  getWallet,
  getTransactions,
  recordCashCollection,
  requestSettlement,
  getSettlements,
  getWalletSummary,
  payWorker,
  requestWithdrawal,
  getWithdrawals,
  getEarningsAnalytics
};
