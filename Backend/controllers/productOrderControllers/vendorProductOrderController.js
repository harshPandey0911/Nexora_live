const mongoose = require('mongoose');
const ProductOrder = require('../../models/ProductOrder');
const ProductOrderRequest = require('../../models/ProductOrderRequest');
const Vendor = require('../../models/Vendor');
const { getIO } = require('../../sockets');
const { sendNotificationToUser } = require('../../services/firebaseAdmin');

/**
 * Update Vendor Delivery & COD Settings
 */
const updateDeliverySettings = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { deliveryCharge, isDeliveryAvailable, freeDeliveryThreshold, codEnabled } = req.body;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    if (!vendor.settings) {
      vendor.settings = {};
    }

    vendor.settings.deliverySettings = {
      deliveryCharge: deliveryCharge !== undefined ? Math.max(0, Number(deliveryCharge)) : (vendor.settings.deliverySettings?.deliveryCharge || 0),
      isDeliveryAvailable: isDeliveryAvailable !== undefined ? Boolean(isDeliveryAvailable) : (vendor.settings.deliverySettings?.isDeliveryAvailable ?? true),
      freeDeliveryThreshold: freeDeliveryThreshold !== undefined ? (freeDeliveryThreshold ? Number(freeDeliveryThreshold) : null) : (vendor.settings.deliverySettings?.freeDeliveryThreshold || null),
      codEnabled: codEnabled !== undefined ? Boolean(codEnabled) : (vendor.settings.deliverySettings?.codEnabled ?? true)
    };

    await vendor.save();

    return res.json({
      success: true,
      message: 'Delivery charges and settings updated successfully!',
      data: vendor.settings.deliverySettings
    });
  } catch (error) {
    console.error('Update delivery settings error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update delivery settings' });
  }
};

/**
 * Get Vendor Delivery Settings
 */
const getDeliverySettings = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const vendor = await Vendor.findById(vendorId).select('settings.deliverySettings');

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    return res.json({
      success: true,
      data: vendor.settings?.deliverySettings || {
        deliveryCharge: 0,
        isDeliveryAvailable: true,
        freeDeliveryThreshold: null,
        codEnabled: true
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching delivery settings' });
  }
};

/**
 * Vendor Accepts Incoming Product Order
 */
const acceptProductOrder = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { orderId } = req.params;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const order = mongoose.Types.ObjectId.isValid(orderId)
      ? await ProductOrder.findById(orderId)
      : await ProductOrder.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Product order not found' });
    }

    if (order.status !== 'PENDING_ACCEPTANCE' && order.vendorId) {
      return res.status(400).json({
        success: false,
        message: 'This order has already been accepted by another vendor'
      });
    }

    // Financial breakdown with Admin-configured delivery charge
    const deliveryCharge = order.financialBreakdown.deliveryCharge || 49;
    const subtotal = order.financialBreakdown.subtotal;
    const tax = order.financialBreakdown.tax;
    const platformFee = order.financialBreakdown.platformFee;
    const commissionRate = vendor.commissionRate || 15;
    const platformCommission = Math.round(subtotal * (commissionRate / 100));

    // Vendor receives 100% of the Admin delivery charge + net item price
    const vendorEarnings = (subtotal - platformCommission) + deliveryCharge;
    const totalAmount = Math.round(subtotal + deliveryCharge + tax + platformFee);

    order.vendorId = vendorId;
    order.status = 'ACCEPTED';
    order.acceptedAt = new Date();
    order.financialBreakdown.deliveryCharge = deliveryCharge;
    order.financialBreakdown.totalAmount = totalAmount;
    order.financialBreakdown.vendorEarnings = vendorEarnings;

    await order.save();

    // Mark request status
    await ProductOrderRequest.findOneAndUpdate(
      { orderId: order._id, vendorId },
      { status: 'ACCEPTED', respondedAt: new Date() },
      { upsert: true }
    );

    // Expire all other vendor requests for this order
    await ProductOrderRequest.updateMany(
      { orderId: order._id, vendorId: { $ne: vendorId } },
      { status: 'EXPIRED' }
    );

    // Emit Socket to user
    const io = getIO();
    const eventPayload = {
      orderId: order._id,
      customOrderId: order.orderId,
      status: 'ACCEPTED',
      vendor: {
        id: vendor._id,
        name: vendor.name,
        businessName: vendor.businessName || vendor.name,
        phone: vendor.phone,
        profilePhoto: vendor.profilePhoto,
        rating: vendor.rating || 4.8,
        deliveryCharge: deliveryCharge
      },
      financialBreakdown: order.financialBreakdown
    };

    io.to(`user_${order.userId.toString()}`).emit('product_order_accepted', eventPayload);

    // Push notification to user
    sendNotificationToUser(order.userId.toString(), {
      title: '📦 Product Order Accepted!',
      body: `${vendor.businessName || vendor.name} accepted your order #${order.orderId}!`
    }).catch(err => console.error('FCM error:', err));

    return res.json({
      success: true,
      message: 'Product order accepted successfully!',
      data: order
    });

  } catch (error) {
    console.error('Accept product order error:', error);
    return res.status(500).json({ success: false, message: 'Server error accepting product order' });
  }
};

/**
 * Vendor Updates Product Order Status (PACKING -> OUT_FOR_DELIVERY -> DELIVERED)
 */
const updateOrderStatus = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { orderId } = req.params;
    const { status } = req.body; // 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'

    const validStatuses = ['PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid order status transition' });
    }

    const order = await ProductOrder.findOne({ _id: orderId, vendorId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Product order not found or not assigned to you' });
    }

    if (status === 'OUT_FOR_DELIVERY' && order.paymentMethod === 'online' && order.paymentStatus !== 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'Cannot dispatch order! Customer has not completed online payment yet.'
      });
    }

    order.status = status;

    if (status === 'OUT_FOR_DELIVERY') {
      order.dispatchedAt = new Date();
    } else if (status === 'DELIVERED') {
      order.deliveredAt = new Date();
      if (order.paymentMethod === 'cod') {
        order.paymentStatus = 'COD_COLLECTED';
      }

      // Update Vendor Wallet Earnings
      const vendor = await Vendor.findById(vendorId);
      if (vendor) {
        if (!vendor.wallet) vendor.wallet = {};
        
        // Add vendor earnings (includes 100% of delivery charges!)
        vendor.wallet.earnings = (vendor.wallet.earnings || 0) + order.financialBreakdown.vendorEarnings;
        vendor.completedJobs = (vendor.completedJobs || 0) + 1;
        vendor.totalJobs = (vendor.totalJobs || 0) + 1;

        if (order.paymentMethod === 'cod') {
          vendor.wallet.totalCashCollected = (vendor.wallet.totalCashCollected || 0) + order.financialBreakdown.totalAmount;
          // Cash collected adds to vendor dues to platform
          vendor.wallet.dues = (vendor.wallet.dues || 0) + (order.financialBreakdown.totalAmount - order.financialBreakdown.vendorEarnings);
        }

        await vendor.save();
      }
    }

    await order.save();

    // Socket notification to user
    const io = getIO();
    io.to(`user_${order.userId.toString()}`).emit('product_order_status_update', {
      orderId: order._id,
      customOrderId: order.orderId,
      status: order.status,
      paymentStatus: order.paymentStatus
    });

    sendNotificationToUser(order.userId.toString(), {
      title: `📦 Product Order Update`,
      body: `Your order #${order.orderId} status is now ${status.replace(/_/g, ' ')}`
    }).catch(err => console.error('FCM error:', err));

    return res.json({
      success: true,
      message: `Order status updated to ${status}`,
      data: order
    });

  } catch (error) {
    console.error('Update order status error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating order status' });
  }
};

/**
 * Get Vendor Product Orders List
 */
const getVendorProductOrders = async (req, res) => {
  try {
    const vendorId = req.user.id;

    // Fetch assigned orders or pending requests
    const assignedOrders = await ProductOrder.find({ vendorId })
      .populate('userId', 'name phone profilePhoto')
      .sort({ createdAt: -1 });

    const requests = await ProductOrderRequest.find({ vendorId, status: 'PENDING' })
      .populate({
        path: 'orderId',
        populate: { path: 'userId', select: 'name phone' }
      })
      .sort({ createdAt: -1 });

    const pendingAlerts = requests
      .filter(r => r.orderId && r.orderId.status === 'PENDING_ACCEPTANCE')
      .map(r => r.orderId);

    return res.json({
      success: true,
      data: {
        assignedOrders,
        pendingAlerts
      }
    });

  } catch (error) {
    console.error('Get vendor product orders error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching vendor orders' });
  }
};

/**
 * Assign Worker / Delivery Boy to Product Order
 */
const assignProductOrderWorker = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { orderId } = req.params;
    const { workerId } = req.body;

    const order = mongoose.Types.ObjectId.isValid(orderId)
      ? await ProductOrder.findById(orderId)
      : await ProductOrder.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Product order not found' });
    }

    // Ensure vendor owns or accepts order first
    if (!order.vendorId) {
      order.vendorId = vendorId;
      order.status = 'ACCEPTED';
      order.acceptedAt = new Date();
    } else if (order.vendorId.toString() !== vendorId) {
      return res.status(403).json({ success: false, message: 'Order assigned to another vendor' });
    }

    if (workerId && workerId !== 'SELF') {
      const Worker = require('../../models/Worker');
      const worker = await Worker.findById(workerId);
      if (!worker) {
        return res.status(404).json({ success: false, message: 'Selected worker not found' });
      }
      order.workerId = workerId;
      order.assignedWorkerAt = new Date();

      // Emit socket event to Worker/Delivery Boy
      const io = getIO();
      io.to(`worker_${workerId}`).emit('new_product_delivery_task', {
        orderId: order._id,
        customOrderId: order.orderId,
        items: order.items,
        deliveryAddress: order.deliveryAddress,
        contactDetails: order.contactDetails,
        totalAmount: order.financialBreakdown?.totalAmount
      });
    } else {
      order.workerId = null;
    }

    await order.save();

    return res.json({
      success: true,
      message: workerId === 'SELF' ? 'Assigned to self' : 'Product order assigned to delivery boy successfully',
      data: order
    });
  } catch (error) {
    console.error('Assign product order worker error:', error);
    return res.status(500).json({ success: false, message: 'Error assigning worker to product order' });
  }
};

module.exports = {
  updateDeliverySettings,
  getDeliverySettings,
  acceptProductOrder,
  updateOrderStatus,
  getVendorProductOrders,
  assignProductOrderWorker
};
