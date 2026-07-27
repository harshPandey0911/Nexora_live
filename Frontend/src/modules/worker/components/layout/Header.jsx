import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiBell, FiSearch, FiHome, FiBriefcase, FiDollarSign, FiUser, FiSettings } from 'react-icons/fi';
import { gsap } from 'gsap';
import { animateLogo } from '../../../../utils/gsapAnimations';
import Logo from '../../../../components/common/Logo';
import api from '../../../../services/api';

const Header = ({
  title,
  onBack,
  showBack = true,
  showSearch = false,
  showNotifications = true,
  notificationCount = 0
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const logoRef = useRef(null);
  const bellRef = useRef(null);
  const [count, setCount] = useState(notificationCount);

  const [, setDummyState] = useState(false);

  // Listen for global worker status changes to force re-render
  useEffect(() => {
    const handleStatusUpdate = () => {
      setDummyState(prev => !prev);
    };
    window.addEventListener('workerStatusUpdated', handleStatusUpdate);
    return () => window.removeEventListener('workerStatusUpdated', handleStatusUpdate);
  }, []);

  // Sync prop changes
  useEffect(() => {
    if (typeof notificationCount !== 'undefined') {
      setCount(notificationCount);
    }
  }, [notificationCount]);

  // Fetch unread count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!localStorage.getItem('workerAccessToken')) {
        return;
      }
      try {
        const res = await api.get('/notifications/worker');
        if (res.data.success && typeof res.data.unreadCount === 'number') {
          setCount(res.data.unreadCount);
        }
      } catch (error) {
        // Silent fail
      }
    };

    if (showNotifications) {
      fetchUnreadCount();
      window.addEventListener('workerNotificationsUpdated', fetchUnreadCount);
      const interval = setInterval(fetchUnreadCount, 60000); // Poll every minute
      return () => {
        window.removeEventListener('workerNotificationsUpdated', fetchUnreadCount);
        clearInterval(interval);
      };
    }
  }, [showNotifications]);

  useEffect(() => {
    if (logoRef.current && !showBack) {
      animateLogo(logoRef.current);
      gsap.fromTo(logoRef.current,
        {
          opacity: 0,
          scale: 0.8,
          y: -10
        },
        {
          opacity: 1,
          scale: 1.0,
          y: 0,
          duration: 0.6,
          ease: 'back.out(1.7)'
        }
      );
    }
  }, [showBack]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const handleNotifications = () => {
    navigate('/worker/notifications');
  };

  const handleLogoClick = () => {
    navigate('/worker/dashboard');
  };

  const isOnline = !!window.isWorkerOnlineGlobally;

  const isActiveRoute = (path) => {
    if (path === '/worker/dashboard') return location.pathname === '/worker/dashboard' || location.pathname === '/worker';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
        <div className="px-4 py-2.5 flex items-center justify-between max-w-7xl mx-auto">
          
          {/* ── LEFT: Logo & App Title ── */}
          <div className="flex items-center gap-3">
            {showBack ? (
              <button
                onClick={handleBack}
                className="p-2 rounded-xl hover:bg-slate-100 transition-colors active:scale-95 text-slate-700"
              >
                <FiArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div
                className="flex items-center gap-2.5 cursor-pointer group"
                onClick={handleLogoClick}
              >
                <Logo
                  ref={logoRef}
                  className="h-9 w-auto transform group-hover:scale-105 transition-transform"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-black text-slate-900 tracking-tight leading-none">
                    Nexora<span className="text-teal-600">Go</span>
                  </span>
                  <span className="text-[9px] font-extrabold text-teal-700 tracking-widest uppercase">
                    Partner Hub
                  </span>
                </div>
              </div>
            )}
            {showBack && (
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight">{title || 'Worker'}</h1>
            )}
          </div>

          {/* ── DESKTOP NAVIGATION LINKS (hidden on mobile, visible on desktop) ── */}
          {!showBack && (
            <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/60">
              {[
                { label: 'Home', path: '/worker/dashboard', icon: FiHome },
                { label: 'Jobs', path: '/worker/jobs', icon: FiBriefcase },
                { label: 'Wallet', path: '/worker/wallet', icon: FiDollarSign },
                { label: 'Alerts', path: '/worker/notifications', icon: FiBell, badge: count },
                { label: 'Profile', path: '/worker/profile', icon: FiUser },
              ].map(item => {
                const active = isActiveRoute(item.path);
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      active
                        ? 'bg-white text-teal-800 shadow-sm border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                    {Boolean(item.badge > 0) && (
                      <span className="bg-rose-500 text-white text-[9px] font-black rounded-full px-1.5 py-0.2 min-w-[16px] h-[16px] flex items-center justify-center shadow-sm ml-0.5">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          {/* ── RIGHT: Duty Status & Notifications ── */}
          <div className="flex items-center gap-3">
            {/* Search Button */}
            {showSearch && (
              <button
                onClick={() => navigate('/worker/jobs')}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-95"
                title="Search Jobs"
              >
                <FiSearch className="w-5 h-5" />
              </button>
            )}

            {/* Header Duty Status Switcher */}
            {!showBack && (
              <div
                onClick={async (e) => {
                  e.stopPropagation();
                  if (window.handleWorkerToggleGlobally) {
                    await window.handleWorkerToggleGlobally();
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-all border shadow-sm ${
                  isOnline 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' 
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
                title="Toggle Duty Status"
              >
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                <span className="text-[10px] font-extrabold tracking-wider uppercase">
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
                <div className={`relative w-7 h-4 rounded-full transition-all duration-300 ${
                  isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                }`}>
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow ${
                    isOnline ? 'left-3.5' : 'left-0.5'
                  }`} />
                </div>
              </div>
            )}

            {/* Notification Button */}
            {showNotifications && (
              <button
                onClick={handleNotifications}
                className="relative p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-95 group border border-slate-200/60"
                title="Notifications"
              >
                <FiBell
                  ref={bellRef}
                  className={`w-5 h-5 transition-transform duration-300 group-hover:rotate-12 ${count > 0 ? 'text-rose-500' : 'text-slate-700'}`}
                />

                {count > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-extrabold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center border-2 border-white shadow">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Spacer pushing page content below fixed navbar */}
      <div className="h-[60px] w-full shrink-0"></div>
    </>
  );
};

export default Header;
