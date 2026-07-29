import React, { useRef, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { HiLocationMarker, HiOutlineShoppingCart, HiOutlineUser, HiOutlineMenu, HiX } from 'react-icons/hi';
import { FiChevronRight, FiMapPin, FiShoppingCart, FiUser, FiMenu, FiX as FiCloseIcon } from 'react-icons/fi';
import { gsap } from 'gsap';
import LocationSelector from '../common/LocationSelector';
import { animateLogo } from '../../../../utils/gsapAnimations';
import Logo from '../../../../components/common/Logo';
import { themeColors } from '../../../../theme';
import { useCart } from '../../../../context/CartContext';
import { useAuth } from '../../../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import AddressSelectionModal from '../../pages/Checkout/components/AddressSelectionModal';

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

  // Lock body scroll when mobile menu is open
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
      <header className="w-full bg-white/95 backdrop-blur-md border-b border-gray-100 fixed top-0 left-0 right-0 z-50 transition-all duration-300 shadow-2xs">
        {/* Top Brand Accent Line */}
        <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-[#00246b]"></div>

        <div className="max-w-screen-2xl mx-auto px-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">

            {/* Left: Logo & Brand Name */}
            <Link to="/user" className="flex items-center gap-2.5 shrink-0 group">
              {brandLogoUrl ? (
                <img 
                  src={toAssetUrl(brandLogoUrl)} 
                  alt={brandName} 
                  className="h-8 sm:h-10 w-auto max-w-[180px] object-contain transition-transform group-hover:scale-105" 
                />
              ) : (
                <>
                  <div ref={logoRef} className="relative">
                    <Logo className="h-8 w-8 sm:h-10 sm:w-10" src={siteIdentity?.logoUrl} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-base sm:text-lg tracking-tight text-gray-900 group-hover:text-blue-600 transition-colors uppercase">
                      {brandName}
                    </span>
                    <span className="text-[9px] font-bold text-gray-400 -mt-1 hidden sm:inline uppercase tracking-widest">
                      {slogan}
                    </span>
                  </div>
                </>
              )}
            </Link>

            {/* Desktop Nav Links */}
            <nav className="hidden lg:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative py-1.5 text-xs font-bold uppercase tracking-wider transition-colors duration-200 ${
                    isActive(link.path) ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {link.name}
                  {isActive(link.path) && (
                    <motion.div
                      layoutId="nav-underline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600"
                    />
                  )}
                </Link>
              ))}
            </nav>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 sm:gap-3">

              {/* Location Pill */}
              <div
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100 shadow-2xs"
                onClick={handleLocationClick}
              >
                <FiMapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="text-[11px] font-bold text-gray-800 truncate max-w-[180px]">
                  {address && address !== '...' ? address : (localStorage.getItem('currentAddress') || 'Select Location')}
                </span>
              </div>

              {/* Cart Button */}
              <Link to="/user/cart" className="relative p-2 text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
                <FiShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-[16px] flex items-center justify-center text-[9px] font-bold text-white rounded-full bg-blue-600 ring-2 ring-white shadow-2xs">
                    {cartCount}
                  </span>
                )}
              </Link>

              {/* Account Button (Desktop) */}
              <Link to="/user/account" className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50 rounded-xl transition-all duration-200 group border border-gray-100 shadow-2xs">
                <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shadow-2xs overflow-hidden shrink-0 border border-blue-100">
                  {user?.profilePhoto || user?.photo ? (
                    <img src={toAssetUrl(user.profilePhoto || user.photo)} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <FiUser className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Account</span>
                  <span className="text-xs font-bold text-gray-900">
                    {user ? (user.name ? user.name.split(' ')[0] : 'Profile') : 'Sign In'}
                  </span>
                </div>
              </Link>

              {/* Mobile Menu Trigger */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 text-gray-600 hover:bg-gray-50 rounded-xl transition-colors border border-gray-100"
              >
                <FiMenu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Slide Drawer */}
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
                  className="absolute inset-0 bg-black/60 backdrop-blur-xs"
                />

                {/* Right Slide Drawer */}
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="relative w-full max-w-xs bg-white h-full shadow-2xl flex flex-col z-10 overflow-hidden"
                >
                  {/* Drawer Header */}
                  <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white shrink-0">
                    <div className="flex items-center gap-2">
                      {brandLogoUrl ? (
                        <img 
                          src={toAssetUrl(brandLogoUrl)} 
                          alt={brandName} 
                          className="h-7 w-auto max-w-[140px] object-contain" 
                        />
                      ) : (
                        <>
                          <Logo className="h-7 w-7" src={siteIdentity?.logoUrl} />
                          <span className="font-bold text-sm tracking-tight text-gray-900 uppercase">
                            {brandName}
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors border border-gray-100"
                    >
                      <FiCloseIcon className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Scrollable Content */}
                  <div className="p-4 space-y-3.5 overflow-y-auto flex-1 pb-24">
                    {/* User Profile Card */}
                    <Link
                      to="/user/account"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-3 p-3 bg-blue-50/50 hover:bg-blue-50 rounded-xl transition-all border border-blue-100 shadow-2xs group"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-2xs overflow-hidden shrink-0">
                        {user?.profilePhoto || user?.photo ? (
                          <img src={toAssetUrl(user.profilePhoto || user.photo)} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          user?.name ? user.name.charAt(0).toUpperCase() : <FiUser className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">Account</span>
                        <span className="text-xs font-bold text-gray-900 truncate">
                          {user ? (user.name ? user.name : 'My Profile') : 'Sign In / Register'}
                        </span>
                        {user?.email || user?.phone ? (
                          <span className="text-[10px] text-gray-500 font-medium truncate">
                            {user.email || user.phone}
                          </span>
                        ) : null}
                      </div>
                    </Link>

                    {/* Location Selector */}
                    <div
                      className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100 shadow-2xs"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        handleLocationClick();
                      }}
                    >
                      <div className="p-1.5 rounded-lg bg-white text-blue-600 shadow-2xs border border-gray-100">
                        <FiMapPin className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Your Location</span>
                        <span className="text-xs font-bold text-gray-800 truncate">
                          {address && address !== '...' ? address : (localStorage.getItem('currentAddress') || 'Select Location')}
                        </span>
                      </div>
                    </div>

                    {/* Navigation Links */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-1 block">Menu Navigation</span>
                      {navLinks.map((link) => (
                        <Link
                          key={link.path}
                          to={link.path}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                            isActive(link.path) ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span>{link.name}</span>
                          <FiChevronRight className="w-3.5 h-3.5 opacity-60" />
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
      {/* Spacer to push down content */}
      <div className="h-14 sm:h-16 w-full shrink-0"></div>

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
