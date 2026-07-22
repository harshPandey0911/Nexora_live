import React, { useEffect, useState, memo, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiHome, FiBriefcase, FiUser, FiDollarSign, FiBell } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../../services/api';

const BottomNav = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingJobsCount, setPendingJobsCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  // Load counts
  useEffect(() => {
    const updatePendingCount = () => {
      try {
        const assignedJobs = JSON.parse(localStorage.getItem('workerAssignedJobs') || '[]');
        const pendingJobs = assignedJobs.filter(job => job.workerStatus === 'PENDING');
        setPendingJobsCount(pendingJobs.length);
      } catch (error) {
        console.error('Error reading pending jobs:', error);
      }
    };

    const fetchUnreadCount = async () => {
      if (!localStorage.getItem('workerAccessToken')) {
        return;
      }
      try {
        const res = await api.get('/notifications/worker');
        if (res.data.success && typeof res.data.unreadCount === 'number') {
          setUnreadNotificationsCount(res.data.unreadCount);
        }
      } catch (error) {
        // Silent fail
      }
    };

    updatePendingCount();
    fetchUnreadCount();

    window.addEventListener('storage', updatePendingCount);
    window.addEventListener('workerJobsUpdated', updatePendingCount);
    const interval = setInterval(fetchUnreadCount, 60000);

    return () => {
      window.removeEventListener('storage', updatePendingCount);
      window.removeEventListener('workerJobsUpdated', updatePendingCount);
      clearInterval(interval);
    };
  }, []);

  const navItems = useMemo(() => [
    { path: '/worker/dashboard', icon: FiHome, label: 'Home' },
    { path: '/worker/jobs', icon: FiBriefcase, label: 'Jobs', badge: pendingJobsCount },
    { path: '/worker/wallet', icon: FiDollarSign, label: 'Wallet' },
    { path: '/worker/notifications', icon: FiBell, label: 'Alerts', badge: unreadNotificationsCount },
    { path: '/worker/profile', icon: FiUser, label: 'Profile' },
  ], [pendingJobsCount, unreadNotificationsCount]);

  const handleNavClick = (path) => {
    if (location.pathname !== path) {
      navigate(path);
    }
  };

  const isActiveRoute = (itemPath) => {
    if (itemPath === '/worker/dashboard') {
      return location.pathname === '/worker/dashboard' || location.pathname === '/worker';
    }
    return location.pathname.startsWith(itemPath);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] safe-area-bottom md:hidden">
      <div className="mx-4 mb-4 bg-white/80 backdrop-blur-xl border border-white/40 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden h-[72px]">
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
                    layoutId="nav-pill"
                    className="absolute inset-x-1 inset-y-2 bg-teal-50 rounded-[20px] border border-teal-100/50"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}

                <div className="relative z-10 flex flex-col items-center gap-1">
                  <motion.div
                    animate={isActive ? { scale: 1.15, y: -2 } : { scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <Icon
                      className={`w-5 h-5 ${isActive ? 'text-teal-600' : 'text-gray-400'}`}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                  </motion.div>

                  <motion.span
                    className={`text-[9px] font-black uppercase tracking-[0.05em] ${isActive ? 'text-teal-700' : 'text-gray-400'}`}
                    animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0.8, scale: 0.95 }}
                  >
                    {item.label}
                  </motion.span>

                  {item.badge > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1.5 min-w-[16px] h-[16px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </motion.span>
                  )}
                </div>

                {isActive && (
                  <motion.div
                    layoutId="active-dot"
                    className="absolute bottom-1.5 w-1 h-1 bg-teal-600 rounded-full"
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

