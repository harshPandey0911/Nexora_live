import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiHome, FiShoppingBag, FiDollarSign, FiUser, FiUsers } from 'react-icons/fi';
import { motion } from 'framer-motion';

const VendorBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [stats, setStats] = React.useState(() => {
    const cached = localStorage.getItem('vendorDashboardStats');
    return cached ? JSON.parse(cached) : { inProgressBookings: 0 };
  });

  const loadStats = React.useCallback(() => {
    const cached = localStorage.getItem('vendorDashboardStats');
    if (cached) {
      setStats(JSON.parse(cached));
    }
  }, []);

  React.useEffect(() => {
    loadStats();
    window.addEventListener('vendorStatsUpdated', loadStats);
    window.addEventListener('vendorJobsUpdated', loadStats);
    return () => {
      window.removeEventListener('vendorStatsUpdated', loadStats);
      window.removeEventListener('vendorJobsUpdated', loadStats);
    };
  }, [loadStats]);

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: FiHome, path: '/vendor/dashboard' },
    { id: 'orders', label: 'Bookings', icon: FiShoppingBag, path: '/vendor/jobs', badge: stats.inProgressBookings || 0 },
    { id: 'workers', label: 'Workers', icon: FiUsers, path: '/vendor/workers' },
    { id: 'earnings', label: 'Earnings', icon: FiDollarSign, path: '/vendor/earnings' },
    { id: 'profile', label: 'Profile', icon: FiUser, path: '/vendor/profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-40 lg:hidden px-4 pb-safe shadow-[0_-8px_24px_rgba(0,0,0,0.15)]">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = item.path && location.pathname === item.path;
          
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.path) {
                  navigate(item.path);
                }
              }}
              className="flex flex-col items-center justify-center relative w-16 h-full text-gray-400 focus:outline-none"
            >
              <div className="relative">
                <item.icon 
                  className={`text-xl transition-all duration-200 ${
                    isActive ? 'text-[#0D9488] scale-110' : 'text-gray-400'
                  }`} 
                />
                
                {/* Bookings Badge */}
                {Number(item.badge) > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-medium px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              
              <span className={`text-[10px] mt-1 font-normal ${
                isActive ? 'text-[#0D9488]' : 'text-gray-500'
              }`}>
                {item.label}
              </span>

              {/* Active Indicator Dot */}
              {isActive && (
                <motion.div 
                  layoutId="bottomTabIndicator"
                  className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[#0D9488]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default VendorBottomNav;
