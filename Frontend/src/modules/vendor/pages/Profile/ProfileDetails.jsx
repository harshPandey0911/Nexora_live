import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUser, FiEdit2, FiMapPin, FiPhone, FiMail, FiBriefcase, FiArrowLeft } from 'react-icons/fi';
import { vendorAuthService } from '../../../../services/authService';
import { vendorTheme as themeColors } from '../../../../theme';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';

const ProfileDetails = () => {
  const navigate = useNavigate();

  // Helper function to convert hex to rgba
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const [profile, setProfile] = useState({
    name: '',
    businessName: '',
    phone: '',
    email: '',
    address: '',
    serviceCategory: '',
    profilePhoto: '',
  });

  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const bgStyle = themeColors.backgroundGradient;

    if (html) html.style.background = bgStyle;
    if (body) body.style.background = bgStyle;
    if (root) root.style.background = bgStyle;

    return () => {
      if (html) html.style.background = '';
      if (body) body.style.background = '';
      if (root) root.style.background = '';
    };
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        // Optimistic load from local storage
        const localVendorData = JSON.parse(localStorage.getItem('vendorData') || '{}');
        const vendorProfile = JSON.parse(localStorage.getItem('vendorProfile') || '{}');

        // Merge sources, preferring vendorData (which might be fresher from other pages)
        const storedData = { ...vendorProfile, ...localVendorData };

        if (Object.keys(storedData).length > 0) {
          // Format address if object
          let addressString = storedData.address;
          if (typeof storedData.address === 'object' && storedData.address !== null) {
            if (storedData.address.fullAddress) {
              addressString = storedData.address.fullAddress;
            } else {
              addressString = `${storedData.address.addressLine1 || ''} ${storedData.address.addressLine2 || ''} ${storedData.address.city || ''} ${storedData.address.state || ''} ${storedData.address.pincode || ''}`.trim() || 'Not set';
            }
          }

          setProfile(prev => ({
            ...prev,
            name: storedData.name || 'Vendor Name',
            businessName: storedData.businessName || null,
            phone: storedData.phone || '',
            email: storedData.email || '',
            address: addressString || 'Not set',
            serviceCategory: storedData.serviceCategory || storedData.service || '',
            profilePhoto: storedData.profilePhoto || ''
          }));
        }

        // Fetch fresh data from API
        const response = await vendorAuthService.getProfile();
        if (response.success) {
          const apiData = response.vendor;

          // Format address
          let formattedAddress = apiData.address;
          if (typeof apiData.address === 'object' && apiData.address !== null) {
            if (apiData.address.fullAddress) {
              formattedAddress = apiData.address.fullAddress;
            } else {
              formattedAddress = `${apiData.address.addressLine1 || ''} ${apiData.address.addressLine2 || ''} ${apiData.address.city || ''} ${apiData.address.state || ''} ${apiData.address.pincode || ''}`.trim() || 'Not set';
            }
          }

          const newProfile = {
            name: apiData.name,
            businessName: apiData.businessName,
            phone: apiData.phone,
            email: apiData.email,
            address: formattedAddress,
            serviceCategory: Array.isArray(apiData.service) ? apiData.service.join(', ') : (apiData.service || ''),
            profilePhoto: apiData.profilePhoto
          };

          setProfile(prev => ({ ...prev, ...newProfile }));

          // Update local storage
          localStorage.setItem('vendorData', JSON.stringify(apiData));
          localStorage.setItem('vendorProfile', JSON.stringify({ ...storedData, ...apiData }));
        }

      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };

    loadProfile();
    window.addEventListener('vendorProfileUpdated', loadProfile);

    return () => {
      window.removeEventListener('vendorProfileUpdated', loadProfile);
    };
  }, []);

  return (
    <div className="p-4 lg:p-6 min-h-screen pb-28 relative" style={{ background: '#FFFFFF' }}>
      {/* Premium Background Pattern */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0"
          style={{
            background: `
              radial-gradient(at 0% 0%, rgba(13, 148, 136, 0.1) 0%, transparent 70%),
              radial-gradient(at 100% 100%, rgba(13, 148, 136, 0.05) 0%, transparent 75%),
              #F8FAFC
            `
          }}
        />
      </div>

      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/40 border-b border-black/[0.03] px-6 py-5 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-white shadow-sm border border-black/[0.02] flex items-center justify-center"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-900" />
          </motion.button>
          <h1 className="text-xl font-[1000] text-gray-900 tracking-tight">Identity Details</h1>
        </div>
        <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-black/[0.02] flex items-center justify-center">
          <FiBriefcase className="w-5 h-5 text-teal-600" />
        </div>
      </header>

      <main className="px-5 pt-8 relative z-10 max-w-lg mx-auto">
        {/* Header Section with Master Edit Trigger */}
        <div className="flex items-center justify-between mb-8 px-2">
          <div>
            <h3 className="text-[10px] font-[1000] text-gray-400 capitalize tracking-[0.25em]">Master Profile</h3>
            <p className="text-[8px] font-medium text-teal-600 capitalize tracking-widest mt-0.5">Verified Data Architecture</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/vendor/profile/edit')}
            className="px-6 py-2.5 rounded-full bg-black text-white text-[10px] font-[1000] capitalize tracking-widest shadow-xl shadow-black/10 flex items-center gap-2"
          >
            <FiEdit2 className="w-3.5 h-3.5" />
            Update
          </motion.button>
        </div>

        {/* Master Avatar Hub */}
        <div className="flex justify-center mb-10">
          <div className="relative group">
            <div className="w-32 h-32 rounded-[44px] p-1 bg-white shadow-2xl relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
              <div className="w-full h-full rounded-[40px] overflow-hidden bg-gray-50 flex items-center justify-center border border-black/[0.03]">
                {profile.profilePhoto ? (
                  <img
                    src={profile.profilePhoto}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-teal-50 flex items-center justify-center">
                    <FiUser className="w-12 h-12 text-teal-200" />
                  </div>
                )}
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-teal-600 shadow-xl flex items-center justify-center border-4 border-white text-white">
              <FiUser className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="space-y-6 mb-12">
          {/* Data Clusters */}
          {[
            {
              group: 'Corporate Identity',
              items: [
                { label: 'Master Identity', value: profile.name, icon: FiUser },
                { label: 'Corporate Entity', value: profile.businessName, icon: FiBriefcase }
              ]
            },
            {
              group: 'Communication Channels',
              items: [
                { label: 'Encryption Link (Mobile)', value: profile.phone, icon: FiPhone },
                { label: 'Network Access (Email)', value: profile.email, icon: FiMail },
                { label: 'Geospatial Coordinates', value: profile.address, icon: FiMapPin }
              ]
            }
          ].map((cluster, cIdx) => (
            <div key={cIdx} className="bg-white/70 backdrop-blur-md rounded-[36px] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-white/60">
              <h4 className="text-[10px] font-[1000] text-gray-400 capitalize tracking-[0.2em] mb-6 opacity-60 px-1">{cluster.group}</h4>
              <div className="space-y-6">
                {cluster.items.map((item, iIdx) => (
                  <div key={iIdx} className="flex items-start gap-5 group">
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center shrink-0 border border-black/[0.02] group-hover:bg-teal-600 group-hover:text-white transition-all duration-500">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-[9px] font-medium text-gray-400 capitalize tracking-widest mb-1 opacity-50">{item.label}</p>
                      <p className="text-gray-900 font-[1000] text-sm tracking-tight leading-relaxed">{item.value || 'NOT_ASSIGNED'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Professional Competencies */}
          <div className="bg-white/70 backdrop-blur-md rounded-[36px] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-white/60">
            <h4 className="text-[10px] font-[1000] text-gray-400 capitalize tracking-[0.2em] mb-6 opacity-60 px-1">Active Specializations</h4>
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center shrink-0 border border-teal-100/50 text-teal-600">
                <FiBriefcase className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-[9px] font-medium text-gray-400 capitalize tracking-widest mb-3 opacity-50">Operational Categories</p>
                <div className="flex flex-wrap gap-2">
                  {profile.serviceCategory && (Array.isArray(profile.serviceCategory) ? profile.serviceCategory : profile.serviceCategory.split(', ')).filter(Boolean).length > 0 ? (
                    (Array.isArray(profile.serviceCategory) ? profile.serviceCategory : profile.serviceCategory.split(', ')).filter(Boolean).map((cat, i) => (
                      <span key={i} className="inline-flex items-center px-4 py-2 rounded-xl bg-teal-600 text-white text-[10px] font-[1000] capitalize tracking-widest shadow-lg shadow-teal-900/10">
                        {cat}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-300 text-[10px] font-medium capitalize tracking-widest italic">Provision Pending</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default ProfileDetails;

