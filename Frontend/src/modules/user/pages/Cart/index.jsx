import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiArrowLeft, 
  FiShoppingCart, 
  FiTrash2, 
  FiPlus, 
  FiMinus, 
  FiInfo, 
  FiChevronRight,
  FiShoppingBag,
  FiCheckCircle,
  FiZap
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useCart } from '../../../../context/CartContext';
import Header from '../../components/layout/Header';
import { publicCatalogService } from '../../../../services/catalogService';
import { getPlans } from '../../services/planService';
import { userAuthService } from '../../../../services/authService';

const Cart = () => {
  const navigate = useNavigate();
  const { cartItems, isLoading: loading, removeItem, updateItem, platformFeeRate, maxCartItemQuantity, flushCartUpdates } = useCart();
  const [homeContent, setHomeContent] = useState(null);
  const [planBenefits, setPlanBenefits] = useState({ name: '', freeCategories: [], freeBrands: [], freeServices: [] });
  const [userPlanActive, setUserPlanActive] = useState(false);

  useEffect(() => {
    const fetchHome = async () => {
      const res = await publicCatalogService.getHomeData();
      if (res.success) setHomeContent(res.homeContent);
    };
    fetchHome();
  }, []);

  useEffect(() => {
    const fetchBenefits = async () => {
      try {
        const [plansRes, userRes] = await Promise.all([
          getPlans(),
          userAuthService.getProfile()
        ]);

        if (plansRes.success && userRes.success && userRes.user?.plans?.isActive) {
          const userPlanName = userRes.user.plans.name;
          const activePlan = plansRes.data.find(p => p.name === userPlanName);

          if (activePlan) {
            setUserPlanActive(true);
            setPlanBenefits({
              name: activePlan.name,
              freeCategories: activePlan.freeCategories || [],
              freeBrands: activePlan.freeBrands || [],
              freeServices: activePlan.freeServices || []
            });
          }
        }
      } catch (e) {
        console.error('Failed to load plan benefits in Cart', e);
      }
    };

    fetchBenefits();
  }, []);

  const toAssetUrl = (url) => {
    if (!url) return '';
    const clean = url.replace('/api/upload', '/upload');
    if (clean.startsWith('http')) return clean;
    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/api$/, '');
    return `${base}${clean.startsWith('/') ? '' : '/'}${clean}`;
  };

  const normalizeId = (id) => {
    if (!id) return '';
    if (typeof id === 'object') {
      return id._id ? id._id.toString() : (id.$oid ? id.$oid.toString() : JSON.stringify(id));
    }
    return id.toString();
  };

  const totals = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => sum + (item.price || 0), 0);
    
    let primeSavings = 0;
    if (userPlanActive) {
      cartItems.forEach(item => {
        const itemCatId = normalizeId(item.categoryId);
        const itemBrandId = normalizeId(item.sectionId);
        const itemServiceId = normalizeId(item.serviceId);

        const isFreeCategory = itemCatId && planBenefits.freeCategories.some(cat => normalizeId(cat) === itemCatId);
        const isFreeBrand = itemBrandId && planBenefits.freeBrands.some(brand => normalizeId(brand) === itemBrandId);
        const isFreeService = itemServiceId && planBenefits.freeServices.some(svc => normalizeId(svc) === itemServiceId);

        if (isFreeCategory || isFreeBrand || isFreeService) {
          primeSavings += (item.price || 0);
        }
      });
    }

    const tax = cartItems.reduce((sum, item) => {
      const itemCatId = normalizeId(item.categoryId);
      const itemBrandId = normalizeId(item.sectionId);
      const itemServiceId = normalizeId(item.serviceId);

      const isFreeCategory = itemCatId && planBenefits.freeCategories.some(cat => normalizeId(cat) === itemCatId);
      const isFreeBrand = itemBrandId && planBenefits.freeBrands.some(brand => normalizeId(brand) === itemBrandId);
      const isFreeService = itemServiceId && planBenefits.freeServices.some(svc => normalizeId(svc) === itemServiceId);

      const itemPrice = userPlanActive && (isFreeCategory || isFreeBrand || isFreeService) ? 0 : (item.price || 0);
      const itemGst = item.gstPercentage !== undefined ? item.gstPercentage : 18;
      return sum + (itemPrice * (itemGst / 100));
    }, 0);

    const netSubtotal = subtotal - primeSavings;
    const delivery = netSubtotal > 0 ? platformFeeRate : 0;
    
    return {
      subtotal,
      primeSavings,
      tax: Math.round(tax),
      delivery,
      total: Math.max(0, netSubtotal + Math.round(tax) + delivery)
    };
  }, [cartItems, platformFeeRate, userPlanActive, planBenefits]);

  const handleQuantityChange = async (item, change) => {
    const itemId = item?.id || item?._id;
    const currentCount = item?.serviceCount || 1;
    const newCount = currentCount + change;
    
    if (newCount <= 0) {
      return handleRemove(item);
    }
    
    try {
      const res = await updateItem(itemId, newCount);
      if (res && !res.success && res.message !== 'Quantity limit reached') {
        toast.error(res.message || 'Failed to update quantity', { id: 'failed-update' });
      }
    } catch (error) {
      console.error(error);
      toast.error('Error updating cart', { id: 'failed-update' });
    }
  };

  const handleItemClick = (item) => {
    const rawId = item.serviceId;
    const id = normalizeId(rawId);
    if (!id) return;
    const isProduct = item.serviceId?.offeringType === 'PRODUCT';
    navigate(isProduct ? `/user/product/${id}` : `/user/service/${id}`);
  };

  const handleRemove = async (item) => {
    const itemId = item?.id || item?._id;
    try {
      const res = await removeItem(itemId);
      if (res && res.success) toast.success('Item removed', { id: 'cart-success' });
    } catch (error) {
      console.error(error);
      toast.error('Failed to remove item', { id: 'cart-error' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <Header
        location={localStorage.getItem('currentAddress') || ''}
        onLocationClick={() => {}}
        navLinks={homeContent?.navLinks}
        siteIdentity={homeContent?.siteIdentity}
        homeContent={homeContent}
      />

      <main className="max-w-7xl mx-auto px-3.5 sm:px-6 py-4 sm:py-8 space-y-4">
        {/* Header Section */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs flex items-center justify-between border border-gray-100">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-700 hover:text-gray-900 transition-all cursor-pointer"
            >
              <FiArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-xl font-bold text-gray-900 tracking-tight leading-tight uppercase">Basket Summary</h1>
              <p className="text-[10px] sm:text-xs font-medium text-gray-500 mt-0.5">
                {cartItems.length} {cartItems.length === 1 ? 'Item' : 'Items'} Selected
              </p>
            </div>
          </div>
          
          {cartItems.length > 0 && (
            <button 
              onClick={() => navigate('/user/services')}
              className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
            >
              <FiPlus className="w-3.5 h-3.5" />
              <span>Add Items</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Items List */}
          <div className="lg:col-span-8 space-y-2.5">
            <AnimatePresence mode="popLayout">
              {cartItems.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl p-8 text-center border border-gray-100 shadow-2xs space-y-2"
                >
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                    <FiShoppingCart className="w-6 h-6" />
                  </div>
                  <h2 className="text-sm font-bold text-gray-900 uppercase">Empty Basket</h2>
                  <p className="text-gray-400 text-xs font-medium">Looks like you haven't added anything yet.</p>
                  <div className="pt-2">
                    <button 
                      onClick={() => navigate('/user/services')}
                      className="px-4 py-2 bg-[#00246b] hover:bg-[#001c54] text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-2xs active:scale-95 transition-all cursor-pointer"
                    >
                      Start Shopping
                    </button>
                  </div>
                </motion.div>
              ) : (
                cartItems.map((item) => (
                  <motion.div
                    key={item.id || item._id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => handleItemClick(item)}
                    className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100 shadow-2xs hover:border-gray-200 transition-all flex items-center gap-3 sm:gap-4 cursor-pointer group"
                  >
                    {/* Item Image */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
                      <img 
                        src={toAssetUrl(item.icon || '')} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        alt={item.title} 
                      />
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[8px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 inline-block mb-0.5">
                            {item.serviceId?.offeringType === 'PRODUCT' ? 'Product' : (item.category || 'Service')}
                          </span>
                          <h3 className="text-xs sm:text-sm font-bold text-gray-900 truncate uppercase tracking-tight">
                            {item.title}
                          </h3>
                        </div>
                        
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleRemove(item); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                          title="Remove item"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {item.description && (
                        <p className="text-[10px] text-gray-400 font-medium truncate">
                          {item.description}
                        </p>
                      )}

                      {/* Price & Quantity Bar */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-bold text-gray-900">₹{item.price}</span>
                          {item.serviceCount > 1 && (
                            <span className="text-[9px] text-gray-400 font-medium">
                              ({item.serviceCount} × ₹{item.unitPrice || Math.round(item.price / item.serviceCount)})
                            </span>
                          )}
                          {item.originalPrice && item.originalPrice > item.price && (
                            <span className="text-[9px] text-gray-300 line-through">
                              ₹{item.originalPrice}
                            </span>
                          )}
                        </div>

                        {/* Quantity Counter */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center bg-gray-50 rounded-lg p-0.5 border border-gray-200 shadow-2xs"
                        >
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleQuantityChange(item, -1); }}
                            className="w-6 h-6 rounded bg-white flex items-center justify-center text-gray-700 shadow-2xs hover:bg-gray-100 transition-colors cursor-pointer"
                          >
                            <FiMinus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.serviceCount || 1}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val >= 1) {
                                if (val > maxCartItemQuantity) {
                                  toast.error(`Maximum quantity limit is ${maxCartItemQuantity}`);
                                  handleQuantityChange(item, maxCartItemQuantity - (item.serviceCount || 1));
                                } else {
                                  handleQuantityChange(item, val - (item.serviceCount || 1));
                                }
                              }
                            }}
                            className="w-7 text-center text-xs font-bold bg-transparent outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleQuantityChange(item, 1); }}
                            className="w-6 h-6 rounded bg-white flex items-center justify-center text-gray-700 shadow-2xs hover:bg-gray-100 transition-colors cursor-pointer"
                          >
                            <FiPlus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-4">
            <div className="sticky top-20 space-y-3">
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-2xs space-y-3">
                <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-100 pb-2">
                  <FiShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                  <span>Order Bill Summary</span>
                </h2>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-gray-600">
                    <span className="font-medium">Basket Subtotal</span>
                    <span className="font-bold text-gray-900">₹{totals.subtotal.toLocaleString()}</span>
                  </div>
                  {totals.primeSavings > 0 && (
                    <div className="flex justify-between items-center text-emerald-600 font-bold">
                      <span>Prime Discount</span>
                      <span>-₹{totals.primeSavings.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-gray-600">
                    <span className="font-medium">GST & Taxes</span>
                    <span className="font-bold text-gray-900">₹{totals.tax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-600">
                    <span className="font-medium">Platform Fee</span>
                    <span className="font-bold text-emerald-600">
                      {totals.delivery === 0 ? 'FREE' : `₹${totals.delivery}`}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-900 uppercase">Total Amount</span>
                    <span className="text-sm font-bold text-[#00246b]">₹{totals.total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="pt-1">
                  <button 
                    disabled={cartItems.length === 0}
                    onClick={async () => {
                      try {
                        if (flushCartUpdates) {
                          await Promise.race([
                            flushCartUpdates(),
                            new Promise(r => setTimeout(r, 400))
                          ]);
                        }
                      } catch (e) {
                        console.error('Flush error:', e);
                      } finally {
                        const hasProducts = cartItems.some(item => {
                          const offType = item.offeringType || item.serviceId?.offeringType;
                          if (offType === 'PRODUCT') return true;
                          const cat = String(item.category || item.categoryTitle || '').toLowerCase().trim();
                          return ['food', 'products', 'product', 'grocery', 'store', 'items', 'snack', 'beverage'].some(k => cat.includes(k));
                        });
                        navigate(hasProducts ? '/user/product-checkout' : '/user/checkout');
                      }
                    }}
                    className="w-full bg-[#00246b] hover:bg-[#001c54] text-white py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs shadow-2xs active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <FiZap className="w-3.5 h-3.5 fill-current" />
                    <span>Proceed to Checkout</span>
                  </button>
                </div>

                <div className="flex items-center justify-center gap-1 text-[9px] font-bold text-emerald-600 uppercase tracking-wider pt-1">
                  <FiCheckCircle className="w-3 h-3" />
                  <span>Guaranteed Safe Checkout</span>
                </div>
              </div>

              {/* Prime Promo Card */}
              {userPlanActive && totals.primeSavings > 0 && (
                <div className="bg-emerald-600 rounded-xl p-3 text-white shadow-2xs space-y-0.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider">Nexus Prime Applied</h4>
                  <p className="text-[10px] font-medium opacity-95">
                    You are saving ₹{totals.primeSavings.toLocaleString()} on this basket with your active Prime subscription.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Cart;
