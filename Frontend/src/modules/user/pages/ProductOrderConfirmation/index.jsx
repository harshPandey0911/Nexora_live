import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  FiCheckCircle, 
  FiPackage, 
  FiTruck, 
  FiPhone, 
  FiMapPin, 
  FiArrowLeft,
  FiClock,
  FiShoppingBag
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { productOrderService } from '../../../../services/productOrderService';
import Header from '../../components/layout/Header';

const ProductOrderConfirmation = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const res = await productOrderService.getDetails(orderId);
      if (res.success) {
        setOrder(res.data);
      } else {
        toast.error('Failed to load order details');
      }
    } catch (error) {
      console.error('Error fetching product order details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  // Real-time socket updates for order status
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/api$/, '') || 'http://localhost:5000';
    const socket = io(socketUrl, {
      auth: { token: localStorage.getItem('accessToken') },
      transports: ['websocket', 'polling']
    });

    socket.on('product_order_status_update', (data) => {
      if (data.orderId === orderId || data.customOrderId === order?.orderId) {
        setOrder(prev => prev ? { ...prev, status: data.status, paymentStatus: data.paymentStatus } : prev);
        toast.success(`Order status updated: ${data.status.replace(/_/g, ' ')}`);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [orderId, order?.orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00246b]" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-white p-8 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Order Not Found</h2>
        <button onClick={() => navigate('/user')} className="px-6 py-2 bg-[#00246b] text-white rounded-xl font-bold uppercase text-xs">Return Home</button>
      </div>
    );
  }

  const getStatusStep = (status) => {
    switch (status) {
      case 'PENDING_ACCEPTANCE': return 1;
      case 'ACCEPTED': return 2;
      case 'PACKING': return 3;
      case 'OUT_FOR_DELIVERY': return 4;
      case 'DELIVERED': return 5;
      default: return 1;
    }
  };

  const currentStepNum = getStatusStep(order.status);

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <button 
          onClick={() => navigate('/user')}
          className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-900 mb-6 uppercase tracking-wider"
        >
          <FiArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        {/* Confirmation Banner */}
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm text-center mb-8">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <FiCheckCircle className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">Order Confirmed!</h1>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mt-1">Order ID: #{order.orderId}</p>

          {/* Timeline Status */}
          <div className="mt-8 pt-8 border-t border-gray-100 grid grid-cols-5 gap-2 text-center">
            {[
              { title: 'Placed', step: 1 },
              { title: 'Accepted', step: 2 },
              { title: 'Packing', step: 3 },
              { title: 'On the Way', step: 4 },
              { title: 'Delivered', step: 5 }
            ].map(s => (
              <div key={s.step} className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-2 transition-all ${s.step <= currentStepNum ? 'bg-emerald-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>
                  {s.step <= currentStepNum ? '✓' : s.step}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${s.step <= currentStepNum ? 'text-gray-900' : 'text-gray-400'}`}>{s.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Vendor & Delivery Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Vendor Card */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Fulfilling Vendor Partner</h3>
            {order.vendorId ? (
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#00246b] flex items-center justify-center font-bold text-xl uppercase border border-blue-100">
                  {order.vendorId.businessName ? order.vendorId.businessName.charAt(0) : 'V'}
                </div>
                <div>
                  <h4 className="text-base font-bold text-gray-900">{order.vendorId.businessName || order.vendorId.name}</h4>
                  <p className="text-xs text-gray-500 font-medium">{order.vendorId.phone || 'Verified Vendor Partner'}</p>
                  <span className="inline-block mt-1 bg-emerald-50 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                    100% Delivery Charge Received
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-gray-400 text-xs">
                <FiClock className="w-5 h-5 animate-spin" />
                Assigning nearby partner vendor...
              </div>
            )}
          </div>

          {/* Delivery Address */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Delivery Address</h3>
            <div className="flex items-start gap-3">
              <FiMapPin className="w-5 h-5 text-[#00246b] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-gray-900 uppercase">{order.deliveryAddress?.type || 'Home'}</p>
                <p className="text-xs text-gray-600 leading-relaxed mt-0.5">
                  {order.deliveryAddress?.addressLine2 ? `${order.deliveryAddress.addressLine2}, ` : ''}{order.deliveryAddress?.addressLine1}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Order Items & Price Summary */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-3">
            <FiShoppingBag className="text-[#00246b]" /> Items & Financial Summary
          </h3>

          <div className="space-y-3">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs py-2 border-b border-gray-50 last:border-none">
                <div>
                  <p className="font-bold text-gray-900 uppercase">{item.title}</p>
                  <p className="text-gray-400">{item.quantity} &times; ₹{item.unitPrice}</p>
                </div>
                <span className="font-bold text-gray-900">₹{item.price}</span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-dashed border-gray-200 space-y-2 text-xs">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span className="font-bold text-gray-900">₹{order.financialBreakdown?.subtotal}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span className="flex items-center gap-1">Vendor Delivery Charge <span className="bg-emerald-100 text-emerald-700 text-[8px] font-bold px-1 rounded">100% VENDOR</span></span>
              <span className="font-bold text-gray-900">₹{order.financialBreakdown?.deliveryCharge}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>GST & Taxes</span>
              <span className="font-bold text-gray-900">₹{order.financialBreakdown?.tax}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Platform Fee</span>
              <span className="font-bold text-gray-900">₹{order.financialBreakdown?.platformFee}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-bold text-gray-900 pt-3 border-t">
              <span className="uppercase">Total Paid ({order.paymentMethod?.toUpperCase()})</span>
              <span className="text-lg">₹{order.financialBreakdown?.totalAmount}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProductOrderConfirmation;
