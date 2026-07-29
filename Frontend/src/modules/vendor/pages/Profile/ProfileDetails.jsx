import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiEdit2, FiMapPin, FiPhone, FiMail, FiBriefcase, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import { vendorAuthService } from '../../../../services/authService';
import Header from '../../components/layout/Header';

const ProfileDetails = () => {
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    name: '',
    businessName: '',
    phone: '',
    email: '',
    address: '',
    serviceCategory: '',
    profilePhoto: '',
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const localVendorData = JSON.parse(localStorage.getItem('vendorData') || '{}');
        const vendorProfile = JSON.parse(localStorage.getItem('vendorProfile') || '{}');

        const storedData = { ...vendorProfile, ...localVendorData };

        if (Object.keys(storedData).length > 0) {
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

        const response = await vendorAuthService.getProfile();
        if (response.success) {
          const apiData = response.vendor;

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
    <div className="space-y-3 sm:space-y-4 pb-16">
      {/* Header Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs flex flex-row items-center justify-between text-gray-900 border border-gray-100 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors shrink-0 cursor-pointer"
          >
            <FiArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-bold text-gray-900 tracking-tight leading-tight capitalize truncate">
              Partner Identity Profile
            </h2>
            <p className="text-gray-500 text-[10px] sm:text-xs font-medium mt-0.5 truncate">
              View verified store details and credentials
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/vendor/profile/edit')}
          className="px-3 py-1.5 bg-[#00246b] hover:bg-[#001c54] text-white text-xs font-bold rounded-xl uppercase tracking-wider shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <FiEdit2 className="w-3.5 h-3.5" />
          <span>Edit</span>
        </button>
      </div>

      <main className="space-y-3 sm:space-y-4 max-w-xl mx-auto">
        {/* Profile Card Summary */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-2xs flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 shadow-2xs bg-gray-50 flex items-center justify-center shrink-0">
            {profile.profilePhoto ? (
              <img src={profile.profilePhoto} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <FiUser className="w-8 h-8 text-gray-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900 truncate">{profile.name}</h3>
              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase">
                Verified
              </span>
            </div>
            {profile.businessName && (
              <p className="text-xs text-gray-500 font-medium truncate mt-0.5">{profile.businessName}</p>
            )}
            <p className="text-[10px] text-blue-600 font-bold mt-1 uppercase tracking-wider">{profile.serviceCategory || 'Partner'}</p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-100 shadow-2xs space-y-3.5">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">
            Contact & Address Details
          </h4>

          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-3">
              <FiUser className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Full Name</span>
                <span className="font-bold text-gray-900">{profile.name}</span>
              </div>
            </div>

            {profile.businessName && (
              <div className="flex items-start gap-3">
                <FiBriefcase className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Business Entity</span>
                  <span className="font-bold text-gray-900">{profile.businessName}</span>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <FiPhone className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Mobile Phone</span>
                <span className="font-bold text-gray-900">{profile.phone || 'Not set'}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FiMail className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Email Address</span>
                <span className="font-bold text-gray-900">{profile.email || 'Not set'}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FiMapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Store Base Location</span>
                <span className="font-bold text-gray-900">{profile.address || 'Not set'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Specialization Categories */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-100 shadow-2xs space-y-2">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">
            Active Specializations
          </h4>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {profile.serviceCategory && (Array.isArray(profile.serviceCategory) ? profile.serviceCategory : profile.serviceCategory.split(', ')).filter(Boolean).length > 0 ? (
              (Array.isArray(profile.serviceCategory) ? profile.serviceCategory : profile.serviceCategory.split(', ')).filter(Boolean).map((cat, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                  {cat}
                </span>
              ))
            ) : (
              <span className="text-gray-400 text-xs italic">No categories opted</span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfileDetails;
