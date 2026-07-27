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

/**
 * Generate unique Product Order ID
 */
const generateOrderId = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${timestamp}-${random}`;
};

/**
 * Calculate distance between two coordinates in kilometers (Haversine formula)
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999;
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};

/**
 * Search & Notify Nearby Product Vendors
 */
const broadcastProductOrderToVendors = async (productOrder) => {
  try {
    const userLat = productOrder.deliveryAddress?.lat;
    const userLng = productOrder.deliveryAddress?.lng;

    // Flexible query to find active candidate vendors
    let vendorQuery = {
      isActive: { $ne: false },
      $or: [
        { approvalStatus: { $regex: /approved/i } },
        { approvalStatus: { $exists: false } },
        { approvalStatus: 'PENDING' }
      ]
    };

    let vendors = await Vendor.find(vendorQuery);

    if (!vendors || vendors.length === 0) {
      console.log(`[ProductOrder] No vendors match query, fetching all vendors as fallback...`);
      vendors = await Vendor.find({});
    }

    if (!vendors || vendors.length === 0) {
      console.log(`[ProductOrder] No vendors exist in database for order ${productOrder.orderId}`);
      return false;
    }

    // Filter by delivery range if coordinates exist
    const candidateVendors = vendors.filter(vendor => {
      const vendorLat = vendor.location?.lat || vendor.address?.lat;
      const vendorLng = vendor.location?.lng || vendor.address?.lng;
      if (!vendorLat || !vendorLng || !userLat || !userLng) return true; // Fallback include

      const dist = calculateDistance(userLat, userLng, vendorLat, vendorLng);
      const range = vendor.settings?.serviceRange || 20;
      return dist <= range;
    });

    const targetVendors = candidateVendors.length > 0 ? candidateVendors : vendors;
    const io = getIO();
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
        bookingId: productOrder._id, // Backward compatibility for socket handlers
        serviceName: productOrder.items?.[0]?.title || 'Product Order',
        itemsCount: productOrder.items.length,
        totalAmount: productOrder.financialBreakdown.totalAmount,
        price: productOrder.financialBreakdown.totalAmount,
        deliveryCharge: productOrder.financialBreakdown.deliveryCharge, // 100% to vendor!
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

    // Determine vendor delivery charge
    let deliveryCharge = 0;
    let selectedVendor = null;

    if (vendorId) {
      selectedVendor = await Vendor.findById(vendorId);
      if (selectedVendor && selectedVendor.settings?.deliverySettings) {
        deliveryCharge = selectedVendor.settings.deliverySettings.deliveryCharge || 0;
      }
    } else {
      // Find candidate vendors to calculate average/default vendor delivery charge
      const firstProduct = items[0];
      const pId = firstProduct.productId || firstProduct.serviceId;
      if (pId) {
        const prod = await UserService.findById(pId);
        if (prod && prod.vendorId) {
          selectedVendor = await Vendor.findById(prod.vendorId);
          if (selectedVendor?.settings?.deliverySettings) {
            deliveryCharge = selectedVendor.settings.deliverySettings.deliveryCharge || 0;
          }
        }
      }
    }

    // Process line items & subtotal
    let subtotal = 0;
    let totalTax = 0;
    const formattedItems = [];

    for (const item of items) {
      const pId = item.productId || item.serviceId || item._id;
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

    // If COD, trigger vendor broadcast immediately and clear cart
    if (paymentMethod === 'cod') {
      // Clear product cart items
      await Cart.findOneAndUpdate(
        { userId },
        { $pull: { items: { 'serviceId.offeringType': 'PRODUCT' } } }
      ).catch(() => {});

      const notified = await broadcastProductOrderToVendors(orderObj);

      return res.status(201).json({
        success: true,
        message: 'Product order placed successfully via COD',
        data: orderObj,
        notifiedVendors: notified
      });
    }

    // Online Payment: Create Razorpay Order
    const razorpayOrder = await razorpayService.createRazorpayOrder(
      totalAmount,
      'INR',
      `order_receipt_${orderObj.orderId}`
    );

    if (!razorpayOrder || !razorpayOrder.id) {
      return res.status(500).json({ success: false, message: 'Failed to create Razorpay payment order' });
    }

    orderObj.razorpayDetails.razorpayOrderId = razorpayOrder.id;
    await orderObj.save();

    return res.status(201).json({
      success: true,
      message: 'Product order created. Proceed with payment.',
      data: {
        order: orderObj,
        razorpayOrder: {
          id: razorpayOrder.id,
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

    const isValid = razorpayService.verifyPaymentSignature(
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

    // Broadcast to candidate vendors
    const notified = await broadcastProductOrderToVendors(productOrder);

    return res.json({
      success: true,
      message: 'Payment verified and product order confirmed!',
      data: productOrder,
      notifiedVendors: notified
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
    const order = await ProductOrder.findById(orderId)
      .populate('vendorId', 'name businessName phone profilePhoto rating location address settings.deliverySettings');

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
    await order.save();

    // Cancel requests
    await ProductOrderRequest.updateMany({ orderId: order._id }, { status: 'EXPIRED' });

    return res.json({ success: true, message: 'Product order cancelled successfully', data: order });
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
