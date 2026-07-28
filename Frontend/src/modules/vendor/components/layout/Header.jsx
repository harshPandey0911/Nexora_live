import React, { memo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiBell, FiSearch, FiMenu } from 'react-icons/fi';
import { motion } from 'framer-motion';
import api from '../../../../services/api';
import { toast } from 'react-hot-toast';

const Header = memo(({
  title,
  onBack,
  showBack = true,
  showSearch = false,
  showNotifications = false,
  notificationCount = 0,
  showOnlineToggle = false,
  onMenuClick
}) => {
  const navigate = useNavigate();
  const [count, setCount] = useState(notificationCount);
  const [isOnline, setIsOnline] = useState(() => {
    try {
      const data = localStorage.getItem('vendorData');
      return data ? JSON.parse(data).isOnline : false;
    } catch {
      return false;
    }
  });
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    const handleStatusSync = (e) => {
      if (e.detail && typeof e.detail.isOnline === 'boolean') {
        setIsOnline(e.detail.isOnline);
      }
    };
    window.addEventListener('vendorStatusChanged', handleStatusSync);
    return () => window.removeEventListener('vendorStatusChanged', handleStatusSync);
  }, []);

  const handleToggleOnline = async () => {
    try {
      setIsToggling(true);
      const newStatus = !isOnline;
      const { vendorDashboardService } = await import('../../services/dashboardService');
      const response = await vendorDashboardService.updateStatus(newStatus);
      if (response.success) {
        setIsOnline(newStatus);
        
        // Update localStorage
        const data = localStorage.getItem('vendorData');
        if (data) {
          const parsed = JSON.parse(data);
          parsed.isOnline = newStatus;
          localStorage.setItem('vendorData', JSON.stringify(parsed));
        }

        toast.success(`You are now ${newStatus ? 'Online' : 'Offline'}`);
        window.dispatchEvent(new CustomEvent('vendorStatusChanged', { detail: { isOnline: newStatus } }));
      }
    } catch (error) {
      console.error('Failed to toggle status:', error);
      toast.error('Failed to update status');
    } finally {
      setIsToggling(false);
    }
  };

  // Sync prop changes
  useEffect(() => {
    if (typeof notificationCount !== 'undefined') {
      setCount(notificationCount);
    }
  }, [notificationCount]);

  // Fetch unread count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res = await api.get('/notifications/vendor');
        if (res.data.success && typeof res.data.unreadCount === 'number') {
          setCount(res.data.unreadCount);
        }
      } catch (error) {
        // Silent fail
      }
    };

    if (showNotifications) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 60000); // Poll every minute
      return () => clearInterval(interval);
    }
  }, [showNotifications]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const handleNotifications = () => {
    navigate('/vendor/notifications');
  };

  return (
    <header
      className="bg-white/95 backdrop-blur-md fixed top-0 left-0 right-0 z-[100] transition-all duration-300 lg:left-[278px] border-b border-gray-100 shadow-2xs h-14 sm:h-16 flex items-center"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <div className="w-full flex items-center justify-between px-3.5 sm:px-6">
        {/* Left: Back / Menu Toggle & Title */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          {!showBack && (
            <button
              onClick={onMenuClick}
              className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-700 transition-all border border-gray-100 active:scale-95 lg:hidden shrink-0 cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              <FiMenu className="w-4 h-4" />
            </button>
          )}

          {showBack && (
            <button
              onClick={handleBack}
              className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-700 transition-all border border-gray-100 active:scale-95 shrink-0 cursor-pointer"
              aria-label="Go back"
            >
              <FiArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-gray-900 leading-tight tracking-tight truncate">
              {title || 'Vendor Hub'}
            </h1>
            <p className="text-[9px] sm:text-[10px] text-gray-400 font-semibold tracking-wider uppercase hidden sm:block">
              Nexora Operations Management
            </p>
          </div>
        </div>

        {/* Right Actions: Online Toggle, Search, Notifications */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Online Toggle Switch */}
          {showOnlineToggle && (
            <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider hidden sm:inline">
                {isOnline ? 'Online' : 'Offline'}
              </span>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleToggleOnline}
                disabled={isToggling}
                className={`w-9 h-5 rounded-full relative transition-all duration-300 focus:outline-none cursor-pointer ${isOnline ? 'bg-emerald-500' : 'bg-gray-300'}`}
                aria-label="Toggle online status"
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-2xs transition-all duration-300 ${isOnline ? 'left-4.5' : 'left-0.5'}`} />
              </motion.button>
            </div>
          )}

          {/* Search Button */}
          {showSearch && (
            <button
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-all border border-gray-100 active:scale-95 cursor-pointer"
              onClick={() => navigate('/vendor/jobs')}
              aria-label="Search jobs"
            >
              <FiSearch className="w-4 h-4" />
            </button>
          )}
          
          {/* Notifications Button */}
          {showNotifications && (
            <div className="relative">
              <button
                onClick={handleNotifications}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-all border border-gray-100 active:scale-95 cursor-pointer"
                aria-label="View notifications"
              >
                <FiBell className="w-4 h-4" />
              </button>
              
              {count > 0 && (
                <span
                  className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px] px-1 border-2 border-white shadow-2xs animate-pulse"
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
});

Header.displayName = 'VendorHeader';
export default Header;
