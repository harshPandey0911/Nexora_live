const mongoose = require('mongoose');
const { SERVICE_STATUS } = require('../utils/constants');

/**
 * Service Model (New Structure)
 * Represents individual services strictly under a Brand
 */
const serviceSchema = new mongoose.Schema({
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    // required: [true, 'Please provide a brand ID'], // Optional for vendor products
    index: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    default: null,
    index: true
  },
  categoryId: { // Explicit category link for vendor products
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
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
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

// Generate slug from title before saving
serviceSchema.pre('validate', async function (next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

module.exports = mongoose.model('Service', serviceSchema);
