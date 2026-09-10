const mongoose = require('mongoose');
const { SERVICE_STATUS } = require('../utils/constants');

/**
 * User Service Model
 * Represents individual services strictly under a Brand
 * separate from internal services or global services
 */
const userServiceSchema = new mongoose.Schema({
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    // required: [true, 'Please provide a brand ID'],
    index: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    default: null,
    index: true
  },
  // Added based on user request "category -> brand -> service", 
  // ensuring we can link if needed, though brand already links to category.
  // Making it optional for now to avoid breaking existing flows if not sent.
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    index: true
  },
  title: {
    type: String,
    required: [true, 'Please provide a service title'],
    trim: true,
    index: true
  },
  // Removed slug as it is not needed for internal modal-based services
  iconUrl: {
    type: String,
    default: null
  },
  basePrice: {
    type: Number,
    required: [true, 'Base price is required'],
    min: [0, 'Price cannot be negative']
  },
  gstPercentage: {
    type: Number,
    required: [true, 'GST percentage is required'],
    min: 0,
    default: 18
  },
  status: {
    type: String,
    enum: Object.values(SERVICE_STATUS),
    default: SERVICE_STATUS.ACTIVE,
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  detailedDescription: {
    type: String,
    trim: true
  },
  features: [{
    type: String
  }],
  benefits: [{
    type: String
  }],
  images: [{
    type: String
  }],
  offeringType: {
    type: String,
    enum: ['SERVICE', 'PRODUCT'],
    default: 'SERVICE',
    index: true
  },
  pricingType: {
    type: String,
    enum: ['FIXED', 'HOURLY'],
    default: 'FIXED',
    index: true
  },
  hourlyRate: {
    type: Number,
    default: 0,
    min: [0, 'Hourly rate cannot be negative']
  },
  minHours: {
    type: Number,
    default: 1,
    min: [1, 'Minimum hours must be at least 1']
  },
  maxHours: {
    type: Number,
    default: 8,
    min: [1, 'Maximum hours must be at least 1']
  },
  // Booking mode availability (admin-controlled)
  // normal.enabled → standard fixed-price booking
  // hourly.enabled → per-hour rate booking
  // Both can be true simultaneously (user chooses at booking time)
  bookingOptions: {
    normal: {
      enabled: { type: Boolean, default: true }
    },
    hourly: {
      enabled: { type: Boolean, default: false }
    }
  }

}, {
  timestamps: true
});

// Compound index to ensure slug is unique PER BRAND
// Index for faster queries
userServiceSchema.index({ brandId: 1, categoryId: 1 });

module.exports = mongoose.model('UserService', userServiceSchema);
