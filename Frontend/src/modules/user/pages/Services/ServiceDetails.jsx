import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiArrowLeft, 
  FiShoppingCart, 
  FiShoppingBag,
  FiArrowRight,
  FiStar, 
  FiCheckCircle, 
  FiInfo, 
  FiShield, 
  FiClock, 
  FiChevronRight,
  FiChevronLeft,
  FiPlus,
  FiMinus,
  FiShare2,
  FiHeart
} from 'react-icons/fi';
import { publicCatalogService } from '../../../../services/catalogService';
import Header from '../../components/layout/Header';
import { useCart } from '../../../../context/CartContext';
import { toast } from 'react-hot-toast';

const ServiceDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, cartItems } = useCart();
  
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [durationHours, setDurationHours] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [homeContent, setHomeContent] = useState(null);
  // Booking mode: 'FIXED' or 'HOURLY' (only relevant when service supports both)
  const [selectedBookingMode, setSelectedBookingMode] = useState('FIXED');

  const isInCart = Boolean(
    cartItems && cartItems.some(item => 
      String(item.serviceId?._id || item.serviceId?.id || item.serviceId || item.id) === String(service?.id || service?._id)
    )
  );

  const toAssetUrl = (url) => {
    if (!url) return '';
    const clean = url.replace('/api/upload', '/upload');
    if (clean.startsWith('http')) return clean;
    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/api$/, '');
    return `${base}${clean.startsWith('/') ? '' : '/'}${clean}`;
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await publicCatalogService.getServiceDetails(id);
        if (res.success) {
          setService(res.service);
          // Derive booking modes from bookingOptions or fallback to pricingType
          const bOpts = res.service.bookingOptions || {
            normal: { enabled: res.service.pricingType !== 'HOURLY' },
            hourly: { enabled: res.service.pricingType === 'HOURLY' }
          };
          const normalEnabled = bOpts.normal?.enabled !== false;
          const hourlyEnabled = bOpts.hourly?.enabled === true;
          // Default mode: Normal if available, else Hourly
          setSelectedBookingMode(normalEnabled ? 'FIXED' : 'HOURLY');
          if (hourlyEnabled) {
            setDurationHours(res.service.minHours || 1);
          }
        }
        
        const homeRes = await publicCatalogService.getHomeData();
        if (homeRes.success) {
          setHomeContent(homeRes.homeContent);
        }
      } catch (error) {
        console.error('Error fetching details:', error);
        toast.error('Service not found');
        navigate('/user/services');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id, navigate]);

  const handleAddToCart = async () => {
    try {
      setAddingToCart(true);
      const isHourly = selectedBookingMode === 'HOURLY';
      const itemUnitPrice = isHourly ? (service.hourlyRate * durationHours) : service.basePrice;

      const cartItemData = {
        serviceId: service.id || service._id,
        title: service.title,
        description: service.description || '',
        icon: toAssetUrl(service.iconUrl || service.icon || ''),
        category: service.categoryTitle || 'General',
        price: itemUnitPrice * quantity,
        unitPrice: itemUnitPrice,
        serviceCount: quantity,
        vendorId: service.vendorId,
        vendorName: service.vendorName,
        gstPercentage: service.gstPercentage,
        bookingType: isHourly ? 'HOURLY' : 'FIXED',
        durationHours: isHourly ? durationHours : 1,
        hourlyRate: isHourly ? service.hourlyRate : 0
      };

      const res = await addToCart(cartItemData);
      if (res && res.success && !res.replaced) {
        toast.success('Added to cart!');
      }
    } catch (error) {
      toast.error('Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!service) return null;

  const gallery = service.images?.length > 0 
    ? service.images.map(img => toAssetUrl(img))
    : [toAssetUrl(service.iconUrl || service.icon || '')];

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Header
        location={localStorage.getItem('currentAddress') || ''}
        navLinks={homeContent?.navLinks}
        siteIdentity={homeContent?.siteIdentity}
        homeContent={homeContent}
      />

      <main className="max-w-[1400px] mx-auto px-4 py-6 sm:px-6 sm:py-12">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 sm:mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-900" />
          </button>
          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-gray-400">
            <span>Services</span>
            <FiChevronRight className="w-3 h-3" />
            <span className="text-gray-900">{service.categoryTitle || 'Expert Service'}</span>
          </div>
        </div>
 
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-12">
          {/* Left Column: Visuals */}
          <div className="lg:col-span-6 space-y-4 sm:space-y-6">
            <div className="relative aspect-[4/3] lg:aspect-auto lg:h-[480px] bg-white rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm">
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeImage}
                  src={gallery[activeImage]}
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5 }}
                  className="w-full h-full object-cover"
                />
              </AnimatePresence>
              
              {gallery.length > 1 && (
                <>
                  <button 
                    onClick={() => setActiveImage(prev => (prev > 0 ? prev - 1 : gallery.length - 1))}
                    className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-12 sm:h-12 bg-white/90 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl hover:bg-white transition-all active:scale-90"
                  >
                    <FiChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  <button 
                    onClick={() => setActiveImage(prev => (prev < gallery.length - 1 ? prev + 1 : 0))}
                    className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-12 sm:h-12 bg-white/90 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl hover:bg-white transition-all active:scale-90"
                  >
                    <FiChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </>
              )}
 
              {/* Badges */}
              <div className="absolute top-4 left-4 sm:top-8 sm:left-8 flex gap-2 sm:gap-3">
                <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-500 text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-widest rounded-lg sm:rounded-xl shadow-lg shadow-blue-500/30">
                  Top Rated
                </div>
                {service.vendorName && (
                  <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white/90 backdrop-blur-md text-gray-900 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest rounded-lg sm:rounded-xl shadow-lg border border-black/5">
                    {service.vendorName}
                  </div>
                )}
              </div>
            </div>
 
            {/* Thumbnails */}
            {gallery.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                {gallery.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`relative w-16 h-16 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl overflow-hidden border-2 transition-all shrink-0 ${
                      activeImage === idx ? 'border-blue-600 scale-105 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} className="w-full h-full object-cover" alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>
 
          {/* Right Column: Info & Action */}
          <div className="lg:col-span-6 flex flex-col">
            <div className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] p-5 sm:p-8 lg:p-8 border border-gray-100 shadow-sm flex-1 lg:h-[480px] flex flex-col justify-between">
              <div>
                {service.rating && (
                  <div className="flex items-center justify-between mb-3 lg:mb-4">
                    <div className="flex items-center gap-2 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full">
                      <FiStar className="w-3.5 h-3.5 fill-current" />
                      <span className="text-[11px] font-bold">
                        {service.rating} ({service.bookingsCount || 0} Bookings)
                      </span>
                    </div>
                  </div>
                )}

                <h1 className="text-xl sm:text-4xl font-bold text-gray-900 tracking-tight leading-tight mb-2 sm:mb-3 uppercase">
                  {service.title}
                </h1>
                
                <p className="text-gray-500 font-medium text-sm sm:text-base leading-relaxed line-clamp-3 mb-4 lg:mb-0">
                  {service.description || 'Professional service offering tailored to your specific requirements.'}
                </p>
              </div>

              <div>
                {/* Resolve booking modes */}
                {(() => {
                  const bOpts = service.bookingOptions || {
                    normal: { enabled: service.pricingType !== 'HOURLY' },
                    hourly: { enabled: service.pricingType === 'HOURLY' }
                  };
                  const normalEnabled = bOpts.normal ? (bOpts.normal.enabled !== false) : true;
                  const hourlyEnabled = bOpts.hourly ? (bOpts.hourly.enabled === true) : false;
                  const bothEnabled = normalEnabled && hourlyEnabled;

                  return (
                    <>
                      {/* Booking Type Info badge — shown for hourly-only */}
                      {!normalEnabled && hourlyEnabled && (
                        <div className="mb-3 inline-flex items-center gap-2 bg-teal-100 text-teal-800 text-xs font-bold px-3 py-1.5 rounded-full border border-teal-300">
                          <FiClock className="w-3.5 h-3.5" />
                          Hourly Service — Pay per hour
                        </div>
                      )}

                      {/* Mode selector — shown when both modes are enabled */}
                      {bothEnabled && (
                        <div className="mb-4 bg-gradient-to-br from-gray-50 to-blue-50/40 p-4 rounded-2xl border border-gray-200 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-4 bg-blue-500 rounded-full" />
                            <p className="text-xs font-black uppercase tracking-wider text-gray-600">Choose Booking Type</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {/* Normal Booking card */}
                            <button
                              type="button"
                              onClick={() => setSelectedBookingMode('FIXED')}
                              className={`p-3.5 rounded-xl border-2 text-left transition-all duration-200 ${
                                selectedBookingMode === 'FIXED'
                                  ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100'
                                  : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[9px] font-black uppercase tracking-wider text-gray-500">Normal</span>
                                {selectedBookingMode === 'FIXED' && (
                                  <span className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                    <FiCheckCircle className="w-3 h-3 text-white" />
                                  </span>
                                )}
                              </div>
                              <span className="text-xl font-black text-blue-700">₹{service.basePrice}</span>
                              <span className="block text-[9px] text-gray-400 font-semibold mt-0.5">Fixed price</span>
                            </button>
                            {/* Hourly Booking card */}
                            <button
                              type="button"
                              onClick={() => setSelectedBookingMode('HOURLY')}
                              className={`p-3.5 rounded-xl border-2 text-left transition-all duration-200 ${
                                selectedBookingMode === 'HOURLY'
                                  ? 'border-teal-500 bg-teal-50 shadow-md shadow-teal-100'
                                  : 'border-gray-200 bg-white hover:border-teal-300 hover:shadow-sm'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[9px] font-black uppercase tracking-wider text-gray-500">Hourly</span>
                                {selectedBookingMode === 'HOURLY' && (
                                  <span className="w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center">
                                    <FiCheckCircle className="w-3 h-3 text-white" />
                                  </span>
                                )}
                              </div>
                              <span className="text-xl font-black text-teal-700">₹{service.hourlyRate}<span className="text-xs font-semibold text-teal-600">/hr</span></span>
                              <span className="block text-[9px] text-gray-400 font-semibold mt-0.5">Pay per hour</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Hourly pricing block — shown when Hourly is selected */}
                      {hourlyEnabled && selectedBookingMode === 'HOURLY' && (
                        <div className="mb-5 bg-teal-50/60 p-4 rounded-2xl border border-teal-100">
                          <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-3xl sm:text-4xl font-black text-teal-700">₹{service.hourlyRate}</span>
                            <span className="text-xs font-bold uppercase tracking-wider text-teal-600">/ hour</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 mt-3 pt-3 border-t border-teal-100">
                            <div>
                              <span className="text-[11px] font-black uppercase tracking-wider text-gray-500 block">Select Duration</span>
                              <span className="text-xs font-bold text-gray-800">Est. Cost: ₹{service.hourlyRate * durationHours} + GST</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl shadow-sm border border-teal-200">
                              <button
                                type="button"
                                onClick={() => setDurationHours(prev => Math.max(service.minHours || 1, prev - 1))}
                                disabled={durationHours <= (service.minHours || 1)}
                                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-700 disabled:opacity-30"
                              >
                                <FiMinus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-12 text-center text-xs font-black text-gray-900">{durationHours} Hrs</span>
                              <button
                                type="button"
                                onClick={() => setDurationHours(prev => Math.min(service.maxHours || 8, prev + 1))}
                                disabled={durationHours >= (service.maxHours || 8)}
                                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-700 disabled:opacity-30"
                              >
                                <FiPlus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Normal pricing block — shown when Normal is selected */}
                      {normalEnabled && selectedBookingMode === 'FIXED' && (
                        <div className="flex items-baseline gap-3 mb-4 lg:mb-5">
                          <span className="text-3xl sm:text-4xl font-bold text-gray-900">₹{service.basePrice}</span>
                          {service.originalPrice && service.originalPrice > service.basePrice && (
                            <span className="text-lg text-gray-400 line-through font-semibold">₹{service.originalPrice}</span>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Add to Cart / Go to Cart Action */}
                <div className="flex gap-4 items-center">
                  {isInCart ? (
                    <button 
                      onClick={() => navigate('/user/cart')}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs shadow-xl shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <FiCheckCircle className="w-4 h-4" />
                      Added to Cart
                      <FiArrowRight className="w-4 h-4 ml-1" />
                    </button>
                  ) : (
                    <button 
                      onClick={handleAddToCart}
                      disabled={addingToCart}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs shadow-xl shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {addingToCart ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <FiShoppingCart className="w-4 h-4" />
                          Add to Cart
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
 
              {/* Key Features Quick List */}
              <div className="mt-8 pt-8 sm:mt-12 sm:pt-12 border-t border-gray-100 grid grid-cols-2 gap-4 sm:gap-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 rounded-lg sm:rounded-xl flex items-center justify-center text-blue-600">
                    <FiShield className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Quality</p>
                    <p className="text-xs font-semibold text-gray-900">Verified</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-emerald-50 rounded-lg sm:rounded-xl flex items-center justify-center text-emerald-600">
                    <FiClock className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Service</p>
                    <p className="text-xs font-semibold text-gray-900">Expert</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
 
        {/* Detailed Info Section */}
        <div className="mt-8 sm:mt-12 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-12">
          <div className="lg:col-span-8 space-y-6 sm:space-y-12">
            {/* Description */}
            <div className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-12 border border-gray-100 shadow-sm">
              <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-8 uppercase tracking-tight flex items-center gap-3">
                <div className="w-1.5 h-6 sm:w-2 sm:h-8 bg-blue-600 rounded-full" />
                Service Narrative
              </h2>
              <div className="prose prose-blue max-w-none">
                <p className="text-gray-600 leading-relaxed text-sm sm:text-base whitespace-pre-wrap">
                  {service.detailedDescription || service.description || 'No detailed description provided.'}
                </p>
              </div>
            </div>
 
            {/* Features & Benefits */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              <div className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-10 border border-gray-100 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-4 sm:mb-8 uppercase tracking-wider flex items-center gap-2">
                  <FiCheckCircle className="text-emerald-500" />
                  Features
                </h3>
                <ul className="space-y-3 sm:space-y-4">
                  {(service.features?.length > 0 ? service.features : ['Professional Service', 'Expert Handling', 'Quality Guaranteed']).map((f, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2" />
                      <span className="text-xs sm:text-sm font-semibold text-gray-600">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
 
              <div className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-10 border border-gray-100 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-4 sm:mb-8 uppercase tracking-wider flex items-center gap-2">
                  <FiInfo className="text-blue-500" />
                  Why Choose Us
                </h3>
                <ul className="space-y-3 sm:space-y-4">
                  {(service.benefits?.length > 0 ? service.benefits : ['Guaranteed Satisfaction', 'Competitive Pricing', 'Verified Professionals']).map((b, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2" />
                      <span className="text-xs sm:text-sm font-semibold text-gray-600">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
 
          {/* Sticky Sidebar Action */}
          <div className="lg:col-span-4">
            <div className="sticky top-32 space-y-6">
              <div className="bg-blue-600 rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-10 text-white overflow-hidden relative shadow-2xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
                <h4 className="text-base sm:text-lg font-bold uppercase tracking-wider mb-2 sm:mb-4">Book with Confidence</h4>
                <p className="text-xs sm:text-sm opacity-70 mb-6 sm:mb-8 font-medium">Join 5000+ happy customers using our platform daily.</p>
                <div className="space-y-3 mb-6 sm:mb-10">
                  <div className="flex items-center gap-3">
                    <FiShield className="text-blue-200" />
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Secure Booking</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <FiCheckCircle className="text-blue-200" />
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Verified Professional</span>
                  </div>
                </div>
                <button 
                  onClick={handleAddToCart}
                  className="w-full bg-white text-blue-600 py-4 rounded-xl font-bold uppercase tracking-wider text-[10px] shadow-xl hover:bg-gray-50 transition-all active:scale-95"
                >
                  Quick Booking
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ServiceDetailsPage;
