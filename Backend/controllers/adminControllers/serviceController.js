const Service = require('../../models/UserService');
const Brand = require('../../models/Brand');
const Category = require('../../models/Category');
const { validationResult } = require('express-validator');
const { SERVICE_STATUS } = require('../../utils/constants');

/**
 * Derive backward-compat pricingType from bookingOptions
 * If only hourly → 'HOURLY', else → 'FIXED'
 */
const derivePricingType = (bookingOptions) => {
  const normalEnabled = bookingOptions?.normal?.enabled !== false;
  const hourlyEnabled = bookingOptions?.hourly?.enabled === true;
  if (hourlyEnabled && !normalEnabled) return 'HOURLY';
  return 'FIXED';
};

/**
 * Validate bookingOptions configuration
 * Returns null if valid, error message string if invalid
 */
const validateBookingOptions = (bookingOptions, basePrice, hourlyRate, minHours, maxHours) => {
  const normalEnabled = bookingOptions?.normal?.enabled !== false;
  const hourlyEnabled = bookingOptions?.hourly?.enabled === true;

  if (!normalEnabled && !hourlyEnabled) {
    return 'At least one booking mode (Normal or Hourly) must be enabled.';
  }

  if (normalEnabled) {
    if (!basePrice || Number(basePrice) <= 0) {
      return 'Base price must be greater than 0 for Normal Booking.';
    }
  }

  if (hourlyEnabled) {
    if (!hourlyRate || Number(hourlyRate) <= 0) {
      return 'Hourly rate must be greater than 0 for Hourly Booking.';
    }
    if (Number(minHours) < 1) {
      return 'Minimum hours must be at least 1.';
    }
    if (Number(maxHours) < Number(minHours)) {
      return 'Maximum hours cannot be less than minimum hours.';
    }
  }

  return null;
};

/**
 * Get all services (with filter by brandId)
 * GET /api/admin/services
 */
const getAllServices = async (req, res) => {
  try {
    const { status, brandId } = req.query;

    const query = {};
    if (status) query.status = status;
    if (brandId) query.brandId = brandId;
    if (req.query.isVendor === 'true') query.vendorId = { $ne: null };
    if (req.query.isVendor === 'false') query.vendorId = null;

    const services = await Service.find(query)
      .populate('brandId', 'title')
      .populate('categoryId', 'title')
      .populate('vendorId', 'name businessName')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: services.length,
      services
    });
  } catch (error) {
    console.error('Get all services error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services'
    });
  }
};

/**
 * Get single service by ID
 * GET /api/admin/services/:id
 */
const getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate('brandId', 'title')
      .populate('categoryId', 'title');

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.status(200).json({
      success: true,
      service
    });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service'
    });
  }
};

/**
 * Create new service
 * POST /api/admin/services
 */
const createService = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      brandId,
      categoryId,
      title,
      basePrice,
      gstPercentage,
      description,
      status,
      iconUrl,
      hourlyRate = 0,
      minHours = 1,
      maxHours = 8,
      // New bookingOptions structure (preferred)
      bookingOptions: reqBookingOptions,
      // Legacy pricingType support (backward compat)
      pricingType: legacyPricingType
    } = req.body;

    // Resolve bookingOptions — prefer new structure, fall back to legacy pricingType
    let bookingOptions;
    if (reqBookingOptions) {
      bookingOptions = {
        normal: { enabled: reqBookingOptions.normal?.enabled !== false },
        hourly: { enabled: reqBookingOptions.hourly?.enabled === true }
      };
    } else if (legacyPricingType === 'HOURLY') {
      // Legacy: pricingType HOURLY → hourly-only mode
      bookingOptions = { normal: { enabled: false }, hourly: { enabled: true } };
    } else {
      // Default: normal booking only
      bookingOptions = { normal: { enabled: true }, hourly: { enabled: false } };
    }

    // Validate booking options
    const validationError = validateBookingOptions(
      bookingOptions,
      basePrice,
      hourlyRate,
      minHours,
      maxHours
    );
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    // Verify brand exists
    const brand = await Brand.findById(brandId);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    // Lookup category to get offeringType
    const category = await Category.findById(categoryId);
    const offeringType = category ? (category.offeringType || 'SERVICE') : 'SERVICE';

    const normalEnabled = bookingOptions.normal.enabled;
    const hourlyEnabled = bookingOptions.hourly.enabled;

    // Compute basePrice: for normal use provided price; for hourly-only derive from rate*minHours
    const computedBasePrice = normalEnabled
      ? Number(basePrice || 0)
      : (hourlyEnabled ? Number(hourlyRate) * Number(minHours) : 0);

    // Create service
    const service = await Service.create({
      brandId,
      categoryId,
      title,
      basePrice: computedBasePrice,
      pricingType: derivePricingType(bookingOptions), // backward compat field
      hourlyRate: hourlyEnabled ? Number(hourlyRate) : 0,
      minHours: hourlyEnabled ? Number(minHours) : 1,
      maxHours: hourlyEnabled ? Number(maxHours) : 8,
      bookingOptions,
      gstPercentage: gstPercentage || 18,
      description,
      status: status || SERVICE_STATUS.ACTIVE,
      iconUrl,
      offeringType
    });

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      service
    });
  } catch (error) {
    // Handle duplicate slug error specifically
    if (error.code === 11000 && error.keyPattern && error.keyPattern.slug) {
      return res.status(409).json({
        success: false,
        message: 'A service with this name already exists for this brand.'
      });
    }

    console.error('Create service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create service'
    });
  }
};

/**
 * Update service
 * PUT /api/admin/services/:id
 */
const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // If brandId is being updated, verify it exists
    if (updates.brandId) {
      const brand = await Brand.findById(updates.brandId);
      if (!brand) {
        return res.status(404).json({
          success: false,
          message: 'Brand not found'
        });
      }
    }

    // Update basic fields
    if (updates.title) service.title = updates.title;
    if (updates.categoryId) {
      service.categoryId = updates.categoryId;
      const category = await Category.findById(updates.categoryId);
      if (category) {
        service.offeringType = category.offeringType || 'SERVICE';
      }
    }
    if (updates.gstPercentage !== undefined) service.gstPercentage = updates.gstPercentage;
    if (updates.description !== undefined) service.description = updates.description;
    if (updates.status) service.status = updates.status;
    if (updates.iconUrl !== undefined) service.iconUrl = updates.iconUrl;
    if (updates.brandId) service.brandId = updates.brandId;

    // Resolve bookingOptions from request
    let bookingOptions;
    if (updates.bookingOptions) {
      // New structure provided
      bookingOptions = {
        normal: { enabled: updates.bookingOptions.normal?.enabled !== false },
        hourly: { enabled: updates.bookingOptions.hourly?.enabled === true }
      };
    } else if (updates.pricingType !== undefined) {
      // Legacy pricingType fallback
      const isHourlyOnly = updates.pricingType === 'HOURLY';
      bookingOptions = {
        normal: { enabled: !isHourlyOnly },
        hourly: { enabled: isHourlyOnly }
      };
    } else {
      // Keep existing bookingOptions unchanged
      bookingOptions = service.bookingOptions || { normal: { enabled: true }, hourly: { enabled: false } };
    }

    // Update hourly pricing fields
    if (updates.hourlyRate !== undefined) service.hourlyRate = Number(updates.hourlyRate);
    if (updates.minHours !== undefined) service.minHours = Number(updates.minHours);
    if (updates.maxHours !== undefined) service.maxHours = Number(updates.maxHours);

    // Validate the resolved bookingOptions
    const validationError = validateBookingOptions(
      bookingOptions,
      updates.basePrice !== undefined ? updates.basePrice : service.basePrice,
      service.hourlyRate,
      service.minHours,
      service.maxHours
    );
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    // Apply bookingOptions
    service.bookingOptions = bookingOptions;
    service.pricingType = derivePricingType(bookingOptions); // keep backward compat field in sync

    const normalEnabled = bookingOptions.normal.enabled;
    const hourlyEnabled = bookingOptions.hourly.enabled;

    // Update basePrice
    if (normalEnabled && updates.basePrice !== undefined) {
      service.basePrice = Number(updates.basePrice);
    } else if (!normalEnabled && hourlyEnabled) {
      // Hourly-only: derive basePrice from hourlyRate * minHours
      service.basePrice = service.hourlyRate * service.minHours;
    }

    await service.save();

    res.status(200).json({
      success: true,
      message: 'Service updated successfully',
      service
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern && error.keyPattern.slug) {
      return res.status(409).json({
        success: false,
        message: 'A service with this name already exists for this brand.'
      });
    }

    console.error('Update service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update service'
    });
  }
};

/**
 * Delete service
 * DELETE /api/admin/services/:id
 */
const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    // Hard delete as requested
    const service = await Service.findByIdAndDelete(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Service deleted permanently'
    });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete service'
    });
  }
};

module.exports = {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService
};
