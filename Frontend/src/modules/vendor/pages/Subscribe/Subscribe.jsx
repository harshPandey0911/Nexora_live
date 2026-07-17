import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../../../../services/api';
import LogoLoader from '../../../../components/common/LogoLoader';
import { FiCheck, FiArrowRight, FiLock, FiAlertCircle } from 'react-icons/fi';
import ConfirmDialog from '../../../../components/common/ConfirmDialog';

const Subscribe = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingPlanId, setPayingPlanId] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPlans();
    loadRazorpay();
  }, []);

  const fetchPlans = async () => {
    try {
      // Fetch plans from public plans endpoint
      const res = await api.get('/public/plans');
      if (res.data && res.data.success) {
        // Filter only active plans
        const activePlans = (res.data.data || []).filter(p => p.isActive);
        setPlans(activePlans);
      } else if (res.data) {
        setPlans(res.data.filter(p => p.isActive));
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to load membership plans. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubscribe = async (planId) => {
    setPayingPlanId(planId);
    try {
      const scriptLoaded = await loadRazorpay();
      if (!scriptLoaded) {
        toast.error('Razorpay SDK failed to load. Please check your internet connection.');
        setPayingPlanId(null);
        return;
      }

      // 1. Create order on backend
      const orderRes = await api.post('/vendors/subscription/create-order', { planId });
      if (!orderRes.data || !orderRes.data.success) {
        throw new Error(orderRes.data?.message || 'Failed to initialize subscription order');
      }

      const { order, plan } = orderRes.data;
      const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_8sYbzHWidwe5Zw';
      const vendorInfo = JSON.parse(localStorage.getItem('vendorData') || '{}');

      // 2. Open Razorpay checkout modal
      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Nexora Go',
        description: `Vendor Subscription - ${plan.name}`,
        order_id: order.id,
        handler: async (response) => {
          try {
            toast.loading('Verifying payment details...', { id: 'payment-verify' });
            
            // 3. Verify payment on backend
            const verifyRes = await api.post('/vendors/subscription/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planId: plan.id
            });

            if (verifyRes.data && verifyRes.data.success) {
              toast.success('Subscription activated successfully!', { id: 'payment-verify' });
              
              // 4. Update vendorData in local storage so that routing guard allows access
              const updatedVendor = {
                ...vendorInfo,
                subscription: verifyRes.data.subscription
              };
              localStorage.setItem('vendorData', JSON.stringify(updatedVendor));
              
              // Redirect to Dashboard
              setTimeout(() => {
                navigate('/vendor/dashboard', { replace: true });
                window.location.reload(); // Force full reload to rebuild routes
              }, 1500);
            } else {
              toast.error(verifyRes.data?.message || 'Payment verification failed', { id: 'payment-verify' });
            }
          } catch (err) {
            console.error('Verify payment error:', err);
            toast.error(err.response?.data?.message || 'Payment verification failed', { id: 'payment-verify' });
          } finally {
            setPayingPlanId(null);
          }
        },
        prefill: {
          name: vendorInfo.name || '',
          email: vendorInfo.email || '',
          contact: vendorInfo.phone || ''
        },
        theme: {
          color: '#347989' // Primary color matching Nexora branding
        },
        modal: {
          ondismiss: () => {
            setPayingPlanId(null);
            toast.error('Payment cancelled');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error('Subscribe Error:', error);
      toast.error(error.response?.data?.message || error.message || 'Subscription failed');
      setPayingPlanId(null);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem('vendorAccessToken');
    localStorage.removeItem('vendorRefreshToken');
    localStorage.removeItem('vendorData');
    navigate('/vendor/login');
  };

  if (loading) {
    return <LogoLoader />;
  }

  return (
    <>
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl w-full mx-auto flex-grow flex flex-col justify-center">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 animate-pulse">
            <FiLock className="w-3.5 h-3.5" /> Activation Required
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
            Activate Your Nexora Account
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Choose a subscription plan to unlock your Vendor Portal. Receive real-time service requests, manage workers, and start earning today.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-center items-stretch max-w-4xl mx-auto w-full">
          {plans.map((plan) => {
            const isPaying = payingPlanId === plan._id;
            return (
              <div 
                key={plan._id} 
                className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700/50 p-8 flex flex-col justify-between hover:border-teal-500/50 transition-all duration-300 shadow-xl group hover:-translate-y-1 relative overflow-hidden"
              >
                {/* Popular Badge */}
                {plan.name.toLowerCase().includes('gold') && (
                  <div className="absolute top-0 right-0 bg-teal-500 text-slate-900 text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                    Most Popular
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-bold text-slate-100 group-hover:text-teal-400 transition-colors mb-2">
                    {plan.name}
                  </h3>
                  
                  {plan.tagline && (
                    <p className="text-xs text-slate-400 font-medium mb-6">
                      {plan.tagline}
                    </p>
                  )}

                  {/* Price */}
                  <div className="flex items-baseline gap-1.5 mb-6">
                    <span className="text-4xl font-extrabold text-white">₹{plan.price}</span>
                    <span className="text-slate-400 text-xs font-semibold">/ {plan.duration || '1'} Month</span>
                  </div>

                  <p className="text-slate-300 text-sm leading-relaxed mb-8 border-t border-slate-700/50 pt-6">
                    {plan.description || `Full access to all platform utilities, dashboard panels, and notifications for ${plan.duration || '1'} month.`}
                  </p>
                </div>

                <button
                  onClick={() => handleSubscribe(plan._id)}
                  disabled={payingPlanId !== null}
                  className="w-full py-4 px-6 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl font-bold transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-teal-500/10"
                >
                  {isPaying ? (
                    <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      Pay & Activate <FiArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            );
          })}

          {plans.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-400 bg-slate-800/20 rounded-2xl border border-dashed border-slate-700/50 max-w-lg mx-auto w-full">
              <FiAlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="font-medium text-slate-300">No active subscription plans found.</p>
              <p className="text-xs text-slate-500 mt-2">Please contact admin support to configure plans.</p>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="text-center mt-12">
          <button 
            onClick={handleLogout}
            className="text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors"
          >
            Sign out from this account
          </button>
        </div>

      </div>

      <div className="text-center text-xs text-slate-600 mt-8">
        Secure transactions powered by Razorpay. Nexora Go &copy; {new Date().getFullYear()}
      </div>
    </div>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
        title="Logout?"
        message="Are you sure you want to logout from your vendor account?"
        confirmLabel="Logout"
        cancelLabel="Stay"
        type="danger"
      />
    </>
  );
};

export default Subscribe;
