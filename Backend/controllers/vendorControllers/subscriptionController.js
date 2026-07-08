const Plan = require('../../models/Plan');
const Vendor = require('../../models/Vendor');
const { createOrder, verifyPayment } = require('../../services/razorpayService');

// Create Order for Subscription
exports.createSubscriptionOrder = async (req, res) => {
  try {
    const { planId } = req.body;
    const vendorId = req.user.id;

    if (!planId) {
      return res.status(400).json({ success: false, message: 'Plan ID is required' });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    // Amount in paise
    const amount = Math.round(plan.price * 100);
    const currency = 'INR';
    const receipt = `sub_receipt_${vendorId.substring(0, 5)}_${Date.now()}`;

    const orderResult = await createOrder(amount, currency, receipt);
    if (!orderResult.success) {
      return res.status(500).json({ success: false, message: orderResult.error });
    }

    res.status(200).json({
      success: true,
      order: orderResult.order,
      plan: {
        id: plan._id,
        name: plan.name,
        price: plan.price
      }
    });
  } catch (error) {
    console.error('Create Subscription Order Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// Verify Payment and Activate Subscription
exports.verifySubscriptionPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;
    const vendorId = req.user.id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planId) {
      return res.status(400).json({ success: false, message: 'Missing payment details' });
    }

    // Verify signature
    const isValid = verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    // Calculate expiry date (based on validityMonths or duration, default 1 month)
    const validityMonths = parseInt(plan.duration) || 1;
    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + validityMonths);

    // Update vendor subscription
    const vendor = await Vendor.findByIdAndUpdate(
      vendorId,
      {
        $set: {
          subscription: {
            planId: plan._id,
            status: 'active',
            startDate,
            expiryDate,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id
          }
        }
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Subscription activated successfully!',
      subscription: vendor.subscription
    });
  } catch (error) {
    console.error('Verify Subscription Payment Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// Get Subscription Status
exports.getSubscriptionStatus = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const vendor = await Vendor.findById(vendorId).populate('subscription.planId', 'name price duration');

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    res.status(200).json({
      success: true,
      subscription: vendor.subscription || { status: 'inactive' }
    });
  } catch (error) {
    console.error('Get Subscription Status Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
