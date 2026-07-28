import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUser, FiEdit2, FiMapPin, FiBriefcase, FiPackage, FiStar, FiSettings, FiChevronRight, FiLogOut, FiPlus, FiUsers, FiAlertTriangle } from 'react-icons/fi';
import { FaWallet } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { vendorTheme as themeColors } from '../../../../theme';
import { vendorAuthService } from '../../../../services/authService';
import LogoLoader from '../../../../components/common/LogoLoader';
import ConfirmDialog from '../../../../components/common/ConfirmDialog';

const Profile = () => {
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Helper function to convert hex to rgba
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const menuItems = [
    { id: 2, label: 'Wallet', icon: FaWallet, path: '/vendor/wallet' },
    { id: 5, label: 'My Ratings', icon: FiStar, path: '/vendor/my-ratings' },
    { id: 10, label: 'My Services', icon: FiBriefcase, path: '/vendor/my-services' },
    { id: 12, label: 'My Products', icon: FiPackage, path: '/vendor/my-products' },
    { id: 7, label: 'Manage Address', icon: FiMapPin, path: '/vendor/address-management' },
    { id: 8, label: 'Settings', icon: FiSettings, path: '/vendor/settings' },
    { id: 9, label: 'About Nexora', icon: null, customIcon: 'S', path: '/vendor/about-cleaning-expert' },
  ];

  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);


  useEffect(() => {
    const fetchProfile = async () => {
      // Try to load from local storage first for immediate display
      const storedVendorData = JSON.parse(localStorage.getItem('vendorData') || '{}');
      if (storedVendorData && Object.keys(storedVendorData).length > 0) {
        setProfile({
          name: storedVendorData.name || 'Vendor Name',
          businessName: storedVendorData.businessName || null,
          phone: storedVendorData.phone || '',
          email: storedVendorData.email || '',
          address: storedVendorData.address ?
            (typeof storedVendorData.address === 'string' ? storedVendorData.address :
              `${storedVendorData.address.addressLine1 || ''} ${storedVendorData.address.addressLine2 || ''} ${storedVendorData.address.city || ''} ${storedVendorData.address.state || ''} ${storedVendorData.address.pincode || ''}`.trim() || 'Not set')
            : 'Not set',
          rating: storedVendorData.rating || 0,
          totalJobs: storedVendorData.totalJobs || 0,
          completionRate: storedVendorData.completionRate || 0,
          serviceCategory: storedVendorData.service || '',
          skills: [],
          photo: storedVendorData.profilePhoto || null,
          approvalStatus: storedVendorData.approvalStatus,
          isPhoneVerified: storedVendorData.isPhoneVerified || false,
          isEmailVerified: storedVendorData.isEmailVerified || false
        });
        setIsLoading(false); // Show content immediately
      }

      setError(null);
      try {
        const response = await vendorAuthService.getProfile();
        if (response.success) {
          const vendorData = response.vendor;
          // Format address
          const addressString = vendorData.address
            ? (typeof vendorData.address === 'string' ? vendorData.address :
              `${vendorData.address.addressLine1 || ''} ${vendorData.address.addressLine2 || ''} ${vendorData.address.city || ''} ${vendorData.address.state || ''} ${vendorData.address.pincode || ''}`.trim() || 'Not set')
            : 'Not set';

          setProfile({
            name: vendorData.name || 'Vendor Name',
            businessName: vendorData.businessName || null,
            phone: vendorData.phone || '',
            email: vendorData.email || '',
            address: addressString,
            rating: vendorData.rating || 0,
            totalJobs: vendorData.totalJobs || 0,
            completionRate: vendorData.completionRate || 0,
            serviceCategory: vendorData.service || '',
            skills: [],
            photo: vendorData.profilePhoto || null,
            approvalStatus: vendorData.approvalStatus,
            isPhoneVerified: vendorData.isPhoneVerified || false,
            isEmailVerified: vendorData.isEmailVerified || false
          });
          localStorage.setItem('vendorData', JSON.stringify(vendorData));
        } else {
          // If API fails but we have local data, stick with it?
          if (!storedVendorData || Object.keys(storedVendorData).length === 0) {
            setError(response.message || 'Failed to fetch profile');
            toast.error(response.message || 'Failed to fetch profile');
          }
        }
      } catch (err) {
        console.error('Error fetching vendor profile:', err);
        if (!storedVendorData || Object.keys(storedVendorData).length === 0) {
          setError(err.response?.data?.message || 'Failed to fetch profile');
          toast.error(err.response?.data?.message || 'Failed to fetch profile');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
    window.addEventListener('vendorDataUpdated', fetchProfile);
    window.addEventListener('vendorProfileUpdated', fetchProfile);

    return () => {
      window.removeEventListener('vendorDataUpdated', fetchProfile);
      window.removeEventListener('vendorProfileUpdated', fetchProfile);
    };
  }, []);

  if (isLoading) {
    return <LogoLoader />;
  }

  if (error && !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center p-12 max-w-sm mx-auto">
          <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-rose-100 shadow-sm">
            <FiAlertTriangle className="w-10 h-10 text-rose-500" />
          </div>
          <h2 className="text-xl font-medium text-gray-900 mb-4 capitalize tracking-widest">Protocol Sync Failure</h2>
          <p className="text-gray-500 text-xs font-normal capitalize tracking-wider mb-10 leading-relaxed">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-5 bg-blue-600 rounded-2xl text-white text-[10px] font-medium capitalize tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
          >
            Restart Uplink
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Profile Master Card (Horizontal & Extremely Compact - Light themed) */}
      <div 
        className="rounded-2xl p-4 border border-blue-100/70 shadow-sm mb-4 relative overflow-hidden group"
        style={{ background: 'linear-gradient(135deg, #F0F5FF 0%, #E0EBFF 100%)' }}
      >
        {/* Decorative Elements */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-100/20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-1000" />

        <div className="relative z-10 flex items-center gap-4">
          {/* Master Avatar */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-xl bg-white/50 border border-blue-200/50 overflow-hidden flex items-center justify-center shadow-sm">
              {profile.photo ? (
                <img src={profile.photo} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-blue-100/30 flex items-center justify-center">
                   <FiUser className="w-8 h-8 text-blue-500/50" />
                </div>
              )}
            </div>
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/vendor/profile/details')}
              className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-md shadow flex items-center justify-center border border-blue-100 text-blue-600"
            >
              <FiEdit2 className="w-2.5 h-2.5" />
            </motion.button>
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-medium text-gray-950 truncate tracking-tight leading-none">{profile.name}</h2>
            <p className="text-[8px] font-normal text-blue-600/70 capitalize tracking-widest mt-1">
              {profile.businessName || 'Verified Elite Partner'}
            </p>
            
            <div className="flex items-center gap-2 mt-2">
              <div className="px-2 py-0.5 bg-white/70 rounded-md border border-blue-100 flex items-center gap-1">
                <FiStar className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span className="text-[8px] font-medium text-gray-800 tracking-wide">{profile.rating.toFixed(1)} Rating</span>
              </div>
              <div className="px-2 py-0.5 bg-white/70 rounded-md border border-blue-100 flex items-center gap-1">
                <FiBriefcase className="w-3 h-3 text-blue-500" />
                <span className="text-[8px] font-medium text-gray-800 tracking-wide">{profile.totalJobs} Deployments</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Action Grid */}
      <div className="grid grid-cols-3 gap-3.5">
        {[
          { label: 'Financials', icon: FaWallet, path: '/vendor/wallet' },
          { label: 'Operations', icon: FiBriefcase, path: '/vendor/jobs' },
          { label: 'Team', icon: FiUsers, path: '/vendor/workers' },
        ].map((item, idx) => (
          <motion.button
            key={idx}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(item.path)}
            className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col items-center text-center group hover:shadow-md transition-all shadow-sm"
          >
            <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center mb-2 group-hover:bg-blue-50 transition-all border border-gray-100 shrink-0">
              <item.icon className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
            </div>
            <span className="text-[8px] font-normal text-gray-500 capitalize tracking-widest group-hover:text-gray-900 transition-colors">{item.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Management Ecosystem */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1 mb-2">
          <h3 className="text-[10px] font-normal text-gray-400 capitalize tracking-widest">Partner Ecosystem</h3>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        
        {menuItems.map((item) => {
          const IconComponent = item.icon || FiSettings;
          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 shadow-sm ${
                item.highlight 
                ? 'bg-blue-50/80 border-blue-100 text-blue-900 hover:shadow-md' 
                : 'bg-white border-gray-100 text-gray-800 hover:shadow-md'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                  item.highlight ? 'bg-blue-600 border-blue-600' : 'bg-gray-50 border-gray-100'
                }`}>
                  {item.customIcon ? (
                    <span className={`text-base font-medium ${item.highlight ? 'text-white' : 'text-gray-400'}`}>{item.customIcon}</span>
                  ) : (
                    <IconComponent className={`w-5 h-5 ${item.highlight ? 'text-white' : 'text-gray-400'}`} />
                  )}
                </div>
                <div className="text-left">
                  <span className={`text-sm font-normal tracking-tight block capitalize ${item.highlight ? 'text-blue-950' : 'text-gray-800'}`}>{item.label}</span>
                  <span className={`text-[8px] font-normal capitalize tracking-widest ${item.highlight ? 'text-blue-600/70' : 'text-gray-400'}`}>
                    Access Module
                  </span>
                </div>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                item.highlight ? 'bg-blue-100/50' : 'bg-gray-50'
              }`}>
                <FiChevronRight className={`w-4 h-4 ${item.highlight ? 'text-blue-600' : 'text-gray-400'}`} />
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Termination Controller */}
      <div className="pt-8">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full py-6 rounded-[32px] bg-rose-50 border border-rose-100 text-rose-600 text-xs font-medium capitalize tracking-widest flex items-center justify-center gap-4 active:scale-95 transition-all hover:bg-rose-600 hover:text-white group shadow-sm"
        >
          <FiLogOut className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
          Terminate Session
        </motion.button>
        
        <div className="mt-8 flex flex-col items-center gap-2 opacity-30">
          <p className="text-[8px] font-normal text-gray-400 capitalize tracking-widest text-center">Powered by Nexora Operational Intelligence</p>
          <p className="text-[7px] font-normal text-gray-400 capitalize tracking-widest text-center">Build v2.4.0-Premium</p>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={async () => {
          try {
            await vendorAuthService.logout();
            toast.success('Logged out');
            navigate('/vendor/login');
          } catch (e) {
            localStorage.clear();
            navigate('/vendor/login');
          }
        }}
        title="Terminate Session?"
        message="Are you sure you want to logout from your vendor account?"
        confirmLabel="Logout"
        cancelLabel="Stay"
        type="danger"
      />
    </div>
  );
};

export default Profile;


