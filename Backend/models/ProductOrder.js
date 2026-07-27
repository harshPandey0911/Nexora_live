const mongoose = require('mongoose');

const productOrderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserService',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: ''
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  gstPercentage: {
    type: Number,
    default: 18
  }
}, { _id: true });

const productOrderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    default: null,
    index: true
  },
  items: [productOrderItemSchema],
  deliveryAddress: {
    type: { type: String, default: 'home' },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    landmark: { type: String, default: '' },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  contactDetails: {
    name: { type: String, required: true },
    phone: { type: String, required: true }
  },
  paymentMethod: {
    type: String,
    enum: ['online', 'cod'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED', 'COD_PENDING', 'COD_COLLECTED'],
    default: 'PENDING'
  },
  status: {
    type: String,
    enum: ['PENDING_ACCEPTANCE', 'ACCEPTED', 'REJECTED', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
    default: 'PENDING_ACCEPTANCE',
    index: true
  },
  financialBreakdown: {
    subtotal: { type: Number, required: true },
    deliveryCharge: { type: Number, required: true, default: 0 }, // Dynamic vendor delivery charge
    tax: { type: Number, required: true, default: 0 },
    platformFee: { type: Number, required: true, default: 0 },
    totalAmount: { type: Number, required: true },
    vendorEarnings: { type: Number, required: true, default: 0 } // 100% of deliveryCharge goes to vendor + net item revenue
  },
  razorpayDetails: {
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null }
  },
  acceptedAt: { type: Date, default: null },
  dispatchedAt: { type: Date, default: null },
  deliveredAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancellationReason: { type: String, default: null }
}, {
  timestamps: true
});

productOrderSchema.index({ status: 1, vendorId: 1 });
productOrderSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ProductOrder', productOrderSchema);
