import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiArrowLeft, 
  FiShoppingCart, 
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
  const { addToCart } = useCart();
  
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [homeContent, setHomeContent] = useState(null);

  const toAssetUrl = (url) => {
    if (!url) return '';
    const clean = url.replace('/api/upload', '/upload');
    if (clean.startsWith('http')) return clean;
    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/api$/, '');
    return `${base}${clean.startsWith('/') ? '' : '/'}${clean}`;
  };

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await publicCatalogService.getServiceDetails(id);
        if (res.success) {
          setService(res.service);
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
      const cartItemData = {
        serviceId: service.id || service._id,
        title: service.title,
        description: service.description || '',
        icon: toAssetUrl(service.iconUrl || service.icon || ''),
        category: service.categoryTitle || 'General',
        price: service.basePrice,
        unitPrice: service.basePrice,
        serviceCount: quantity,
        vendorId: service.vendorId,
        vendorName: service.vendorName,
        gstPercentage: service.gstPercentage
      };

      const res = await addToCart(cartItemData);
      if (res.success) {
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

      <main className="max-w-[1400px] mx-auto px-6 py-12">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-900" />
          </button>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400">
            <span>Services</span>
            <FiChevronRight className="w-3 h-3" />
            <span className="text-gray-900">{service.categoryTitle || 'Expert Service'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Visuals */}
          <div className="lg:col-span-7 space-y-6">
            <div className="relative aspect-[4/3] bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm">
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
                    className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-xl hover:bg-white transition-all active:scale-90"
                  >
                    <FiChevronLeft className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={() => setActiveImage(prev => (prev < gallery.length - 1 ? prev + 1 : 0))}
                    className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-xl hover:bg-white transition-all active:scale-90"
                  >
                    <FiChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              {/* Badges */}
              <div className="absolute top-8 left-8 flex gap-3">
                <div className="px-4 py-2 bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-500/30">
                  Top Rated
                </div>
                {service.vendorName && (
                  <div className="px-4 py-2 bg-white/90 backdrop-blur-md text-gray-900 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg border border-black/5">
                    {service.vendorName}
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnails */}
            {gallery.length > 1 && (
              <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                {gallery.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`relative w-24 h-24 rounded-2xl overflow-hidden border-2 transition-all shrink-0 ${
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
          <div className="lg:col-span-5 flex flex-col">
            <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm flex-1">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full">
                  <FiStar className="w-4 h-4 fill-current" />
                  <span className="text-xs font-black">
                    {service.rating || '5.0'} ({service.bookingsCount || 0} Bookings)
                  </span>
                </div>
              </div>

              <h1 className="text-4xl font-[1000] text-gray-900 tracking-tight leading-tight mb-4 uppercase">
                {service.title}
              </h1>
              
              <p className="text-gray-500 font-medium text-lg mb-8 leading-relaxed">
                {service.description || 'Professional service offering tailored to your specific requirements.'}
              </p>

              <div className="flex items-baseline gap-4 mb-10">
                <span className="text-5xl font-black text-gray-900">₹{service.basePrice}</span>
                {service.originalPrice && service.originalPrice > service.basePrice && (
                  <span className="text-xl text-gray-400 line-through font-bold">₹{service.originalPrice}</span>
                )}
              </div>

              {/* Quantity & Add to Cart */}
              <div className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="flex items-center bg-gray-50 rounded-2xl p-2 border border-gray-100">
                    <button 
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors active:scale-90"
                    >
                      <FiMinus className="w-4 h-4" />
                    </button>
                    <span className="w-16 text-center text-xl font-black">{quantity}</span>
                    <button 
                      onClick={() => setQuantity(q => q + 1)}
                      className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors active:scale-90"
                    >
                      <FiPlus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={handleAddToCart}
                    disabled={addingToCart}
                    className="flex-[2] bg-blue-600 text-white py-6 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-blue-900/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    {addingToCart ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <FiShoppingCart className="w-5 h-5" />
                        Book Now
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Key Features Quick List */}
              <div className="mt-12 pt-12 border-t border-gray-100 grid grid-cols-2 gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <FiShield className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Quality</p>
                    <p className="text-xs font-bold text-gray-900">Verified</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <FiClock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Service</p>
                    <p className="text-xs font-bold text-gray-900">Expert</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Info Section */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-12">
            {/* Description */}
            <div className="bg-white rounded-[2.5rem] p-12 border border-gray-100 shadow-sm">
              <h2 className="text-2xl font-black text-gray-900 mb-8 uppercase tracking-tight flex items-center gap-4">
                <div className="w-2 h-8 bg-blue-600 rounded-full" />
                Service Narrative
              </h2>
              <div className="prose prose-blue max-w-none">
                <p className="text-gray-600 leading-loose text-lg whitespace-pre-wrap">
                  {service.detailedDescription || service.description || 'No detailed description provided.'}
                </p>
              </div>
            </div>

            {/* Features & Benefits */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm">
                <h3 className="text-lg font-black text-gray-900 mb-8 uppercase tracking-widest flex items-center gap-3">
                  <FiCheckCircle className="text-emerald-500" />
                  Features
                </h3>
                <ul className="space-y-4">
                  {(service.features?.length > 0 ? service.features : ['Professional Service', 'Expert Handling', 'Quality Guaranteed']).map((f, idx) => (
                    <li key={idx} className="flex items-start gap-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2" />
                      <span className="text-sm font-bold text-gray-600">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm">
                <h3 className="text-lg font-black text-gray-900 mb-8 uppercase tracking-widest flex items-center gap-3">
                  <FiInfo className="text-blue-500" />
                  Why Choose Us
                </h3>
                <ul className="space-y-4">
                  {(service.benefits?.length > 0 ? service.benefits : ['Guaranteed Satisfaction', 'Competitive Pricing', 'Verified Professionals']).map((b, idx) => (
                    <li key={idx} className="flex items-start gap-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2" />
                      <span className="text-sm font-bold text-gray-600">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Sticky Sidebar Action */}
          <div className="lg:col-span-4">
            <div className="sticky top-32 space-y-6">
              <div className="bg-blue-600 rounded-[2.5rem] p-10 text-white overflow-hidden relative shadow-2xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
                <h4 className="text-lg font-black uppercase tracking-widest mb-4">Book with Confidence</h4>
                <p className="text-sm opacity-70 mb-8 font-medium">Join 5000+ happy customers using our platform daily.</p>
                <div className="space-y-4 mb-10">
                  <div className="flex items-center gap-3">
                    <FiShield className="text-blue-200" />
                    <span className="text-xs font-bold uppercase tracking-wider">Secure Booking</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <FiCheckCircle className="text-blue-200" />
                    <span className="text-xs font-bold uppercase tracking-wider">Verified Professional</span>
                  </div>
                </div>
                <button 
                  onClick={handleAddToCart}
                  className="w-full bg-white text-blue-600 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-gray-50 transition-all active:scale-95"
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
