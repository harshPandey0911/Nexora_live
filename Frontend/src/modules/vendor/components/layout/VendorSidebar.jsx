import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FiHome, FiShoppingBag, FiPackage, FiLayers, FiGrid,
  FiTrendingUp, FiCreditCard, FiUsers, FiStar, 
  FiSettings, FiUser, FiHelpCircle, FiLogOut, FiBell, FiX
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

  const rawSections = [
    {
      title: 'OPERATIONS',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: FiHome, path: '/vendor/dashboard' },
        { id: 'orders', label: 'Service Bookings', icon: FiShoppingBag, path: '/vendor/jobs', badge: stats.inProgressBookings || 0 },
        { id: 'product-orders', label: 'Product Orders', icon: FiPackage, path: '/vendor/product-orders' },
      ]
    },
    {
      title: 'PORTFOLIO & FLEET',
      items: [
        { id: 'services', label: 'Manage Services', icon: FiLayers, path: '/vendor/my-services' },
        { id: 'manage-products', label: 'Manage Products', icon: FiGrid, path: '/vendor/my-products' },
        { id: 'workers', label: 'Manage Workers', icon: FiUsers, path: '/vendor/workers' },
      ]
    },
    {
      title: 'FINANCE',
      items: [
        { id: 'earnings', label: 'Earnings', icon: FiTrendingUp, path: '/vendor/earnings' },
        { id: 'wallet', label: 'Wallet & Payouts', icon: FiCreditCard, path: '/vendor/wallet' },
      ]
    },
    {
      title: 'ACCOUNT & HELP',
      items: [
        { id: 'reviews', label: 'My Ratings', icon: FiStar, path: '/vendor/my-ratings' },
        { id: 'notifications', label: 'Notifications', icon: FiBell, path: '/vendor/notifications' },
        { id: 'store-settings', label: 'Store Settings', icon: FiSettings, path: '/vendor/settings' },
        { id: 'profile-settings', label: 'Profile Settings', icon: FiUser, path: '/vendor/profile' },
        { id: 'support', label: 'Support', icon: FiHelpCircle, path: '/vendor/support' },
      ]
    },
    {
      title: 'SYSTEM',
      items: [
        { id: 'logout', label: 'Logout', icon: FiLogOut, path: '/logout', isDanger: true },
      ]
    }
  ];

  // Filter sections and items based on permissions
  const sections = rawSections.map(section => {
    const filteredItems = section.items.filter(item => {
      if (item.id === 'logout') return true;
      if (!permissions || permissions.length === 0) return true;
      return permissions.includes(item.id);
    });
    return { ...section, items: filteredItems };
  }).filter(section => section.items.length > 0);

  return (
    <>
    <aside className={`w-[278px] h-screen bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 fixed top-0 transition-all duration-300 overflow-hidden z-[150] shadow-2xl ${isOpen ? 'left-0' : '-left-[278px] lg:left-0'}`}>
      {/* Header Section */}
      <div className="px-4 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Logo className="w-9 h-9 object-cover rounded-xl shadow-md border border-slate-800 flex-shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-bold text-white text-xs sm:text-sm tracking-tight truncate">
                Verified Partner
              </h2>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate flex items-center gap-1 mt-0.5">
              <FiStar className="w-2.5 h-2.5 text-amber-400 fill-amber-400" /> ID: #V-7742
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen?.(false)}
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors lg:hidden active:scale-95 border border-slate-800 cursor-pointer"
          title="Close Navigation"
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>
 
      {/* Scrollable Navigation Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 scrollbar-admin lg:pb-3 space-y-4 overscroll-contain">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-1">
              {section.title}
            </h3>

            {section.items.map((item) => {
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
                    flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer relative group text-xs font-bold
                    ${isActive
                      ? "bg-[#0D9488] text-white shadow-md shadow-teal-950"
                      : item.isDanger 
                        ? "text-rose-400 hover:bg-rose-500/10 hover:text-rose-500"
                        : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                    }
                  `}
                >
                  <item.icon className={`text-base flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-white' : item.isDanger ? 'text-rose-400' : 'text-slate-400 group-hover:text-white'}`} />
                  <span className={`flex-1 truncate ${isActive ? 'text-white font-bold' : ''}`}>
                    {item.label}
                  </span>
                  {Number(item.badge) > 0 && (
                    <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-2xs animate-pulse">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        ))}
      </nav>
 
      {/* Footer Branding */}
      <div className="px-4 py-3 border-t border-slate-800 bg-slate-950">
        <div className="flex flex-col gap-0.5 opacity-60 text-[9px]">
          <p className="font-bold text-slate-400 uppercase tracking-widest">Nexora Operations Hub</p>
          <p className="font-semibold text-blue-400">Protocol v2.4.0 Premium</p>
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
