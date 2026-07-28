import React, { useRef, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { HiLocationMarker, HiOutlineShoppingCart, HiOutlineUser, HiOutlineMenu, HiX } from 'react-icons/hi';
import { gsap } from 'gsap';
import LocationSelector from '../common/LocationSelector';
import { animateLogo } from '../../../../utils/gsapAnimations';
import Logo from '../../../../components/common/Logo';
import { themeColors, getColorWithOpacity } from '../../../../theme';
import { useCart } from '../../../../context/CartContext';
import { useAuth } from '../../../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import AddressSelectionModal from '../../pages/Checkout/components/AddressSelectionModal';
import { testPushNotification } from '../../../../services/pushNotificationService';

const toAssetUrl = (url) => {
  if (!url) return '';
  const clean = url.replace('/api/upload', '/upload');
  if (clean.startsWith('http')) return clean;
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/api$/, '');
  return `${base}${clean.startsWith('/') ? '' : '/'}${clean}`;
};

const Header = ({ location: address, onLocationClick, navLinks: dynamicNavLinks, siteIdentity, homeContent }) => {
  const logoRef = useRef(null);
  const routerLocation = useLocation();
  const { cartCount } = useCart();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [houseNumber, setHouseNumber] = useState('');

  // Lock body scroll & touch action when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const brandName = siteIdentity?.brandName || 'NEXORA GO';
  const slogan = siteIdentity?.slogan || 'Everything you need, one place';
  const brandLogoUrl = siteIdentity?.brandLogoUrl;

  const handleLocationClick = () => {
    if (onLocationClick) {
      onLocationClick();
    } else {
      setIsAddressModalOpen(true);
    }
  };

  const handleAddressSave = (savedHouseNumber, locationObj) => {
    if (locationObj) {
      const newAddress = locationObj.address;
      localStorage.setItem('currentAddress', newAddress);

      // Try to parse city
      const components = locationObj.components || locationObj.address_components;
      let city = '';
      if (components) {
        const getComponent = (type) => components.find(c => c.types.includes(type))?.long_name || '';
        city = getComponent('locality') || getComponent('administrative_area_level_2');
      }

      if (!city && newAddress) {
        const parts = newAddress.split(',').map(p => p.trim());
        city = parts.length > 2 ? parts[parts.length - 3] : (parts.length > 1 ? parts[parts.length - 2] : parts[0]);
      }

      if (city) {
        localStorage.setItem('currentCity', city);
      }
      if (locationObj.lat && locationObj.lng) {
        const newCoords = { lat: locationObj.lat, lng: locationObj.lng };
        localStorage.setItem('currentCoords', JSON.stringify(newCoords));
      }

      toast.success(city ? `Location set to ${city}` : 'Location updated');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
    setHouseNumber(savedHouseNumber);
    setIsAddressModalOpen(false);
  };

  useEffect(() => {
    if (logoRef.current) {
      animateLogo(logoRef.current);
    }
  }, []);

  const navLinks = useMemo(() => {
    let links = (dynamicNavLinks && dynamicNavLinks.length > 0)
      ? dynamicNavLinks.map(link => ({ name: link.label, path: link.path }))
      : [];

    if (homeContent?.isAboutUsVisible !== false && homeContent?.aboutUs && !links.some(l => l.path.includes('about'))) {
      links.push({ name: 'About Us', path: '/user/about' });
    }
    if (homeContent?.isHowItWorksVisible !== false && homeContent?.howItWorks?.items?.length > 0 && !links.some(l => l.path.includes('how-it-works'))) {
      links.push({ name: 'How It Works', path: '/user#how-it-works' });
    }
    if (homeContent?.isOffersVisible !== false && homeContent?.offers?.items?.length > 0 && !links.some(l => l.path.includes('offers'))) {
      links.push({ name: 'Offers', path: '/user#offers' });
    }
    if (homeContent?.isCategoriesVisible !== false && !links.some(l => l.path.includes('services'))) {
      links.push({ name: 'Services', path: '/user/services' });
    }
    if (homeContent?.isCategoriesVisible !== false && !links.some(l => l.path.includes('products'))) {
      links.push({ name: 'Products', path: '/user/products' });
    }
    if (homeContent?.isContactUsVisible !== false && homeContent?.contactUs && !links.some(l => l.path.includes('contact'))) {
      links.push({ name: 'Contact', path: '/user/contact' });
    }

    return links;
  }, [dynamicNavLinks, homeContent]);

  const isActive = (path) => {
    if (path === '/user') return routerLocation.pathname === '/user';
    return routerLocation.pathname.startsWith(path);
  };

  return (
    <>
      <header className="w-full bg-white border-b border-gray-100 fixed top-0 left-0 right-0 z-50 transition-all duration-300">
        <div className="h-1.5 w-full" style={{ backgroundColor: themeColors.primary }}></div>

        <div className="max-w-screen-2xl mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-20">

            {/* Left: Logo & Brand Name */}
            <Link to="/user" className="flex items-center gap-3 shrink-0 group">
              {brandLogoUrl ? (
                <img 
                  src={toAssetUrl(brandLogoUrl)} 
                  alt={brandName} 
                  className="h-10 sm:h-12 w-auto max-w-[220px] object-contain transition-transform group-hover:scale-105" 
                />
              ) : (
                <>
                  <div ref={logoRef} className="relative">
                    <Logo className="h-10 w-10 sm:h-12 sm:w-12" src={siteIdentity?.logoUrl} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-lg sm:text-xl tracking-tight text-gray-900 group-hover:text-blue-600 transition-colors">
                      {brandName}
                    </span>
                    <span className="text-[10px] font-semibold text-gray-400 -mt-1 hidden sm:inline">
                      {slogan}
                    </span>
                  </div>
                </>
              )}
            </Link>

            {/* Desktop Nav Links */}
            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="relative py-2 text-sm font-bold transition-colors duration-200"
                  style={{
                    color: isActive(link.path) ? themeColors.primary : '#4B5563'
                  }}
                >
                  {link.name}
                  {isActive(link.path) && (
                    <motion.div
                      layoutId="nav-underline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                      style={{ backgroundColor: themeColors.primary }}
                    />
                  )}
                </Link>
              ))}
            </nav>

            {/* Right: Actions (Search, Cart, Account, Location) */}
            <div className="flex items-center gap-1 sm:gap-5">

              <div
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border border-black/[0.03]"
                onClick={handleLocationClick}
              >
                <HiLocationMarker className="w-4 h-4 text-gray-400" />
                <span className="text-[11px] font-bold text-gray-600 truncate max-w-[200px]">
                  {address && address !== '...' ? address : (localStorage.getItem('currentAddress') || 'Location')}
                </span>
              </div>

              <div className="flex items-center gap-0.5 sm:gap-3">
                <Link to="/user/cart" className="relative p-2 text-gray-500 hover:bg-gray-50 rounded-full transition-colors">
                  <HiOutlineShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
                  {cartCount > 0 && (
                    <span
                      className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] flex items-center justify-center text-[8px] sm:text-[10px] font-black text-white rounded-full shadow-sm ring-2 ring-white"
                      style={{ backgroundColor: themeColors.primary }}
                    >
                      {cartCount}
                    </span>
                  )}
                </Link>
              </div>

              <Link to="/user/account" className="hidden lg:flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-xl transition-all duration-200 group border border-transparent hover:border-black/[0.03]">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:text-blue-600 transition-all duration-300 shadow-sm overflow-hidden border border-black/[0.03]">
                  {user?.profilePhoto || user?.photo ? (
                    <img src={toAssetUrl(user.profilePhoto || user.photo)} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <HiOutlineUser className="w-5 h-5" />
                  )}
                </div>
                <div className="flex flex-col items-start leading-none">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Account</span>
                  <span className="text-[13px] font-black text-gray-900">
                    {user ? (user.name ? user.name.split(' ')[0] : 'Profile') : 'Sign In'}
                  </span>
                </div>
              </Link>

              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 text-gray-500 hover:bg-gray-50 rounded-xl transition-colors border border-black/[0.03]"
              >
                <HiOutlineMenu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Fullscreen Overlay & Drawer (Portaled to document.body) */}
        {createPortal(
          <AnimatePresence>
            {isMobileMenuOpen && (
              <div className="fixed inset-0 z-[99999] lg:hidden flex justify-end">
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsMobileMenuOpen(false)}
                  onTouchMove={(e) => e.preventDefault()}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Right Slide Drawer */}
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="relative w-full max-w-xs bg-white h-full shadow-2xl flex flex-col z-10 overflow-hidden"
                >
                  {/* Drawer Top Header */}
                  <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white shrink-0">
                    <div className="flex items-center gap-2.5">
                      {brandLogoUrl ? (
                        <img 
                          src={toAssetUrl(brandLogoUrl)} 
                          alt={brandName} 
                          className="h-8 w-auto max-w-[160px] object-contain" 
                        />
                      ) : (
                        <>
                          <Logo className="h-8 w-8" src={siteIdentity?.logoUrl} />
                          <span className="font-black text-base tracking-tight text-gray-900">
                            {brandName}
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors border border-gray-100"
                    >
                      <HiX className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Scrollable Content with pb-28 clearance for BottomNav */}
                  <div className="p-4 space-y-4 overflow-y-auto flex-1 pb-28">
                    {/* User Profile Card (Prominent at top) */}
                    <Link
                      to="/user/account"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-3.5 p-3.5 bg-gradient-to-r from-gray-50 to-blue-50/50 hover:from-gray-100 hover:to-blue-100/50 rounded-2xl transition-all border border-blue-100/80 shadow-sm group"
                    >
                      <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-base shadow-md overflow-hidden shrink-0 border-2 border-white">
                        {user?.profilePhoto || user?.photo ? (
                          <img src={toAssetUrl(user.profilePhoto || user.photo)} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          user?.name ? user.name.charAt(0).toUpperCase() : <HiOutlineUser className="w-6 h-6" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">Account</span>
                        <span className="text-base font-black text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                          {user ? (user.name ? user.name : 'My Profile') : 'Sign In / Register'}
                        </span>
                        {user?.email || user?.phone ? (
                          <span className="text-[11px] font-medium text-gray-500 truncate">
                            {user.email || user.phone}
                          </span>
                        ) : null}
                      </div>
                    </Link>

                    {/* Location Selector */}
                    <div
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        handleLocationClick();
                      }}
                    >
                      <div className="p-2 rounded-xl bg-white text-blue-600 shadow-sm border border-gray-100">
                        <HiLocationMarker className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Your Location</span>
                        <span className="text-xs font-bold text-gray-800 truncate">
                          {address && address !== '...' ? address : (localStorage.getItem('currentAddress') || 'Select Location')}
                        </span>
                      </div>
                    </div>

                    {/* Navigation Links */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest px-3 mb-2 block">Menu Navigation</span>
                      {navLinks.map((link) => (
                        <Link
                          key={link.path}
                          to={link.path}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-bold transition-all"
                          style={{
                            color: isActive(link.path) ? themeColors.primary : '#374151',
                            backgroundColor: isActive(link.path) ? `${themeColors.primary}12` : 'transparent'
                          }}
                        >
                          <span>{link.name}</span>
                          <span className="text-xs font-extrabold opacity-60">→</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
      </header>
      {/* Spacer to push down page content under fixed navbar */}
      <div className="h-[86px] w-full shrink-0"></div>

      {/* Location Selector Modal */}
      <AddressSelectionModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        houseNumber={houseNumber}
        onHouseNumberChange={setHouseNumber}
        onSave={handleAddressSave}
      />
    </>
  );
};

export default Header;

