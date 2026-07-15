import React, { useState, useEffect, useLayoutEffect, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { themeColors, getColorWithOpacity } from '../../../../theme';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import HeroBanner from './components/HeroBanner';
import ServiceQuickLinks from './components/ServiceQuickLinks';
import ServiceCategories from './components/ServiceCategories';
import { publicCatalogService } from '../../../../services/catalogService';
import { useCart } from '../../../../context/CartContext';
import { useCity } from '../../../../context/CityContext';
import { toast } from 'react-hot-toast';
import { registerFCMToken } from '../../../../services/pushNotificationService';
import { motion } from 'framer-motion';

// Lazy load heavy components for better initial load performance
import PromoCarousel from './components/PromoCarousel';
// Lazy load OTHER heavy components
const NewAndNoteworthy = lazy(() => import('./components/NewAndNoteworthy'));
const MostBookedServices = lazy(() => import('./components/MostBookedServices'));
const CuratedServices = lazy(() => import('./components/CuratedServices'));
const ServiceSectionWithRating = lazy(() => import('./components/ServiceSectionWithRating'));
const Banner = lazy(() => import('./components/Banner'));
const ReferEarnSection = lazy(() => import('./components/ReferEarnSection'));
import CategoryModal from './components/CategoryModal';
import SearchOverlay from './components/SearchOverlay';
import OfferBannerSlider from './components/OfferBannerSlider';
import userBannerService from '../../../../services/userBannerService';
import LogoLoader from '../../../../components/common/LogoLoader';
import AddressSelectionModal from '../Checkout/components/AddressSelectionModal';
import ScrapPromotionCard from './components/ScrapPromotionCard';
const OrderTrackingBar = lazy(() => import('./components/OrderTrackingBar'));
const StatsBar = lazy(() => import('./components/StatsBar'));
const AppDownloadBanner = lazy(() => import('./components/AppDownloadBanner'));
const HowItWorks = lazy(() => import('./components/HowItWorks'));
const AboutUs = lazy(() => import('./components/AboutUs'));
const OffersSection = lazy(() => import('./components/OffersSection'));
const ContactUs = lazy(() => import('./components/ContactUs'));




const Home = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Handle Hash Scroll
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500); // Wait for content to load
    }
  }, [location.hash]);

  const toAssetUrl = (url) => {
    if (!url) return '';
    const clean = url.replace('/api/upload', '/upload');
    if (clean.startsWith('http')) return clean;
    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/api$/, '');
    return `${base}${clean.startsWith('/') ? '' : '/'}${clean}`;
  };

  const [address, setAddress] = useState(localStorage.getItem('currentAddress') || 'Select Location');
  const [coords, setCoords] = useState(() => {
    const saved = localStorage.getItem('currentCoords');
    return saved ? JSON.parse(saved) : null;
  });
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [houseNumber, setHouseNumber] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLocationSupported, setIsLocationSupported] = useState(true);
  const [detectedCityName, setDetectedCityName] = useState(localStorage.getItem('currentCity') || null);


  const { cartCount, addToCart } = useCart();
  const { currentCity, cities, selectCity, loading: cityLoading } = useCity();

  // Clean up legacy storage keys on mount
  useEffect(() => {
    ['userAddress', 'detectedCity', 'user_formatted_address', 'user_city'].forEach(key => localStorage.removeItem(key));
  }, []);

  // Sync detectedCityName with Address on mount/update if not already set
  useEffect(() => {
    if (address && address !== 'Select Location' && cities && cities.length > 0) {
      const foundCity = cities.find(c =>
        address.toLowerCase().includes(c.name.toLowerCase())
      );
      if (foundCity) {
        if (detectedCityName !== foundCity.name) {
          setDetectedCityName(foundCity.name);
          localStorage.setItem('currentCity', foundCity.name);
        }
      } else {
        // Address is present but doesn't contain any supported city name
        // Try to parse ANY city from the address string (e.g. "Bhopal")
        const parts = address.split(',').map(p => p.trim());
        // Usually city is 2nd or 3rd to last in Google address strings
        const cityCandidate = parts.length > 2 ? parts[parts.length - 3] : (parts.length > 1 ? parts[parts.length - 2] : parts[0]);

        if (detectedCityName !== cityCandidate) {
          setDetectedCityName(cityCandidate);
          localStorage.setItem('currentCity', cityCandidate);
        }
        setIsLocationSupported(false);
      }
    }
  }, [address, cities, detectedCityName]);

  // Validate city whenever detected name or cities list changes
  useEffect(() => {
    if (!detectedCityName || !cities || cities.length === 0) return;

    const matchedCity = cities.find(c =>
      c.name.toLowerCase() === detectedCityName.toLowerCase() ||
      c.name.toLowerCase().includes(detectedCityName.toLowerCase()) ||
      detectedCityName.toLowerCase().includes(c.name.toLowerCase())
    );

    if (matchedCity) {
      setIsLocationSupported(true);
      const matchedId = matchedCity._id || matchedCity.id;
      const currentId = currentCity?._id || currentCity?.id;

      if (!cityLoading && currentId && matchedId !== currentId) {
        selectCity(matchedCity);
        toast.success(`Location updated to ${matchedCity.name}`);
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    } else {
      setIsLocationSupported(false);
      if (currentCity) selectCity(null);
    }
  }, [detectedCityName, cities, currentCity, cityLoading]);


  const handleAddressSave = (savedHouseNumber, locationObj) => {
    if (locationObj) {
      const newAddress = locationObj.address;
      setAddress(newAddress);
      localStorage.setItem('currentAddress', newAddress);

      // Try to parse city from location object (Google Places)
      const components = locationObj.components || locationObj.address_components;
      let city = '';
      if (components) {
        const getComponent = (type) => components.find(c => c.types.includes(type))?.long_name || '';
        city = getComponent('locality') || getComponent('administrative_area_level_2');
      }

      // Fallback city parsing from address string if components failed
      if (!city && newAddress) {
        const parts = newAddress.split(',').map(p => p.trim());
        city = parts.length > 2 ? parts[parts.length - 3] : (parts.length > 1 ? parts[parts.length - 2] : parts[0]);
      }

      if (city) {
        setDetectedCityName(city);
        localStorage.setItem('currentCity', city);

        // Immediate update of selected city if supported
        if (cities && cities.length > 0) {
          const matchedCity = cities.find(c =>
            c.name.toLowerCase() === city.toLowerCase() ||
            c.name.toLowerCase().includes(city.toLowerCase()) ||
            city.toLowerCase().includes(c.name.toLowerCase())
          );
          if (matchedCity) {
            selectCity(matchedCity);
          } else {
            selectCity(null);
          }
        }

        toast.success(`Location set to ${city}`);
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
      if (locationObj.lat && locationObj.lng) {
        const newCoords = { lat: locationObj.lat, lng: locationObj.lng };
        setCoords(newCoords);
        localStorage.setItem('currentCoords', JSON.stringify(newCoords));
      }
    }
    setHouseNumber(savedHouseNumber);
    setIsAddressModalOpen(false);
  };

  // Auto-detect location on mount
  useEffect(() => {
    const autoDetectLocation = async () => {
      if (navigator.geolocation) {
        if (address === 'Select Location') {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                const { latitude, longitude } = position.coords;
                const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
                const response = await fetch(
                  `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
                );
                const data = await response.json();

                if (data.status === 'OK' && data.results.length > 0) {
                  const result = data.results[0];
                  const getComponent = (type) =>
                    result.address_components.find(c => c.types.includes(type))?.long_name || '';

                  const area = getComponent('sublocality_level_1') || getComponent('neighborhood') || getComponent('locality');
                  const city = getComponent('locality') || getComponent('administrative_area_level_2');
                  const state = getComponent('administrative_area_level_1');

                  const formattedAddress = `${area}, ${city}, ${state}`;
                  setAddress(formattedAddress);
                  localStorage.setItem('currentAddress', formattedAddress);

                  if (city) {
                    setDetectedCityName(city);
                    localStorage.setItem('currentCity', city);

                    // Immediate update of selected city if supported
                    if (cities && cities.length > 0) {
                      const matchedCity = cities.find(c =>
                        c.name.toLowerCase() === city.toLowerCase() ||
                        c.name.toLowerCase().includes(city.toLowerCase()) ||
                        city.toLowerCase().includes(c.name.toLowerCase())
                      );
                      if (matchedCity) {
                        selectCity(matchedCity);
                      } else {
                        selectCity(null);
                      }
                    }

                    // Save coords for distance filtering
                    const newCoords = { lat: latitude, lng: longitude };
                    setCoords(newCoords);
                    localStorage.setItem('currentCoords', JSON.stringify(newCoords));
                  }
                }
              } catch (error) {
                // Silent fail
              }
            },
            (error) => {
              console.log("GPS Error:", error);
            },
            {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0
            }
          );
        }
      }
    };

    autoDetectLocation();

    // Register FCM token for user to receive push notifications
    registerFCMToken('user', true).catch(err => {/* Silent fail */ });
  }, []);

  const [categories, setCategories] = useState([]);
  const [homeContent, setHomeContent] = useState(null);
  const [offerBanners, setOfferBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  // Handle scroll separately (only when needed)
  useEffect(() => {
    if (location.state?.scrollToTop) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      window.history.replaceState({}, '', location.pathname);
    } else if (location.hash) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        const id = location.hash.replace('#', '');
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 500);
    }
  }, [location.state?.scrollToTop, location.pathname, location.hash]);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Fetch categories and home content on mount (and when city changes)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const cityId = currentCity?._id || currentCity?.id;

        const response = await publicCatalogService.getHomeData(cityId, coords);

        if (response.success) {
          if (response.categories) {
            const mappedCategories = response.categories.map(cat => ({
              id: cat.id,
              title: cat.title,
              slug: cat.slug,
              icon: toAssetUrl(cat.icon),
              hasSaleBadge: cat.hasSaleBadge,
              badge: cat.badge,
              description: cat.description,
              offeringType: cat.offeringType || 'SERVICE'
            }));
            setCategories(mappedCategories);
          }

          if (response.homeContent) {
            setHomeContent(response.homeContent);
          }
        }

        setLoading(false);
      } catch (error) {
        setLoading(false);
      }
    };

    const fetchBanners = async () => {
      try {
        const response = await userBannerService.getActiveBanners();
        if (response.success) {
          setOfferBanners(response.data);
        }
      } catch (error) {
        console.error('Error fetching banners:', error);
      }
    };

    fetchData();
    fetchBanners();
  }, [currentCity, coords]);

  // Split categories for display
  const { serviceCategories, productCategories } = React.useMemo(() => {
    return {
      serviceCategories: categories.filter(c => c.offeringType === 'SERVICE'),
      productCategories: categories.filter(c => c.offeringType === 'PRODUCT')
    };
  }, [categories]);

  // Open category modal from navigation state (e.g. from Cart 'Add Services')
  useEffect(() => {
    if (!loading && categories.length > 0 && (location.state?.openCategoryId || location.state?.openCategoryName)) {
      const targetId = location.state.openCategoryId;
      const targetName = location.state.openCategoryName;

      const cat = categories.find(c =>
        (targetId && (c.id === targetId || c._id === targetId)) ||
        (targetName && c.title === targetName)
      );

      if (cat) {
        handleCategoryClick(cat);
        // Clear state to prevent reopening on subsequent renders/refreshes
        window.history.replaceState({}, '', location.pathname);
      }
    }
  }, [loading, categories, location.state]);

  const handleSearch = (query) => {
    // Navigate to search results page
  };

  const handleCategoryClick = (category) => {
    if (category.offeringType === 'PRODUCT') {
      navigate(`/user/products?categoryId=${category.id || category._id}&type=PRODUCT`);
    } else {
      navigate(`/user/services?categoryId=${category.id || category._id}&type=SERVICE`);
    }
  };

  const handlePromoClick = (promo) => {
    if (promo.targetCategoryId) {
      const cat = categories.find(c => (c.id === promo.targetCategoryId || c._id === promo.targetCategoryId));
      if (cat) {
        handleCategoryClick(cat);
        return;
      }
    }
    if (promo.route && !promo.slug) {
      if (promo.scrollToSection) {
        navigate(promo.route, {
          state: { scrollToSection: promo.scrollToSection }
        });
      } else {
        navigate(promo.route);
      }
    }
  };

  const handleServiceClick = (service) => {
    if (!service) return;
    if (service.targetCategoryId) {
      const cat = categories.find(c => (c.id === service.targetCategoryId || c._id === service.targetCategoryId));
      if (cat) {
        handleCategoryClick(cat);
        return;
      }
    }
    // Fallback if no targetCategoryId but has slug/title, we no longer navigate to slug
  };

  const handleAddClick = async (service) => {
    try {
      if (service.targetCategoryId) {
        const cat = categories.find(c => c.id === service.targetCategoryId);
        if (cat) {
          handleCategoryClick(cat);
          return;
        }
      }

      if (service.serviceId && service.categoryId) {
        const cartItemData = {
          serviceId: service.serviceId,
          categoryId: service.categoryId,
          title: service.title,
          description: service.subtitle || service.description || '',
          icon: service.image || '',
          category: service.category || 'Service',
          price: parseInt(service.price?.toString().replace(/,/g, '') || 0),
          originalPrice: service.originalPrice ? parseInt(service.originalPrice.toString().replace(/,/g, '')) : null,
          unitPrice: parseInt(service.price?.toString().replace(/,/g, '') || 0),
          serviceCount: 1,
          rating: service.rating || "4.8",
          reviews: service.reviews || "10k+",
          vendorId: service.vendorId || null,
          sectionId: service.sectionId || null, // VITAL: Added for plan benefits
          gstPercentage: service.gstPercentage
        };

        const response = await addToCart(cartItemData);
        if (response.success) {
          toast.success(`${service.title} added to cart!`);
          navigate('/user/cart');
        } else {
          toast.error(response.message || 'Failed to add to cart');
        }
      } else {
        if (service.targetCategoryId) {
          const cat = categories.find(c => (c.id === service.targetCategoryId || c._id === service.targetCategoryId));
          if (cat) {
            handleCategoryClick(cat);
          } else {
            toast.error('Unable to add this service to cart.');
          }
        } else {
          toast.error('Unable to add this service to cart.');
        }
      }
    } catch (error) {
      toast.error('Failed to add to cart. Please try again.');
    }
  };

  const handleReferClick = () => {
    navigate('/user/rewards');
  };

  const handleLocationClick = () => {
    setIsAddressModalOpen(true);
  };

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15
      }
    }
  };

  const hasTopLevelInfo = (homeContent?.isHowItWorksVisible !== false && homeContent?.howItWorks?.items?.length > 0) ||
                          (homeContent?.isOffersVisible !== false && homeContent?.offers?.items?.length > 0);

  const hasAnySection = (homeContent?.curated?.length > 0 && homeContent?.isCuratedVisible !== false) ||
                        (homeContent?.noteworthy?.length > 0 && homeContent?.isNoteworthyVisible !== false) ||
                        (homeContent?.booked?.length > 0 && homeContent?.isBookedVisible !== false) ||
                        ((homeContent?.categorySections || []).length > 0 && homeContent?.isCategorySectionsVisible !== false);

  if (loading) {
    return <LogoLoader />;
  }

  return (
    <div className="min-h-screen pb-20 relative bg-transparent">
      {/* Refined Brand Mesh Gradient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0"
          style={{
            background: `
              radial-gradient(at 0% 0%, ${getColorWithOpacity('teal', 0.08)} 0%, transparent 70%),
              radial-gradient(at 100% 0%, ${getColorWithOpacity('teal', 0.05)} 0%, transparent 70%),
              radial-gradient(at 100% 100%, ${getColorWithOpacity('teal', 0.03)} 0%, transparent 75%),
              radial-gradient(at 0% 100%, ${getColorWithOpacity('teal', 0.04)} 0%, transparent 70%),
              #FFFFFF
            `
          }}
        />
        {/* Elegant Dot Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(var(--brand-teal) 0.8px, transparent 0.8px)`,
            backgroundSize: '32px 32px'
          }}
        />
      </div>

      <motion.div
        className="relative z-10"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.div
          variants={itemVariants}
          className="backdrop-blur-xl sticky top-0 z-50 border-b border-black/[0.03] transition-all duration-300"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.4)' }}
        >
          <Header
            location={address}
            onLocationClick={handleLocationClick}
            navLinks={homeContent?.navLinks}
            siteIdentity={homeContent?.siteIdentity}
            homeContent={homeContent}
          />
        </motion.div>

        {!isSearchOpen && (
          <HeroBanner 
            banners={offerBanners} 
            onSearchClick={() => navigate('/user/services')} 
            heroData={homeContent?.heroSection}
          />
        )}





        {/* Top-level Info Sections (Requested at Top) */}
        {hasTopLevelInfo && (
          <div className="space-y-4 lg:space-y-6 mt-4 lg:mt-6">
            {homeContent?.isHowItWorksVisible !== false && homeContent?.howItWorks?.items?.length > 0 && (
              <Suspense fallback={<div className="h-40 bg-gray-50 animate-pulse rounded-xl mx-4" />}>
                <div id="how-it-works">
                  <HowItWorks data={homeContent?.howItWorks} />
                </div>
              </Suspense>
            )}

            {homeContent?.isOffersVisible !== false && homeContent?.offers?.items?.length > 0 && (
              <Suspense fallback={<div className="h-40 bg-gray-50 animate-pulse rounded-xl mx-4" />}>
                <div id="offers">
                  <OffersSection data={homeContent?.offers} />
                </div>
              </Suspense>
            )}
          </div>
        )}

        {/* Services & Products Sections */}
        {homeContent?.isCategoriesVisible !== false && (
          <div className="space-y-0 lg:space-y-4">
            {/* Services Section */}
            {serviceCategories.length > 0 && (
              <motion.section variants={itemVariants} id="services">
                <ServiceQuickLinks 
                  title="Our Services"
                  categories={serviceCategories} 
                  onCategoryClick={handleCategoryClick} 
                  onSeeAllClick={() => navigate('/user/services')}
                />
              </motion.section>
            )}

            {/* Products Section */}
            {productCategories.length > 0 && (
              <motion.section variants={itemVariants} id="products">
                <ServiceQuickLinks 
                  title="Our Products"
                  categories={productCategories} 
                  onCategoryClick={handleCategoryClick} 
                  onSeeAllClick={() => navigate('/user/products')}
                />
              </motion.section>
            )}
          </div>
        )}





        {/* Hero Section - Promo Carousel */}
        {homeContent?.isPromosVisible !== false && homeContent?.promos?.length > 0 && (
          <motion.section variants={itemVariants} className="relative z-0">
            <PromoCarousel
              promos={(homeContent?.promos || []).sort((a, b) => (a.order || 0) - (b.order || 0)).map(promo => ({
                id: promo.id || promo._id,
                title: promo.title || '',
                subtitle: promo.subtitle || promo.description || '',
                buttonText: promo.buttonText || 'Book now',
                className: promo.gradientClass || 'from-[#00A6A6] to-[#008a8a]',
                image: toAssetUrl(promo.imageUrl),
                targetCategoryId: promo.targetCategoryId,
                slug: promo.slug,
                scrollToSection: promo.scrollToSection,
                route: '/'
              }))}
              onPromoClick={handlePromoClick}
            />
          </motion.section>
        )}

        <main className="pt-4 lg:pt-6 space-y-4 lg:space-y-6 pb-6 lg:pb-8 max-w-[1400px] mx-auto w-full">
              {/* All Categories Section (Optional/Secondary) */}
              {/* Categories Section removed as redundant with QuickLinks */}



              {/* Curated Services */}
              {homeContent?.isCuratedVisible !== false && homeContent?.curated?.length > 0 && (
                <motion.div variants={itemVariants}>
                  <Suspense fallback={<div className="h-40 bg-gray-50 animate-pulse rounded-xl mx-4" />}>
                    <CuratedServices
                      services={(homeContent?.curated || []).sort((a, b) => (a.order || 0) - (b.order || 0)).map(item => ({
                        id: item.id || item._id,
                        title: item.title,
                        gif: toAssetUrl(item.gifUrl),
                        slug: item.slug,
                        targetCategoryId: item.targetCategoryId
                      }))}
                      onServiceClick={handleServiceClick}
                    />
                  </Suspense>
                </motion.div>
              )}

              {/* New & Noteworthy */}
              {homeContent?.isNoteworthyVisible !== false && homeContent?.noteworthy?.length > 0 && (
                <motion.div variants={itemVariants}>
                  <Suspense fallback={<div className="h-40 bg-gray-50 animate-pulse rounded-xl mx-4" />}>
                    <NewAndNoteworthy
                      services={(homeContent?.noteworthy || []).sort((a, b) => (a.order || 0) - (b.order || 0)).map(item => ({
                        id: item.id || item._id,
                        title: item.title,
                        image: toAssetUrl(item.imageUrl),
                        slug: item.slug,
                        targetCategoryId: item.targetCategoryId
                      }))}
                      onServiceClick={handleServiceClick}
                    />
                  </Suspense>
                </motion.div>
              )}

              {/* Most Booked */}
              {homeContent?.isBookedVisible !== false && homeContent?.booked?.length > 0 && (
                <motion.div variants={itemVariants}>
                  <Suspense fallback={<div className="h-40 bg-gray-50 animate-pulse rounded-xl mx-4" />}>
                    <MostBookedServices
                      services={(homeContent?.booked || []).sort((a, b) => (a.order || 0) - (b.order || 0)).map(item => ({
                        id: item.id || item._id,
                        title: item.title,
                        rating: item.rating,
                        reviews: item.reviews,
                        price: item.price,
                        originalPrice: item.originalPrice,
                        discount: item.discount,
                        image: toAssetUrl(item.imageUrl),
                        targetCategoryId: item.targetCategoryId,
                        slug: item.slug
                      }))}
                      onServiceClick={handleServiceClick}
                      onAddClick={handleAddClick}
                    />
                  </Suspense>
                </motion.div>
              )}



              {/* Dynamic Sections */}
              {homeContent?.isCategorySectionsVisible !== false && (homeContent?.categorySections || []).sort((a, b) => (a.order || 0) - (b.order || 0)).map((section, sIdx) => (
                <motion.div key={section._id || sIdx} variants={itemVariants}>
                  <Suspense fallback={<div className="h-40 bg-gray-50 animate-pulse rounded-xl mx-4" />}>
                    <ServiceSectionWithRating
                      title={section.title}
                      subtitle={section.subtitle}
                      services={section.cards?.map((card, cIdx) => {
                        const processedImage = toAssetUrl(card.imageUrl);
                        return {
                          id: card._id || cIdx,
                          title: card.title,
                          rating: card.rating || "4.8",
                          reviews: card.reviews || "10k+",
                          price: card.price,
                          originalPrice: card.originalPrice,
                          discount: card.discount,
                          image: processedImage,
                          targetCategoryId: card.targetCategoryId,
                          slug: card.slug
                        };
                      }) || []}
                      onSeeAllClick={() => {
                        if (section.seeAllTargetCategoryId) {
                          const cat = categories.find(c => (c.id === section.seeAllTargetCategoryId || c._id === section.seeAllTargetCategoryId));
                          if (cat) handleCategoryClick(cat);
                        }
                      }}
                      onServiceClick={(service) => handleServiceClick(service)}
                      onAddClick={handleAddClick}
                    />
                  </Suspense>
                </motion.div>
              ))}





              {/* Footer Space */}
              {hasAnySection && <div className="h-10" />}

              {!isSearchOpen && homeContent?.isAppDownloadVisible !== false && (
                <Suspense fallback={<div className="h-32 bg-gray-50 animate-pulse rounded-xl mx-4" />}>
                  <AppDownloadBanner appData={homeContent?.appDownload} />
                </Suspense>
              )}
        </main>
      </motion.div>

      {/* Bottom Navigation */}
      {!isAddressModalOpen && <BottomNav />}

      {/* Category Modal */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setSelectedCategory(null);
        }}
        category={selectedCategory}
        location={address}
        cartCount={cartCount}
        currentCity={currentCity}
      />

      {/* Search Overlay */}
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        categories={categories}
        onCategoryClick={handleCategoryClick}
      />

      {/* Address Selection Modal */}
      <AddressSelectionModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        houseNumber={houseNumber}
        onHouseNumberChange={setHouseNumber}
        onSave={handleAddressSave}
      />


    </div>
  );
};

export default Home;
