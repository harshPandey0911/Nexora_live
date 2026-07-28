import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  FiArrowLeft, 
  FiShoppingBag, 
  FiTrash2, 
  FiMinus, 
  FiPlus, 
  FiPhone, 
  FiHome, 
  FiCheckCircle, 
  FiInfo, 
  FiCreditCard, 
  FiDollarSign,
  FiTruck,
  FiZap,
  FiMapPin,
  FiX
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { useCart } from '../../../../context/CartContext';
import { productOrderService } from '../../../../services/productOrderService';
import { userAuthService } from '../../../../services/authService';
import AddressSelectionModal from '../Checkout/components/AddressSelectionModal';
import ProductVendorSearchModal from './components/ProductVendorSearchModal';
import Header from '../../components/layout/Header';
import { NEXORA_LOGO_BASE64 } from '../../../../utils/logoBase64';

const toAssetUrl = (url) => {
  if (!url) return '';
  const clean = url.replace('/api/upload', '/upload');
  if (clean.startsWith('http')) return clean;
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/api$/, '');
  return `${base}${clean.startsWith('/') ? '' : '/'}${clean}`;
};

const ProductCheckout = () => {
  const navigate = useNavigate();
  const { cartItems: globalCartItems, isInitialized, removeItem: removeItemGlobal, updateItem: updateItemGlobal, clearCart: clearCartGlobal, platformFeeRate, productDeliveryChargeRate } = useCart();

  const [cartItems, setCartItems] = useState([]);
  const [address, setAddress] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [addressDetails, setAddressDetails] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showSavedAddressesModal, setShowSavedAddressesModal] = useState(false);

  const [contactDetails, setContactDetails] = useState({ name: '', phone: '' });
  const [showContactModal, setShowContactModal] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'cod' | 'online'
  const [loading, setLoading] = useState(true);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  // Vendor & Dispatch states
  const [currentStep, setCurrentStep] = useState('details'); // 'details' | 'searching' | 'waiting' | 'accepted' | 'failed'
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [acceptedVendor, setAcceptedVendor] = useState(null);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [vendorDeliveryCharge, setVendorDeliveryCharge] = useState(30);
  const [adminPlatformFee, setAdminPlatformFee] = useState(null);

  // Load Razorpay SDK lazily
  useEffect(() => {
    const checkRazorpay = () => {
      if (window.Razorpay) {
        setRazorpayLoaded(true);
      } else {
        setTimeout(checkRazorpay, 200);
      }
    };
    checkRazorpay();
  }, []);

  // Filter cart items for products only
  useEffect(() => {
    if (isInitialized && Array.isArray(globalCartItems)) {
      const productItems = globalCartItems.filter(item => {
        const offType = item.offeringType || item.serviceId?.offeringType;
        if (offType === 'PRODUCT') return true;
        const cat = String(item.category || item.categoryTitle || '').toLowerCase().trim();
        return ['food', 'products', 'product', 'grocery', 'store', 'items', 'snack', 'beverage'].some(k => cat.includes(k));
      });
      setCartItems(productItems.length > 0 ? productItems : globalCartItems);
    }
  }, [globalCartItems, isInitialized]);

  // Sync delivery charge from CartContext when updated
  useEffect(() => {
    if (productDeliveryChargeRate !== undefined && productDeliveryChargeRate !== null) {
      setVendorDeliveryCharge(productDeliveryChargeRate);
    }
  }, [productDeliveryChargeRate]);

  // Load user profile & address details
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const response = await userAuthService.getCheckoutData();
        if (response.success && response.settings) {
          const pCharge = response.settings.productDeliveryCharge;
          if (pCharge !== undefined && pCharge !== null && !isNaN(Number(pCharge))) {
            setVendorDeliveryCharge(Number(pCharge));
          }
          if (response.settings.visitedCharges !== undefined && response.settings.visitedCharges !== null) {
            setAdminPlatformFee(Number(response.settings.visitedCharges));
          }
        } else if (productDeliveryChargeRate !== undefined && productDeliveryChargeRate !== null) {
          setVendorDeliveryCharge(Number(productDeliveryChargeRate));
        }
        if (response.success && response.user) {
          setContactDetails({
            name: response.user.name || '',
            phone: response.user.phone || ''
          });

          if (response.user.addresses && response.user.addresses.length > 0) {
            setSavedAddresses(response.user.addresses);
            const defaultAddr = response.user.addresses.find(a => a.isDefault) || response.user.addresses[0];
            setAddress(defaultAddr.addressLine1);
            setHouseNumber(defaultAddr.addressLine2 || '');
            setAddressDetails({
              address: defaultAddr.addressLine1,
              lat: defaultAddr.lat,
              lng: defaultAddr.lng,
              type: defaultAddr.type,
              city: defaultAddr.city,
              state: defaultAddr.state,
              pincode: defaultAddr.pincode
            });
          }
        }
      } catch (error) {
        console.error('Failed to load user data for product checkout', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, []);

  // Listen for real-time socket events when vendor accepts product order
  useEffect(() => {
    if (currentStep !== 'waiting') return;

    const socketUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/api$/, '') || 'http://localhost:5000';
    const socket = io(socketUrl, {
      auth: { token: localStorage.getItem('accessToken') },
      transports: ['websocket', 'polling']
    });

    socket.on('product_order_accepted', (data) => {
      setAcceptedVendor(data.vendor);
      setCurrentStep('accepted');
      toast.success(`${data.vendor.businessName || data.vendor.name} accepted your product order!`);

      const targetId = data.orderId || data.customOrderId || (createdOrder ? createdOrder._id : '');

      setTimeout(() => {
        setShowVendorModal(false);
        if (targetId) {
          navigate(`/user/product-order-confirmation/${targetId}`, { replace: true });
        } else {
          navigate('/user', { replace: true });
        }
      }, 2000);
    });

    // Polling fallback: If vendor accepts or order is created, redirect to confirmation page after timeout
    const interval = setInterval(async () => {
      if (createdOrder?._id || createdOrder?.orderId) {
        try {
          const res = await productOrderService.getDetails(createdOrder._id || createdOrder.orderId);
          if (res.success && res.data && ['ACCEPTED', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(res.data.status)) {
            setAcceptedVendor(res.data.vendorId);
            setCurrentStep('accepted');
            toast.success('Product order accepted!');
            setTimeout(() => {
              setShowVendorModal(false);
              navigate(`/user/product-order/${res.data._id || res.data.orderId}`, { replace: true });
            }, 1500);
          }
        } catch (err) {}
      }
    }, 4000);

    // Hard fallback: Navigate to order detail page after 10 seconds so user is not stuck on loading modal
    const timeout = setTimeout(() => {
      if (createdOrder?._id || createdOrder?.orderId) {
        setShowVendorModal(false);
        navigate(`/user/product-order/${createdOrder._id || createdOrder.orderId}`, { replace: true });
      }
    }, 12000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [currentStep, createdOrder]);

  // Calculations
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price || 0), 0);
  const totalTax = Math.round(
    cartItems.reduce((sum, item) => {
      const itemGst = item.gstPercentage !== undefined ? item.gstPercentage : 18;
      return sum + ((item.price || 0) * (itemGst / 100));
    }, 0)
  );
  const platformFee = subtotal > 0 ? (adminPlatformFee !== null ? adminPlatformFee : (platformFeeRate || 19)) : 0;
  const deliveryCharge = subtotal > 0 ? vendorDeliveryCharge : 0;
  const totalPayable = subtotal + deliveryCharge + totalTax + platformFee;

  const handleQuantityChange = async (item, change) => {
    const itemId = item.id || item._id;
    const currentCount = item.serviceCount || 1;
    const newCount = currentCount + change;
    if (newCount <= 0) {
      await removeItemGlobal(itemId);
    } else {
      await updateItemGlobal(itemId, newCount);
    }
  };

  const handleAddressSave = async (savedHouseNumber, locationObj) => {
    setHouseNumber(savedHouseNumber);
    if (locationObj) {
      setAddress(locationObj.address);
      setAddressDetails(locationObj);
    }
    setShowAddressModal(false);
  };

  // Process Product Order
  const handlePlaceOrder = async () => {
    if (!addressDetails) {
      toast.error('Please select delivery address');
      setShowSavedAddressesModal(true);
      return;
    }

    if (!contactDetails.name || !contactDetails.phone) {
      toast.error('Please enter valid contact details');
      setShowContactModal(true);
      return;
    }

    if (cartItems.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    try {
      setShowVendorModal(true);
      setCurrentStep('searching');

      const formattedItems = cartItems.map(item => ({
        productId: typeof item.serviceId === 'object' ? (item.serviceId._id || item.serviceId.id) : (item.serviceId || item.id || item._id),
        title: item.title || item.card?.title || 'Product Item',
        description: item.description || '',
        icon: item.icon || '',
        unitPrice: item.unitPrice || (item.price / (item.serviceCount || 1)),
        quantity: item.serviceCount || 1,
        price: item.price,
        gstPercentage: item.gstPercentage || 18
      }));

      const payload = {
        items: formattedItems,
        deliveryAddress: {
          type: addressDetails.type || 'home',
          addressLine1: addressDetails.addressLine1 || address,
          addressLine2: houseNumber,
          city: addressDetails.city || 'City',
          state: addressDetails.state || 'State',
          pincode: addressDetails.pincode || '000000',
          lat: addressDetails.lat,
          lng: addressDetails.lng
        },
        contactDetails,
        paymentMethod
      };

      const res = await productOrderService.create(payload);

      if (!res.success) {
        toast.error(res.message || 'Failed to place product order');
        setCurrentStep('failed');
        return;
      }

      setCreatedOrder(res.data.order || res.data);
      setCurrentStep('waiting');
      clearCartGlobal().catch(() => {});

      if (paymentMethod === 'cod') {
        toast.success('Order placed! Notifying nearby vendors...');
      } else {
        toast.success('Searching nearby vendors! You can complete online payment once accepted.');
      }
    } catch (error) {
      console.error('Error placing product order:', error);
      toast.error('Error initiating product order');
      setCurrentStep('failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00246b] mb-4"></div>
          <p className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Loading product checkout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-10">
        {/* Top Navigation */}
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-900 hover:bg-gray-50 transition-all active:scale-95"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight uppercase">Product Order Checkout</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
              {cartItems.length} {cartItems.length === 1 ? 'Product' : 'Products'} ready for delivery
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Products & Delivery Details */}
          <div className="lg:col-span-8 space-y-6">

            {/* Product Items List */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-gray-100">
                <FiShoppingBag className="text-[#00246b]" />
                Order Items
              </h2>

              {cartItems.map((item) => (
                <div key={item.id || item._id} className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-none">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 overflow-hidden border border-gray-100 shrink-0">
                    <img src={toAssetUrl(item.icon || '')} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 truncate uppercase">{item.title}</h3>
                    <p className="text-xs text-gray-400 line-clamp-1">{item.description || 'Quality product'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-bold text-gray-900">₹{item.price}</span>
                      {item.serviceCount > 1 && (
                        <span className="text-xs text-gray-400 font-medium">({item.serviceCount} &times; ₹{Math.round(item.price / item.serviceCount)})</span>
                      )}
                    </div>
                  </div>

                  {/* Quantity Modifier */}
                  <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-100 shrink-0">
                    <button 
                      onClick={() => handleQuantityChange(item, -1)}
                      className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shadow-sm hover:bg-gray-50"
                    >
                      <FiMinus className="w-3 h-3 text-gray-700" />
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-gray-900">{item.serviceCount || 1}</span>
                    <button 
                      onClick={() => handleQuantityChange(item, 1)}
                      className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shadow-sm hover:bg-gray-50"
                    >
                      <FiPlus className="w-3 h-3 text-gray-700" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Delivery Address Card */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                  <FiHome className="text-[#00246b]" />
                  Delivery Address
                </h2>
                <button 
                  onClick={() => setShowSavedAddressesModal(true)}
                  className="text-xs font-bold text-blue-600 hover:underline uppercase"
                >
                  Change
                </button>
              </div>

              {addressDetails ? (
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-start gap-3">
                  <FiMapPin className="w-5 h-5 text-[#00246b] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-gray-900 uppercase">{addressDetails.type || 'Home Address'}</p>
                    <p className="text-xs text-gray-600 leading-relaxed mt-0.5">
                      {houseNumber ? `${houseNumber}, ` : ''}{address || 'Selected delivery location'}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowSavedAddressesModal(true)}
                  className="w-full py-4 border-2 border-dashed border-blue-200 text-blue-600 rounded-2xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-blue-50/50 transition-all"
                >
                  <FiPlus className="w-4 h-4" /> Add Delivery Address
                </button>
              )}
            </div>

            {/* Contact Details Card */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#00246b]">
                  <FiPhone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900 uppercase">{contactDetails.name || 'Recipient'}</p>
                  <p className="text-xs text-gray-500 font-semibold">{contactDetails.phone || 'Enter Phone'}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowContactModal(true)}
                className="text-xs font-bold text-blue-600 hover:underline uppercase"
              >
                Edit
              </button>
            </div>

            {/* Payment Method Selector */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <FiCreditCard className="text-[#00246b]" />
                Payment Method
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cash on Delivery (COD) */}
                <div 
                  onClick={() => setPaymentMethod('cod')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-4 ${paymentMethod === 'cod' ? 'border-[#00246b] bg-blue-50/30 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}
                >
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'cod' ? 'border-[#00246b] bg-[#00246b]' : 'border-gray-300'}`}>
                    {paymentMethod === 'cod' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 uppercase">Cash on Delivery (COD)</p>
                    <p className="text-[10px] text-gray-500 font-medium">Pay cash or UPI upon product delivery</p>
                  </div>
                </div>

                {/* Pay Online */}
                <div 
                  onClick={() => setPaymentMethod('online')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-4 ${paymentMethod === 'online' ? 'border-[#00246b] bg-blue-50/30 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}
                >
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'online' ? 'border-[#00246b] bg-[#00246b]' : 'border-gray-300'}`}>
                    {paymentMethod === 'online' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 uppercase">Pay Online Now</p>
                    <p className="text-[10px] text-gray-500 font-medium">UPI, Cards, NetBanking (Razorpay)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Note */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
              <FiInfo className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-blue-900 uppercase mb-0.5">Product Delivery Guarantee</h4>
                <p className="text-xs text-blue-800 leading-relaxed">
                  Your order is assigned directly to verified local partners. Vendor receives 100% of the delivery charge for fast & safe fulfillment.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & Place Order */}
          <div className="lg:col-span-4">
            <div className="sticky top-28 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-gray-100">
                <FiDollarSign className="text-[#00246b]" />
                Payment Summary
              </h2>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center text-gray-500">
                  <span className="font-semibold uppercase">Products Subtotal</span>
                  <span className="font-bold text-gray-900">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold uppercase">Vendor Delivery Charge</span>
                    <span className="bg-emerald-100 text-emerald-700 text-[8px] font-bold px-1.5 py-0.5 rounded">100% TO VENDOR</span>
                  </div>
                  <span className="font-bold text-gray-900">₹{deliveryCharge.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center text-gray-500">
                  <span className="font-semibold uppercase">GST & Taxes</span>
                  <span className="font-bold text-gray-900">₹{totalTax.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center text-gray-500">
                  <span className="font-semibold uppercase">Platform Fee</span>
                  <span className="font-bold text-gray-900">₹{platformFee.toLocaleString('en-IN')}</span>
                </div>

                <div className="pt-4 border-t border-dashed border-gray-200 flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-900 uppercase tracking-tight">Total Amount</span>
                  <span className="text-xl font-bold text-gray-900">₹{totalPayable.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handlePlaceOrder}
                className="w-full bg-[#00246b] text-white py-4 rounded-2xl font-bold uppercase tracking-wider text-xs shadow-xl shadow-blue-900/15 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <FiZap className="w-4 h-4 fill-current" />
                {paymentMethod === 'cod' ? 'Place Product Order (COD)' : 'Proceed to Pay Online'}
              </button>

              <div className="flex items-center justify-center gap-2 text-[9px] font-bold text-emerald-600 uppercase tracking-widest">
                <FiCheckCircle className="w-4 h-4" />
                Verified Local Vendor Delivery
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Address Selection Modal */}
      {showSavedAddressesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-gray-900 uppercase">Select Delivery Address</h3>
              <button onClick={() => setShowSavedAddressesModal(false)}><FiX className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {savedAddresses.map(addr => (
                <div 
                  key={addr._id || addr.id}
                  onClick={() => {
                    setAddress(addr.addressLine1);
                    setHouseNumber(addr.addressLine2 || '');
                    setAddressDetails(addr);
                    setShowSavedAddressesModal(false);
                  }}
                  className="p-3 border rounded-xl hover:border-blue-500 cursor-pointer text-xs"
                >
                  <p className="font-bold text-gray-900">{addr.type || 'Home'}</p>
                  <p className="text-gray-500">{addr.addressLine1}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => { setShowSavedAddressesModal(false); setShowAddressModal(true); }}
              className="w-full py-3 border-2 border-dashed border-blue-500 text-blue-600 rounded-xl text-xs font-bold uppercase"
            >
              + Add New Address
            </button>
          </div>
        </div>
      )}

      <AddressSelectionModal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        address={address}
        houseNumber={houseNumber}
        onHouseNumberChange={setHouseNumber}
        onSave={handleAddressSave}
      />

      {/* Vendor Dispatch Modal */}
      <ProductVendorSearchModal
        isOpen={showVendorModal}
        onClose={() => setShowVendorModal(false)}
        currentStep={currentStep}
        acceptedVendor={acceptedVendor}
        onRetry={handlePlaceOrder}
      />
    </div>
  );
};

export default ProductCheckout;
