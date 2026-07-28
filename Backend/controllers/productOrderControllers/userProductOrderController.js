const mongoose = require('mongoose');
const ProductOrder = require('../../models/ProductOrder');
const ProductOrderRequest = require('../../models/ProductOrderRequest');
const UserService = require('../../models/UserService');
const Vendor = require('../../models/Vendor');
const Cart = require('../../models/Cart');
const User = require('../../models/User');
const razorpayService = require('../../services/razorpayService');
const { getIO } = require('../../sockets');
const { sendNotificationToVendor } = require('../../services/firebaseAdmin');

const Settings = require('../../models/Settings');

/**
 * Generate unique Product Order ID
 */
const generateOrderId = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${timestamp}-${random}`;
};

const { calculateDistance: calcDistService } = require('../../services/locationService');

/**
 * Calculate distance between two coordinates in kilometers using locationService
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const dist = calcDistService({ lat: lat1, lng: lon1 }, { lat: lat2, lng: lon2 });
  return Math.round(dist * 10) / 10;
};

/**
 * Search & Notify Nearby Product Vendors
 */
const broadcastProductOrderToVendors = async (productOrder) => {
  try {
    const userLat = productOrder.deliveryAddress?.lat;
    const userLng = productOrder.deliveryAddress?.lng;

    // Query to find active, online and available candidate vendors
    let vendorQuery = {
      isActive: { $ne: false },
      isOnline: true,
      availability: { $ne: 'OFFLINE' },
      $or: [
        { approvalStatus: { $regex: /approved/i } },
        { approvalStatus: { $exists: false } },
        { approvalStatus: 'PENDING' }
      ]
    };

    let vendors = await Vendor.find(vendorQuery);
    const io = getIO();

    if (!vendors || vendors.length === 0) {
      console.log(`[ProductOrder] No active/online vendors found for order ${productOrder.orderId}. Immediate escalation to Admin...`);
      
      productOrder.status = 'ESCALATED';
      productOrder.isEscalatedToAdmin = true;
      await productOrder.save();

      if (io) {
        const escalatePayload = {
          orderId: productOrder._id,
          customOrderId: productOrder.orderId,
          bookingId: productOrder._id,
          serviceName: productOrder.items?.[0]?.title || 'Product Order',
          totalAmount: productOrder.financialBreakdown?.totalAmount,
          message: `Product Order #${productOrder.orderId} escalated to admin (no active vendors nearby).`
        };

        io.to('admin_room').emit('adminBookingEscalated', escalatePayload);
        io.emit('adminBookingEscalated', escalatePayload);

        io.to(`user_${productOrder.userId}`).emit('product_order_status_update', {
          orderId: productOrder._id,
          customOrderId: productOrder.orderId,
          status: 'ESCALATED',
          message: 'Our admin team is manually assigning a nearby vendor partner for your order.'
        });
      }

      return false;
    }

    // Filter by delivery range if coordinates exist
    const candidateVendors = vendors.filter(vendor => {
      const vendorLat = vendor.location?.lat || vendor.address?.lat;
      const vendorLng = vendor.location?.lng || vendor.address?.lng;
      if (!vendorLat || !vendorLng || !userLat || !userLng) return true;

      const dist = calculateDistance(userLat, userLng, vendorLat, vendorLng);
      const range = vendor.settings?.serviceRange || 20;
      return dist === null || dist <= range;
    });

    const targetVendors = candidateVendors.length > 0 ? candidateVendors : vendors;
    let notifiedCount = 0;

    for (const vendor of targetVendors) {
      const vId = vendor._id.toString();
      const dist = calculateDistance(
        userLat, userLng,
        vendor.location?.lat || vendor.address?.lat,
        vendor.location?.lng || vendor.address?.lng
      );

      // Create request entry
      await ProductOrderRequest.findOneAndUpdate(
        { orderId: productOrder._id, vendorId: vendor._id },
        { status: 'PENDING', distance: dist },
        { upsert: true, new: true }
      );

      // Socket Alert Data
      const alertData = {
        orderId: productOrder._id,
        customOrderId: productOrder.orderId,
        bookingId: productOrder._id,
        serviceName: productOrder.items?.[0]?.title || 'Product Order',
        itemsCount: productOrder.items.length,
        totalAmount: productOrder.financialBreakdown.totalAmount,
        price: productOrder.financialBreakdown.totalAmount,
        deliveryCharge: productOrder.financialBreakdown.deliveryCharge,
        vendorEarnings: productOrder.financialBreakdown.vendorEarnings,
        paymentMethod: productOrder.paymentMethod,
        customerName: productOrder.contactDetails.name,
        customerPhone: productOrder.contactDetails.phone,
        address: { addressLine1: `${productOrder.deliveryAddress.addressLine1}, ${productOrder.deliveryAddress.city}` },
        distance: dist,
        items: productOrder.items,
        createdAt: productOrder.createdAt || new Date().toISOString()
      };

      // Emit Socket to vendor room & broadcast
      io.to(`vendor_${vId}`).emit('new_product_order_alert', alertData);
      io.to(`vendor_${vId}`).emit('new_booking_request', alertData);
      notifiedCount++;

      // Push notification
      sendNotificationToVendor(vId, {
        title: '🛍️ New Product Order Nearby!',
        body: `New order #${productOrder.orderId} for ₹${productOrder.financialBreakdown.totalAmount}. Accept to start delivery!`
      }).catch(err => console.error('Product FCM error:', err));
    }

    // Schedule 45-second timeout escalation to Admin if no vendor accepts
    setTimeout(async () => {
      try {
        const freshOrder = await ProductOrder.findById(productOrder._id);
        if (freshOrder && freshOrder.status === 'PENDING_ACCEPTANCE') {
          freshOrder.status = 'ESCALATED';
          freshOrder.isEscalatedToAdmin = true;
          await freshOrder.save();

          console.log(`[ProductOrder] ⚠️ Order ${freshOrder.orderId} unaccepted after 45s. Escalated to Admin.`);

          if (io) {
            const escalatePayload = {
              orderId: freshOrder._id,
              customOrderId: freshOrder.orderId,
              bookingId: freshOrder._id,
              serviceName: freshOrder.items?.[0]?.title || 'Product Order',
              totalAmount: freshOrder.financialBreakdown?.totalAmount,
              message: `Product Order #${freshOrder.orderId} unaccepted by vendors after 45s. Escalated for manual admin dispatch.`
            };

            io.to('admin_room').emit('adminBookingEscalated', escalatePayload);
            io.emit('adminBookingEscalated', escalatePayload);
            io.to(`user_${freshOrder.userId}`).emit('product_order_status_update', {
              orderId: freshOrder._id,
              customOrderId: freshOrder.orderId,
              status: 'ESCALATED',
              message: 'Our admin team is manually assigning a nearby vendor partner for your order.'
            });
          }
        }
      } catch (timerErr) {
        console.error('[ProductOrder] Error in timeout escalation:', timerErr);
      }
    }, 45000);

    console.log(`[ProductOrder] Broadcasted order ${productOrder.orderId} to ${notifiedCount} vendors`);
    return notifiedCount > 0;
  } catch (error) {
    console.error('Error broadcasting product order to vendors:', error);
    return false;
  }
};

/**
 * Create Product Order
 */
const createProductOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { items, deliveryAddress, contactDetails, paymentMethod, vendorId } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are required for product order' });
    }

    if (!deliveryAddress || !deliveryAddress.addressLine1) {
      return res.status(400).json({ success: false, message: 'Valid delivery address is required' });
    }

    if (!contactDetails || !contactDetails.phone) {
      return res.status(400).json({ success: false, message: 'Contact details are required' });
    }

    if (!['online', 'cod'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Invalid payment method' });
    }

    // Fetch Admin-configured delivery charge from global settings
    const globalSettings = await Settings.findOne({ type: 'global' }).lean();
    const deliveryCharge = globalSettings?.productDeliveryCharge !== undefined ? globalSettings.productDeliveryCharge : 49;
    let selectedVendor = null;

    if (vendorId) {
      selectedVendor = await Vendor.findById(vendorId);
    } else {
      const firstProduct = items[0];
      const pId = firstProduct.productId || firstProduct.serviceId;
      if (pId) {
        const prod = await UserService.findById(pId);
        if (prod && prod.vendorId) {
          selectedVendor = await Vendor.findById(prod.vendorId);
        }
      }
    }

    // Process line items & subtotal
    let subtotal = 0;
    let totalTax = 0;
    const formattedItems = [];

    for (const item of items) {
      let pId = item.productId || item.serviceId || item._id;
      if (!mongoose.Types.ObjectId.isValid(pId)) {
        pId = new mongoose.Types.ObjectId();
      }
      const unitPrice = Number(item.unitPrice || item.price || 0);
      const quantity = Number(item.quantity || item.serviceCount || 1);
      const itemPrice = unitPrice * quantity;
      const gst = item.gstPercentage !== undefined ? Number(item.gstPercentage) : 18;

      subtotal += itemPrice;
      totalTax += (itemPrice * (gst / 100));

      formattedItems.push({
        productId: pId,
        title: item.title || item.card?.title || 'Product Item',
        description: item.description || item.card?.description || '',
        icon: item.icon || item.card?.imageUrl || '',
        unitPrice,
        quantity,
        price: itemPrice,
        gstPercentage: gst
      });
    }

    const taxAmount = Math.round(totalTax);
    const platformFee = 19; // Standard platform fee
    const commissionRate = selectedVendor?.commissionRate || 15;
    const platformCommission = Math.round(subtotal * (commissionRate / 100));
    
    // Vendor gets: (subtotal - platformCommission) + 100% of deliveryCharge!
    const vendorEarnings = (subtotal - platformCommission) + deliveryCharge;
    const totalAmount = Math.round(subtotal + deliveryCharge + taxAmount + platformFee);

    const newOrderId = generateOrderId();

    const orderObj = new ProductOrder({
      orderId: newOrderId,
      userId,
      vendorId: selectedVendor ? selectedVendor._id : null,
      items: formattedItems,
      deliveryAddress: {
        type: deliveryAddress.type || 'home',
        addressLine1: deliveryAddress.addressLine1,
        addressLine2: deliveryAddress.addressLine2 || '',
        city: deliveryAddress.city || '',
        state: deliveryAddress.state || '',
        pincode: deliveryAddress.pincode || '',
        landmark: deliveryAddress.landmark || '',
        lat: deliveryAddress.lat || null,
        lng: deliveryAddress.lng || null
      },
      contactDetails: {
        name: contactDetails.name,
        phone: contactDetails.phone
      },
      paymentMethod,
      paymentStatus: paymentMethod === 'cod' ? 'COD_PENDING' : 'PENDING',
      status: 'PENDING_ACCEPTANCE',
      financialBreakdown: {
        subtotal,
        deliveryCharge,
        tax: taxAmount,
        platformFee,
        totalAmount,
        vendorEarnings
      }
    });

    await orderObj.save();

    // Trigger vendor broadcast for both COD and Online Payment methods so vendor receives alert immediately
    const notified = await broadcastProductOrderToVendors(orderObj);

    // If COD, clear product cart items and return immediately
    if (paymentMethod === 'cod') {
      await Cart.findOneAndUpdate(
        { userId },
        { $pull: { items: { 'serviceId.offeringType': 'PRODUCT' } } }
      ).catch(() => {});

      return res.status(201).json({
        success: true,
        message: 'Product order placed successfully via COD',
        data: orderObj,
        notifiedVendors: notified
      });
    }

    // Online Payment: Create Razorpay Order
    const razorpayOrder = await razorpayService.createOrder(
      totalAmount,
      'INR',
      `order_receipt_${orderObj.orderId}`
    );

    if (!razorpayOrder || !razorpayOrder.success || !razorpayOrder.orderId) {
      return res.status(500).json({ success: false, message: razorpayOrder?.error || 'Failed to create Razorpay payment order' });
    }

    if (!orderObj.razorpayDetails) {
      orderObj.razorpayDetails = {};
    }
    orderObj.razorpayDetails.razorpayOrderId = razorpayOrder.orderId;
    await orderObj.save();

    return res.status(201).json({
      success: true,
      message: 'Product order created. Proceed with payment.',
      data: {
        order: orderObj,
        razorpayOrder: {
          id: razorpayOrder.orderId,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency
        }
      }
    });

  } catch (error) {
    console.error('Create product order error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating product order' });
  }
};

/**
 * Verify Razorpay Online Payment for Product Order
 */
const verifyProductOrderPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    const productOrder = await ProductOrder.findById(orderId);
    if (!productOrder) {
      return res.status(404).json({ success: false, message: 'Product order not found' });
    }

    const isValid = await razorpayService.verifyPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      productOrder.paymentStatus = 'FAILED';
      await productOrder.save();
      return res.status(400).json({ success: false, message: 'Payment verification signature invalid' });
    }

    productOrder.paymentStatus = 'PAID';
    productOrder.razorpayDetails = {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature
    };

    await productOrder.save();

    // Clear cart
    await Cart.findOneAndUpdate(
      { userId: req.user.id },
      { $pull: { items: { 'serviceId.offeringType': 'PRODUCT' } } }
    ).catch(() => {});

    return res.json({
      success: true,
      message: 'Payment verified and product order confirmed!',
      data: productOrder
    });

  } catch (error) {
    console.error('Verify product order payment error:', error);
    return res.status(500).json({ success: false, message: 'Error verifying payment' });
  }
};

/**
 * Get Product Order Details for Tracking View
 */
const getProductOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    let query = {};
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      query = { $or: [{ _id: orderId }, { orderId: orderId }] };
    } else {
      query = { orderId: orderId };
    }

    let order = await ProductOrder.findOne(query)
      .populate('vendorId', 'name businessName phone profilePhoto rating location address settings.deliverySettings');

    // Fallback to Booking collection if not found in ProductOrder
    if (!order && mongoose.Types.ObjectId.isValid(orderId)) {
      const Booking = require('../../models/Booking');
      const bookingDoc = await Booking.findById(orderId)
        .populate('vendorId', 'name businessName phone profilePhoto rating location address')
        .populate('workerId', 'name phone profilePhoto');
      if (bookingDoc) {
        order = bookingDoc.toObject();
        if (!order.orderId) order.orderId = order.bookingNumber || String(order._id).slice(-8).toUpperCase();
      }
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.json({ success: true, data: order });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching order details' });
  }
};

/**
 * Get User Product Order History
 */
const getUserProductOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await ProductOrder.find({ userId })
      .populate('vendorId', 'name businessName phone profilePhoto rating')
      .sort({ createdAt: -1 });

    return res.json({ success: true, data: orders });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching user product orders' });
  }
};

/**
 * Cancel Product Order
 */
const cancelProductOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await ProductOrder.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (['DELIVERED', 'CANCELLED', 'OUT_FOR_DELIVERY'].includes(order.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel order in status ${order.status}` });
    }

    order.status = 'CANCELLED';
    order.cancelledAt = new Date();
    order.cancellationReason = reason || 'Cancelled by user';

    let refundProcessed = false;
    let refundError = null;

    // Trigger Razorpay Auto-Refund if paid online
    if (order.paymentMethod === 'online' && order.paymentStatus === 'PAID' && order.razorpayDetails?.razorpayPaymentId) {
      try {
        const refundRes = await razorpayService.refundPayment(
          order.razorpayDetails.razorpayPaymentId,
          order.financialBreakdown?.totalAmount,
          { orderId: order.orderId, reason: order.cancellationReason }
        );
        if (refundRes && refundRes.success) {
          order.paymentStatus = 'REFUNDED';
          refundProcessed = true;
        } else {
          refundError = refundRes?.error || 'Refund initiation failed';
        }
      } catch (err) {
        console.error('Razorpay Product Order Refund Error:', err);
        refundError = err.message;
      }
    }

    await order.save();

    // Cancel pending requests
    await ProductOrderRequest.updateMany({ orderId: order._id }, { status: 'EXPIRED' });

    return res.json({
      success: true,
      message: refundProcessed 
        ? 'Product order cancelled & 100% refund initiated to your bank account' 
        : 'Product order cancelled successfully',
      data: order,
      refundProcessed,
      refundError
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error cancelling product order' });
  }
};

module.exports = {
  createProductOrder,
  verifyProductOrderPayment,
  getProductOrderDetails,
  getUserProductOrders,
  cancelProductOrder,
  broadcastProductOrderToVendors
};
