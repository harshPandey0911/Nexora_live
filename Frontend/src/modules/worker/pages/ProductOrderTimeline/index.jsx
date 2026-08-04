import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiCheck, FiClock, FiPackage, FiTruck, FiCheckCircle, FiKey } from 'react-icons/fi';
import { workerTheme as themeColors } from '../../../../theme';
import Header from '../../components/layout/Header';
import workerService from '../../../../services/workerService';
import { toast } from 'react-hot-toast';

const DeliveryOtpModal = ({ isOpen, onClose, onVerify, loading }) => {
  const [otp, setOtp] = useState(['', '', '', '']);
  const handleChange = (index, value) => {
    const cleanValue = value.replace(/\D/g, '');
    if (!cleanValue) {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      return;
    }
    if (cleanValue.length > 1) {
      const digits = cleanValue.slice(0, 4).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (i < 4) newOtp[i] = d;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(digits.length, 3);
      document.getElementById(`totp-${nextIndex}`)?.focus();
      return;
    }
    const digit = cleanValue.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    if (digit && index < 3) document.getElementById(`totp-${index + 1}`)?.focus();
  };
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) document.getElementById(`totp-${index - 1}`)?.focus();
  };
  const handleSubmit = () => {
    const code = otp.join('');
    if (code.length !== 4) return toast.error('Enter 4-digit OTP');
    onVerify(code);
  };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3.5 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-xs sm:max-w-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl">
        <div className="text-center mb-4 sm:mb-6">
          <div className="w-11 h-11 sm:w-16 sm:h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
            <FiKey className="w-5 h-5 sm:w-8 sm:h-8 text-emerald-600" />
          </div>
          <h3 className="font-bold text-base sm:text-xl text-slate-900 leading-tight">Enter Delivery OTP</h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1 font-medium">Ask customer for the 4-digit OTP</p>
        </div>
        <div className="flex gap-2 sm:gap-3 justify-center mb-4 sm:mb-6">
          {[0, 1, 2, 3].map((i) => (
            <input key={i} id={`totp-${i}`} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code"
              className="w-11 h-11 sm:w-14 sm:h-14 border-2 border-slate-200 rounded-xl sm:rounded-2xl text-center text-lg sm:text-xl font-black focus:border-emerald-500 focus:outline-none text-slate-900 shadow-xs transition-colors"
              value={otp[i]} onChange={(e) => handleChange(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)} maxLength={1} />
          ))}
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm text-slate-600 bg-slate-100 border border-slate-200 active:scale-95 transition-transform">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="flex-1 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm text-white shadow-md active:scale-95 transition-transform" style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}>
            {loading ? 'Verifying...' : 'Confirm Delivery'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ProductOrderTimeline = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpInitiated, setOtpInitiated] = useState(false);

  useLayoutEffect(() => {
    const bg = themeColors.backgroundGradient;
    document.documentElement.style.background = bg;
    document.body.style.background = bg;
    return () => { document.documentElement.style.background = ''; document.body.style.background = ''; };
  }, []);

  const fetchOrder = async () => {
    try {
      const res = await workerService.getProductOrderById(id);
      if (res.success) setOrder(res.data);
    } catch { toast.error('Failed to load order'); }
  };

  useEffect(() => { fetchOrder(); }, [id]);

  const handleStatusUpdate = async (status) => {
    try {
      setActionLoading(true);
      const res = await workerService.updateProductOrderStatus(id, status);
      if (res.success) { toast.success(res.message); fetchOrder(); }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update status'); }
    finally { setActionLoading(false); }
  };

  const handleInitiateOtp = async () => {
    try {
      setActionLoading(true);
      const res = await workerService.initiateDeliveryOtp(id);
      if (res.success) { toast.success('OTP sent to customer!'); setOtpInitiated(true); setOtpModalOpen(true); }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send OTP'); }
    finally { setActionLoading(false); }
  };

  const handleVerifyOtp = async (otpCode) => {
    try {
      setActionLoading(true);
      const res = await workerService.verifyDeliveryOtp(id, otpCode);
      if (res.success) { toast.success('Order Delivered Successfully!'); setOtpModalOpen(false); fetchOrder(); }
    } catch (err) { toast.error(err.response?.data?.message || 'Invalid OTP'); }
    finally { setActionLoading(false); }
  };

  const getCurrentStage = (status) => {
    const map = { ACCEPTED: 1, ASSIGNED: 1, PACKING: 2, OUT_FOR_DELIVERY: 3, DELIVERED: 4, CANCELLED: 4 };
    return map[status] || 1;
  };

  if (!order) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: themeColors.backgroundGradient }}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  );

  const currentStage = getCurrentStage(order.status);
  const isDelivered = order.status === 'DELIVERED';

  const stages = [
    {
      id: 1,
      title: 'Order Assigned',
      icon: '📦',
      description: 'You have been assigned this delivery task.',
      timestamp: order.assignedWorkerAt || order.acceptedAt || order.createdAt,
      actionLabel: null,
      action: null,
    },
    {
      id: 2,
      title: 'Packing',
      icon: '🗃️',
      description: currentStage >= 2 ? 'Order is being packed for delivery.' : 'Pack the order items carefully before heading out.',
      timestamp: null,
      actionLabel: currentStage === 1 ? 'Start Packing' : null,
      action: currentStage === 1 ? () => handleStatusUpdate('PACKING') : null,
    },
    {
      id: 3,
      title: 'Out for Delivery',
      icon: '🚚',
      description: currentStage >= 3 ? 'Order is on the way to customer.' : 'Head to the delivery address after packing.',
      timestamp: order.dispatchedAt || null,
      actionLabel: currentStage === 2 ? 'Mark Out for Delivery' : null,
      action: currentStage === 2 ? () => handleStatusUpdate('OUT_FOR_DELIVERY') : null,
    },
    {
      id: 4,
      title: 'Delivered',
      icon: '✅',
      description: isDelivered
        ? `Delivered on ${order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : ''}`
        : 'Send OTP to customer, ask them for the code, then confirm delivery.',
      timestamp: order.deliveredAt || null,
      actionLabel: currentStage === 3
        ? (!otpInitiated ? 'Send Delivery OTP to Customer' : 'Enter OTP & Confirm Delivery')
        : null,
      action: currentStage === 3
        ? (!otpInitiated ? handleInitiateOtp : () => setOtpModalOpen(true))
        : null,
    },
  ];

  return (
    <div className="min-h-screen pb-20" style={{ background: themeColors.backgroundGradient }}>
      <Header title="Delivery Timeline" onBack={() => navigate(`/worker/product-order/${id}`, { replace: true })} />

      <main className="px-3.5 sm:px-4 py-4 sm:py-8">
        {/* Order ID Banner */}
        <div className="bg-white/80 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 mb-4 sm:mb-6 flex items-center justify-between shadow-xs sm:shadow-sm border border-white/60">
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase">Delivery Order</p>
            <p className="font-black text-slate-900 text-xs sm:text-base">#{order.orderId}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase">Amount</p>
            <p className="font-black text-slate-900 text-xs sm:text-base">₹{order.financialBreakdown?.totalAmount || 0}</p>
          </div>
        </div>

        {/* Timeline */}
        <div
          className="bg-white/90 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xl sm:shadow-2xl relative overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 10px 25px rgba(0,0,0,0.06)' }}
        >
          <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl" />

          <div className="relative">
            {stages.map((stage, index) => {
              const isCompleted = stage.id < currentStage || (stage.id === 4 && isDelivered);
              const isCurrent = stage.id === currentStage && !isDelivered;
              const isFuture = stage.id > currentStage;

              return (
                <div key={stage.id} className="relative pb-6 sm:pb-10 last:pb-0">
                  {index < stages.length - 1 && (
                    <div
                      className="absolute left-[17px] sm:left-[23px] top-10 sm:top-12 w-0.5 h-full opacity-20"
                      style={{ background: isCompleted ? themeColors.button : '#E5E7EB', backgroundColor: isCompleted ? themeColors.button : '#E5E7EB' }}
                    />
                  )}

                  <div className="flex items-start gap-3.5 sm:gap-6 relative">
                    {isCurrent && <div className="absolute left-0 top-0 w-9 h-9 sm:w-12 sm:h-12 rounded-full animate-ping bg-blue-400/20" />}

                    <div
                      className="relative z-10 w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-500 ease-out text-base sm:text-xl"
                      style={{
                        background: isCompleted ? themeColors.button : isCurrent ? '#fff' : '#F9FAFB',
                        border: `2px solid ${isCompleted || isCurrent ? themeColors.button : '#F3F4F6'}`,
                        boxShadow: isCurrent ? `0 10px 20px ${themeColors.button}30` : 'none',
                        transform: isCurrent ? 'scale(1.05) translateY(-1px)' : 'scale(1)',
                      }}
                    >
                      {isCompleted ? <FiCheck className="w-4 h-4 sm:w-6 sm:h-6 text-white" /> : stage.icon}
                    </div>

                    <div className="flex-1 pt-0.5">
                      <h3 className={`font-bold text-sm sm:text-lg tracking-tight ${isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-400'}`}>
                        {stage.title}
                      </h3>
                      <p className={`text-xs sm:text-sm leading-relaxed transition-colors duration-300 ${isCurrent ? 'text-gray-600 font-medium' : 'text-gray-500'}`}>
                        {stage.description}
                      </p>

                      {stage.timestamp && (
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-wider font-bold text-gray-400 mt-1 sm:mt-2 flex items-center gap-1">
                          <FiClock className="w-3 h-3" />
                          {new Date(stage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(stage.timestamp).toLocaleDateString()}
                        </p>
                      )}

                      {stage.action && (
                        <button
                          onClick={stage.action}
                          disabled={actionLoading}
                          className="group relative px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-white text-xs sm:text-sm shadow-md sm:shadow-lg overflow-hidden transition-all duration-300 active:scale-95 hover:shadow-xl mt-2.5 sm:mt-4 inline-flex items-center gap-2"
                          style={{ background: themeColors.button }}
                        >
                          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                          {actionLoading ? (
                            <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : null}
                          <span className="relative z-10">{actionLoading ? 'Processing...' : stage.actionLabel}</span>
                        </button>
                      )}

                      {/* Resend OTP button for stage 4 when OTP already initiated */}
                      {stage.id === 4 && currentStage === 3 && otpInitiated && (
                        <button
                          onClick={handleInitiateOtp}
                          disabled={actionLoading}
                          className="mt-2 ml-2 text-xs font-bold text-slate-500 underline"
                        >
                          Resend OTP
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <DeliveryOtpModal
        isOpen={otpModalOpen}
        onClose={() => setOtpModalOpen(false)}
        onVerify={handleVerifyOtp}
        loading={actionLoading}
      />
    </div>
  );
};

export default ProductOrderTimeline;
