import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiHome, FiShoppingCart, FiUser, FiCalendar } from 'react-icons/fi';
import { HiHome, HiShoppingCart, HiUser, HiCalendar } from 'react-icons/hi';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../../../../context/CartContext';

const BottomNav = React.memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cartCount } = useCart();

  const navItems = useMemo(() => [
    { id: 'home', label: 'Home', icon: FiHome, filledIcon: HiHome, path: '/user' },
    { id: 'bookings', label: 'Bookings', icon: FiCalendar, filledIcon: HiCalendar, path: '/user/my-bookings' },
    { id: 'cart', label: 'Cart', icon: FiShoppingCart, filledIcon: HiShoppingCart, path: '/user/cart', isCart: true },
    { id: 'account', label: 'Account', icon: FiUser, filledIcon: HiUser, path: '/user/account' },
  ], []);

  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/user' || path === '/user/' || path.startsWith('/user/category/')) return 'home';
    if (path.startsWith('/user/my-bookings')) return 'bookings';
    if (path.startsWith('/user/cart')) return 'cart';
    if (path.startsWith('/user/account') || path.startsWith('/user/profile')) return 'account';
    return 'home';
  };

  const activeTab = getActiveTab();

  const handleTabClick = (path) => {
    navigate(path);
  };

  return (
    <nav className="fixed bottom-4 left-0 right-0 z-50 flex justify-center lg:hidden px-4 pointer-events-none">
      <div
        className="flex items-center justify-between bg-white/95 backdrop-blur-xl px-2 py-1.5 rounded-full shadow-lg border border-gray-100/80 w-full max-w-sm pointer-events-auto"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = isActive ? item.filledIcon : item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.path)}
              className="relative flex items-center justify-center transition-all duration-300 cursor-pointer"
            >
              <motion.div
                layout
                initial={false}
                animate={{
                  width: isActive ? 'auto' : '44px',
                  backgroundColor: isActive ? '#00246b' : 'transparent',
                }}
                className="flex items-center gap-1.5 px-3.5 h-10 rounded-full overflow-hidden"
              >
                <div className="relative">
                  <Icon
                    className={`w-4 h-4 transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-400'}`}
                  />
                  {item.isCart && cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white shadow-2xs">
                      {cartCount > 9 ? '9+' : cartCount}
                    </span>
                  )}
                </div>
                
                {isActive && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </motion.div>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

BottomNav.displayName = 'BottomNav';

export default BottomNav;
