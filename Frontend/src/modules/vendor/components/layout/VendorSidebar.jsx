import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FiHome, FiShoppingBag, FiBox, FiPackage, 
  FiDollarSign, FiCreditCard, FiUsers, FiStar, 
  FiPercent, FiBarChart2, FiFileText, FiSettings, 
  FiUser, FiHelpCircle, FiLogOut, FiBell, FiX
} from 'react-icons/fi';
import { useNavigate, useLocation } from 'react-router-dom';
import { logout } from '../../services/authService';
import ConfirmDialog from '../../../../components/common/ConfirmDialog';
import Logo from '../../../../components/common/Logo';

const VendorSidebar = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
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
    <>
    <aside className={`w-[278px] h-screen bg-slate-800 border-r border-slate-700/50 flex flex-col shrink-0 fixed top-0 transition-all duration-300 overflow-hidden z-[150] shadow-2xl ${isOpen ? 'left-0' : '-left-[278px] lg:left-0'}`}>
      {/* Header Section */}
      <div className="px-4 py-5 border-b border-slate-700 bg-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Logo className="w-10 h-10 object-cover rounded-xl shadow-lg border border-slate-700 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-white text-sm tracking-tight truncate">
              Verified Partner
            </h2>
            <p className="text-[10px] font-bold text-gray-400 capitalize tracking-widest truncate flex items-center gap-1">
              <FiStar className="w-2.5 h-2.5 text-blue-400" /> ID: #V-7742
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen?.(false)}
          className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-slate-800 transition-colors lg:hidden active:scale-95 border border-slate-700/60"
          title="Close Navigation"
        >
          <FiX className="w-5 h-5" />
        </button>
      </div>
 
      <nav className="flex-1 overflow-y-auto p-3 scrollbar-admin lg:pb-3 space-y-1 overscroll-contain">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <motion.div
              key={item.id}
              whileTap={{ scale: 0.98 }}
              onClick={async () => {
                setIsOpen?.(false);
                if (item.id === 'logout') {
                  setShowLogoutConfirm(true);
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
              <span className={`font-semibold flex-1 text-sm whitespace-nowrap ${isActive ? 'text-white' : ''}`}>
                {item.label}
              </span>
              {Number(item.badge) > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">
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
          <p className="text-[10px] font-bold text-gray-500 capitalize tracking-wider">Protocol v2.4.0</p>
          <p className="text-[9px] font-black text-blue-400 capitalize tracking-wide">Powered by Nexora</p>
        </div>
      </div>
    </aside>

    <ConfirmDialog
      isOpen={showLogoutConfirm}
      onClose={() => setShowLogoutConfirm(false)}
      onConfirm={async () => {
        try {
          await logout();
        } catch (e) {
          console.error('Logout failed:', e);
        }
        navigate('/vendor/login');
      }}
      title="Logout?"
      message="Are you sure you want to logout from your vendor account?"
      confirmLabel="Logout"
      cancelLabel="Stay"
      type="danger"
    />
    </>
  );
};

export default VendorSidebar;
