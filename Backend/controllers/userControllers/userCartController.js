const Cart = require('../../models/Cart');
const Service = require('../../models/UserService');
const { validationResult } = require('express-validator');

/**
 * Get user's cart
 */
const getUserCart = async (req, res) => {
  try {
    const userId = req.user.id;

    let cart = await Cart.findOne({ userId }).populate('items.serviceId', 'title iconUrl slug offeringType minHours maxHours basePrice hourlyRate').populate('items.categoryId', 'title slug');

    if (!cart) {
      // Create empty cart if doesn't exist
      cart = await Cart.create({ userId, items: [] });
    } else if (cart.items && cart.items.length > 1) {
      // Deduplicate any pre-existing duplicate items in the cart
      const mergedMap = new Map();
      let hasDuplicates = false;

      cart.items.forEach(item => {
        const sId = item.serviceId ? (item.serviceId._id ? item.serviceId._id.toString() : item.serviceId.toString()) : null;
        const key = sId || (item.title ? item.title.trim().toLowerCase() : item._id.toString());

        if (mergedMap.has(key)) {
          hasDuplicates = true;
          const existing = mergedMap.get(key);
          const newCount = (existing.serviceCount || 1) + (item.serviceCount || 1);
          const unit = existing.unitPrice || (existing.serviceCount ? existing.price / existing.serviceCount : existing.price) || 0;
          existing.serviceCount = newCount;
          existing.unitPrice = unit;
          existing.price = unit * newCount;
        } else {
          mergedMap.set(key, item);
        }
      });

      if (hasDuplicates) {
        cart.items = Array.from(mergedMap.values());
        await cart.save();
      }
    }

    res.status(200).json({
      success: true,
      data: cart.items || []
    });
  } catch (error) {
    console.error('Get user cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cart. Please try again.'
    });
  }
};

/**
 * Add item to cart
 */
const addToCart = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const {
      serviceId,
      categoryId,
      title,
      description,
      icon,
      category,
      price,
      originalPrice,
      unitPrice,
      serviceCount,
      rating,
      reviews,
      vendorId,
      sectionTitle, // Brand name
      sectionIcon,  // Brand logo URL
      card,          // Card details snapshot
      gstPercentage
    } = req.body;

    console.log(`[AddToCart] Request details - Title: ${title}, Section: ${sectionTitle}`);

    // Verify service exists (only if serviceId is provided)
    let service = null;
    if (serviceId) {
      service = await Service.findById(serviceId);
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }
    }

    const isHourly = req.body.bookingType === 'HOURLY';
    let durationHours = 1;
    let hourlyRate = 0;
    let computedUnitPrice = unitPrice || (price && serviceCount ? price / serviceCount : price) || 0;

    if (service) {
      // Resolve effective bookingOptions (new structure) with backward compat fallback
      const bookingOpts = service.bookingOptions || {
        normal: { enabled: service.pricingType !== 'HOURLY' },
        hourly: { enabled: service.pricingType === 'HOURLY' }
      };

      if (isHourly) {
        // Validate that hourly mode is enabled for this service
        if (!bookingOpts.hourly?.enabled) {
          return res.status(400).json({
            success: false,
            message: 'This service does not support Hourly booking.'
          });
        }

        durationHours = Number(req.body.durationHours || service.minHours || 1);
        const minHours = service.minHours || 1;
        const maxHours = service.maxHours || 8;

        if (durationHours < minHours || durationHours > maxHours) {
          return res.status(400).json({
            success: false,
            message: `Selected duration (${durationHours} hrs) is outside allowed range (${minHours}-${maxHours} hrs).`
          });
        }

        hourlyRate = service.hourlyRate || 0;
        if (hourlyRate <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Invalid hourly service configuration.'
          });
        }
        computedUnitPrice = hourlyRate * durationHours;
      } else {
        // Normal/FIXED booking
        if (!bookingOpts.normal?.enabled) {
          return res.status(400).json({
            success: false,
            message: 'This service does not support Normal booking. Please select Hourly booking.'
          });
        }
      }
    }

    // Get or create cart
    let cart = await Cart.findOne({ userId });

    console.log(`[AddToCart] User: ${userId}, Cart Found: ${!!cart}`);

    if (!cart) {
      console.log('[AddToCart] Creating new cart');
      cart = await Cart.create({ userId, items: [] });
    }

    // Category & Shop/Vendor Validation: Ensure all items belong to the same category and vendor
    if (cart.items && cart.items.length > 0) {
      if (req.body.replaceCart) {
        cart.items = [];
      } else {
        // 1. Check Vendor / Shop Conflict
        const getVendorKey = (item) => {
          if (!item) return '';
          if (item.vendorId) return String(item.vendorId._id || item.vendorId).trim();
          if (item.sectionTitle) return String(item.sectionTitle).trim().toLowerCase();
          return '';
        };

        const existingVendorKey = getVendorKey(cart.items[0]);
        const newVendorKey = getVendorKey({ vendorId, sectionTitle });

        if (existingVendorKey && newVendorKey && existingVendorKey !== newVendorKey) {
          return res.status(400).json({
            success: false,
            categoryConflict: true,
            shopConflict: true,
            existingShopName: cart.items[0].sectionTitle || cart.items[0].category || 'current shop',
            message: 'Your cart already contains items from another shop/restaurant. You can only order from one shop at a time.'
          });
        }

        // 2. Check Category Conflict
        const getCatKey = (item) => {
          if (!item) return '';
          if (item.categoryId) return String(item.categoryId._id || item.categoryId).trim().toLowerCase();
          if (item.category) return String(item.category).trim().toLowerCase();
          return '';
        };

        const existingKey = getCatKey(cart.items[0]);
        const newKey = getCatKey({ categoryId, category });

        if (existingKey && newKey && existingKey !== newKey) {
          return res.status(400).json({
            success: false,
            categoryConflict: true,
            message: 'Your cart already contains services from another category. You can only book one service category in a single booking.'
          });
        }
      }
    }

    // Check if item already exists in cart
    // Key includes bookingType so Normal and Hourly of same service are distinct items
    const requestedBookingType = isHourly ? 'HOURLY' : 'FIXED';
    const existingItemIndex = cart.items.findIndex(item => {
      const sId1 = item.serviceId ? (item.serviceId._id ? item.serviceId._id.toString() : item.serviceId.toString()) : null;
      const sId2 = serviceId ? serviceId.toString() : null;
      const typeMatch = (item.bookingType || 'FIXED') === requestedBookingType;
      if (sId1 && sId2) {
        return sId1 === sId2 && typeMatch;
      }
      return item.title && title && item.title.trim().toLowerCase() === title.trim().toLowerCase() && typeMatch;
    });

    if (existingItemIndex !== -1) {
      // Update quantity if item exists
      const addedCount = serviceCount || 1;
      const newCount = (cart.items[existingItemIndex].serviceCount || 1) + addedCount;
      const unit = isHourly ? computedUnitPrice : (cart.items[existingItemIndex].unitPrice || computedUnitPrice);
      const newPrice = unit * newCount;

      cart.items[existingItemIndex].serviceCount = newCount;
      cart.items[existingItemIndex].unitPrice = unit;
      cart.items[existingItemIndex].price = newPrice;
      if (isHourly) {
        cart.items[existingItemIndex].bookingType = 'HOURLY';
        cart.items[existingItemIndex].durationHours = durationHours;
        cart.items[existingItemIndex].hourlyRate = hourlyRate;
      }
    } else {
      // Add new item
      const count = serviceCount || 1;
      const unit = computedUnitPrice;

      const newItem = {
        title,
        description: description || '',
        icon: icon || '',
        category: category || 'General',
        price: unit * count,
        originalPrice: originalPrice || null,
        unitPrice: unit,
        serviceCount: count,
        rating: rating || '4.8',
        reviews: reviews || '10k+',
        vendorId: vendorId || null,
        sectionTitle: sectionTitle || '',
        sectionIcon: sectionIcon || null,
        offeringType: req.body.offeringType || service?.offeringType || (['food', 'products', 'product', 'grocery', 'store', 'items', 'snack', 'beverage'].some(k => String(category || '').toLowerCase().includes(k)) ? 'PRODUCT' : 'SERVICE'),
        bookingType: isHourly ? 'HOURLY' : 'FIXED',
        durationHours: isHourly ? durationHours : 1,
        hourlyRate: isHourly ? hourlyRate : 0,
        card: card || null,
        gstPercentage: gstPercentage !== undefined ? gstPercentage : (service?.gstPercentage !== undefined ? service.gstPercentage : 18)
      };

      // Only add serviceId and categoryId if they are provided
      if (serviceId) newItem.serviceId = serviceId;
      if (categoryId) newItem.categoryId = categoryId;

      console.log(`[AddToCart] Adding new item: ${title}`);
      cart.items.push(newItem);
    }

    await cart.save();
    console.log(`[AddToCart] Cart saved. Total items: ${cart.items.length}`);

    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      data: cart.items
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add item to cart. Please try again.'
    });
  }
};

/**
 * Update cart item quantity
 */
const updateCartItem = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { itemId } = req.params;
    const { serviceCount } = req.body;

    console.log("req.params.itemId:", itemId);
    console.log("typeof req.params.itemId:", typeof itemId);

    if (serviceCount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(item => {
      const subId = item._id ? item._id.toString() : '';
      const sId = item.serviceId ? (item.serviceId._id ? item.serviceId._id.toString() : item.serviceId.toString()) : '';
      return subId === itemId || sId === itemId || item.id === itemId;
    });

    console.log("findIndex result:", itemIndex);

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    const item = cart.items[itemIndex];
    if (serviceCount) {
      item.serviceCount = serviceCount;
    }

    // Direct mode switch support (FIXED <-> HOURLY)
    if (req.body.bookingType) {
      const newType = req.body.bookingType;
      const service = item.serviceId ? (item.serviceId.maxHours !== undefined ? item.serviceId : await Service.findById(item.serviceId._id || item.serviceId)) : null;
      
      if (newType === 'HOURLY') {
        const minH = service?.minHours || 1;
        const maxH = service?.maxHours || 8;
        const rate = service?.hourlyRate || item.hourlyRate || Math.round((item.unitPrice || item.price || 200) / minH);
        let dur = Number(req.body.durationHours || item.durationHours || minH);
        dur = Math.max(minH, Math.min(maxH, dur));
        
        item.bookingType = 'HOURLY';
        item.durationHours = dur;
        item.hourlyRate = rate;
        item.unitPrice = rate * dur;
      } else {
        // FIXED / Normal booking
        const base = service?.basePrice || item.unitPrice || item.price || 200;
        item.bookingType = 'FIXED';
        item.durationHours = 1;
        item.unitPrice = base;
      }
    } else if (req.body.durationHours && (item.bookingType === 'HOURLY' || item.hourlyRate > 0)) {
      const service = item.serviceId ? (item.serviceId.maxHours !== undefined ? item.serviceId : await Service.findById(item.serviceId._id || item.serviceId)) : null;
      const minH = service?.minHours || 1;
      const maxH = service?.maxHours || 8;
      let dur = Number(req.body.durationHours);
      if (dur < minH || dur > maxH) {
        return res.status(400).json({
          success: false,
          message: `Duration hours must be between ${minH} and ${maxH} hours`
        });
      }
      item.durationHours = dur;
      item.unitPrice = (item.hourlyRate || 0) * dur;
    }

    item.price = item.unitPrice * item.serviceCount;
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart item updated',
      data: cart.items
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cart item. Please try again.'
    });
  }
};

/**
 * Remove item from cart
 */
const removeFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;

    console.log("req.params.itemId:", itemId);
    console.log("typeof req.params.itemId:", typeof itemId);

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = cart.items.filter(item => {
      const subId = item._id ? item._id.toString() : '';
      const sId = item.serviceId ? (item.serviceId._id ? item.serviceId._id.toString() : item.serviceId.toString()) : '';
      return subId !== itemId && sId !== itemId && item.id !== itemId;
    });

    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: cart.items
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item from cart. Please try again.'
    });
  }
};

/**
 * Clear cart (remove all items)
 */
const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = [];
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart cleared',
      data: []
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart. Please try again.'
    });
  }
};

/**
 * Remove items by category
 */
const removeCategoryItems = async (req, res) => {
  try {
    const userId = req.user.id;
    const { category } = req.params;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = cart.items.filter(item => item.category !== category);
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Category items removed from cart',
      data: cart.items
    });
  } catch (error) {
    console.error('Remove category items error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove category items. Please try again.'
    });
  }
};

module.exports = {
  getUserCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  removeCategoryItems
};

