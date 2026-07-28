import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiMapPin, FiPhone, FiUser, FiClock, FiPackage, FiCheckCircle, FiXCircle, FiChevronRight, FiKey, FiTruck, FiShoppingBag } from 'react-icons/fi';
import { workerTheme as themeColors } from '../../../../theme';
import Header from '../../components/layout/Header';
import workerService from '../../../../services/workerService';
import { toast } from 'react-hot-toast';

const DeliveryOtpModal = ({ isOpen, onClose, onVerify, loading }) => {
  const [otp, setOtp] = useState(['', '', '', '']);
  const handleChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 3) document.getElementById(`dotp-${index + 1}`)?.focus();
  };
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) document.getElementById(`dotp-${index - 1}`)?.focus();
  };
  const handleSubmit = () => {
    const code = otp.join('');
    if (code.length !== 4) return toast.error('Enter 4-digit OTP');
    onVerify(code);
  };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <FiKey className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="font-black text-xl text-slate-900">Enter Delivery OTP</h3>
          <p className="text-sm text-slate-500 mt-1 font-medium">Ask customer for the 4-digit OTP</p>
        </div>
        <div className="flex gap-3 justify-center mb-6">
          {[0, 1, 2, 3].map((i) => (
            <input key={i} id={`dotp-${i}`} type="number" inputMode="numeric"
              className="w-14 h-14 border-2 border-slate-200 rounded-2xl text-center text-xl font-black focus:border-emerald-500 focus:outline-none text-slate-900"
              value={otp[i]} onChange={(e) => handleChange(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)} maxLength={1} />
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl font-bold text-slate-600 bg-slate-100 border border-slate-200">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="flex-1 py-3 rounded-2xl font-bold text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}>
            {loading ? 'Verifying...' : 'Confirm Delivery'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ProductOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpInitiated, setOtpInitiated] = useState(false);

  useLayoutEffect(() => {
    const bg = themeColors.backgroundGradient;
    document.documentElement.style.background = bg;
    document.body.style.background = bg;
    const root = document.getElementById('root');
    if (root) root.style.background = bg;
    return () => { document.documentElement.style.background = ''; document.body.style.background = ''; if (root) root.style.background = ''; };
  }, []);

  const fetchOrder = async () => {
    try { setLoading(true); const res = await workerService.getProductOrderById(id); if (res.success) setOrder(res.data); } catch { toast.error('Failed to load order details'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchOrder(); }, [id]);

  const handleStatusUpdate = async (status) => {
    try { setActionLoading(true); const res = await workerService.updateProductOrderStatus(id, status); if (res.success) { toast.success(res.message); fetchOrder(); } } catch (err) { toast.error(err.response?.data?.message || 'Failed to update status'); } finally { setActionLoading(false); }
  };

  const handleInitiateOtp = async () => {
    try { setActionLoading(true); const res = await workerService.initiateDeliveryOtp(id); if (res.success) { toast.success('OTP sent to customer!'); setOtpInitiated(true); setOtpModalOpen(true); } } catch (err) { toast.error(err.response?.data?.message || 'Failed to send OTP'); } finally { setActionLoading(false); }
  };

  const handleVerifyOtp = async (otpCode) => {
    try { setActionLoading(true); const res = await workerService.verifyDeliveryOtp(id, otpCode); if (res.success) { toast.success('Order Delivered Successfully!'); setOtpModalOpen(false); fetchOrder(); } } catch (err) { toast.error(err.response?.data?.message || 'Invalid OTP'); } finally { setActionLoading(false); }
  };

  const getStatusBadge = (status) => {
    const map = { ACCEPTED: { label: 'Assigned', bg: '#DBEAFE', color: '#1D4ED8' }, ASSIGNED: { label: 'Assigned', bg: '#DBEAFE', color: '#1D4ED8' }, PACKING: { label: 'Packing', bg: '#FEF3C7', color: '#92400E' }, OUT_FOR_DELIVERY: { label: 'Out for Delivery', bg: '#D1FAE5', color: '#065F46' }, DELIVERED: { label: 'Delivered', bg: '#D1FAE5', color: '#065F46' }, CANCELLED: { label: 'Cancelled', bg: '#FEE2E2', color: '#991B1B' } };
    const s = map[status] || { label: status, bg: '#F3F4F6', color: '#374151' };
    return <span className="text-xs font-black uppercase px-3 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
  };

  if (loading) return (
    <div className="min-h-screen pb-20" style={{ background: themeColors.backgroundGradient }}>
      <Header title="Delivery Details" />
      <main className="px-4 py-6 space-y-4">{[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-32 animate-pulse" />)}</main>
    </div>
  );

  if (!order) return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center" style={{ background: themeColors.backgroundGradient }}>
      <div><FiXCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" /><p className="text-gray-600 font-bold text-xl mb-4">Order not found</p><button onClick={() => navigate('/worker/jobs')} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold">Back to Jobs</button></div>
    </div>
  );

  const isDelivered = order.status === 'DELIVERED';
  const isCancelled = order.status === 'CANCELLED';
  const customerName = order.userId?.name || order.contactDetails?.name || 'Customer';
  const customerPhone = order.userId?.phone || order.contactDetails?.phone || '';

  return (
    <div className="min-h-screen pb-24" style={{ background: themeColors.backgroundGradient }}>
      <Header title="Delivery Details" onBack={() => navigate('/worker/jobs')} />
      <main className="px-4 py-5 space-y-4">

        <button onClick={() => navigate(`/worker/product-order/${id}/timeline`)} className="w-full bg-white border border-gray-200 py-4 rounded-2xl font-bold text-gray-700 flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all">
          <FiClock className="w-5 h-5 text-gray-500" /> View Delivery Timeline <FiChevronRight className="w-4 h-4 ml-auto text-gray-400" />
        </button>

        {!isDelivered && !isCancelled && (
          <div className="space-y-3">
            {(order.status === 'ACCEPTED' || order.status === 'ASSIGNED') && (
              <button onClick={() => handleStatusUpdate('PACKING')} disabled={actionLoading} className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all text-base" style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }}>
                <FiPackage className="w-5 h-5" />{actionLoading ? 'Updating...' : 'Start Packing'}
              </button>
            )}
            {order.status === 'PACKING' && (
              <button onClick={() => handleStatusUpdate('OUT_FOR_DELIVERY')} disabled={actionLoading} className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all text-base" style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}>
                <FiTruck className="w-5 h-5" />{actionLoading ? 'Updating...' : 'Mark Out for Delivery'}
              </button>
            )}
            {order.status === 'OUT_FOR_DELIVERY' && (
              !otpInitiated ? (
                <button onClick={handleInitiateOtp} disabled={actionLoading} className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all text-base" style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)' }}>
                  <FiKey className="w-5 h-5" />{actionLoading ? 'Sending OTP...' : 'Send Delivery OTP to Customer'}
                </button>
              ) : (
                <button onClick={() => setOtpModalOpen(true)} disabled={actionLoading} className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all text-base" style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}>
                  <FiKey className="w-5 h-5" />Enter OTP & Confirm Delivery
                </button>
              )
            )}
          </div>
        )}

        {isDelivered && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
            <FiCheckCircle className="w-8 h-8 text-emerald-600 shrink-0" />
            <div><p className="font-black text-emerald-800">Order Delivered!</p><p className="text-xs text-emerald-600 font-medium mt-0.5">{order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : ''}</p></div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-5 shadow-md">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl">📦</div>
              <div><p className="text-xs font-bold text-slate-400 uppercase">Order ID</p><p className="font-black text-slate-900 text-base">#{order.orderId}</p></div>
            </div>
            <div className="text-right">
              {getStatusBadge(order.status)}
              <p className="text-2xl font-black text-slate-900 mt-2">₹{order.financialBreakdown?.totalAmount || 0}</p>
              {order.paymentMethod === 'cod' ? (
                <p className="text-xs font-bold text-amber-600 uppercase mt-0.5">Cash on Delivery</p>
              ) : order.paymentStatus === 'PAID' ? (
                <p className="text-xs font-bold text-emerald-600 uppercase mt-0.5">Paid Online</p>
              ) : (
                <span className="inline-block bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded uppercase mt-0.5 animate-pulse">
                  ⚠️ ONLINE PAYMENT PENDING
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-md">
          <h4 className="font-black text-slate-900 mb-4 flex items-center gap-2"><FiUser className="w-5 h-5 text-slate-400" /> Customer</h4>
          <div className="flex items-center justify-between">
            <div><p className="font-bold text-slate-900 text-base">{customerName}</p>{customerPhone && <p className="text-sm text-slate-500 font-medium mt-0.5">{customerPhone}</p>}</div>
            {customerPhone && <a href={`tel:${customerPhone}`} className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100 active:scale-90 transition-transform"><FiPhone className="w-5 h-5" /></a>}
          </div>
        </div>

        {order.deliveryAddress && (
          <div className="bg-white rounded-2xl p-5 shadow-md">
            <h4 className="font-black text-slate-900 mb-4 flex items-center gap-2"><FiMapPin className="w-5 h-5 text-slate-400" /> Delivery Address</h4>
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 mb-3">
              <p className="font-semibold text-slate-800 text-sm">{order.deliveryAddress.addressLine1}{order.deliveryAddress.addressLine2 ? `, ${order.deliveryAddress.addressLine2}` : ''}</p>
              <p className="text-xs text-slate-500 mt-1">{[order.deliveryAddress.city, order.deliveryAddress.state, order.deliveryAddress.pincode].filter(Boolean).join(', ')}</p>
              {order.deliveryAddress.landmark && <p className="text-xs text-blue-600 font-semibold mt-1">Landmark: {order.deliveryAddress.landmark}</p>}
            </div>
            <div className="w-full h-40 rounded-xl overflow-hidden border border-blue-100 mb-3">
              <iframe width="100%" height="100%" frameBorder="0" style={{ border: 0, pointerEvents: 'none' }} src={`https://maps.google.com/maps?q=${(order.deliveryAddress.lat && order.deliveryAddress.lng) ? `${order.deliveryAddress.lat},${order.deliveryAddress.lng}` : encodeURIComponent([order.deliveryAddress.addressLine1, order.deliveryAddress.city].filter(Boolean).join(', '))}&z=15&output=embed`} allowFullScreen loading="lazy" tabIndex="-1" />
            </div>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${(order.deliveryAddress.lat && order.deliveryAddress.lng) ? `${order.deliveryAddress.lat},${order.deliveryAddress.lng}` : encodeURIComponent([order.deliveryAddress.addressLine1, order.deliveryAddress.city].filter(Boolean).join(', '))}`} target="_blank" rel="noopener noreferrer" className="w-full py-2 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform" style={{ background: themeColors.button }}>
              <FiMapPin className="w-4 h-4" /> Open in Google Maps
            </a>
          </div>
        )}

        {order.items && order.items.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-md">
            <h4 className="font-black text-slate-900 mb-4 flex items-center gap-2"><FiShoppingBag className="w-5 h-5 text-slate-400" /> Items to Deliver</h4>
            <div className="space-y-3">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    {item.icon ? <img src={item.icon} alt={item.title} className="w-10 h-10 rounded-xl object-cover" /> : <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg">📦</div>}
                    <div><p className="font-bold text-slate-800 text-sm">{item.title}</p><p className="text-xs text-slate-400 font-medium">₹{item.unitPrice} each</p></div>
                  </div>
                  <div className="text-right"><span className="text-xs font-black bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">x{item.quantity}</span><p className="text-sm font-black text-slate-900 mt-1">₹{item.price}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-5 shadow-md">
          <h4 className="font-black text-slate-900 mb-4">💰 Payment Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>₹{order.financialBreakdown?.subtotal || 0}</span></div>
            <div className="flex justify-between text-slate-600"><span>Delivery Charge</span><span>₹{order.financialBreakdown?.deliveryCharge || 0}</span></div>
            {(order.financialBreakdown?.tax > 0) && <div className="flex justify-between text-slate-600"><span>Tax</span><span>₹{order.financialBreakdown.tax}</span></div>}
            <div className="border-t border-slate-100 my-2" />
            <div className="flex justify-between items-center"><span className="font-black text-slate-900">Total</span><span className="text-xl font-black text-slate-900">₹{order.financialBreakdown?.totalAmount || 0}</span></div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Payment Status</span>
              <span className={`font-bold ${order.paymentMethod === 'cod' ? 'text-amber-600' : order.paymentStatus === 'PAID' ? 'text-emerald-600' : 'text-red-600 font-black'}`}>
                {order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentStatus === 'PAID' ? 'Paid Online' : '⚠️ ONLINE PAYMENT PENDING'}
              </span>
            </div>
          </div>
        </div>

      </main>
      <DeliveryOtpModal isOpen={otpModalOpen} onClose={() => setOtpModalOpen(false)} onVerify={handleVerifyOtp} loading={actionLoading} />
    </div>
  );
};

export default ProductOrderDetail;
