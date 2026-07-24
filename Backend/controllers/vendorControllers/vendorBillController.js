const VendorBill = require('../../models/VendorBill');
const Booking = require('../../models/Booking');
const VendorServiceCatalog = require('../../models/VendorServiceCatalog');
const VendorPartsCatalog = require('../../models/VendorPartsCatalog');
const Settings = require('../../models/Settings');
const { BILL_STATUS } = require('../../utils/constants');

/**
 * Create or Update Vendor Bill
 * ────────────────────────────
 * Revenue Model:
 *   Vendor → 70% of total service BASE (excl GST)
 *   Vendor → 10% of total parts BASE  (excl GST)
 *   GST   → 100% retained by company
 *
 * VendorBill is the SINGLE source of truth for earnings.
 * Booking does NOT store vendorEarnings/adminCommission.
 *
 * POST /api/vendors/bookings/:bookingId/bill
 */
const createOrUpdateBill = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { services, parts, customItems, transportCharges, applyPartsGST = true } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const { USER_ROLES } = require('../../utils/constants');

    // Auth check: Vendor or assigned Worker
    const isVendorAuth = booking.vendorId.toString() === req.user.id && req.userRole === USER_ROLES.VENDOR;
    const isWorkerAuth = booking.workerId?.toString() === req.user.id && req.userRole === USER_ROLES.WORKER;

    if (!isVendorAuth && !isWorkerAuth) {
      return res.status(403).json({ success: false, message: 'Not authorized for this booking' });
    }

    // Always use the booking's vendorId for the bill
    const billVendorId = booking.vendorId;

    // ── Fetch Settings & Vendor (dynamic level-based commission calculation) ──
    const Vendor = require('../../models/Vendor');
    const [settings, vendor] = await Promise.all([
      Settings.findOne({ type: 'global' }),
      Vendor.findById(billVendorId)
    ]);

    const vendorLevel = vendor?.level || 3;
    const levelKey = `level${vendorLevel}`;

    // Dynamic Level-based Commission Rate from Settings (Level 1: 10%, Level 2: 15%, Level 3: 20%)
    const commissionRate = settings?.commissionRates?.[levelKey] ?? (vendorLevel === 1 ? 10 : vendorLevel === 2 ? 15 : 20);
    const serviceSplitPct = 100 - commissionRate;
    const partsSplitPct = settings?.partsPayoutPercentage ?? 100;
    const serviceGstPct = settings?.serviceGstPercentage ?? 18;
    const partsGstPct = settings?.partsGstPercentage ?? 18;

    // ═══════════════════════════════════════
    // 1. ORIGINAL SERVICE (from booking)
    // ═══════════════════════════════════════
    const isPlanBooking = booking.paymentMethod === 'plan_benefit';
    const originalServiceBaseForBill = isPlanBooking ? 0 : (booking.basePrice || 0);
    const originalServiceBaseForEarnings = booking.basePrice || 0;
    const originalGST = isPlanBooking ? 0 : parseFloat(((originalServiceBaseForBill * serviceGstPct) / 100).toFixed(2));
    const visitingCharges = Number(booking.visitingCharges) || 0;

    // ═══════════════════════════════════════
    // 2. VENDOR-ADDED SERVICES
    // ═══════════════════════════════════════
    const processedServices = [];
    let vendorServiceBase = 0;
    let vendorServiceGST = 0;

    if (services && Array.isArray(services)) {
      for (const item of services) {
        let catalogItem = null;
        if (item.catalogId) {
          catalogItem = await VendorServiceCatalog.findById(item.catalogId);
        }

        const name = catalogItem ? catalogItem.name : item.name;
        // Catalog prices are BASE PRICES (excl GST)
        const unitBasePrice = catalogItem ? catalogItem.price : (Number(item.price) || 0);
        const quantity = Number(item.quantity) || 1;

        const base = unitBasePrice * quantity;
        const gst = parseFloat(((base * serviceGstPct) / 100).toFixed(2));
        const totalInclusive = parseFloat((base + gst).toFixed(2));

        processedServices.push({
          catalogId: item.catalogId,
          name,
          price: unitBasePrice,
          gstPercentage: serviceGstPct,
          quantity,
          gstAmount: gst,
          total: totalInclusive,
          isOriginal: false
        });

        vendorServiceBase += base;
        vendorServiceGST += gst;
      }
    }

    // ═══════════════════════════════════════
    // 3. PARTS
    // ═══════════════════════════════════════
    const processedParts = [];
    let totalPartsBase = 0;
    let partsGST = 0;

    if (parts && Array.isArray(parts)) {
      for (const item of parts) {
        let catalogItem = null;
        if (item.catalogId) {
          catalogItem = await VendorPartsCatalog.findById(item.catalogId);
        }

        const name = catalogItem ? catalogItem.name : item.name;
        const unitBasePrice = catalogItem ? catalogItem.price : (Number(item.price) || 0);
        const quantity = Number(item.quantity) || 1;
        const pGstPct = catalogItem ? (catalogItem.gstPercentage || partsGstPct) : (Number(item.gstPercentage) || partsGstPct);

        const base = unitBasePrice * quantity;
        // Honour the worker's GST toggle — if applyPartsGST=false, force zero GST
        const effectivePGstPct = applyPartsGST ? pGstPct : 0;
        const gst = applyPartsGST ? parseFloat(((base * pGstPct) / 100).toFixed(2)) : 0;

        processedParts.push({
          catalogId: item.catalogId,
          name,
          price: unitBasePrice,
          gstPercentage: effectivePGstPct,
          quantity,
          gstAmount: gst,
          total: parseFloat((base + gst).toFixed(2))
        });

        totalPartsBase += base;
        partsGST += gst;
      }
    }

    // ═══════════════════════════════════════
    // 3.5 CUSTOM ITEMS (treated as Parts for revenue logic)
    // ═══════════════════════════════════════
    const processedCustomItems = []; // To store in bill

    if (customItems && Array.isArray(customItems)) {
      for (const item of customItems) {
        const name = item.name || 'Custom Item';
        const unitBasePrice = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 1;
        // Default custom items to parts GST % if not provided (usually from settings)
        const cGstPct = Number(item.gstPercentage) || partsGstPct;

        const base = unitBasePrice * quantity;
        // Honour the worker's GST toggle — if applyPartsGST=false, force zero GST on custom items too
        const effectiveCGstPct = applyPartsGST ? cGstPct : 0;
        const gst = applyPartsGST ? parseFloat(((base * cGstPct) / 100).toFixed(2)) : 0;

        processedCustomItems.push({
          name,
          price: unitBasePrice,
          gstPercentage: effectiveCGstPct,
          quantity,
          gstAmount: gst,
          total: parseFloat((base + gst).toFixed(2)),
          hsnCode: item.hsnCode || '',
          gstApplicable: applyPartsGST
        });

        // Add to PARTS totals
        totalPartsBase += base;
        partsGST += gst;
      }
    }

    // ═══════════════════════════════════════
    // 4. AGGREGATION
    // ═══════════════════════════════════════
    const totalServiceBaseForBill = parseFloat((originalServiceBaseForBill + vendorServiceBase).toFixed(2));
    const totalServiceBaseForEarnings = parseFloat((originalServiceBaseForEarnings + vendorServiceBase).toFixed(2));
    totalPartsBase = parseFloat(totalPartsBase.toFixed(2));

    const totalGST = parseFloat((originalGST + vendorServiceGST + partsGST).toFixed(2));
    const finalTransportCharges = Number(transportCharges) || 0;
    const grandTotal = parseFloat((totalServiceBaseForBill + totalPartsBase + totalGST + visitingCharges + finalTransportCharges).toFixed(2));

    // ═══════════════════════════════════════
    // 5. REVENUE SPLIT (% applied on BASE only, Transport to Vendor)
    // ═══════════════════════════════════════
    const vendorServiceEarning = parseFloat(((totalServiceBaseForEarnings * serviceSplitPct) / 100).toFixed(2));
    const vendorPartsEarning = parseFloat(((totalPartsBase * partsSplitPct) / 100).toFixed(2));
    // Transport charges go 100% to vendor/worker who travelled
    const vendorTotalEarning = parseFloat((vendorServiceEarning + vendorPartsEarning + finalTransportCharges).toFixed(2));
    // Platform commission earned by company (excluding GST & vendor transport)
    const companyRevenue = parseFloat(Math.max(0, grandTotal - vendorTotalEarning - totalGST).toFixed(2));

    // ═══════════════════════════════════════
    // 6. ALL SERVICES (original + vendor-added)
    // ═══════════════════════════════════════
    const allServices = [
      {
        name: booking.serviceName || 'Original Service',
        price: originalServiceBaseForBill,
        gstPercentage: serviceGstPct,
        quantity: 1,
        gstAmount: originalGST,
        total: parseFloat((originalServiceBaseForBill + originalGST).toFixed(2)),
        isOriginal: true
      },
      ...processedServices
    ];

    // ═══════════════════════════════════════
    // 7. SAVE BILL
    // ═══════════════════════════════════════
    let bill = await VendorBill.findOne({ bookingId });

    const isBillFinalized = req.body.isFinalized === true;

    const billData = {
      vendorId: billVendorId,
      services: allServices,
      parts: processedParts,
      customItems: processedCustomItems,
      originalServiceBase: originalServiceBaseForBill,
      vendorServiceBase: parseFloat(vendorServiceBase.toFixed(2)),
      totalServiceBase: totalServiceBaseForBill,
      totalPartsBase,
      originalGST,
      vendorServiceGST: parseFloat(vendorServiceGST.toFixed(2)),
      partsGST: parseFloat(partsGST.toFixed(2)),
      totalGST,
      visitingCharges,
      transportCharges: finalTransportCharges,
      grandTotal,
      payoutConfig: {
        serviceSplitPercentage: serviceSplitPct,
        partsSplitPercentage: partsSplitPct,
        serviceGstPercentage: serviceGstPct,
        partsGstPercentage: partsGstPct
      },
      vendorServiceEarning,
      vendorPartsEarning,
      vendorTotalEarning,
      companyRevenue,
      applyPartsGST,
      isFinalized: isBillFinalized,
      status: isBillFinalized ? BILL_STATUS.GENERATED : BILL_STATUS.DRAFT,
      generatedAt: new Date()
    };

    if (bill) {
      Object.assign(bill, billData);
      await bill.save();
    } else {
      bill = await VendorBill.create({ bookingId, ...billData });
    }

    // ═══════════════════════════════════════
    // 8. UPDATE BOOKING (no earnings!)
    // ═══════════════════════════════════════
    booking.finalAmount = grandTotal;
    booking.userPayableAmount = grandTotal;
    booking.vendorBillId = bill._id;
    booking.razorpayOrderId = null; // Invalidate stale Razorpay order to force new order matching grandTotal
    await booking.save();

    // Emit real-time Socket events & notifications to user
    const io = req.app.get('io');
    if (io) {
      if (isBillFinalized) {
        io.to(`user_${booking.userId}`).emit('bill_finalized', {
          bookingId: booking._id,
          finalAmount: grandTotal,
          bill,
          isFinalized: true,
          status: booking.status
        });
      } else {
        io.to(`user_${booking.userId}`).emit('bill_editing', {
          bookingId: booking._id,
          isFinalized: false,
          bill
        });
      }
      io.to(`user_${booking.userId}`).emit('booking_updated', {
        bookingId: booking._id,
        finalAmount: grandTotal,
        bill,
        isFinalized: isBillFinalized,
        status: booking.status
      });
      io.to(`user_${booking.userId}`).emit('bill_updated', {
        bookingId: booking._id,
        finalAmount: grandTotal,
        bill,
        isFinalized: isBillFinalized
      });
    }

    if (isBillFinalized) {
      try {
        const { createNotification } = require('../notificationControllers/notificationController');
        await createNotification({
          recipientType: 'User',
          recipientId: booking.userId,
          userId: booking.userId,
          title: 'Bill Finalized',
          message: `Your final bill of ₹${grandTotal} is ready for review & payment.`,
          type: 'bill_finalized',
          data: { bookingId: booking._id, finalAmount: grandTotal }
        });
      } catch (notifErr) {
        console.warn('Error sending bill_finalized notification:', notifErr);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Bill generated successfully',
      bill,
      financials: {
        grandTotal,
        vendorTotalEarning,
        companyRevenue,
        breakdown: {
          serviceBase: totalServiceBaseForBill,
          partsBase: totalPartsBase,
          totalGST
        }
      }
    });

  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate bill' });
  }
};

/**
 * Get Bill by Booking ID
 * GET /api/vendors/bookings/:bookingId/bill
 */
const getBillByBookingId = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const { USER_ROLES } = require('../../utils/constants');

    const isVendorAuth = booking.vendorId.toString() === req.user.id && req.userRole === USER_ROLES.VENDOR;
    const isWorkerAuth = booking.workerId?.toString() === req.user.id && req.userRole === USER_ROLES.WORKER;

    if (!isVendorAuth && !isWorkerAuth) {
      return res.status(403).json({ success: false, message: 'Not authorized for this booking' });
    }

    const [bill, settings] = await Promise.all([
      VendorBill.findOne({ bookingId }).populate('services.catalogId parts.catalogId'),
      Settings.findOne({ type: 'global' })
    ]);

    if (!bill) {
      // Return 200 instead of 404 to gracefully tell the frontend that a bill is not yet created
      // This prevents Ugly `404 (Not Found)` network errors in the console from Axios on page load
      return res.status(200).json({ success: true, bill: null, message: 'Bill not found' });
    }

    const companyDetails = {
      companyName: settings?.companyName || 'Nexora Go',
      companyGSTIN: settings?.companyGSTIN || '',
      companyPAN: settings?.companyPAN || '',
      companyAddress: settings?.companyAddress || '',
      companyCity: settings?.companyCity || '',
      companyState: settings?.companyState || '',
      companyPincode: settings?.companyPincode || '',
      companyPhone: settings?.companyPhone || '',
      companyEmail: settings?.companyEmail || '',
      invoicePrefix: settings?.invoicePrefix || 'INV',
      sacCode: settings?.sacCode || '998599'
    };

    res.status(200).json({ success: true, bill, companyDetails });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch bill' });
  }
};

module.exports = {
  createOrUpdateBill,
  getBillByBookingId
};
