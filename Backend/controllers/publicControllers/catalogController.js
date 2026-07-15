const mongoose = require('mongoose');
const Category = require('../../models/Category');
const Brand = require('../../models/Brand');
const Service = require('../../models/UserService');
const HomeContent = require('../../models/HomeContent');
const Booking = require('../../models/Booking');
const Review = require('../../models/Review');

/**
 * Public Catalog Controllers
 * These endpoints are accessible without authentication for user app
 */

/**
 * Get all active categories for user app
 * GET /api/public/categories
 */
const getPublicCategories = async (req, res) => {
  try {
    const { cityId } = req.query;
    const City = require('../../models/City');
    const Vendor = require('../../models/Vendor');
    const { findNearbyVendors } = require('../../services/locationService');

    const cityDoc = cityId ? await City.findById(cityId).select('name').lean() : null;
    const cityName = cityDoc ? cityDoc.name : '';

    // Build query
    const query = { status: 'active' };
    if (cityId) {
      query.$or = [
        { vendorId: null, cityIds: cityId },
        { vendorId: { $ne: null } }
      ];
    }

    const allCategories = await Category.find(query)
      .select('title slug homeIconUrl homeBadge hasSaleBadge homeOrder showOnHome vendorId cityIds description group')
      .sort({ homeOrder: 1, createdAt: -1 })
      .lean();

    // Filter categories based on vendor availability (regardless of online status)
    const filteredCategories = await Promise.all(allCategories.map(async (cat) => {
      // 1. If it's a platform category (no vendorId), always return it so vendors can see and join
      if (!cat.vendorId) {
        return cat;
      }

      // 2. If it's a vendor-specific category
      if (cat.vendorId) {
        const ownerVendor = await Vendor.findById(cat.vendorId).select('address status');
        if (!ownerVendor) return null;

        // NEW: If offeringType filter is provided, check if the vendor has items of that type in this category
        if (req.query.offeringType) {
          const Service = require('../../models/UserService');
          const hasMatchingItems = await Service.exists({
            categoryId: cat._id,
            vendorId: cat.vendorId,
            status: 'active',
            offeringType: req.query.offeringType
          });
          if (!hasMatchingItems) return null;
        }

        if (cityName && ownerVendor.address?.city) {
          const isMatch = new RegExp(cityName, 'i').test(ownerVendor.address.city);
          return isMatch ? cat : null;
        }
        return cat;
      }

      return null;
    }));

    const categories = filteredCategories.filter(Boolean);

    // Group categories by title to avoid duplicates for the user
    const groupedMap = new Map();
    categories.forEach(cat => {
      const normalizedTitle = cat.title.trim().toLowerCase();
      if (!groupedMap.has(normalizedTitle)) {
        groupedMap.set(normalizedTitle, {
          id: cat._id.toString(),
          title: cat.title,
          slug: cat.slug,
          icon: cat.homeIconUrl || '',
          badge: cat.homeBadge || '',
          hasSaleBadge: cat.hasSaleBadge || false,
          showOnHome: cat.showOnHome || false,
          group: cat.group || 'None'
        });
      }
    });

    const initialCategories = Array.from(groupedMap.values());

    res.status(200).json({
      success: true,
      categories: initialCategories
    });
  } catch (error) {
    console.error('Get public categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories. Please try again.'
    });
  }
};

/**
 * Get all active brands for user app (Formerly Services)
 * GET /api/public/brands
 */
const getPublicBrands = async (req, res) => {
  try {
    const { categoryId, categorySlug, search, cityId } = req.query;

    // Grouping support: If categoryId or categorySlug is provided, find all related categories by title
    let categoryIds = [];
    if (categoryId) {
      const targetCat = await Category.findById(categoryId).select('title');
      if (targetCat) {
        const relatedCats = await Category.find({ title: { $regex: new RegExp(`^${targetCat.title}$`, 'i') } }).select('_id');
        categoryIds = relatedCats.map(c => c._id);
      } else {
        categoryIds = [categoryId];
      }
    } else if (categorySlug) {
      const targetCat = await Category.findOne({ slug: categorySlug }).select('title');
      if (targetCat) {
        const relatedCats = await Category.find({ title: { $regex: new RegExp(`^${targetCat.title}$`, 'i') } }).select('_id');
        categoryIds = relatedCats.map(c => c._id);
      }
    }

    // Build query
    const query = { status: 'active' };
    if (categoryIds.length > 0) query.categoryIds = { $in: categoryIds };
    if (cityId) query.cityIds = cityId;

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.title = { $regex: escapedSearch, $options: 'i' };
    }

    let brands = await Brand.find(query)
      .select('title slug iconUrl logo imageUrl badge categoryIds basePrice discountPrice sections')
      .sort({ homeOrder: 1, createdAt: -1 })
      .lean();

    // 2. ALSO check for vendor-specific services/products in these categories
    if (categoryIds.length > 0) {
      const vendorServices = await Service.find({
        categoryId: { $in: categoryIds },
        status: 'active'
      })
        .populate({
          path: 'vendorId',
          select: 'name businessName profilePhoto isOnline availability'
        })
        .lean();

      const onlineVendorServices = vendorServices.filter(svc => svc.vendorId);

      if (onlineVendorServices.length > 0) {
        // Create virtual brands for each unique vendor
        const vendorMap = new Map();
        onlineVendorServices.forEach(svc => {
          const vId = svc.vendorId._id.toString();
          if (!vendorMap.has(vId)) {
            // Check if this vendor is already represented as a Brand (unlikely but safe)
            const alreadyExists = brands.some(b => b.vendorId?.toString() === vId);
            if (!alreadyExists) {
              vendorMap.set(vId, {
                id: vId,
                title: svc.vendorId.businessName || svc.vendorId.name,
                slug: `vendor-${vId}`,
                icon: svc.vendorId.profilePhoto || '',
                logo: svc.vendorId.profilePhoto || '',
                imageUrl: svc.vendorId.profilePhoto || '',
                badge: 'Vendor',
                categoryId: categoryId || (categoryIds.length > 0 ? categoryIds[0] : null),
                vendorId: svc.vendorId._id,
                isVendor: true
              });
            }
          }
        });

        // Combine static brands with dynamic vendor brands
        const dynamicBrands = Array.from(vendorMap.values());
        brands = [...brands, ...dynamicBrands];
      }
    }

    res.status(200).json({
      success: true,
      brands: brands.map(brand => ({
        id: brand.id || brand._id.toString(),
        title: brand.title,
        slug: brand.slug,
        icon: brand.iconUrl || brand.icon || '',
        logo: brand.logo || brand.iconUrl || brand.icon || '',
        imageUrl: brand.imageUrl || brand.iconUrl || brand.icon || '',
        badge: brand.badge || '',
        price: brand.basePrice || 0, // Legacy support
        originalPrice: brand.discountPrice ? (brand.basePrice + brand.discountPrice) : (brand.basePrice || 0),
        categoryId: brand.categoryId || (brand.categoryIds && brand.categoryIds.length > 0 ? brand.categoryIds[0].toString() : null),
        categoryIds: brand.categoryIds ? brand.categoryIds.map(id => id.toString()) : [brand.categoryId?.toString()],
        sections: brand.sections || [],
        vendorId: brand.vendorId || null,
        isVendor: brand.isVendor || false
      }))
    });
  } catch (error) {
    console.error('Get public brands error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch brands. Please try again.'
    });
  }
};

/**
 * Get brand by slug for user app
 * GET /api/public/brands/slug/:slug
 */
const getPublicBrandBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const brand = await Brand.findOne({ slug, status: 'active' })
      .populate('categoryIds', 'title slug')
      .lean();

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    // Remove _id from nested objects
    const cleanBrand = JSON.parse(JSON.stringify(brand));
    const removeIds = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(item => {
          if (item && typeof item === 'object') {
            const { _id, ...rest } = item;
            return removeIds(rest);
          }
          return item;
        });
      } else if (obj && typeof obj === 'object') {
        const { _id, ...rest } = obj;
        return Object.keys(rest).reduce((acc, key) => {
          acc[key] = removeIds(rest[key]);
          return acc;
        }, {});
      }
      return obj;
    };

    // Fetch services associated with this brand
    const brandServices = await Service.find({ brandId: brand._id, status: 'active' }).lean();

    const serviceIds = brandServices.map(svc => svc._id);

    // Get average ratings and total reviews count grouped by serviceId
    const [reviewStats, bookingStats] = await Promise.all([
      Review.aggregate([
        { $match: { serviceId: { $in: serviceIds }, status: 'active' } },
        {
          $group: {
            _id: '$serviceId',
            avgRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 }
          }
        }
      ]),
      Booking.aggregate([
        { $match: { serviceId: { $in: serviceIds } } },
        {
          $group: {
            _id: '$serviceId',
            totalBookings: { $sum: 1 }
          }
        }
      ])
    ]);

    const ratingMap = {};
    const bookingCountMap = {};
    
    reviewStats.forEach(stat => {
      if (stat._id) {
        ratingMap[stat._id.toString()] = stat.avgRating;
      }
    });

    bookingStats.forEach(stat => {
      if (stat._id) {
        bookingCountMap[stat._id.toString()] = stat.totalBookings;
      }
    });

    // Map services to a default section structure for the frontend
    const servicesSection = {
      title: brand.title,
      subtitle: 'Available Services',
      cards: brandServices.map(svc => {
        const ratingVal = ratingMap[svc._id.toString()];
        const bookingsVal = bookingCountMap[svc._id.toString()] || 0;
        return {
          id: svc._id.toString(),
          title: svc.title,
          subtitle: svc.description || '',
          price: svc.basePrice,
          rating: ratingVal ? ratingVal.toFixed(1) : "5.0",
          reviews: bookingsVal > 0 ? `${bookingsVal}+ Bookings` : "New",
          imageUrl: svc.iconUrl || brand.iconUrl || '',
          features: svc.description ? [svc.description] : [],
          duration: "60 min" // Default duration
        };
      })
    };

    const formattedBrand = {
      id: brand._id.toString(),
      title: brand.title,
      slug: brand.slug,
      icon: brand.iconUrl || '',
      logo: brand.logo || '',
      badge: brand.badge || '',
      basePrice: brand.basePrice, // Legacy
      category: brand.categoryIds && brand.categoryIds[0] ? {
        id: brand.categoryIds[0]._id.toString(),
        title: brand.categoryIds[0].title,
        slug: brand.categoryIds[0].slug
      } : null,
      categories: (brand.categoryIds || []).map(cat => ({
        id: cat._id.toString(),
        title: cat.title,
        slug: cat.slug
      })),
      page: brand.page ? removeIds(brand.page) : {
        banners: brand.iconUrl ? [{ imageUrl: brand.iconUrl, text: brand.title }] : [],
        paymentOffers: [],
        paymentOffersEnabled: false
      },
      sections: brandServices.length > 0 ? [servicesSection] : []
    };

    res.status(200).json({
      success: true,
      brand: formattedBrand
    });
  } catch (error) {
    console.error('Get public brand by slug error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch brand. Please try again.'
    });
  }
};

/**
 * Get services based on brand
 * GET /api/public/services
 */
const getPublicServices = async (req, res) => {
  try {
    const { brandId, brandSlug, categoryId, offeringType } = req.query;

    const query = { status: 'active' };
    
    if (offeringType) {
      query.offeringType = offeringType;
    }

    if (brandId) {
      query.brandId = brandId;
    } else if (brandSlug) {
      const brand = await Brand.findOne({ slug: brandSlug });
      if (brand) {
        query.brandId = brand._id;
      } else {
        return res.status(200).json({ success: true, services: [] });
      }
    }

    if (categoryId) {
      const targetCat = await Category.findById(categoryId).select('title');
      if (targetCat) {
        const relatedCats = await Category.find({ title: { $regex: new RegExp(`^${targetCat.title}$`, 'i') } }).select('_id');
        query.categoryId = { $in: relatedCats.map(c => c._id) };
      } else {
        query.categoryId = categoryId;
      }

      // If fetching by category and brandId is a vendor ID
      if (brandId && brandId.toString().length > 10) {
        query.vendorId = brandId;
        delete query.brandId;
      }
    }

    if (req.query.search) {
      const escapedSearch = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.title = { $regex: escapedSearch, $options: 'i' };
    }

    const services = await Service.find(query)
      .populate({
        path: 'vendorId',
        select: 'name businessName profilePhoto isOnline availability'
      })
      .populate('brandId', 'title iconUrl')
      .populate('categoryId', 'title status')
      .sort({ createdAt: 1 })
      .lean();

    const finalServices = services.filter(svc => {
      if (svc.categoryId && svc.categoryId.status === 'inactive') return false;
      return true;
    });

    const finalServiceIds = finalServices.map(svc => svc._id);

    // Get average ratings and total reviews count grouped by serviceId
    const [reviewStats, bookingStats] = await Promise.all([
      Review.aggregate([
        { $match: { serviceId: { $in: finalServiceIds }, status: 'active' } },
        {
          $group: {
            _id: '$serviceId',
            avgRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 }
          }
        }
      ]),
      Booking.aggregate([
        { $match: { serviceId: { $in: finalServiceIds } } },
        {
          $group: {
            _id: '$serviceId',
            totalBookings: { $sum: 1 }
          }
        }
      ])
    ]);

    const ratingMap = {};
    const bookingCountMap = {};
    
    reviewStats.forEach(stat => {
      if (stat._id) {
        ratingMap[stat._id.toString()] = stat.avgRating;
      }
    });

    bookingStats.forEach(stat => {
      if (stat._id) {
        bookingCountMap[stat._id.toString()] = stat.totalBookings;
      }
    });

    res.status(200).json({
      success: true,
      services: finalServices.map(svc => {
        const ratingVal = ratingMap[svc._id.toString()];
        const bookingsVal = bookingCountMap[svc._id.toString()] || 0;
        return {
          id: svc._id.toString(),
          title: svc.title,
          slug: svc.slug,
          icon: svc.iconUrl,
          basePrice: svc.basePrice,
          gstPercentage: svc.gstPercentage,
          description: svc.description,
          brandId: svc.brandId?._id,
          brandName: svc.brandId?.title,
          brandIcon: svc.brandId?.iconUrl,
          vendorId: svc.vendorId?._id,
          vendorName: svc.vendorId?.businessName || svc.vendorId?.name,
          vendorPhoto: svc.vendorId?.profilePhoto,
          categoryId: svc.categoryId?._id,
          categoryTitle: svc.categoryId?.title,
          rating: ratingVal ? ratingVal.toFixed(1) : "5.0",
          bookingsCount: bookingsVal
        };
      })
    });
  } catch (error) {
    console.error('Get public services error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services'
    });
  }
};

/**
 * Get single service details for user app
 * GET /api/public/services/:id
 */
const getPublicServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const svc = await Service.findById(id)
      .populate({
        path: 'vendorId',
        select: 'name businessName profilePhoto isOnline availability'
      })
      .populate('categoryId', 'title')
      .lean();

    if (!svc) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Fetch average rating and total bookings count for this specific service
    const [reviewStats, totalBookings] = await Promise.all([
      Review.aggregate([
        { $match: { serviceId: new mongoose.Types.ObjectId(id), status: 'active' } },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 }
          }
        }
      ]),
      Booking.countDocuments({ serviceId: id })
    ]);

    const avgRating = reviewStats[0]?.avgRating;
    const totalReviews = reviewStats[0]?.totalReviews || 0;

    res.status(200).json({
      success: true,
      service: {
        id: svc._id.toString(),
        title: svc.title,
        iconUrl: svc.iconUrl,
        basePrice: svc.basePrice,
        gstPercentage: svc.gstPercentage,
        description: svc.description,
        detailedDescription: svc.detailedDescription,
        features: svc.features || [],
        benefits: svc.benefits || [],
        images: svc.images || [],
        vendorId: svc.vendorId?._id,
        vendorName: svc.vendorId?.businessName || svc.vendorId?.name,
        vendorPhoto: svc.vendorId?.profilePhoto,
        categoryId: svc.categoryId?._id,
        categoryTitle: svc.categoryId?.title,
        rating: avgRating ? avgRating.toFixed(1) : "5.0",
        bookingsCount: totalBookings,
        reviewsCount: totalReviews
      }
    });
  } catch (error) {
    console.error('Get public service details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product details'
    });
  }
};

/**
 * Get home content
 */
const getPublicHomeContent = async (req, res) => {
  try {
    const { cityId } = req.query;
    const homeContent = await HomeContent.getHomeContent(cityId);

    if (!homeContent) {
      return res.status(200).json({
        success: true,
        homeContent: {
          banners: [],
          promos: [],
          curated: [],
          noteworthy: [],
          booked: [],
          categorySections: []
        }
      });
    }

    // Used for backwards compatibility, we might need to update this to refer to Brands?
    // For now keeping as is, but assuming targetServiceId will point to Brand ID essentially.

    const contentObj = homeContent.toObject();

    const formattedContent = {
      banners: (contentObj.banners || []).map(item => ({
        ...item,
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      promos: (contentObj.promos || []).map(item => ({
        ...item,
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      curated: (contentObj.curated || []).map(item => ({
        ...item,
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      noteworthy: (contentObj.noteworthy || []).map(item => ({
        ...item,
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      booked: (contentObj.booked || []).map(item => ({
        ...item,
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      categorySections: (contentObj.categorySections || []).map(section => ({
        ...section,
        id: section._id ? section._id.toString() : section.id,
        seeAllTargetCategoryId: section.seeAllTargetCategoryId?.toString() || null,
        seeAllTargetServiceId: section.seeAllTargetServiceId?.toString() || null,
        cards: (section.cards || []).map(card => ({
          ...card,
          id: card._id ? card._id.toString() : card.id,
          targetCategoryId: card.targetCategoryId?.toString() || null,
          targetServiceId: card.targetServiceId?.toString() || null,
        }))
      })),
      isBannersVisible: contentObj.isBannersVisible ?? true,
      isPromosVisible: contentObj.isPromosVisible ?? true,
      isCuratedVisible: contentObj.isCuratedVisible ?? true,
      isNoteworthyVisible: contentObj.isNoteworthyVisible ?? true,
      isBookedVisible: contentObj.isBookedVisible ?? true,
      isCategorySectionsVisible: contentObj.isCategorySectionsVisible ?? true,
      isCategoriesVisible: contentObj.isCategoriesVisible ?? true,
      isAboutUsVisible: contentObj.isAboutUsVisible ?? true,
      isOffersVisible: contentObj.isOffersVisible ?? true,
      isContactUsVisible: contentObj.isContactUsVisible ?? true,
      aboutUs: contentObj.aboutUs || null,
      offers: contentObj.offers || null,
      contactUs: contentObj.contactUs || null
    };

    res.status(200).json({
      success: true,
      homeContent: formattedContent
    });

  } catch (error) {
    console.error('Get public home content error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home content. Please try again.'
    });
  }
};

/**
 * Get consolidated home data (Categories + Content)
 */
const getPublicHomeData = async (req, res) => {
  try {
    const { cityId, lat, lng } = req.query;
    const userLocation = (lat && lng) ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null;

    const City = require('../../models/City');

    // Fetch categories, home content and city details in parallel
    // Always try city-specific first, then fall back to global default
    const [allCategories, citySpecificContent, defaultContent, cityDoc] = await Promise.all([
      Category.find({ status: 'active', showOnHome: true })
        .select('title slug homeIconUrl homeBadge hasSaleBadge showOnHome vendorId cityIds description group offeringType')
        .sort({ homeOrder: 1, createdAt: -1 })
        .lean(),
      cityId ? HomeContent.findOne({ cityId }) : null,
      HomeContent.findOne({ cityId: null }),
      cityId ? City.findById(cityId).select('name').lean() : null
    ]);

    // Use city-specific content if it has meaningful data (heroSection with imageUrl),
    // otherwise fall back to the global default document
    let homeContent = null;
    if (cityId && citySpecificContent && citySpecificContent.heroSection?.imageUrl) {
      homeContent = citySpecificContent;
    } else if (defaultContent) {
      homeContent = defaultContent;
    } else {
      homeContent = await HomeContent.getHomeContent(null);
    }

    const cityName = cityDoc ? cityDoc.name : '';

    const { findNearbyVendors } = require('../../services/locationService');
    const Vendor = require('../../models/Vendor');

    // Filter categories based on city assignment (regardless of vendor online status)
    const nearbyCategories = await Promise.all(allCategories.map(async (cat) => {
      // 1. If it's a platform category (no vendorId)
      if (!cat.vendorId) {
        // If it doesn't belong to the current city, skip it early
        if (cityId && cat.cityIds && !cat.cityIds.some(id => id.toString() === cityId)) {
          return null;
        }
        return cat;
      }

      // 2. If it's a vendor-specific category
      if (cat.vendorId) {
        const ownerVendor = await Vendor.findById(cat.vendorId).select('address name');
        if (!ownerVendor) {
          return null;
        }

        // Fallback: If city filter applied, verify vendor matches city
        if (cityName && ownerVendor.address?.city) {
          const isMatch = new RegExp(cityName, 'i').test(ownerVendor.address.city);
          return isMatch ? cat : null;
        }

        return cat;
      }

      return null;
    }));

    const categoriesRes = nearbyCategories.filter(Boolean);

    // Group categories by title to avoid duplicates
    const groupedMapRes = new Map();
    categoriesRes.forEach(cat => {
      const normalizedTitle = cat.title.trim().toLowerCase();
      if (!groupedMapRes.has(normalizedTitle)) {
        groupedMapRes.set(normalizedTitle, {
          id: cat._id.toString(),
          title: cat.title,
          slug: cat.slug,
          icon: cat.homeIconUrl || '',
          badge: cat.homeBadge || '',
          hasSaleBadge: cat.hasSaleBadge || false,
          showOnHome: cat.showOnHome || false,
          group: cat.group || 'None',
          description: cat.description || '',
          offeringType: cat.offeringType || 'SERVICE'
        });
      }
    });

    const formattedCategories = Array.from(groupedMapRes.values());

    let formattedContent = null;
    if (homeContent) {
      const contentObj = homeContent.toObject();
      formattedContent = {
        banners: (contentObj.banners || []).map(item => ({
          imageUrl: item.imageUrl,
          targetCategoryId: item.targetCategoryId?.toString() || null,
          slug: item.slug,
          order: item.order
        })),
        promos: (contentObj.promos || []).map(item => ({
          title: item.title,
          subtitle: item.subtitle,
          imageUrl: item.imageUrl,
          targetCategoryId: item.targetCategoryId?.toString() || null,
          order: item.order
        })),
        curated: (contentObj.curated || []).map(item => ({
          title: item.title,
          gifUrl: item.gifUrl,
          order: item.order
        })),
        noteworthy: (contentObj.noteworthy || []).map(item => ({
          title: item.title,
          imageUrl: item.imageUrl,
          targetCategoryId: item.targetCategoryId?.toString() || null,
          order: item.order
        })),
        booked: (contentObj.booked || []).map(item => ({
          title: item.title,
          rating: item.rating,
          price: item.price,
          imageUrl: item.imageUrl,
          targetCategoryId: item.targetCategoryId?.toString() || null,
          order: item.order
        })),
        categorySections: (contentObj.categorySections || []).map(section => ({
          title: section.title,
          seeAllTargetCategoryId: section.seeAllTargetCategoryId?.toString() || null,
          cards: (section.cards || []).map(card => ({
            title: card.title,
            imageUrl: card.imageUrl,
            price: card.price,
            rating: card.rating,
            targetCategoryId: card.targetCategoryId?.toString() || null
          })),
          order: section.order
        })),
        isBannersVisible: contentObj.isBannersVisible ?? true,
        isPromosVisible: contentObj.isPromosVisible ?? true,
        isCuratedVisible: contentObj.isCuratedVisible ?? true,
        isNoteworthyVisible: contentObj.isNoteworthyVisible ?? true,
        isBookedVisible: contentObj.isBookedVisible ?? true,
        isCategorySectionsVisible: contentObj.isCategorySectionsVisible ?? true,
        isCategoriesVisible: contentObj.isCategoriesVisible ?? true,
        isStatsVisible: contentObj.isStatsVisible ?? true,
        isAppDownloadVisible: contentObj.isAppDownloadVisible ?? true,
        isOrderTrackingVisible: contentObj.isOrderTrackingVisible ?? true,
        isHowItWorksVisible: contentObj.isHowItWorksVisible ?? true,
        heroSection: contentObj.heroSection || null,
        stats: contentObj.stats || [],
        appDownload: contentObj.appDownload || null,
        navLinks: contentObj.navLinks || [],
        siteIdentity: contentObj.siteIdentity || null,
        howItWorks: contentObj.howItWorks || null,
        isAboutUsVisible: contentObj.isAboutUsVisible ?? true,
        isOffersVisible: contentObj.isOffersVisible ?? true,
        isContactUsVisible: contentObj.isContactUsVisible ?? true,
        aboutUs: contentObj.aboutUs || null,
        offers: contentObj.offers || null,
        contactUs: contentObj.contactUs || null
      };
    }

    res.status(200).json({
      success: true,
      categories: formattedCategories,
      homeContent: formattedContent
    });
  } catch (error) {
    console.error('Get public home data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home data'
    });
  }
};

module.exports = {
  getPublicCategories,
  getPublicBrands,
  getPublicBrandBySlug,
  getPublicServices,
  getPublicServiceById,
  getPublicHomeContent,
  getPublicHomeData
};
