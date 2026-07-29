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
  const [deliveryOtp, setDeliveryOtp] = useState(null); // OTP state

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const res = await productOrderService.getDetails(orderId);
      if (res.success) {
        setOrder(res.data);
        // If OTP already exists in the order (persisted in DB), show it
        if (res.data?.deliveryOtp) {
          setDeliveryOtp(res.data.deliveryOtp);
        }
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

  // Poll every 20s when OUT_FOR_DELIVERY to catch OTP if socket missed
  useEffect(() => {
    if (!order) return;
    if (order.status === 'OUT_FOR_DELIVERY' && !deliveryOtp) {
      const interval = setInterval(async () => {
        try {
          const res = await productOrderService.getDetails(orderId);
          if (res.success && res.data?.deliveryOtp) {
            setDeliveryOtp(res.data.deliveryOtp);
            setOrder(res.data);
            clearInterval(interval);
          }
        } catch {}
      }, 20000);
      return () => clearInterval(interval);
    }
  }, [order?.status, deliveryOtp]);

  const [showThankYouModal, setShowThankYouModal] = useState(false);

  // Trigger Thank You modal if order status is DELIVERED
  useEffect(() => {
    if (order?.status === 'DELIVERED') {
      setShowThankYouModal(true);
    }
  }, [order?.status]);

  // Real-time socket updates for order status
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/api$/, '') || 'http://localhost:5000';
    const socket = io(socketUrl, {
      auth: { token: localStorage.getItem('accessToken') },
      transports: ['websocket', 'polling']
    });

    socket.on('product_order_status_update', (data) => {
      if (data.orderId === orderId || data.customOrderId === order?.orderId || String(data.orderId) === String(order?._id)) {
        setOrder(prev => prev ? { ...prev, status: data.status } : prev);
        if (data.status === 'DELIVERED') {
          setShowThankYouModal(true);
          toast.success('Order Delivered Successfully!');
        } else {
          toast.success(`Order status: ${data.status.replace(/_/g, ' ')}`);
        }
      }
    });

    // Listen for delivery OTP — show it on this page immediately
    socket.on('product_delivery_otp', (data) => {
      setDeliveryOtp(data.otp);
      toast.success('Delivery OTP received! Share it with the delivery person.');
    });

    return () => {
      socket.disconnect();
    };
  }, [orderId, order?.orderId, order?._id]);

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
          <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3.5 py-1.5 rounded-full text-xs font-extrabold mt-3 shadow-xs">
            <span className="text-sm">🚚</span> Estimated Delivery: <span className="text-emerald-900 font-black">6 - 7 Days</span>
          </div>

          {/* Timeline Status — matches worker side stages */}
          <div className="mt-8 pt-8 border-t border-gray-100">
            {(() => {
              const stages = [
                { step: 1, title: 'Ordered',    icon: '🛒', status: 'PENDING_ACCEPTANCE' },
                { step: 2, title: 'Accepted',   icon: '✅', status: 'ACCEPTED'           },
                { step: 3, title: 'Packing',    icon: '📦', status: 'PACKING'            },
                { step: 4, title: 'On the Way', icon: '🚚', status: 'OUT_FOR_DELIVERY'   },
                { step: 5, title: 'Delivered',  icon: '🎉', status: 'DELIVERED'          },
              ];
              return (
                <div className="flex items-start justify-between relative">
                  {/* Connecting line */}
                  <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-gray-100 z-0" />
                  <div
                    className="absolute top-5 left-[10%] h-0.5 bg-emerald-500 z-0 transition-all duration-700"
                    style={{ width: `${Math.max(0, (currentStepNum - 1) / 4 * 80)}%` }}
                  />

                  {stages.map((s) => {
                    const done    = s.step < currentStepNum;
                    const current = s.step === currentStepNum;
                    const future  = s.step > currentStepNum;
                    return (
                      <div key={s.step} className="flex flex-col items-center z-10 flex-1">
                        {/* Circle */}
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-black mb-2 border-2 transition-all duration-500 ${
                            done
                              ? 'bg-emerald-500 border-emerald-500 text-white shadow-md'
                              : current
                              ? 'bg-white border-emerald-500 text-emerald-600 shadow-lg ring-4 ring-emerald-100'
                              : 'bg-white border-gray-200 text-gray-300'
                          }`}
                        >
                          {done ? '✓' : current ? <span className="text-xs font-black">{s.step}</span> : <span className="text-xs text-gray-300">{s.step}</span>}
                        </div>
                        {/* Emoji */}
                        <span className={`text-base mb-1 ${future ? 'opacity-30 grayscale' : ''}`}>{s.icon}</span>
                        {/* Label */}
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider text-center leading-tight ${
                            done ? 'text-emerald-600' : current ? 'text-gray-900' : 'text-gray-300'
                          }`}
                        >
                          {s.title}
                        </span>
                        {current && (
                          <span className="mt-1 text-[8px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full animate-pulse">
                            Now
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── DELIVERY OTP BANNER ─────────────────────────────────── */}
        {(order.paymentMethod !== 'online' || order.paymentStatus === 'PAID') && (deliveryOtp || (order.status === 'OUT_FOR_DELIVERY' && order.deliveryOtp)) && (
          <div className="mb-8 rounded-3xl overflow-hidden border-2 border-emerald-400 shadow-lg">
            {/* Green header */}
            <div className="bg-emerald-500 px-6 py-4 flex items-center gap-3">
              <span className="text-2xl">🔑</span>
              <div>
                <p className="text-white font-black text-sm uppercase tracking-wide">Delivery OTP</p>
                <p className="text-emerald-100 text-xs font-medium">Share this with your delivery person</p>
              </div>
            </div>
            {/* OTP digits */}
            <div className="bg-white px-6 py-6 text-center">
              <p className="text-slate-500 text-sm font-medium mb-4">Your delivery code</p>
              <div className="flex gap-3 justify-center mb-4">
                {String(deliveryOtp || order.deliveryOtp).split('').map((digit, i) => (
                  <div
                    key={i}
                    className="w-16 h-16 bg-emerald-50 border-2 border-emerald-400 rounded-2xl flex items-center justify-center text-3xl font-black text-emerald-700 shadow-sm"
                  >
                    {digit}
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 font-medium">⏱ Valid for 15 minutes</p>
              <p className="text-xs text-slate-500 mt-1">Tell this OTP to your delivery person to complete the delivery</p>
            </div>
          </div>
        )}

        {/* OUT_FOR_DELIVERY waiting banner (before OTP arrives or payment pending) */}
        {order.status === 'OUT_FOR_DELIVERY' && (order.paymentMethod !== 'online' || order.paymentStatus === 'PAID') && !deliveryOtp && !order.deliveryOtp && (
          <div className="mb-8 bg-blue-50 border-2 border-blue-200 rounded-3xl px-6 py-5 flex items-center gap-4">
            <span className="text-3xl">🚚</span>
            <div>
              <p className="font-black text-blue-800 text-base">Your order is on the way!</p>
              <p className="text-blue-600 text-sm font-medium mt-0.5">The delivery person will share an OTP with you shortly. It will appear here automatically.</p>
            </div>
          </div>
        )}

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
            ) : (order.status === 'ESCALATED' || order.isEscalatedToAdmin) ? (
              <div className="flex items-center gap-3 bg-amber-50 p-3 rounded-2xl border border-amber-200">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center text-lg shrink-0 font-bold">
                  🛡️
                </div>
                <div>
                  <h4 className="text-xs font-black text-amber-900 uppercase">Assigned to Nexora Support Team</h4>
                  <p className="text-[11px] text-amber-700 font-medium leading-tight mt-0.5">
                    Our admin team is manually assigning a nearby vendor partner for your order.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-400 text-xs">
                  <FiClock className="w-5 h-5 animate-spin" />
                  Assigning nearby partner vendor...
                </div>
                {['PENDING_ACCEPTANCE', 'ESCALATED'].includes(order.status) && (
                  <button
                    onClick={async () => {
                      if (!window.confirm('Are you sure you want to cancel this order? Paid amount will be 100% refunded to your bank account.')) return;
                      try {
                        toast.loading('Cancelling order & processing refund...');
                        const res = await productOrderService.cancel(order._id || order.orderId, 'Cancelled by user before vendor assignment');
                        toast.dismiss();
                        if (res.success) {
                          toast.success(res.message || 'Order cancelled & 100% bank refund initiated');
                          setOrder(prev => ({ ...prev, status: 'CANCELLED', paymentStatus: res.refundProcessed ? 'REFUNDED' : prev.paymentStatus }));
                        } else {
                          toast.error(res.message || 'Failed to cancel order');
                        }
                      } catch (err) {
                        toast.dismiss();
                        toast.error('Error cancelling order');
                      }
                    }}
                    className="w-full py-2 px-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold uppercase hover:bg-red-100 transition-all border border-red-100"
                  >
                    Cancel Order (100% Instant Refund)
                  </button>
                )}
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
              <span className="uppercase">Total Amount ({order.paymentMethod?.toUpperCase()})</span>
              <span className="text-lg">₹{order.financialBreakdown?.totalAmount}</span>
            </div>

            {order.paymentMethod === 'online' && order.paymentStatus === 'PENDING' && (
              <div className="pt-3 border-t border-amber-200 bg-amber-50 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-amber-900 uppercase">Vendor Accepted Your Order!</p>
                  <p className="text-[11px] text-amber-700 font-medium">Please complete online payment to confirm dispatch.</p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      toast.loading('Initiating Razorpay payment...');
                      const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_8sYbzHWidwe5Zw';
                      const options = {
                        key: razorpayKey,
                        amount: Math.round(order.financialBreakdown?.totalAmount * 100),
                        currency: 'INR',
                        name: 'Nexora Product Order',
                        description: `Payment for Order #${order.orderId}`,
                        order_id: order.razorpayDetails?.razorpayOrderId,
                        handler: async function (response) {
                          try {
                            const verifyRes = await productOrderService.verifyPayment({
                              razorpay_order_id: response.razorpay_order_id,
                              razorpay_payment_id: response.razorpay_payment_id,
                              razorpay_signature: response.razorpay_signature,
                              orderId: order._id
                            });
                            toast.dismiss();
                            if (verifyRes.success) {
                              toast.success('Payment completed successfully!');
                              setOrder(prev => ({ ...prev, paymentStatus: 'PAID' }));
                            } else {
                              toast.error(verifyRes.message || 'Payment verification failed');
                            }
                          } catch (err) {
                            toast.dismiss();
                            toast.error('Payment verification failed');
                          }
                        },
                        prefill: {
                          name: order.contactDetails?.name || '',
                          contact: order.contactDetails?.phone || ''
                        },
                        theme: { color: '#00246b' }
                      };
                      toast.dismiss();
                      const rzp = new window.Razorpay(options);
                      rzp.open();
                    } catch (e) {
                      toast.dismiss();
                      toast.error('Error launching payment');
                    }
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#00246b] text-white text-xs font-bold rounded-xl shadow-md uppercase active:scale-95 transition-all"
                >
                  Pay ₹{order.financialBreakdown?.totalAmount} Online
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── THANK YOU / DELIVERED MODAL ───────────────────────── */}
        {showThankYouModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
            <div className="bg-white w-full max-w-md rounded-3xl p-8 text-center shadow-2xl border border-emerald-100 transform transition-all">
              <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5 border-4 border-emerald-200 animate-bounce">
                <span className="text-5xl">🎉</span>
              </div>
              
              <h2 className="text-2xl font-black text-slate-900 mb-2">Thank You for Ordering!</h2>
              <p className="text-slate-600 text-sm font-medium mb-6 leading-relaxed">
                Your order <span className="font-bold text-emerald-600">#{order?.orderId}</span> has been delivered successfully. We hope you enjoy your purchase!
              </p>

              <button
                onClick={() => navigate('/user', { replace: true })}
                className="w-full py-4 rounded-2xl font-bold text-white shadow-xl active:scale-95 transition-all text-base bg-emerald-500 hover:bg-emerald-600"
              >
                Go to Home Page
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProductOrderConfirmation;
