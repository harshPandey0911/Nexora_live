const mongoose = require('mongoose');

const productOrderRequestSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductOrder',
    required: true,
    index: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
    default: 'PENDING',
    index: true
  },
  distance: {
    type: Number, // Distance in km
    default: null
  },
  viewedAt: { type: Date, default: null },
  respondedAt: { type: Date, default: null }
}, {
  timestamps: true
});

productOrderRequestSchema.index({ orderId: 1, vendorId: 1 }, { unique: true });

module.exports = mongoose.model('ProductOrderRequest', productOrderRequestSchema);
