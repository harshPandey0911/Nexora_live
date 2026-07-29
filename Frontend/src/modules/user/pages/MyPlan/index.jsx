import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiStar, FiCheckCircle, FiShield, FiZap, FiGift, FiBox } from 'react-icons/fi';
import { getPlans } from '../../services/planService';
import { userAuthService } from '../../../../services/authService';
import { toast } from 'react-hot-toast';

const MyPlan = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const getCardStyle = (name) => {
    const lower = name.toLowerCase();

    if (lower.includes('platinum')) {
      return {
        container: 'bg-slate-950 border-slate-800 text-white',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        includes: 'text-slate-400',
        check: 'text-emerald-400',
        price: 'text-white',
        button: 'bg-white text-slate-950 hover:bg-slate-100'
      };
    }
    if (lower.includes('diamond')) {
      return {
        container: 'bg-indigo-900 border-indigo-700 text-white',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        includes: 'text-indigo-200',
        check: 'text-indigo-300',
        price: 'text-white',
        button: 'bg-white text-indigo-900 hover:bg-indigo-50'
      };
    }
    if (lower.includes('gold')) {
      return {
        container: 'bg-amber-500/10 border-amber-300/60 text-amber-950',
        badge: 'bg-emerald-500 text-white',
        includes: 'text-amber-900',
        check: 'text-amber-700',
        price: 'text-amber-950',
        button: 'bg-amber-800 text-white hover:bg-amber-900'
      };
    }
    if (lower.includes('silver')) {
      return {
        container: 'bg-slate-50 border-slate-200 text-slate-900',
        badge: 'bg-emerald-600 text-white',
        includes: 'text-slate-600',
        check: 'text-slate-600',
        price: 'text-slate-900',
        button: 'bg-slate-900 text-white hover:bg-slate-800'
      };
    }

    return {
      container: 'bg-white border-gray-200 text-gray-900',
      badge: 'bg-emerald-600 text-white',
      includes: 'text-gray-500',
      check: 'text-blue-600',
      price: 'text-gray-900',
      button: 'bg-[#00246b] text-white hover:bg-[#001c54]'
    };
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [plansRes, userRes] = await Promise.all([
        getPlans(),
        userAuthService.getProfile()
      ]);

      if (plansRes.success) setPlans(plansRes.data);
      if (userRes.success) setUser(userRes.user);

    } catch (error) {
      console.error(error);
      toast.error('Could not load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-gray-50/50 space-y-3 sm:space-y-4">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-3.5 sm:px-4 py-3 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
          >
            <FiArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight leading-tight">Membership Passes</h1>
            <p className="text-[10px] text-gray-500 font-medium hidden sm:block">Unlock free service deployments and exclusive cashback discounts</p>
          </div>
        </div>
        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
          <FiZap className="w-4 h-4" />
        </div>
      </header>

      <main className="px-3.5 sm:px-4 max-w-4xl mx-auto space-y-3 sm:space-y-4">
        {/* Banner Hero Box */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-gray-100 shadow-2xs space-y-1">
          <h2 className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wider">Select Your VIP Membership</h2>
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 leading-relaxed">
            Upgrade your home care plan to enjoy free annual maintenance deployments. Higher tiers inherit all benefits from lower tiers automatically.
          </p>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-2xs">
            <div className="w-6 h-6 border-2 border-[#00246b] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Loading Membership Tiers...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {plans.map((plan) => {
              const style = getCardStyle(plan.name || '');
              const currentPlan = user?.plans;
              const isCurrent = currentPlan?.isActive && currentPlan?.name === plan.name;

              const userPlanPrice = currentPlan?.price || 0;
              const isUpgrade = currentPlan?.isActive && plan.price > userPlanPrice;
              const isDowngradeOrSame = currentPlan?.isActive && plan.price <= userPlanPrice && !isCurrent;
              const isDisabled = isCurrent || isDowngradeOrSame;

              let buttonText = `Select ${plan.name}`;
              if (isCurrent) buttonText = 'Active Pass';
              else if (isUpgrade) buttonText = 'Upgrade Pass';

              return (
                <div
                  key={plan._id}
                  onClick={() => navigate(`/user/my-plan/${plan._id}`)}
                  className={`rounded-xl border p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between relative overflow-hidden cursor-pointer group ${style.container}`}
                >
                  <div className="space-y-3">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2 border-b border-current/10 pb-2.5">
                      <div>
                        <h3 className="text-base sm:text-lg font-bold tracking-tight uppercase">{plan.name}</h3>
                        {plan.tagline && (
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-current/10 border border-current/20">
                            {plan.tagline}
                          </span>
                        )}
                      </div>
                      {isCurrent && (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-emerald-500/30 bg-emerald-500/20 text-emerald-300">
                          Active
                        </span>
                      )}
                    </div>

                    {/* Price Tag */}
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl font-bold">₹{plan.price}</span>
                      <span className="text-[10px] font-medium opacity-70">/ {plan.duration || '1'} Months</span>
                    </div>

                    {/* Benefits List */}
                    <div className="space-y-2 pt-1 text-xs">
                      {(plan.freeCategories || []).map((cat, idx) => (
                        <div key={`cat-${idx}`} className="flex items-center gap-2">
                          <FiZap className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                          <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] border border-emerald-100">
                            Free {cat.title || cat.name}
                          </span>
                        </div>
                      ))}

                      {((() => {
                        const groups = new Map();
                        (plan.freeServices || []).forEach(svc => {
                          const cid = String(svc.categoryId?._id || svc.categoryId || 'unknown');
                          const tkey = (svc.title || '').trim().toLowerCase();
                          const key = `${cid}_${tkey}`;
                          if (!groups.has(key)) groups.set(key, svc);
                        });
                        
                        return Array.from(groups.values()).map((svc, idx) => {
                          const catTitle = svc.categoryId?.title || 'Service';
                          return (
                            <div key={`svc-${idx}`} className="flex items-center gap-2">
                              <FiZap className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[9px] font-bold uppercase text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                                  {catTitle}
                                </span>
                                <span className="text-xs font-bold">Free {svc.title || svc.name}</span>
                              </div>
                            </div>
                          );
                        });
                      })())}

                      {/* Tier Inheritance Notice */}
                      {(() => {
                        const planOrder = ['Silver', 'Gold', 'Platinum', 'Diamond'];
                        const currentName = plan.name || '';
                        const baseName = planOrder.find(p => currentName.toLowerCase().includes(p.toLowerCase()));
                        const currentIndex = baseName ? planOrder.indexOf(baseName) : -1;
                        const prevName = currentIndex > 0 ? planOrder[currentIndex - 1] : null;

                        if (!prevName) return null;

                        return (
                          <div className="p-2 rounded-lg bg-current/5 border border-dashed border-current/20 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 mt-2">
                            <FiGift className="w-3.5 h-3.5 shrink-0" />
                            <span>Includes all {prevName} tier benefits</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Footer Action Button */}
                  <div className="pt-4 mt-3 border-t border-current/10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/user/my-plan/${plan._id}`);
                      }}
                      className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider shadow-2xs transition-all active:scale-95 cursor-pointer ${style.button} ${isDisabled && !isCurrent ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                    >
                      {buttonText}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {plans.length === 0 && !loading && (
          <div className="bg-white rounded-xl p-8 text-center border border-gray-100 shadow-2xs space-y-2">
            <FiBox className="w-8 h-8 text-gray-300 mx-auto" />
            <h3 className="text-xs font-bold text-gray-900 uppercase">No Membership Plans Found</h3>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Check back later for new VIP passes</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default MyPlan;
