import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FiUser, FiEdit2, FiMapPin, FiBriefcase, FiPackage, 
  FiStar, FiSettings, FiChevronRight, FiLogOut, FiUsers, 
  FiAlertTriangle, FiShield, FiCheckCircle, FiPhone, FiMail, FiInfo
} from 'react-icons/fi';
import { FaWallet } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { vendorAuthService } from '../../../../services/authService';
import LogoLoader from '../../../../components/common/LogoLoader';
import ConfirmDialog from '../../../../components/common/ConfirmDialog';

const Profile = () => {
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const menuItems = [
    { 
      id: 2, 
      label: 'Wallet & Payouts', 
      desc: 'View balance, payouts & transaction history',
      icon: FaWallet, 
      path: '/vendor/wallet',
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:border-emerald-200'
    },
    { 
      id: 5, 
      label: 'My Ratings & Reviews', 
      desc: 'Track customer feedback & performance score',
      icon: FiStar, 
      path: '/vendor/my-ratings',
      color: 'bg-amber-50 text-amber-600 border-amber-100 hover:border-amber-200'
    },
    { 
      id: 10, 
      label: 'My Services', 
      desc: 'Configure active service offerings & pricing',
      icon: FiBriefcase, 
      path: '/vendor/my-services',
      color: 'bg-blue-50 text-blue-600 border-blue-100 hover:border-blue-200'
    },
    { 
      id: 12, 
      label: 'My Products', 
      desc: 'Manage inventory & product listings',
      icon: FiPackage, 
      path: '/vendor/my-products',
      color: 'bg-purple-50 text-purple-600 border-purple-100 hover:border-purple-200'
    },
    { 
      id: 7, 
      label: 'Store Addresses', 
      desc: 'Manage operational areas & store locations',
      icon: FiMapPin, 
      path: '/vendor/address-management',
      color: 'bg-rose-50 text-rose-600 border-rose-100 hover:border-rose-200'
    },
    { 
      id: 8, 
      label: 'Account Settings', 
      desc: 'Security, notifications & preferences',
      icon: FiSettings, 
      path: '/vendor/settings',
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:border-indigo-200'
    },
    { 
      id: 9, 
      label: 'About Nexora', 
      desc: 'Platform terms, policies & partner guidelines',
      icon: FiInfo, 
      path: '/vendor/about-cleaning-expert',
      color: 'bg-sky-50 text-sky-600 border-sky-100 hover:border-sky-200'
    },
  ];

  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const storedVendorData = JSON.parse(localStorage.getItem('vendorData') || '{}');
      if (storedVendorData && Object.keys(storedVendorData).length > 0) {
        setProfile({
          name: storedVendorData.name || 'Vendor Partner',
          businessName: storedVendorData.businessName || null,
          phone: storedVendorData.phone || '',
          email: storedVendorData.email || '',
          address: storedVendorData.address ?
            (typeof storedVendorData.address === 'string' ? storedVendorData.address :
              `${storedVendorData.address.addressLine1 || ''} ${storedVendorData.address.city || ''}`.trim() || 'Location Not Set')
            : 'Location Not Set',
          rating: storedVendorData.rating || 4.9,
          totalJobs: storedVendorData.totalJobs || 0,
          serviceCategory: storedVendorData.service || 'Partner',
          photo: storedVendorData.profilePhoto || null,
          approvalStatus: storedVendorData.approvalStatus || 'APPROVED',
        });
        setIsLoading(false);
      }

      setError(null);
      try {
        const response = await vendorAuthService.getProfile();
        if (response.success) {
          const vendorData = response.vendor;
          const addressString = vendorData.address
            ? (typeof vendorData.address === 'string' ? vendorData.address :
              `${vendorData.address.addressLine1 || ''} ${vendorData.address.city || ''}`.trim() || 'Location Not Set')
            : 'Location Not Set';

          setProfile({
            name: vendorData.name || 'Vendor Partner',
            businessName: vendorData.businessName || null,
            phone: vendorData.phone || '',
            email: vendorData.email || '',
            address: addressString,
            rating: vendorData.rating || 4.9,
            totalJobs: vendorData.totalJobs || 0,
            serviceCategory: vendorData.service || 'Partner',
            photo: vendorData.profilePhoto || null,
            approvalStatus: vendorData.approvalStatus || 'APPROVED',
          });
          localStorage.setItem('vendorData', JSON.stringify(vendorData));
        }
      } catch (err) {
        console.error('Error fetching vendor profile:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (isLoading) return <LogoLoader />;

  if (error && !profile) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center p-8 max-w-sm mx-auto bg-white rounded-3xl border border-gray-100 shadow-sm">
          <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100">
            <FiAlertTriangle className="w-8 h-8 text-rose-500" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-2">Sync Error</h3>
          <p className="text-xs text-gray-500 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-[#00246b] text-white text-xs font-bold rounded-xl shadow-md active:scale-95 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4 sm:space-y-5 pb-16"
    >
      {/* Master Vendor Profile Card */}
      <div className="bg-gradient-to-br from-[#00246b] via-[#001c54] to-[#0d1b3e] text-white rounded-3xl p-5 sm:p-6 shadow-lg relative overflow-hidden">
        {/* Subtle background Glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {/* Avatar container */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 border-2 border-white/20 overflow-hidden flex items-center justify-center shadow-md backdrop-blur-xs">
                {profile.photo ? (
                  <img src={profile.photo} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-blue-400/20 flex items-center justify-center">
                    <FiUser className="w-8 h-8 sm:w-10 sm:h-10 text-white/70" />
                  </div>
                )}
              </div>
              <button 
                onClick={() => navigate('/vendor/profile/details')}
                className="absolute -bottom-1 -right-1 p-1.5 bg-white text-gray-900 rounded-lg shadow-md hover:bg-gray-100 active:scale-95 transition-all cursor-pointer border border-gray-200"
                title="Edit Profile"
              >
                <FiEdit2 className="w-3 h-3 text-blue-600" />
              </button>
            </div>

            {/* Profile Info */}
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white truncate">{profile.name}</h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold">
                  <FiCheckCircle className="w-3 h-3" />
                  Verified Partner
                </span>
              </div>

              {profile.businessName && (
                <p className="text-xs text-blue-200/90 font-medium truncate">
                  {profile.businessName}
                </p>
              )}

              {/* Stats Badges */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <div className="px-2.5 py-1 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-1.5">
                  <FiStar className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-xs font-bold text-white">{Number(profile.rating || 4.9).toFixed(1)}</span>
                </div>
                <div className="px-2.5 py-1 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-1.5">
                  <FiBriefcase className="w-3.5 h-3.5 text-blue-300" />
                  <span className="text-xs font-bold text-white">{profile.totalJobs} Orders</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/vendor/profile/details')}
            className="w-full sm:w-auto px-4 py-2 bg-white/10 hover:bg-white/20 active:scale-95 transition-all rounded-xl border border-white/20 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer backdrop-blur-md"
          >
            <span>Edit Profile</span>
            <FiChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Access Actions Grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Financials', sub: 'Ledger & Payouts', icon: FaWallet, path: '/vendor/wallet', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
          { label: 'Bookings', sub: 'Active Orders', icon: FiBriefcase, path: '/vendor/jobs', color: 'text-blue-600 bg-blue-50 border-blue-100' },
          { label: 'Team', sub: 'Staff & Fleet', icon: FiUsers, path: '/vendor/workers', color: 'text-purple-600 bg-purple-50 border-purple-100' },
        ].map((item, idx) => (
          <motion.button
            key={idx}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate(item.path)}
            className="bg-white rounded-2xl p-3.5 sm:p-4 border border-gray-100 hover:border-gray-200 shadow-2xs hover:shadow-xs transition-all text-center flex flex-col items-center justify-center cursor-pointer group"
          >
            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center mb-2 border transition-transform group-hover:scale-105 ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-gray-900 block leading-tight">{item.label}</span>
            <span className="text-[9px] text-gray-400 font-medium block mt-0.5">{item.sub}</span>
          </motion.button>
        ))}
      </div>

      {/* Partner Ecosystem Menu Items */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-2xs p-3.5 sm:p-4 space-y-2">
        <div className="flex items-center justify-between px-1 pb-1">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Partner Ecosystem</h3>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        </div>

        <div className="space-y-1.5">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(item.path)}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-gray-100 hover:border-gray-200 bg-white hover:bg-gray-50/70 transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${item.color}`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div className="text-left min-w-0">
                    <span className="text-xs font-bold text-gray-900 block truncate group-hover:text-blue-600 transition-colors">
                      {item.label}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium block truncate mt-0.5">
                      {item.desc}
                    </span>
                  </div>
                </div>

                <div className="w-7 h-7 rounded-lg bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center transition-colors text-gray-400 group-hover:text-blue-600 shrink-0 ml-2">
                  <FiChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Logout Action Card */}
      <div className="pt-2">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full py-3.5 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100/80 border border-rose-100 text-rose-600 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs group"
        >
          <FiLogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Logout Account</span>
        </motion.button>

        <div className="mt-6 flex flex-col items-center gap-1 opacity-40">
          <p className="text-[10px] font-semibold text-gray-500">Nexora Partner Ecosystem • Build v2.4.0</p>
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
        title="Logout of Account?"
        message="Are you sure you want to logout from your vendor account?"
        confirmLabel="Logout"
        cancelLabel="Cancel"
        type="danger"
      />
    </motion.div>
  );
};

export default Profile;
