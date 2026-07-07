const Vendor = require('../../models/Vendor');
const Category = require('../../models/Category');
const Booking = require('../../models/Booking');
const Service = require('../../models/UserService');
const { validationResult } = require('express-validator');

/**
 * Get all services/categories assigned to the vendor with performance stats
 */
const getMyServices = async (req, res) => {
  try {
    const vendorId = req.user.id;
    console.log('[getMyServices] vendorId:', vendorId);

    // 1. Fetch vendor to get assigned categories
    const vendor = await Vendor.findById(vendorId).select('service categories');
    if (!vendor) {
      console.log('[getMyServices] Vendor not found');
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // Combine 'service' and 'categories' arrays (handle legacy data)
    const assignedCategoryNames = Array.from(new Set([...(vendor.service || []), ...(vendor.categories || [])]));
    console.log('[getMyServices] assignedCategoryNames:', assignedCategoryNames);

    if (assignedCategoryNames.length === 0) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    // 2. Fetch Category details:
    // - Categories assigned by name in the vendor profile
    // - Categories created specifically by this vendor (using vendorId)
    const categories = await Category.find({
      $or: [
        { title: { $in: assignedCategoryNames.map(name => new RegExp(`^${name}$`, 'i')) } },
        { vendorId: vendorId }
      ],
      status: 'active'
    }).select('title imageUrl homeIconUrl description slug vendorId');

    console.log(`[getMyServices] Found ${categories.length} total categories (assigned + custom) for vendor ${vendorId}`);

    // 3. For each category, calculate performance stats
    const servicesWithStats = await Promise.all(categories.map(async (cat) => {
      // Get booking stats for this specific category and vendor
      const stats = await Booking.aggregate([
        {
          $match: {
            vendorId: vendor._id,
            serviceName: { $regex: new RegExp(cat.title, 'i') } // Rough match by name
          }
        },
        {
          $group: {
            _id: null,
            totalJobs: { $sum: 1 },
            completedJobs: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            totalRating: { $sum: '$rating' },
            ratingCount: {
              $sum: { $cond: [{ $gt: ['$rating', 0] }, 1, 0] }
            }
          }
        }
      ]);

      const catStats = stats[0] || { totalJobs: 0, completedJobs: 0, totalRating: 0, ratingCount: 0 };

      // Fetch all services for this category by this vendor to get offeringType
      const categoryServices = await Service.find({ categoryId: cat._id, vendorId: vendor._id }).select('offeringType').lean();
      const offeringType = categoryServices.length > 0 ? categoryServices[0].offeringType : 'SERVICE';

      return {
        id: cat._id,
        title: cat.title,
        slug: cat.slug,
        imageUrl: cat.imageUrl,
        iconUrl: cat.homeIconUrl,
        description: cat.description,
        status: 'Active', // Authorized by admin
        offeringType,
        stats: {
          totalJobs: catStats.totalJobs,
          completedJobs: catStats.completedJobs,
          rating: catStats.ratingCount > 0
            ? parseFloat((catStats.totalRating / catStats.ratingCount).toFixed(1))
            : 0.0
        }
      };
    }));

    res.status(200).json({
      success: true,
      data: servicesWithStats
    });

  } catch (error) {
    console.error('Get My Services error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your service portfolio'
    });
  }
};

/**
 * Get vendor's services (Old/Generic implementation)
 */
const getVendorServices = async (req, res) => {
  // Keep for backward compatibility or other uses
  res.status(200).json({ success: true, data: [] });
};

/**
 * Update service availability (enable/disable)
 */
const updateServiceAvailability = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { isAvailable } = req.body;
    res.status(200).json({ success: true, message: 'Updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Set service pricing
 */
const setServicePricing = async (req, res) => {
  try {
    res.status(200).json({ success: true, message: 'Pricing updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Add a custom category by vendor
 */
const addVendorCategory = async (req, res) => {
  try {
    const { title, description, imageUrl, homeIconUrl } = req.body;
    const vendorId = req.user.id;
    const vendor = await Vendor.findById(vendorId).select('cityId');
    const cityIds = vendor?.cityId ? [vendor.cityId] : [];

    if (!title) {
      return res.status(400).json({ success: false, message: 'Category title is required' });
    }

    const category = await Category.create({
      title,
      description,
      imageUrl,
      homeIconUrl: homeIconUrl || imageUrl,
      vendorId,
      cityIds,
      offeringType: req.body.offeringType || 'SERVICE', // New: Allow vendor to set type
      status: 'active',
      showOnHome: true
    });

    res.status(201).json({
      success: true,
      message: 'Category added successfully',
      data: category
    });
  } catch (error) {
    console.error('Add Vendor Category error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Add a custom service/product by vendor
 */
  const addVendorService = async (req, res) => {
  try {
    const { serviceId, title, description, basePrice, categoryId, iconUrl, detailedDescription, features, benefits, images, offeringType } = req.body;
    const vendorId = req.user.id;

    // Handle subscription to Admin Master Service
    if (serviceId) {
      const masterService = await Service.findOne({ _id: serviceId, vendorId: null });
      if (!masterService) {
        return res.status(404).json({ success: false, message: 'Master service not found' });
      }

      const existing = await Service.findOne({ title: masterService.title, vendorId });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Service already exists in your portfolio' });
      }

      const service = await Service.create({
        title: masterService.title,
        description: masterService.description,
        basePrice: masterService.basePrice, // Fixed price set by Admin
        categoryId: categoryId || masterService.categoryId,
        vendorId,
        iconUrl: masterService.iconUrl,
        detailedDescription: masterService.detailedDescription,
        features: masterService.features,
        benefits: masterService.benefits,
        images: masterService.images,
        offeringType: offeringType || masterService.offeringType || 'SERVICE',
        status: 'active'
      });

      return res.status(201).json({ success: true, message: 'Service subscribed successfully', data: service });
    }

    if (!title || !basePrice || !categoryId) {
      return res.status(400).json({ success: false, message: 'Title, price, and category are required' });
    }

    let finalCategoryId = categoryId;

    // Handle Platform Groups (Needs, Delivery, Home, etc.)
    const platformGroups = ['Needs', 'Delivery', 'Home', 'Health', 'More'];
    if (platformGroups.includes(categoryId)) {
      const groupLabels = {
        'Needs': 'Daily Needs',
        'Delivery': 'Delivery Services',
        'Home': 'Home Services',
        'Health': 'Health & Care',
        'More': 'More Services'
      };

      // Find or create a vendor category for this group
      let vendorCat = await Category.findOne({ 
        vendorId, 
        group: categoryId,
        status: 'active'
      });

      if (!vendorCat) {
        const vendor = await Vendor.findById(vendorId).select('cityId');
        vendorCat = await Category.create({
          title: groupLabels[categoryId],
          group: categoryId,
          vendorId,
          offeringType: offeringType || 'SERVICE',
          status: 'active',
          showOnHome: true,
          cityIds: vendor?.cityId ? [vendor.cityId] : []
        });
      }
      finalCategoryId = vendorCat._id;
    }

    const service = await Service.create({
      title,
      description,
      basePrice,
      categoryId: finalCategoryId,
      vendorId,
      iconUrl,
      detailedDescription,
      features,
      benefits,
      images,
      offeringType: offeringType || 'SERVICE',
      status: 'active'
    });

    // New: Sync offeringType to parent category so it shows in correct section on Home Page
    if (offeringType) {
      await Category.findByIdAndUpdate(finalCategoryId, { offeringType });
    }

    res.status(201).json({
      success: true,
      message: 'Service added successfully',
      data: service
    });
  } catch (error) {
    console.error('Add Vendor Service error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Remove a service/category from vendor's portfolio
 */
const removeVendorService = async (req, res) => {
  try {
    const { categoryId } = req.params; // This can be a category ID or a service/product ID
    const vendorId = req.user.id;

    // Check if valid ObjectId to prevent CastError/Server Crash
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      console.warn(`[removeVendorService] Invalid ID received: ${categoryId}`);
      return res.status(400).json({ success: false, message: 'Invalid Item ID' });
    }

    console.log(`[removeVendorService] Removing item ${categoryId} for vendor ${vendorId}`);

    // 1. Try finding it in Category first
    const category = await Category.findById(categoryId);
    
    if (!category) {
      // 2. If not a category, try finding it in Service (for custom products/services)
      const service = await Service.findById(categoryId);
      if (!service) {
        return res.status(404).json({ success: false, message: 'Item not found' });
      }

      // Check ownership
      if (service.vendorId && service.vendorId.toString() === vendorId.toString()) {
        service.status = 'inactive';
        await service.save();
        return res.status(200).json({
          success: true,
          message: `Product "${service.title}" removed`
        });
      } else {
        return res.status(403).json({ success: false, message: 'Not authorized to remove this item' });
      }
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    // 3. If it's a custom category created by THIS vendor
    if (category.vendorId && category.vendorId.toString() === vendorId.toString()) {
      // Option A: Set to inactive so it doesn't show up but history is preserved
      category.status = 'inactive';
      await category.save();

      // NEW: Also mark all products/services under this category as inactive
      await Service.updateMany(
        { categoryId: category._id, vendorId: vendorId },
        { status: 'inactive' }
      );
      
      console.log(`[removeVendorService] Custom category ${category.title} and its items marked inactive`);
    }

    // 4. Always remove from the vendor's assigned list (handles both platform and custom)
    const categoryTitle = category.title;

    // Remove from 'service' array
    if (vendor.service && vendor.service.length > 0) {
      vendor.service = vendor.service.filter(s => s.toLowerCase() !== categoryTitle.toLowerCase());
    }

    // Remove from 'categories' array
    if (vendor.categories && vendor.categories.length > 0) {
      vendor.categories = vendor.categories.filter(c => c.toLowerCase() !== categoryTitle.toLowerCase());
    }

    await vendor.save();

    res.status(200).json({
      success: true,
      message: `Service "${categoryTitle}" removed from your portfolio`
    });

  } catch (error) {
    console.error('Remove Vendor Service error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove item' });
  }
};

/**
 * Get all custom content (categories and services) created by this vendor
 */
const getMyCustomContent = async (req, res) => {
  try {
    const vendorId = req.user.id;
    console.log('[getMyCustomContent] vendorId:', vendorId);

    const categories = await Category.find({ vendorId, status: 'active' });
    
    // Find all services created by this vendor
    const services = await Service.find({ vendorId, status: 'active' });

    res.status(200).json({
      success: true,
      data: {
        categories,
        services
      }
    });
  } catch (error) {
    console.error('Get My Custom Content error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your custom content'
    });
  }
};

/**
 * Update a custom category by vendor
 */
const updateVendorCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { title, description, imageUrl, homeIconUrl } = req.body;
    const vendorId = req.user.id;

    const category = await Category.findOne({ _id: categoryId, vendorId: vendorId });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found or not owned by you' });
    }

    if (title) category.title = title;
    if (description) category.description = description;
    if (imageUrl) category.imageUrl = imageUrl;
    if (homeIconUrl) category.homeIconUrl = homeIconUrl;

    await category.save();

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });
  } catch (error) {
    console.error('Update Vendor Category error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get a specific service by ID
 */
const getVendorServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = req.user.id;

    const service = await Service.findOne({ _id: id, vendorId });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.status(200).json({ success: true, data: service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update a specific service by ID
 */
const updateVendorService = async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = req.user.id;
    const updates = req.body;

    const service = await Service.findOneAndUpdate(
      { _id: id, vendorId },
      { $set: updates },
      { new: true }
    );

    if (!service) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.status(200).json({ success: true, message: 'Updated successfully', data: service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getMyServices,
  getVendorServices,
  updateServiceAvailability,
  setServicePricing,
  addVendorCategory,
  addVendorService,
  getMyCustomContent,
  removeVendorService,
  updateVendorCategory,
  getVendorServiceById,
  updateVendorService
};
