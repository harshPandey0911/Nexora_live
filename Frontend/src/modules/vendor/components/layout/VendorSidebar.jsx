import React from 'react';
import { motion } from 'framer-motion';
import { 
  FiHome, FiShoppingBag, FiBox, FiPackage, 
  FiDollarSign, FiCreditCard, FiUsers, FiStar, 
  FiPercent, FiBarChart2, FiFileText, FiSettings, 
  FiUser, FiHelpCircle, FiLogOut, FiBell
} from 'react-icons/fi';
import { useNavigate, useLocation } from 'react-router-dom';

const VendorSidebar = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [stats, setStats] = React.useState(() => {
    const cached = localStorage.getItem('vendorDashboardStats');
    return cached ? JSON.parse(cached) : { inProgressBookings: 0 };
  });

  const [permissions, setPermissions] = React.useState(() => {
    try {
      const data = localStorage.getItem('vendorData');
      const vendor = data ? JSON.parse(data) : null;
      return vendor?.permissions || [];
    } catch (e) {
      return [];
    }
  });

  const loadStats = React.useCallback(() => {
    const cached = localStorage.getItem('vendorDashboardStats');
    if (cached) {
      setStats(JSON.parse(cached));
    }
    
    // Also refresh permissions if vendorData changed
    const data = localStorage.getItem('vendorData');
    if (data) {
      const vendor = JSON.parse(data);
      if (vendor.permissions) setPermissions(vendor.permissions);
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

  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: FiHome, path: '/vendor/dashboard' },
    { id: 'orders', label: 'Service Bookings', icon: FiShoppingBag, path: '/vendor/jobs', badge: stats.inProgressBookings || 0 },
    { id: 'product-orders', label: 'Product Orders', icon: FiPackage, path: '/vendor/product-orders' },
    { id: 'services', label: 'Manage Services', icon: FiBox, path: '/vendor/my-services' },
    { id: 'manage-products', label: 'Manage Products', icon: FiPackage, path: '/vendor/my-products' },
    { id: 'workers', label: 'Manage Workers', icon: FiUsers, path: '/vendor/workers' },
    { id: 'earnings', label: 'Earnings', icon: FiDollarSign, path: '/vendor/earnings' },
    { id: 'wallet', label: 'Wallet & Payouts', icon: FiCreditCard, path: '/vendor/wallet' },
    { id: 'reviews', label: 'My Ratings', icon: FiStar, path: '/vendor/my-ratings' },
    { id: 'notifications', label: 'Notifications', icon: FiBell, path: '/vendor/notifications' },
    { id: 'store-settings', label: 'Store Settings', icon: FiSettings, path: '/vendor/settings' },
    { id: 'profile-settings', label: 'Profile Settings', icon: FiUser, path: '/vendor/profile' },
    { id: 'support', label: 'Support', icon: FiHelpCircle, path: '/vendor/support' },
    { id: 'logout', label: 'Logout', icon: FiLogOut, path: '/logout', isDanger: true },
  ];

  // Filter items based on permissions
  // If permissions array is empty (e.g. old user), show all by default
  const navItems = allNavItems.filter(item => {
    if (item.id === 'logout') return true;
    if (!permissions || permissions.length === 0) return true;
    return permissions.includes(item.id);
  });

  return (
    <aside className={`w-[278px] h-screen bg-slate-800 border-r border-slate-700/50 flex flex-col shrink-0 fixed top-0 transition-all duration-300 overflow-hidden z-50 shadow-2xl ${isOpen ? 'left-0' : '-left-[278px] lg:left-0'}`}>
      {/* Header Section */}
      <div className="px-4 py-6 border-b border-slate-700 bg-slate-900">
        <div className="flex items-center justify-between gap-3 px-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #2874F0 0%, #4787F7 100%)',
              }}
            >
              <FiUser className="text-white text-xl" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-normal text-white text-sm tracking-tight truncate">
                Verified Partner
              </h2>
              <p className="text-[10px] font-normal text-gray-400 capitalize tracking-widest truncate flex items-center gap-1">
                <FiStar className="w-2.5 h-2.5 text-blue-400" /> ID: #V-7742
              </p>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 scrollbar-admin lg:pb-3 space-y-1 overscroll-contain">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <motion.div
              key={item.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setIsOpen?.(false);
                if (item.id === 'logout') {
                  navigate('/vendor/login');
                } else {
                  navigate(item.path);
                }
              }}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer relative group
                ${isActive
                  ? "bg-[#0D9488] text-white shadow-lg shadow-teal-900/40"
                  : item.isDanger 
                    ? "text-rose-400 hover:bg-rose-500/10 hover:text-rose-500 mt-8"
                    : "text-gray-400 hover:bg-slate-700/50 hover:text-white"
                }
              `}
            >
              <item.icon className={`text-lg flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-white' : 'text-gray-500'}`} />
              <span className={`font-normal flex-1 text-[13px] whitespace-nowrap ${isActive ? 'text-white' : ''}`}>
                {item.label}
              </span>
              {Number(item.badge) > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-medium px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </motion.div>
          );
        })}
      </nav>

      {/* Footer Branding */}
      <div className="p-6 border-t border-slate-700 bg-slate-900">
        <div className="flex flex-col gap-1 opacity-60">
          <p className="text-[10px] font-normal text-gray-500 capitalize tracking-wider">Protocol v2.4.0</p>
          <p className="text-[9px] font-normal text-blue-400 capitalize tracking-wide">Powered by Nexora</p>
        </div>
      </div>
    </aside>
  );
};

export default VendorSidebar;
