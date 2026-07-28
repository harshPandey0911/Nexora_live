import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiCalendar, FiClock, FiCreditCard, FiInfo, FiShield, FiStar, FiZap, FiCheckCircle, FiGift } from 'react-icons/fi';
import { getPlans } from '../../services/planService';
import { userAuthService } from '../../../../services/authService';
import { toast } from 'react-hot-toast';
import LogoLoader from '../../../../components/common/LogoLoader';

const PlanDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [plansRes, userRes] = await Promise.all([
        getPlans(),
        userAuthService.getProfile()
      ]);

      if (plansRes.success) {
        const found = plansRes.data.find(p => p._id === id);
        if (found) {
          setPlan(found);
        } else {
          toast.error('Plan not found');
          navigate('/user/my-plan');
        }
      }
      if (userRes.success) setUser(userRes.user);

    } catch (error) {
      console.error(error);
      toast.error('Could not load plan details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LogoLoader />;
  if (!plan) return null;

  const currentPlan = user?.plans;
  const isCurrent = currentPlan?.isActive && currentPlan?.name === plan.name;
  const isUpgrade = currentPlan?.isActive && plan.price > (currentPlan?.price || 0);
  const isDowngradeOrSame = currentPlan?.isActive && plan.price <= (currentPlan?.price || 0) && !isCurrent;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getTheme = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes('platinum')) return { color: 'text-slate-900', bg: 'bg-slate-900', light: 'bg-slate-50', gradient: 'from-slate-900 to-slate-950', badge: 'bg-emerald-500' };
    if (lower.includes('diamond')) return { color: 'text-indigo-600', bg: 'bg-indigo-600', light: 'bg-indigo-50', gradient: 'from-indigo-600 to-purple-800', badge: 'bg-emerald-500' };
    if (lower.includes('gold')) return { color: 'text-amber-600', bg: 'bg-amber-600', light: 'bg-amber-50', gradient: 'from-amber-400 via-amber-500 to-yellow-500', badge: 'bg-[#00246b]' };
    if (lower.includes('silver')) return { color: 'text-gray-700', bg: 'bg-gray-700', light: 'bg-gray-50', gradient: 'from-gray-500 to-slate-600', badge: 'bg-emerald-600' };
    return { color: 'text-[#00246b]', bg: 'bg-[#00246b]', light: 'bg-blue-50', gradient: 'from-blue-600 to-[#00246b]', badge: 'bg-blue-600' };
  };

  const theme = getTheme(plan.name);

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24">
      {/* Header Banner */}
      <div className={`w-full bg-gradient-to-br ${theme.gradient} text-white pt-4 pb-12 px-4 relative overflow-hidden shadow-2xs`}>
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-xs flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <FiArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-bold uppercase tracking-widest bg-white/10 px-2.5 py-0.5 rounded border border-white/20">
            {plan.tagline || 'VIP Pass'}
          </span>
        </div>

        <div className="max-w-xl mx-auto mt-4 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/80">
            <FiStar className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
            <span>Subscription Plan</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase">{plan.name}</h1>
        </div>
      </div>

      <main className="px-3.5 sm:px-4 max-w-xl mx-auto -mt-6 space-y-3 sm:space-y-4 relative z-10">
        {/* Pricing Summary Card */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Total Pricing</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl sm:text-3xl font-bold text-gray-900">₹{plan.price}</span>
                <span className="text-xs font-medium text-gray-400">/ {plan.duration || '1'} Months</span>
              </div>
            </div>

            {isCurrent && (
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active Pass
              </span>
            )}
          </div>

          {plan.description && (
            <p className="text-xs text-gray-600 font-medium border-t border-gray-100 pt-2 leading-relaxed">
              "{plan.description}"
            </p>
          )}
        </div>

        {/* Previous Tier Extra Perks Card */}
        {(() => {
          const planOrder = ['Silver', 'Gold', 'Platinum', 'Diamond'];
          const currentPlanName = plan.name || '';
          const currentBaseName = planOrder.find(p => currentPlanName.toLowerCase().includes(p.toLowerCase()));
          const currentIndex = currentBaseName ? planOrder.indexOf(currentBaseName) : -1;
          const previousPlan = currentIndex > 0 ? planOrder[currentIndex - 1] : null;

          if (!previousPlan) return null;

          return (
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-4 text-white shadow-2xs space-y-2.5 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
                  <FiGift className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider">Extra Perks From Previous Tier</h3>
                  <p className="text-[9px] font-medium text-amber-100 uppercase tracking-widest">Tier Booster Active</p>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-xs rounded-lg p-3 border border-white/20 text-xs font-medium leading-relaxed space-y-2">
                <p>
                  As a <strong className="underline uppercase">{plan.name} Member</strong>, you automatically enjoy extra benefits from the <span className="bg-white text-orange-700 px-1.5 py-0.5 rounded font-bold uppercase mx-1">{previousPlan}</span> tier.
                </p>
                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider pt-1 border-t border-white/10 text-amber-100">
                  <span>Legacy Support Included</span>
                  <div className="flex items-center gap-1">
                    <FiCheck className="w-3 h-3 text-white" />
                    <FiCheck className="w-3 h-3 text-white" />
                    <FiCheck className="w-3 h-3 text-white" />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Unlimited Service Categories Section */}
        {plan.freeCategories && plan.freeCategories.length > 0 && (
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-2xs space-y-2">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
              <FiZap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Unlimited Service Categories</span>
            </h3>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {plan.freeCategories.map((cat, idx) => (
                <span key={idx} className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-bold">
                  Free {cat.title || cat.name}
                </span>
              ))}
            </div>

            <p className="text-[9px] font-medium text-gray-400 pt-1">
              * All service deployments under these categories are 100% free with your membership pass.
            </p>
          </div>
        )}

        {/* Plan Inclusive Benefits List */}
        {plan.freeServices && plan.freeServices.length > 0 && (
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-2xs space-y-2.5">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
              <FiCheckCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>{plan.name} Inclusive Benefits</span>
            </h3>

            <div className="space-y-2">
              {(() => {
                const groups = new Map();
                (plan.freeServices || []).forEach(svc => {
                  const cid = String(svc.categoryId?._id || svc.categoryId || 'unknown');
                  const tkey = (svc.title || '').trim().toLowerCase();
                  const key = `${cid}_${tkey}`;
                  if (!groups.has(key)) groups.set(key, svc);
                });
                return Array.from(groups.values()).map((svc, idx) => (
                  <div key={`free-${idx}`} className="flex items-center justify-between p-2.5 bg-gray-50/70 border border-gray-100 rounded-lg text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                        <FiCheck className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[8px] font-bold uppercase text-gray-500 block">{svc.categoryId?.title || 'Service'}</span>
                        <span className="font-bold text-gray-900 truncate block">{svc.title}</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase shrink-0">
                      Free Benefit
                    </span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* Inherited Bonus Services */}
        {plan.bonusServices && plan.bonusServices.length > 0 && (
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-2xs space-y-2.5">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
              <FiStar className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Complimentary Membership Perks</span>
            </h3>

            <div className="space-y-2">
              {(() => {
                const groups = new Map();
                (plan.bonusServices || []).forEach(bs => {
                  const svc = bs.serviceId;
                  if (!svc) return;
                  const cid = String(bs.categoryId?._id || bs.categoryId || svc.categoryId?._id || svc.categoryId || 'unknown');
                  const tkey = (svc.title || '').trim().toLowerCase();
                  const key = `${cid}_${tkey}`;
                  if (!groups.has(key)) groups.set(key, bs);
                });
                
                return Array.from(groups.values()).map((bs, idx) => {
                  const svc = bs.serviceId;
                  const catTitle = bs.categoryId?.title || svc?.categoryId?.title || 'Service';
                  return (
                    <div key={`bonus-${idx}`} className="flex items-center justify-between p-2.5 bg-amber-50/40 border border-amber-100/80 rounded-lg text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                          <FiStar className="w-3.5 h-3.5 fill-amber-500" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[8px] font-bold uppercase text-amber-700 block">{catTitle}</span>
                          <span className="font-bold text-gray-900 truncate block">{svc.title}</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded border border-amber-200 uppercase shrink-0">
                        Free Access
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* Active Subscription Details Box (If Current) */}
        {isCurrent && (
          <div className="bg-gray-900 text-white rounded-xl p-4 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-800 pb-2">
              <FiShield className="text-emerald-400 w-4 h-4" />
              <span>Active Membership Status</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Expires On</span>
                <span className="font-bold text-white mt-0.5 block">{formatDate(currentPlan.expiry)}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Amount Paid</span>
                <span className="font-bold text-emerald-400 mt-0.5 block">₹{currentPlan.price}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          {!isCurrent && !isDowngradeOrSame ? (
            <button
              onClick={() => {
                navigate('/user/checkout', {
                  state: {
                    plan: {
                      id: plan._id,
                      name: plan.name,
                      price: plan.price,
                      description: plan.description || `${plan.duration || 'Monthly'} Plan`
                    },
                    isUpgrade
                  }
                });
              }}
              className="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-[#00246b] hover:bg-[#001c54] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-2xs cursor-pointer"
            >
              <FiZap className="w-4 h-4 fill-current" />
              <span>{isUpgrade ? 'Upgrade Membership' : 'Subscribe Now'}</span>
            </button>
          ) : isCurrent ? (
            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-100 flex items-center justify-center gap-2 font-bold text-xs">
              <FiCheckCircle className="w-4 h-4" />
              <span>Active Membership Pass</span>
            </div>
          ) : (
            <div className="bg-gray-100 text-gray-500 p-3 rounded-xl border border-gray-200 flex items-center justify-center gap-2 font-bold text-xs">
              <FiInfo className="w-4 h-4" />
              <span>Select a higher tier to upgrade</span>
            </div>
          )}
        </div>

        {/* Security & Guarantee Info */}
        <div className="pt-1 text-center space-y-1">
          <p className="text-[10px] text-gray-500 font-medium">
            100% Secure Checkout • Benefits applied instantly after payment completion
          </p>
        </div>
      </main>
    </div>
  );
};

export default PlanDetails;
