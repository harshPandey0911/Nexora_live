import React, { useState, useEffect, memo, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiHome, FiBriefcase, FiUsers, FiUser } from 'react-icons/fi';
import { FaWallet } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { vendorTheme as themeColors } from '../../../../theme';

const BottomNav = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingJobsCount, setPendingJobsCount] = useState(0);

  // Load pending jobs count from localStorage
  useEffect(() => {
    const updatePendingCount = () => {
      try {
        const acceptedBookings = JSON.parse(localStorage.getItem('vendorAcceptedBookings') || '[]');
        const activeJobs = acceptedBookings.filter(job => job.status === 'PENDING');
        setPendingJobsCount(activeJobs.length);
      } catch (error) {
        console.error('Error reading pending jobs:', error);
      }
    };

    updatePendingCount();
    window.addEventListener('storage', updatePendingCount);
    window.addEventListener('vendorJobsUpdated', updatePendingCount);

    return () => {
      window.removeEventListener('storage', updatePendingCount);
      window.removeEventListener('vendorJobsUpdated', updatePendingCount);
    };
  }, []);

  const navItems = useMemo(() => [
    { path: '/vendor/dashboard', icon: FiHome, label: 'Home' },
    { path: '/vendor/jobs', icon: FiBriefcase, label: 'Jobs', badge: pendingJobsCount },
    { path: '/vendor/workers', icon: FiUsers, label: 'Workers' },
    { path: '/vendor/wallet', icon: FaWallet, label: 'Wallet' },
    { path: '/vendor/profile', icon: FiUser, label: 'Profile' },
  ], [pendingJobsCount]);

  const handleNavClick = (path) => {
    if (location.pathname !== path) {
      navigate(path);
    }
  };

  const isActiveRoute = (itemPath) => {
    if (itemPath === '/vendor/dashboard') {
      return location.pathname === '/vendor/dashboard' || location.pathname === '/vendor' || location.pathname === '/vendor/';
    }
    return location.pathname.startsWith(itemPath);
  };

  // Hide nav when specific routes are active (booking alerts, maps)
  const hideNavRoutes = [
    '/vendor/booking-alert/',
    '/vendor/booking/',
  ];

  const shouldHideNav = hideNavRoutes.some(route =>
    location.pathname.includes(route) &&
    (location.pathname.includes('/map') || location.pathname.includes('/alert/'))
  );

  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const checkIfModalIsOpen = () => {
      const modalElements = document.querySelectorAll('.fixed.inset-0, [class*="z-[9999]"]');
      const hasVisibleModal = Array.from(modalElements).some(el => {
        if (el.tagName.toLowerCase() === 'nav') return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      setIsModalOpen(hasVisibleModal);
    };

    checkIfModalIsOpen();
    const observer = new MutationObserver(checkIfModalIsOpen);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    return () => observer.disconnect();
  }, []);

  if (shouldHideNav || isModalOpen) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] safe-area-bottom lg:hidden">
      <div className="mx-4 mb-4 bg-white/95 backdrop-blur-xl border border-gray-100 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden h-[72px]">
        <div className="flex items-center justify-around h-full px-2 relative">
          {navItems.map((item) => {
            const isActive = isActiveRoute(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className="relative flex flex-col items-center justify-center w-full h-full outline-none transition-colors"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-pill-vendor"
                    className="absolute inset-x-1 inset-y-2 bg-blue-50 rounded-[18px] border border-blue-100/50"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}

                <div className="relative z-10 flex flex-col items-center gap-1">
                  <motion.div
                    animate={isActive ? { scale: 1.1, y: -1 } : { scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <Icon
                      className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                  </motion.div>

                  <span className={`text-[9px] font-normal capitalize tracking-wider ${isActive ? 'text-blue-700' : 'text-gray-400'}`}>
                    {item.label}
                  </span>

                  {item.badge > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1.5 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[9px] font-normal rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </motion.span>
                  )}
                </div>

                {isActive && (
                  <motion.div
                    layoutId="active-dot-vendor"
                    className="absolute bottom-1.5 w-1 h-1 bg-blue-600 rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
});

BottomNav.displayName = 'BottomNav';
export default BottomNav;


