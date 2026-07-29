import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { userAuthService } from '../../../../services/authService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { motion } from 'framer-motion';
import {
  FiArrowLeft,
  FiUser,
  FiEdit3,
  FiClipboard,
  FiHeadphones,
  FiFileText,
  FiStar,
  FiMapPin,
  FiSettings,
  FiChevronRight,
  FiLogOut,
  FiGift,
  FiShield,
  FiZap,
  FiCheckCircle
} from 'react-icons/fi';
import { MdAccountBalanceWallet } from 'react-icons/md';
import NotificationBell from '../../components/common/NotificationBell';
import Logo from '../../../../components/common/Logo';
import ConfirmDialog from '../../../../components/common/ConfirmDialog';

const toAssetUrl = (url) => {
  if (!url) return '';
  const clean = url.replace('/api/upload', '/upload');
  if (clean.startsWith('http')) return clean;
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/api$/, '');
  return `${base}${clean.startsWith('/') ? '' : '/'}${clean}`;
};

const Account = () => {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState({
    name: 'Verified Customer',
    phone: '',
    email: '',
    isPhoneVerified: false,
    isEmailVerified: false,
    walletBalance: 0,
    plans: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const storedUserData = localStorage.getItem('userData');
        if (storedUserData) {
          const userData = JSON.parse(storedUserData);
          setUserProfile({
            name: userData.name || 'Verified Customer',
            phone: userData.phone || '',
            email: userData.email || '',
            isPhoneVerified: userData.isPhoneVerified || false,
            isEmailVerified: userData.isEmailVerified || false,
            profilePhoto: userData.profilePhoto || '',
            walletBalance: userData.wallet?.balance ?? 0
          });
        }

        const response = await userAuthService.getProfile();
        if (response.success && response.user) {
          setUserProfile({
            name: response.user.name || 'Verified Customer',
            phone: response.user.phone || '',
            email: response.user.email || '',
            isPhoneVerified: response.user.isPhoneVerified || false,
            isEmailVerified: response.user.isEmailVerified || false,
            profilePhoto: response.user.profilePhoto || '',
            walletBalance: response.user.wallet?.balance ?? 0,
            plans: response.user.plans
          });
        }
      } catch (error) {
        const storedUserData = localStorage.getItem('userData');
        if (storedUserData) {
          const userData = JSON.parse(storedUserData);
          setUserProfile({
            name: userData.name || 'Verified Customer',
            phone: userData.phone || '',
            email: userData.email || '',
            isPhoneVerified: userData.isPhoneVerified || false,
            isEmailVerified: userData.isEmailVerified || false
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    if (phone.startsWith('+91')) return phone;
    if (phone.length === 10) return `+91 ${phone}`;
    return phone;
  };

  const getInitials = () => {
    if (userProfile.name && userProfile.name !== 'Verified Customer') {
      const names = userProfile.name.split(' ');
      if (names.length >= 2) {
        return (names[0][0] + names[1][0]).toUpperCase();
      }
      return names[0][0].toUpperCase();
    }
    if (userProfile.phone) {
      return userProfile.phone.slice(-2);
    }
    return 'VC';
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    try {
      await userAuthService.logout();
      toast.success('Logged out successfully');
      navigate('/user/login');
    } catch (error) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userData');
      toast.success('Logged out successfully');
      navigate('/user/login');
    }
  };

  const MenuItem = ({ icon: Icon, label, onClick, color = "text-gray-900", badge }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-3 sm:p-3.5 bg-white rounded-xl border border-gray-100 shadow-2xs hover:border-gray-200 hover:bg-gray-50/70 transition-all cursor-pointer group mb-2"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-gray-100 bg-gray-50 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className={`text-xs font-bold truncate ${color}`}>{label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge && (
          <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-[9px] font-bold rounded-full border border-rose-100">
            {badge}
          </span>
        )}
        <div className="w-6 h-6 rounded-md bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center transition-colors text-gray-400 group-hover:text-blue-600">
          <FiChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </button>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-gray-50/50 space-y-3 sm:space-y-4">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-3.5 sm:px-4 py-3 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/user')}
            className="w-8 h-8 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
          >
            <FiArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight leading-tight">Account Hub</h1>
            <p className="text-[10px] text-gray-500 font-medium hidden sm:block">Manage your profile, wallet, orders & preferences</p>
          </div>
        </div>
        <div className="relative">
          <NotificationBell />
        </div>
      </header>

      <main className="px-3.5 sm:px-4 max-w-xl mx-auto space-y-3 sm:space-y-4">
        {/* User Profile Card */}
        <div className="bg-gradient-to-br from-[#00246b] via-[#001c54] to-[#0d1b3e] text-white rounded-xl p-4 sm:p-5 shadow-2xs relative overflow-hidden space-y-3">
          <div className="flex items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative shrink-0">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-white/20 bg-white/10 flex items-center justify-center shadow-2xs">
                  {userProfile.profilePhoto ? (
                    <img
                      src={toAssetUrl(userProfile.profilePhoto)}
                      alt={userProfile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-bold text-base text-white">{getInitials()}</span>
                  )}
                </div>
                <button
                  onClick={() => navigate('/user/update-profile')}
                  className="absolute -bottom-0.5 -right-0.5 p-1 bg-white text-gray-900 rounded-full border border-gray-200 shadow-2xs hover:bg-gray-100 transition-transform active:scale-95 cursor-pointer"
                  title="Edit Profile"
                >
                  <FiEdit3 className="w-3 h-3 text-blue-600" />
                </button>
              </div>

              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-white truncate">{userProfile.name}</h2>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold border border-emerald-400/30">
                    <FiCheckCircle className="w-2.5 h-2.5" />
                    Verified
                  </span>
                </div>
                <p className="text-xs text-blue-200/90 font-medium truncate">
                  {userProfile.phone ? formatPhoneNumber(userProfile.phone) : 'No phone linked'}
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/user/update-profile')}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:scale-95 transition-all rounded-xl border border-white/20 text-[10px] font-bold uppercase tracking-wider text-white shrink-0 cursor-pointer backdrop-blur-xs"
            >
              Edit
            </button>
          </div>
        </div>

        {/* Active Membership / Plan Card */}
        {userProfile.plans && userProfile.plans.isActive && (
          <div
            onClick={() => navigate('/user/my-plan')}
            className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl p-3.5 shadow-2xs cursor-pointer flex items-center justify-between border border-blue-500/30"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center shrink-0">
                <FiZap className="w-4 h-4 fill-white" />
              </div>
              <div>
                <span className="text-[8px] font-bold text-blue-200 uppercase tracking-widest block">Active Pass</span>
                <h3 className="text-xs font-bold uppercase tracking-wide">{userProfile.plans.name}</h3>
                <span className="text-[9px] text-blue-100 font-medium">Expires: {new Date(userProfile.plans.expiry).toLocaleDateString()}</span>
              </div>
            </div>
            <FiChevronRight className="w-4 h-4 text-blue-200" />
          </div>
        )}

        {/* Quick Balance & Rewards Metrics Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => navigate('/user/wallet')}
            className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-2xs hover:border-gray-200 transition-all text-left cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <MdAccountBalanceWallet className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Wallet Balance</span>
            <p className={`text-xs sm:text-sm font-bold mt-0.5 ${userProfile.walletBalance < 0 ? 'text-rose-600' : 'text-gray-900'}`}>
              ₹{Math.abs(userProfile.walletBalance || 0).toLocaleString('en-IN')}
              {userProfile.walletBalance < 0 && <span className="text-[8px] text-rose-500 font-medium ml-1">(Penalty)</span>}
            </p>
          </button>

          <button
            onClick={() => navigate('/user/rewards')}
            className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-2xs hover:border-gray-200 transition-all text-left cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <FiGift className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Rewards Hub</span>
            <p className="text-xs sm:text-sm font-bold text-gray-900 mt-0.5">Refer & Earn</p>
          </button>
        </div>

        {/* Menu Groups */}
        <div className="space-y-3">
          {/* Plans */}
          <div>
            <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 px-1">Plans & Subscriptions</h3>
            <MenuItem
              icon={FiFileText}
              label="My Plans & VIP Passes"
              onClick={() => navigate('/user/my-plan')}
            />
          </div>

          {/* Activity */}
          <div>
            <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 px-1">Activity & Requests</h3>
            <MenuItem
              icon={FiClipboard}
              label="My Bookings Stream"
              onClick={() => navigate('/user/my-bookings')}
            />
            <MenuItem
              icon={FiStar}
              label="My Ratings & Feedback"
              onClick={() => navigate('/user/my-rating')}
            />
          </div>

          {/* Preferences */}
          <div>
            <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 px-1">Preferences & Location</h3>
            <MenuItem
              icon={FiMapPin}
              label="Saved Delivery Addresses"
              onClick={() => navigate('/user/manage-addresses')}
            />
            <MenuItem
              icon={FiSettings}
              label="App Settings & Security"
              onClick={() => navigate('/user/settings')}
            />
          </div>

          {/* Support & Legal */}
          <div>
            <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 px-1">Support & Ecosystem</h3>
            <MenuItem
              icon={FiHeadphones}
              label="Help & Support Center"
              onClick={() => navigate('/user/help-support')}
            />
            <button
              onClick={() => navigate('/user/about-cleaning-expert')}
              className="w-full flex items-center justify-between p-3 sm:p-3.5 bg-white rounded-xl border border-gray-100 shadow-2xs hover:border-gray-200 transition-all cursor-pointer group mb-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                  <Logo className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-gray-900 truncate">About Nexora Go</span>
              </div>
              <div className="w-6 h-6 rounded-md bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center transition-colors text-gray-400 group-hover:text-blue-600">
                <FiChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>

            <div className="pt-2">
              <button
                onClick={handleLogout}
                className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-2 active:scale-95"
              >
                <FiLogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>

        <div className="text-center pt-2 pb-6">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nexora App Version 7.6.27</p>
        </div>
      </main>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
        title="Log Out"
        message="Are you sure you want to log out of Nexora Go?"
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        type="danger"
      />
    </div>
  );
};

export default Account;
