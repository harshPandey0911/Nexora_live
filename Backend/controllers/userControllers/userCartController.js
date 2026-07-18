const Cart = require('../../models/Cart');
const Service = require('../../models/UserService');
const { validationResult } = require('express-validator');

/**
 * Get user's cart
 */
const getUserCart = async (req, res) => {
  try {
    const userId = req.user.id;

    let cart = await Cart.findOne({ userId }).populate('items.serviceId', 'title iconUrl slug offeringType').populate('items.categoryId', 'title slug');

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

    // Get or create cart
    let cart = await Cart.findOne({ userId });

    console.log(`[AddToCart] User: ${userId}, Cart Found: ${!!cart}`);

    if (!cart) {
      console.log('[AddToCart] Creating new cart');
      cart = await Cart.create({ userId, items: [] });
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(item => {
      const sId1 = item.serviceId ? (item.serviceId._id ? item.serviceId._id.toString() : item.serviceId.toString()) : null;
      const sId2 = serviceId ? serviceId.toString() : null;
      if (sId1 && sId2) {
        return sId1 === sId2;
      }
      return item.title && title && item.title.trim().toLowerCase() === title.trim().toLowerCase();
    });

    if (existingItemIndex !== -1) {
      // Update quantity if item exists
      const existingItem = cart.items[existingItemIndex];
      const addedCount = serviceCount || 1;
      const newCount = (existingItem.serviceCount || 1) + addedCount;
      const unit = existingItem.unitPrice || (existingItem.serviceCount ? existingItem.price / existingItem.serviceCount : existingItem.price) || (unitPrice || price || 0);
      const newPrice = unit * newCount;

      cart.items[existingItemIndex].serviceCount = newCount;
      cart.items[existingItemIndex].unitPrice = unit;
      cart.items[existingItemIndex].price = newPrice;
    } else {
      // Add new item
      const count = serviceCount || 1;
      const unit = unitPrice || (price && count ? price / count : price) || 0;

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

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    const item = cart.items[itemIndex];
    item.serviceCount = serviceCount;
    item.price = item.unitPrice * serviceCount;
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

