const mongoose = require('mongoose');

/**
 * ServiceRequest Model
 * Stores vendor requests for new services to be added to the platform catalog.
 * Admin reviews and manually adds the service if approved.
 */
const serviceRequestSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  categoryName: {
    type: String,
    required: true,
    trim: true
  },
  serviceName: {
    type: String,
    required: true,
    trim: true
  },
  suggestedPrice: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminNote: {
    type: String,
    trim: true,
    default: ''
  },
  requestType: {
    type: String,
    enum: ['SERVICE', 'PRODUCT'],
    default: 'SERVICE'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
