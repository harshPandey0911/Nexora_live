const Settings = require('../../models/Settings');
const Vendor = require('../../models/Vendor');

// Get Global Settings
exports.getSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne({ type: 'global' });

    // If no settings exist yet, create default
    if (!settings) {
      settings = await Settings.create({ type: 'global' });
    }

    res.status(200).json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings'
    });
  }
};

// Update Global Settings
exports.updateSettings = async (req, res, next) => {
  try {
    const {
      visitedCharges,
      productDeliveryCharge,
      serviceGstPercentage,
      partsGstPercentage,
      servicePayoutPercentage,
      partsPayoutPercentage,
      tdsPercentage,
      platformFeePercentage,
      vendorCashLimit, // Add this
      cancellationPenalty,
      razorpayKeyId,
      razorpayKeySecret,
      razorpayWebhookSecret,
      cloudinaryCloudName,
      cloudinaryApiKey,
      cloudinaryApiSecret,
      // Billing Settings
      companyName, companyGSTIN, companyPAN, companyAddress, companyCity, companyState, companyPincode, companyPhone, companyEmail, invoicePrefix, sacCode,
      // Support Settings
      supportEmail, supportPhone, supportWhatsapp,
      // Booking Timing
      maxSearchTime, waveDuration, searchRadius, maxCartItemQuantity,
      // Payment Control
      isOnlinePaymentEnabled,
      // Commission & Platform Fees
      commissionRates, platformFeeRates,
      // Slots Config
      slotConfig,
      // Configurable Policies
      termsAndConditions, privacyPolicy,
      workerTermsAndConditions, workerPrivacyPolicy,
      vendorTermsAndConditions, vendorPrivacyPolicy,
      // Admin Receiving Account Details
      adminUpiId, adminAccountName, adminBankName, adminAccountNumber, adminIfscCode
    } = req.body;

    let settings = await Settings.findOne({ type: 'global' });

    if (!settings) {
      settings = new Settings({ type: 'global' });
    }

    // Update fields if provided
    if (visitedCharges !== undefined) settings.visitedCharges = visitedCharges;
    if (productDeliveryCharge !== undefined) settings.productDeliveryCharge = productDeliveryCharge;
    if (serviceGstPercentage !== undefined) settings.serviceGstPercentage = serviceGstPercentage;
    if (partsGstPercentage !== undefined) settings.partsGstPercentage = partsGstPercentage;
    if (servicePayoutPercentage !== undefined) settings.servicePayoutPercentage = servicePayoutPercentage;
    if (partsPayoutPercentage !== undefined) settings.partsPayoutPercentage = partsPayoutPercentage;
    if (tdsPercentage !== undefined) settings.tdsPercentage = tdsPercentage;
    if (platformFeePercentage !== undefined) settings.platformFeePercentage = platformFeePercentage;
    if (vendorCashLimit !== undefined) settings.vendorCashLimit = vendorCashLimit;
    if (cancellationPenalty !== undefined) settings.cancellationPenalty = cancellationPenalty;
    if (razorpayKeyId !== undefined) settings.razorpayKeyId = razorpayKeyId;
    if (razorpayKeySecret !== undefined) settings.razorpayKeySecret = razorpayKeySecret;
    if (razorpayWebhookSecret !== undefined) settings.razorpayWebhookSecret = razorpayWebhookSecret;
    if (cloudinaryCloudName !== undefined) settings.cloudinaryCloudName = cloudinaryCloudName;
    if (cloudinaryApiKey !== undefined) settings.cloudinaryApiKey = cloudinaryApiKey;
    if (cloudinaryApiSecret !== undefined) settings.cloudinaryApiSecret = cloudinaryApiSecret;

    // Admin Receiving Account Details
    if (adminUpiId !== undefined) settings.adminUpiId = adminUpiId;
    if (adminAccountName !== undefined) settings.adminAccountName = adminAccountName;
    if (adminBankName !== undefined) settings.adminBankName = adminBankName;
    if (adminAccountNumber !== undefined) settings.adminAccountNumber = adminAccountNumber;
    if (adminIfscCode !== undefined) settings.adminIfscCode = adminIfscCode;

    // Billing update
    if (companyName !== undefined) settings.companyName = companyName;
    if (companyGSTIN !== undefined) settings.companyGSTIN = companyGSTIN;
    if (companyPAN !== undefined) settings.companyPAN = companyPAN;
    if (companyAddress !== undefined) settings.companyAddress = companyAddress;
    if (companyCity !== undefined) {
      settings.companyCity = companyCity.replace(/[^a-zA-Z\s]/g, '').replace(/\b\w/g, c => c.toUpperCase()).trim();
    }
    if (companyState !== undefined) {
      settings.companyState = companyState.replace(/[^a-zA-Z\s]/g, '').replace(/\b\w/g, c => c.toUpperCase()).trim();
    }
    if (companyPincode !== undefined) settings.companyPincode = companyPincode;
    if (companyPhone !== undefined) settings.companyPhone = companyPhone;
    if (companyEmail !== undefined) settings.companyEmail = companyEmail;
    if (invoicePrefix !== undefined) settings.invoicePrefix = invoicePrefix;
    if (sacCode !== undefined) settings.sacCode = sacCode;

    // Support update
    if (supportEmail !== undefined) settings.supportEmail = supportEmail;
    if (supportPhone !== undefined) settings.supportPhone = supportPhone;
    if (supportWhatsapp !== undefined) settings.supportWhatsapp = supportWhatsapp;

    // Booking Timing update
    if (maxSearchTime !== undefined) settings.maxSearchTime = maxSearchTime;
    if (waveDuration !== undefined) settings.waveDuration = waveDuration;
    if (searchRadius !== undefined) settings.searchRadius = searchRadius;
    if (maxCartItemQuantity !== undefined) settings.maxCartItemQuantity = maxCartItemQuantity;
    if (isOnlinePaymentEnabled !== undefined) settings.isOnlinePaymentEnabled = isOnlinePaymentEnabled;

    // Commission & Platform Fees update
    if (commissionRates !== undefined) settings.commissionRates = commissionRates;
    if (platformFeeRates !== undefined) settings.platformFeeRates = platformFeeRates;

    // Slots Config update
    if (slotConfig !== undefined) settings.slotConfig = slotConfig;

    // Policy updates
    if (termsAndConditions !== undefined) settings.termsAndConditions = termsAndConditions;
    if (privacyPolicy !== undefined) settings.privacyPolicy = privacyPolicy;
    if (workerTermsAndConditions !== undefined) settings.workerTermsAndConditions = workerTermsAndConditions;
    if (workerPrivacyPolicy !== undefined) settings.workerPrivacyPolicy = workerPrivacyPolicy;
    if (vendorTermsAndConditions !== undefined) settings.vendorTermsAndConditions = vendorTermsAndConditions;
    if (vendorPrivacyPolicy !== undefined) settings.vendorPrivacyPolicy = vendorPrivacyPolicy;

    await settings.save();

    // Propagate vendorCashLimit to all existing vendors if it was changed
    if (vendorCashLimit !== undefined) {
      console.log(`Updating all vendors with new cash limit: ${vendorCashLimit}`);
      await Vendor.updateMany(
        {}, // Filter: all vendors
        { $set: { 'wallet.cashLimit': vendorCashLimit } }
      );
    }

    // Propagate searchRadius to all existing vendors if it was changed
    if (searchRadius !== undefined) {
      console.log(`Updating all vendors with new service range: ${searchRadius}`);
      await Vendor.updateMany(
        {},
        { $set: { 'settings.serviceRange': searchRadius } }
      );
    }

    res.status(200).json({
      success: true,
      message: 'System settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings'
    });
  }
};
// Get Public Settings (Visited Charges, GST, Live Stats)
exports.getPublicSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne({ type: 'global' }).select('visitedCharges serviceGstPercentage partsGstPercentage supportEmail supportPhone supportWhatsapp cancellationPenalty companyName companyAddress companyCity companyState companyPincode companyPhone companyEmail isOnlinePaymentEnabled slotConfig termsAndConditions privacyPolicy workerTermsAndConditions workerPrivacyPolicy vendorTermsAndConditions vendorPrivacyPolicy maxCartItemQuantity').lean();

    // Default if not found (fallback values)
    if (!settings) {
      settings = { visitedCharges: 29, serviceGstPercentage: 18, partsGstPercentage: 18, maxCartItemQuantity: 100, companyName: 'Nexora' };
    }

    const User = require('../../models/User');
    const Vendor = require('../../models/Vendor');

    const [userCount, vendorCount] = await Promise.all([
      User.countDocuments().catch(() => 0),
      Vendor.countDocuments().catch(() => 0)
    ]);

    const stats = {
      happyCustomers: userCount > 0 ? `${userCount.toLocaleString()}+` : '10K+',
      servicePartners: vendorCount > 0 ? `${vendorCount.toLocaleString()}+` : '500+',
      platformRating: '4.8'
    };

    res.status(200).json({
      success: true,
      settings,
      stats
    });
  } catch (error) {
    console.error('Error fetching public settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings'
    });
  }
};

// Submit Public/User Support Request (Creates Ticket + Notifies Admin)
exports.submitPublicSupportTicket = async (req, res) => {
  try {
    const { name, email, phone, subject, message, category } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and message are required'
      });
    }

    const Ticket = require('../../models/Ticket');
    const Admin = require('../../models/Admin');
    const { createNotification } = require('../notificationControllers/notificationController');

    const ticket = new Ticket({
      creatorRole: 'user',
      creatorId: req.user?._id || req.user?.id || null,
      creatorModel: 'User',
      guestName: name.trim(),
      guestEmail: email.trim(),
      guestPhone: phone ? phone.trim() : null,
      subject: subject ? subject.trim() : `Support Request from ${name.trim()}`,
      category: category || 'general',
      priority: 'medium',
      status: 'open',
      messages: [{
        sender: 'user',
        senderId: req.user?._id || req.user?.id || null,
        senderModel: 'User',
        message: message.trim()
      }]
    });

    await ticket.save();

    // Broadcast socket event to admin room if active
    try {
      const { getIO } = require('../../sockets');
      const io = getIO();
      if (io) {
        io.to('admin_room').emit('new_support_ticket', {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          name: name.trim(),
          email: email.trim(),
          subject: ticket.subject,
          message: message.trim(),
          createdAt: ticket.createdAt
        });
      }
    } catch (sErr) {
      console.warn('Socket emit error on support ticket:', sErr.message);
    }

    // Create DB notifications for active admins
    try {
      const activeAdmins = await Admin.find({ isActive: true }).select('_id');
      if (activeAdmins.length > 0) {
        await Promise.all(
          activeAdmins.map(admin =>
            createNotification({
              adminId: admin._id,
              type: 'general',
              title: `New Support Request: ${ticket.subject}`,
              message: `${name.trim()} (${email.trim()}): ${message.trim().slice(0, 80)}...`,
              relatedId: ticket._id,
              relatedType: 'ticket'
            })
          )
        );
      }
    } catch (nErr) {
      console.warn('Notification create error on support ticket:', nErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Support request submitted successfully. Our team will contact you soon.',
      ticket
    });
  } catch (error) {
    console.error('Error submitting public support ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit support request. Please try again.'
    });
  }
};
