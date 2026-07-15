import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiHome, FiGift, FiShoppingCart, FiUser, FiTrash2, FiCalendar, FiShoppingBag } from 'react-icons/fi';
import { HiHome, HiGift, HiShoppingCart, HiUser, HiTrash, HiCalendar } from 'react-icons/hi';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../../../../context/CartContext';
import { userTheme as themeColors } from '../../../../theme';



const BottomNav = React.memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(null);
  const { cartCount } = useCart();
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

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
  const activeIndex = navItems.findIndex(item => item.id === activeTab);

  const handleTabClick = (path) => {
    navigate(path);
  };

  return (
    <nav className="fixed bottom-6 left-0 right-0 z-50 flex justify-center lg:hidden px-4 pointer-events-none">
      <div
        className="flex items-center justify-between bg-white/90 backdrop-blur-xl px-2 py-2 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-100/50 w-full max-w-sm pointer-events-auto"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = isActive ? item.filledIcon : item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.path)}
              className="relative flex items-center justify-center transition-all duration-300"
            >
              <motion.div
                layout
                initial={false}
                animate={{
                  width: isActive ? 'auto' : '48px',
                  backgroundColor: isActive ? themeColors.primary : 'transparent',
                }}
                className="flex items-center gap-2 px-4 h-12 rounded-full overflow-hidden"
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-400'}`}
                  />
                  {item.isCart && cartCount > 0 && (
                    <span className="absolute -top-2 -right-3 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                      {cartCount > 9 ? '9+' : cartCount}
                    </span>
                  )}
                </div>
                
                {isActive && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-xs font-bold text-white whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </motion.div>

              {/* Bottom Dot indicator if not expanded */}
              {!isActive && (
                <AnimatePresence>
                  {activeTab === item.id && (
                    <motion.div
                      layoutId="active-dot"
                      className="absolute -bottom-1 w-1 h-1 rounded-full"
                      style={{ backgroundColor: themeColors.primary }}
                    />
                  )}
                </AnimatePresence>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
});


BottomNav.displayName = 'BottomNav';

export default BottomNav;
