import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HiLocationMarker, HiOutlineShoppingCart, HiOutlineUser, HiOutlineMenu, HiX } from 'react-icons/hi';
import { gsap } from 'gsap';
import LocationSelector from '../common/LocationSelector';
import { animateLogo } from '../../../../utils/gsapAnimations';
import Logo from '../../../../components/common/Logo';
import { themeColors, getColorWithOpacity } from '../../../../theme';
import { useCart } from '../../../../context/CartContext';
import { useAuth } from '../../../../context/AuthContext';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import AddressSelectionModal from '../../pages/Checkout/components/AddressSelectionModal';
import { testPushNotification } from '../../../../services/pushNotificationService';

const Header = ({ location: address, onLocationClick, navLinks: dynamicNavLinks, siteIdentity, homeContent }) => {
  const logoRef = useRef(null);
  const routerLocation = useLocation();
  const { cartCount } = useCart();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [houseNumber, setHouseNumber] = useState('');
  const [isTestPushSending, setIsTestPushSending] = useState(false);
  const [testPushSent, setTestPushSent] = useState(false);

  const handleTestPushClick = async () => {
    if (testPushSent) {
      toast.error('Test notification already sent once.');
      return;
    }
    setIsTestPushSending(true);
    const loadingToast = toast.loading('Initializing test push...');
    try {
      await testPushNotification();
      toast.success('Test notification sent successfully!', { id: loadingToast });
      setTestPushSent(true);
    } catch (err) {
      toast.error(err.message || 'Failed to send test push', { id: loadingToast });
    } finally {
      setIsTestPushSending(false);
    }
  };

  const brandName = siteIdentity?.brandName || 'NEXORA GO';
  const slogan = siteIdentity?.slogan || 'Everything you need, one place';

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

    // Automatically add active sections if not already present
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
        {/* Top Blue Bar */}
        <div className="h-1.5 w-full" style={{ backgroundColor: themeColors.primary }}></div>

      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-20">

          {/* Left: Logo & Brand Name */}
          <Link to="/user" className="flex items-center gap-3 shrink-0 group">
            <div ref={logoRef} className="relative">
              <Logo className="h-10 w-10 sm:h-12 sm:w-12" src={siteIdentity?.logoUrl} />
              <div className="absolute inset-0 bg-brand/10 rounded-full scale-0 group-hover:scale-110 transition-transform duration-300"></div>
            </div>
            {siteIdentity?.brandLogoUrl ? (
              <img
                src={siteIdentity.brandLogoUrl.startsWith('http') || siteIdentity.brandLogoUrl.startsWith('data:') ? siteIdentity.brandLogoUrl : `${(import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/api$/, '')}${siteIdentity.brandLogoUrl.startsWith('/') ? '' : '/'}${siteIdentity.brandLogoUrl}`}
                alt={brandName}
                className="h-8 sm:h-10 w-auto object-contain"
              />
            ) : (
              <div className="flex flex-col">
                <span className="text-xl sm:text-2xl font-black tracking-tighter leading-none" style={{ color: themeColors.primary }}>
                  {brandName}
                </span>
                <span className="text-[7px] sm:text-[9px] font-bold uppercase tracking-[0.1em] sm:tracking-[0.15em] text-gray-400 mt-0.5">
                  {slogan}
                </span>
              </div>
            )}
          </Link>

          {/* Center: Navigation Links */}
          <nav className="hidden lg:flex items-center gap-10">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="relative py-2 text-[15px] font-bold transition-colors duration-200"
                style={{ color: isActive(link.path) ? themeColors.primary : '#4B5563' }}
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
            {/* Test Push Button */}
            <button
              onClick={handleTestPushClick}
              disabled={isTestPushSending || testPushSent}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all duration-300 border ${
                testPushSent
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : isTestPushSending
                  ? 'bg-blue-50 text-blue-400 border-blue-100 cursor-wait'
                  : 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white border-transparent hover:shadow-md hover:scale-105 active:scale-95 shadow-sm'
              }`}
            >
              <span>🔔</span>
              <span>{testPushSent ? 'Push Sent' : isTestPushSending ? 'Sending...' : 'Test Push'}</span>
            </button>

            {/* Location (Subtle integration) */}
            <div
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border border-black/[0.03]"
              onClick={handleLocationClick}
            >
              <HiLocationMarker className="w-4 h-4 text-gray-400" />
              <span className="text-[11px] font-bold text-gray-600 truncate max-w-[100px]">
                {address && address !== '...' ? address.split(',')[0] : (localStorage.getItem('currentAddress') ? localStorage.getItem('currentAddress').split(',')[0] : 'Location')}
              </span>
            </div>

            {/* Icons Group */}
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

            {/* Profile / Account Link (Desktop only) */}
            <Link to="/user/account" className="hidden lg:flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-xl transition-all duration-200 group border border-transparent hover:border-black/[0.03]">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:text-blue-600 transition-all duration-300 shadow-sm overflow-hidden border border-black/[0.03]">
                {user?.profilePhoto || user?.photo ? (
                  <img src={user.profilePhoto || user.photo} alt="Profile" className="w-full h-full object-cover" />
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

            {/* Menu Button (Mobile only) */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-gray-500 hover:bg-gray-50 rounded-xl transition-colors border border-black/[0.03]"
            >
              {isMobileMenuOpen ? <HiX className="w-6 h-6" /> : <HiOutlineMenu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-100 bg-white shadow-lg">
          <div className="flex flex-col p-4 gap-4">
            {/* Mobile Test Push Button */}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleTestPushClick();
              }}
              disabled={isTestPushSending || testPushSent}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-extrabold transition-all duration-300 border ${
                testPushSent
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : isTestPushSending
                  ? 'bg-blue-50 text-blue-400 border-blue-100 cursor-wait'
                  : 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white border-transparent shadow-sm'
              }`}
            >
              <span>🔔</span>
              <span>{testPushSent ? 'Push Sent' : isTestPushSending ? 'Sending...' : 'Test Push Notification'}</span>
            </button>

            {/* Mobile Location Selector (Visible under md) */}
            <div
              className="flex md:hidden items-center gap-2.5 px-4 py-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border border-black/[0.03]"
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleLocationClick();
              }}
            >
              <HiLocationMarker className="w-5 h-5 text-gray-500" />
              <span className="text-sm font-bold text-gray-700 truncate">
                {address && address !== '...' ? address : 'Select Location'}
              </span>
            </div>

            {/* Navigation Links */}
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-4 py-2.5 text-sm font-bold rounded-lg transition-colors"
                  style={{
                    color: isActive(link.path) ? themeColors.primary : '#4B5563',
                    backgroundColor: isActive(link.path) ? `${themeColors.primary}10` : 'transparent'
                  }}
                >
                  {link.name}
                </Link>
              ))}
            </div>

            <hr className="border-gray-100 my-1" />

            {/* Profile Link in Mobile Menu */}
            <Link
              to="/user/account"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all border border-black/[0.03]"
            >
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-gray-400 shadow-sm overflow-hidden border border-black/[0.03]">
                {user?.photo ? (
                  <img src={user.photo} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <HiOutlineUser className="w-4 h-4" />
                )}
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Account</span>
                <span className="text-sm font-black text-gray-900">
                  {user ? (user.name ? user.name : 'Profile') : 'Sign In / Register'}
                </span>
              </div>
            </Link>
          </div>
        </div>
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

