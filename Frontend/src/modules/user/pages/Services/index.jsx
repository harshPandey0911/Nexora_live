import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  FiSearch, 
  FiGrid, 
  FiArrowRight, 
  FiArrowLeft, 
  FiTruck, 
  FiShoppingBag, 
  FiHome, 
  FiPackage, 
  FiPlusSquare, 
  FiShield, 
  FiHeadphones, 
  FiClock, 
  FiAward, 
  FiRotateCcw, 
  FiGift,
  FiMapPin,
  FiStar,
  FiTool
} from 'react-icons/fi';
import { publicCatalogService } from '../../../../services/catalogService';
import Header from '../../components/layout/Header';
import { useCart } from '../../../../context/CartContext';
import { useCity } from '../../../../context/CityContext';
import { toast } from 'react-hot-toast';

// Assets
import serviceHeroImg from '../../../../assets/service.png';

const ServicesPage = () => {
  const navigate = useNavigate();
  const { addToCart, cartCount } = useCart();
  const { currentCity } = useCity();
  const [searchParams] = useSearchParams();
  const categoryIdParam = searchParams.get('categoryId');
  
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]); 
  const [homeContent, setHomeContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [addingToCart, setAddingToCart] = useState(null);

  const toAssetUrl = (url) => {
    if (!url) return '';
    const clean = url.replace('/api/upload', '/upload');
    if (clean.startsWith('http')) return clean;
    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/api$/, '');
    return `${base}${clean.startsWith('/') ? '' : '/'}${clean}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const cityId = currentCity?._id || currentCity?.id;
        
        // Fetch Categories and Items (filtered by offeringType=SERVICE)
        const [catRes, itemRes, homeRes] = await Promise.all([
          publicCatalogService.getCategories(cityId, 'SERVICE'),
          publicCatalogService.getServices({ cityId, offeringType: 'SERVICE' }),
          publicCatalogService.getHomeData(cityId)
        ]);

        if (catRes.success) {
          setCategories(catRes.categories || []);
        }
        if (itemRes.success) {
          setServices(itemRes.services || []);
        }
        if (homeRes.success) {
          setHomeContent(homeRes.homeContent);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentCity]);

  // Set active tab from URL param
  useEffect(() => {
    if (categoryIdParam && categories.length > 0) {
      const cat = categories.find(c => c._id === categoryIdParam || c.id === categoryIdParam);
      if (cat && cat.group && cat.group !== 'None') {
        setActiveTab(cat.group);
      } else {
        setActiveTab(categoryIdParam);
      }
    }
  }, [categoryIdParam, categories]);

  const uniqueGroups = [...new Set(categories.filter(c => c.group && c.group !== 'None').map(c => c.group))];

  const tabs = [
    { id: 'All', label: 'All Services', icon: <FiTool /> },
    // Groups
    ...uniqueGroups.map(group => ({
      id: group,
      label: group,
      icon: group.toLowerCase().includes('home') ? <FiHome /> : 
            group.toLowerCase().includes('delivery') ? <FiTruck /> :
            group.toLowerCase().includes('needs') ? <FiShoppingBag /> :
            group.toLowerCase().includes('health') ? <FiPlusSquare /> : <FiGrid />
    })),
    // Categories without groups
    ...categories
      .filter(cat => !cat.group || cat.group === 'None')
      .map(cat => ({
        id: cat.id || cat._id,
        label: cat.title,
        icon: <FiGrid />
      })),
    { id: 'More', label: 'More Services', icon: <FiGrid /> },
  ];

  const filteredItems = services.filter(svc => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    const matchesSearch = svc.title.toLowerCase().includes(trimmedQuery) ||
                          svc.description?.toLowerCase().includes(trimmedQuery);
    
    if (activeTab === 'All') return matchesSearch;

    // Find the category for this item
    const cat = categories.find(c => c._id === (svc.categoryId?._id || svc.categoryId) || c.id === (svc.categoryId?.id || svc.categoryId));
    
    if (!cat) return false;

    // It matches if:
    // 1. The active tab is the group this category belongs to
    if (cat.group && cat.group !== 'None' && cat.group === activeTab) {
      return matchesSearch;
    }

    // 2. The active tab is the category ID itself
    const svcCatId = svc.categoryId?._id || svc.categoryId?.id || svc.categoryId;
    return matchesSearch && svcCatId === activeTab;
  });

  const handleAddToCart = async (service) => {
    try {
      setAddingToCart(service.id || service._id);
      const cartItemData = {
        serviceId: service.id || service._id,
        title: service.title,
        description: service.description || '',
        icon: toAssetUrl(service.icon || ''),
        category: service.categoryTitle || 'General',
        price: service.basePrice,
        unitPrice: service.basePrice,
        serviceCount: 1,
        vendorId: service.vendorId,
        gstPercentage: service.gstPercentage,
        card: {
          title: service.title,
          subtitle: service.description || '',
          price: service.basePrice,
          imageUrl: toAssetUrl(service.icon || ''),
        }
      };

      const res = await addToCart(cartItemData);
      if (res.success) {
        toast.success(`${service.title} added to cart!`);
      }
    } catch (error) {
      toast.error('Failed to add to cart');
    } finally {
      setAddingToCart(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Header
        location={localStorage.getItem('currentAddress') || ''}
        navLinks={homeContent?.navLinks}
        siteIdentity={homeContent?.siteIdentity}
        homeContent={homeContent}
      />

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-[#f8fafc] pt-4 pb-6">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-200/20 rounded-full blur-[120px] -z-0 translate-x-1/3 -translate-y-1/3" />
        
        <div className="max-w-[1400px] mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="flex-1 max-w-2xl text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h1 className="text-5xl lg:text-7xl font-[1000] text-gray-900 leading-tight tracking-tight mb-4">
                  Our <span className="text-blue-600">Services</span>
                </h1>
                <p className="text-gray-500 font-medium text-lg lg:text-xl leading-relaxed max-w-xl mb-6 mx-auto lg:mx-0">
                  Professional services delivered right at your doorstep. Fast, reliable, and verified experts for all your needs.
                </p>
                
                {/* Search Bar in Hero */}
                <div className="relative max-w-md mx-auto lg:mx-0">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search services..." 
                    value={searchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith(' ')) return;
                      setSearchQuery(val);
                    }}
                    className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl text-sm font-bold shadow-xl shadow-blue-900/5 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </motion.div>
            </div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative hidden lg:flex items-center"
            >
              <img 
                src={serviceHeroImg} 
                alt="Services" 
                className="h-[350px] w-auto drop-shadow-2xl"
              />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-6 -mt-12 relative z-20 pb-16">
        <div className="bg-white rounded-[32px] p-4 lg:p-8 shadow-2xl shadow-blue-900/5 border border-white">
          
          {/* Tabs */}
          <div className="bg-slate-50/80 rounded-[20px] p-2 mb-8 flex overflow-x-auto no-scrollbar gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-[14px] whitespace-nowrap transition-all duration-300 font-black text-[10px] uppercase tracking-wider ${
                  activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' 
                  : 'text-gray-500 hover:bg-white'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Grid */}
          <AnimatePresence mode="wait">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="h-48 bg-slate-50 rounded-[20px] animate-pulse" />
                ))}
              </div>
            ) : filteredItems.length > 0 ? (
              <motion.div 
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
              >
                {filteredItems.map((svc) => (
                  <motion.div
                    key={svc.id || svc._id}
                    whileHover={{ y: -5, shadow: "0 20px 40px -12px rgba(0, 0, 0, 0.1)" }}
                    onClick={() => navigate(`/user/service/${svc.id || svc._id}`)}
                    className="group bg-white rounded-[24px] border border-gray-100 hover:border-blue-100 cursor-pointer transition-all duration-500 flex flex-col overflow-hidden shadow-sm hover:shadow-xl"
                  >
                    {/* Top: Image */}
                    <div className="relative aspect-square overflow-hidden bg-slate-50">
                      <img 
                        src={toAssetUrl(svc.icon || svc.vendorPhoto || '')} 
                        className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                        alt={svc.title}
                        onError={(e) => {
                          e.target.src = 'https://ui-avatars.com/api/?name=' + svc.title + '&background=f0f9ff&color=2563eb&bold=true';
                        }}
                      />
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg shadow-sm flex items-center gap-1">
                        <FiStar className="fill-current w-2.5 h-2.5 text-orange-400" />
                        <span className="text-[10px] font-black text-gray-900">{svc.rating || '5.0'}</span>
                      </div>
                    </div>
                    
                    {/* Bottom: Content */}
                    <div className="p-4 flex flex-col flex-1">
                      <div className="mb-2">
                        <h3 className="text-sm font-black text-gray-900 leading-tight mb-1 uppercase truncate group-hover:text-blue-600 transition-colors">
                          {svc.title}
                        </h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {categories.find(c => c._id === svc.categoryId || c.id === svc.categoryId)?.title || 'Service'}
                        </p>
                      </div>

                      <p className="text-gray-500 text-[11px] leading-relaxed line-clamp-2 mb-4">
                        {svc.description || 'Professional service delivered right at your doorstep with fast & secure delivery.'}
                      </p>

                      <div className="mt-auto flex items-center justify-between gap-2">
                        <span className="text-lg font-black text-blue-600">₹{svc.basePrice}</span>
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCart(svc);
                          }}
                          disabled={addingToCart === (svc.id || svc._id)}
                          className="h-9 px-4 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2"
                        >
                          {addingToCart === (svc.id || svc._id) ? '...' : (
                            <><FiPlusSquare className="w-3 h-3" /> Add</>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="py-20 text-center">
                <FiTool className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <h3 className="text-xl font-black text-gray-900 uppercase">No Services Found</h3>
                <p className="text-gray-500 font-medium">Try another category or search term.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Trust Badges */}
      <div className="max-w-[1400px] mx-auto px-6 pb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: <FiShield />, label: "100% SECURE", sub: "Payments" },
            { icon: <FiHeadphones />, label: "24/7 SUPPORT", sub: "Happy customers" },
            { icon: <FiAward />, label: "VERIFIED", sub: "Trusted Experts" },
            { icon: <FiRotateCcw />, label: "EASY RETURNS", sub: "Hassle-free" },
          ].map((badge, idx) => (
            <div key={idx} className="bg-white p-6 rounded-[24px] border border-gray-100 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
                {badge.icon}
              </div>
              <h4 className="text-sm font-black text-gray-900 uppercase tracking-wider">{badge.label}</h4>
              <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">{badge.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ServicesPage;
