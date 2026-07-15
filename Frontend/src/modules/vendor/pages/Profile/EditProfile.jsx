import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSave, FiUser, FiBriefcase, FiPhone, FiMail, FiMapPin, FiChevronDown, FiCamera, FiUpload, FiEdit2 } from 'react-icons/fi';
import { vendorTheme as themeColors } from '../../../../theme';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import { publicCatalogService } from '../../../../services/catalogService';
import { vendorAuthService } from '../../../../services/authService';
import AddressSelectionModal from '../../../user/pages/Checkout/components/AddressSelectionModal';
import { toast } from 'react-hot-toast';
import { z } from "zod";
import flutterBridge from '../../../../utils/flutterBridge';

// Zod schema
const vendorProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  businessName: z.string().optional(),
  phone: z.string().regex(/^\+?[0-9]{10,13}$/, "Invalid phone number"),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  address: z.custom((val) => {
    return (typeof val === 'string' && val.trim().length > 0) ||
      (typeof val === 'object' && val !== null && (val.fullAddress || val.addressLine1));
  }, "Address is required"),
  serviceCategories: z.any().optional(), // Relaxed validation for debugging
});

const EditProfile = () => {
  const navigate = useNavigate();

  // Helper function to convert hex to rgba
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
    phone: '',
    email: '',
    address: '',
    serviceCategories: [], // Array for multiple selection
    profilePhoto: '', // URL
    aadharDocument: '', // URL
    serviceRange: 10,
  });

  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [aadharFile, setAadharFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  // Load service categories from admin config (dynamic)
  const [categories, setCategories] = useState([]);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [isFlutter, setIsFlutter] = useState(flutterBridge.isFlutter);

  // Sync flutter bridge state
  useEffect(() => {
    flutterBridge.waitForFlutter().then(ready => {
      setIsFlutter(ready);
    });
  }, []);

  const handleNativeCamera = async (target = 'photo') => {
    const file = await flutterBridge.openCamera();
    if (file) {
      if (target === 'photo') {
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
      } else if (target === 'aadhar') {
        setAadharFile(file);
      }
      flutterBridge.hapticFeedback('success');
    }
  };

  const handleImageClick = (target = 'photo') => {
    if (isFlutter) {
      handleNativeCamera(target);
    } else {
      if (target === 'photo') {
        document.getElementById('photo-upload')?.click();
      } else {
        document.getElementById('aadhar-upload')?.click();
      }
    }
  };

  useEffect(() => {
    const loadServiceCategories = async () => {
      try {
        const catRes = await publicCatalogService.getCategories();
        if (catRes.success) {
          setCategories(catRes.categories || []);
        }
      } catch (error) {
        console.error('Error loading service categories:', error);
      }
    };

    loadServiceCategories();
  }, []);

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
        // Try to get fresh profile from API
        const response = await vendorAuthService.getProfile();

        if (response.success && response.vendor) {
          const v = response.vendor;

          let addressData = v.address;
          if (typeof v.address === 'string') {
            addressData = { fullAddress: v.address };
          } else if (!v.address) {
            addressData = {};
          }

          setFormData({
            name: v.name || '',
            businessName: v.businessName || '',
            phone: v.phone || '',
            email: v.email || '',
            address: addressData,
            serviceCategories: Array.isArray(v.service) ? v.service : (v.service ? [v.service] : []),
            profilePhoto: v.profilePhoto || '',
            aadharDocument: v.aadharDocument || (v.aadhar && v.aadhar.document) || '',
            serviceRange: v.settings?.serviceRange || 10,
          });

          // Update local storage
          localStorage.setItem('vendorProfile', JSON.stringify(v));
          localStorage.setItem('vendorData', JSON.stringify(v));
        } else {
          // Fallback to local storage if API fails
          const vendorProfile = JSON.parse(localStorage.getItem('vendorProfile') || '{}');
          const vendorData = JSON.parse(localStorage.getItem('vendorData') || '{}');
          const storedData = { ...vendorProfile, ...vendorData };

          if (Object.keys(storedData).length > 0) {
            // ... existing fallback logic ...
            let addressData = storedData.address;
            if (typeof storedData.address === 'string') {
              addressData = { fullAddress: storedData.address };
            } else if (!storedData.address) {
              addressData = {};
            }

            setFormData({
              name: storedData.name || '',
              businessName: storedData.businessName || '',
              phone: storedData.phone || '',
              email: storedData.email || '',
              address: addressData,
              serviceCategories: Array.isArray(storedData.service) ? storedData.service : (storedData.service ? [storedData.service] : (storedData.serviceCategory ? [storedData.serviceCategory] : [])),
              profilePhoto: storedData.profilePhoto || '',
              aadharDocument: storedData.aadharDocument || (storedData.aadhar && storedData.aadhar.document) || '',
            });
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };
    loadProfile();
  }, []);

  const handleAddressSave = (houseNumber, location) => {
    let city = '';
    let state = '';
    let pincode = '';
    let addressLine2 = '';

    // Parse Google Maps address components
    if (location.components) {
      location.components.forEach(comp => {
        if (comp.types.includes('locality')) city = comp.long_name;
        if (comp.types.includes('administrative_area_level_1')) state = comp.long_name;
        if (comp.types.includes('postal_code')) pincode = comp.long_name;
        if (comp.types.includes('sublocality')) addressLine2 = comp.long_name;
      });
    }

    // Update FormData with structured address object
    setFormData(prev => ({
      ...prev,
      address: {
        ...(typeof prev.address === 'object' ? prev.address : {}),
        fullAddress: location.address,
        addressLine1: houseNumber, // House/Flat No
        addressLine2: addressLine2, // Sublocality/Street
        city: city,
        state: state,
        pincode: pincode,
        lat: location.lat,
        lng: location.lng
      }
    }));
    setIsAddressModalOpen(false);
  };

  // Upload file helper
  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    let baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    if (!baseUrl) {
      // If no env var, check hostname to determine dev vs prod
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        baseUrl = 'http://localhost:5000';
      } else {
        // In production, fallback to same origin (relative path)
        baseUrl = window.location.origin;
      }
    }
    baseUrl = baseUrl.replace(/\/api$/, '');
    const response = await fetch(`${baseUrl}/api/image/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Upload failed');
    return data.imageUrl;
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size should be less than 5MB');
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleAadharChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size should be less than 5MB');
        return;
      }
      setAadharFile(file);
    }
  };

  const handleInputChange = (field, value) => {
    let filteredValue = value;
    if (field === 'name') {
      filteredValue = value.replace(/[^a-zA-Z\s]/g, '');
    } else if (field === 'email') {
      filteredValue = value.toLowerCase();
    }
    setFormData(prev => ({
      ...prev,
      [field]: filteredValue,
    }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null,
      }));
    }
  };

  const handleCategoryChange = (val) => {
    setFormData(prev => {
      const current = prev.serviceCategories || [];
      const updated = current.includes(val)
        ? current.filter(c => c !== val)
        : [...current, val];

      // When categories change, we might want to filter out skills that no longer apply?
      // For now, let's keep all skills or clear them if categories become empty.
      // Better: Keep skills, user can remove them manually.
      return {
        ...prev,
        serviceCategories: updated,
        // skills: [] // Optional: clear skills on category change? Maybe annoying. Let's keep them.
      };
    });
  };

  const handleSubmit = async () => {
    // Zod Validation
    const validationResult = vendorProfileSchema.safeParse({
      name: formData.name,
      businessName: formData.businessName,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      serviceCategories: formData.serviceCategories,
    });

    if (!validationResult.success) {
      console.log('Validation failed:', validationResult.error);
      const errorMessage = validationResult.error?.errors?.[0]?.message || 'Validation failed';
      toast.error(errorMessage);
      return;
    }

    try {
      setUploading(true);
      let photoUrl = formData.profilePhoto;
      let aadharUrl = formData.aadharDocument;

      // Upload new photo if selected
      if (photoFile) {
        try {
          photoUrl = await uploadFile(photoFile);
        } catch (err) {
          console.error('Photo upload failed:', err);
          alert('Failed to upload profile photo');
          setUploading(false);
          return;
        }
      }

      // Upload Aadhar if selected
      if (aadharFile) {
        try {
          aadharUrl = await uploadFile(aadharFile);
        } catch (err) {
          console.error('Aadhar upload failed:', err);
          alert('Failed to upload Aadhar document');
          setUploading(false);
          return;
        }
      }

      // Prepare payload to match backend structure
      // Prepare payload to match backend structure
      const payload = {
        name: formData.name,
        businessName: formData.businessName,
        address: formData.address,
        serviceCategory: formData.serviceCategories,
        profilePhoto: photoUrl,
        aadharDocument: aadharUrl,
        serviceRange: formData.serviceRange
      };

      try {
        const response = await vendorAuthService.updateProfile(payload);
        if (response.success) {
          const updatedProfile = { ...response.vendor, skills: formData.skills }; // Keep local skills 

          // Update Local Storage
          localStorage.setItem('vendorProfile', JSON.stringify(updatedProfile));
          localStorage.setItem('vendorData', JSON.stringify(updatedProfile));

          // Dispatch events
          window.dispatchEvent(new Event('vendorProfileUpdated'));
          window.dispatchEvent(new Event('vendorDataUpdated'));

          navigate('/vendor/profile');
        } else {
          throw new Error(response.message || 'Failed to update profile');
        }
      } catch (apiError) {
        console.error('API update failed:', apiError);
        // Fallback to local storage if API is mock or fails? No, display error
        alert(apiError.message || 'Failed to save profile on server.');
      }

    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen pb-28 relative" style={{ background: '#FFFFFF' }}>
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
            <FiUser className="w-5 h-5 text-gray-900 rotate-180" />
          </motion.button>
          <h1 className="text-xl font-[1000] text-gray-900 tracking-tight">Modify Identity</h1>
        </div>
        <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-black/[0.02] flex items-center justify-center">
          <FiEdit2 className="w-5 h-5 text-teal-600" />
        </div>
      </header>

      <main className="px-5 pt-8 relative z-10 max-w-lg mx-auto">
        <div className="space-y-8">
          {/* Profile Photo - Master Uplink */}
          <div className="flex flex-col items-center justify-center mb-10">
            <div className="relative group">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-32 h-32 rounded-[44px] overflow-hidden border-4 border-white shadow-2xl cursor-pointer relative"
                onClick={() => handleImageClick('photo')}
              >
                {photoPreview || formData.profilePhoto ? (
                  <img
                    src={photoPreview || formData.profilePhoto}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-teal-50 text-teal-200">
                    <FiUser className="w-12 h-12" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <FiUpload className="w-6 h-6 text-white" />
                </div>
              </motion.div>

              <motion.div
                whileTap={{ scale: 0.9 }}
                onClick={() => handleImageClick('photo')}
                className="absolute -bottom-2 -right-2 p-3 rounded-2xl cursor-pointer shadow-xl transition-all bg-teal-600 text-white border-4 border-white"
              >
                <FiCamera className="w-5 h-5" />
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </motion.div>
            </div>
            <p className="text-[10px] font-medium text-gray-400 capitalize tracking-[0.2em] mt-5 opacity-60">Identity Visualization</p>
          </div>

          <div className="space-y-6">
            {/* Name Input */}
            <div className="group">
              <label className="block text-[10px] font-[1000] text-gray-400 capitalize tracking-[0.2em] mb-2 px-1">
                Full Name <span className="text-rose-500">*</span> (Identity Details cannot be edited)
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center border border-black/[0.02]">
                  <FiUser className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={formData.name}
                  disabled
                  className="w-full pl-16 pr-4 py-4 bg-gray-100 rounded-3xl border border-gray-200 outline-none font-[1000] text-gray-400 text-sm tracking-tight cursor-not-allowed"
                />
              </div>
            </div>

            {/* Business Name Input */}
            <div className="group">
              <label className="block text-[10px] font-[1000] text-gray-400 capitalize tracking-[0.2em] mb-2 px-1">
                Business Entity
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center border border-teal-100/50 text-teal-600">
                  <FiBriefcase className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => handleInputChange('businessName', e.target.value)}
                  placeholder="Enter business name"
                  className={`w-full pl-16 pr-4 py-4 bg-white/70 backdrop-blur-md rounded-3xl border border-white/60 focus:border-teal-500/30 transition-all focus:outline-none focus:ring-4 focus:ring-teal-500/5 font-[1000] text-gray-900 text-sm tracking-tight`}
                />
              </div>
            </div>

            {/* Phone Input */}
            <div className="group">
              <label className="block text-[10px] font-[1000] text-gray-400 capitalize tracking-[0.2em] mb-2 px-1">
                Encryption Link (Mobile) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center border border-teal-100/50 text-teal-600">
                  <FiPhone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Enter contact number"
                  className={`w-full pl-16 pr-4 py-4 bg-white/70 backdrop-blur-md rounded-3xl border transition-all focus:outline-none focus:ring-4 focus:ring-teal-500/5 ${
                    errors.phone ? 'border-rose-200 text-rose-900' : 'border-white/60 focus:border-teal-500/30'
                  } font-[1000] text-gray-900 text-sm tracking-tight`}
                />
              </div>
              {errors.phone && <p className="text-rose-500 text-[9px] font-medium capitalize tracking-widest mt-2 px-1">{errors.phone}</p>}
            </div>

            {/* Email Input */}
            <div className="group">
              <label className="block text-[10px] font-[1000] text-gray-400 capitalize tracking-[0.2em] mb-2 px-1">
                Network Access (Email)
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center border border-teal-100/50 text-teal-600">
                  <FiMail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter email address"
                  className={`w-full pl-16 pr-4 py-4 bg-white/70 backdrop-blur-md rounded-3xl border border-white/60 focus:border-teal-500/30 transition-all focus:outline-none focus:ring-4 focus:ring-teal-500/5 font-[1000] text-gray-900 text-sm tracking-tight`}
                />
              </div>
            </div>

            {/* Address Master Section */}
            <div className="space-y-4">
              <label className="block text-[10px] font-[1000] text-gray-400 capitalize tracking-[0.2em] px-1">
                Geospatial Base <span className="text-rose-500">*</span>
              </label>

              <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center shrink-0 border border-teal-100/50 text-teal-600">
                    <FiMapPin className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-[13px] font-[1000] text-gray-900 leading-relaxed tracking-tight">
                      {formData.address?.fullAddress ||
                        (typeof formData.address === 'string' ? formData.address : '') ||
                        `${formData.address?.addressLine1 || ''} ${formData.address?.city || ''}` || 'Coordinates Not Set'
                      }
                    </p>
                    <p className="text-[9px] font-medium text-gray-400 capitalize tracking-widest mt-1 opacity-60">Verified Service Base</p>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsAddressModalOpen(true)}
                  className="w-full py-4 bg-teal-600 text-white rounded-[24px] font-[1000] text-[10px] capitalize tracking-widest shadow-xl shadow-teal-900/10 flex items-center justify-center gap-3"
                >
                  <FiMapPin className="w-4 h-4" />
                  Recalibrate Location
                </motion.button>
              </div>

              {errors.address && <p className="text-rose-500 text-[9px] font-medium capitalize tracking-widest px-1">{errors.address}</p>}
            </div>

            {/* Category Ecosystem (Multi-Select) */}
            <div className="group relative">
              <label className="block text-[10px] font-[1000] text-gray-400 capitalize tracking-[0.2em] mb-2 px-1">
                Service Specializations <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                className="w-full px-6 py-5 bg-white/70 backdrop-blur-md rounded-[32px] border border-white/60 flex items-center justify-between focus:outline-none focus:ring-4 focus:ring-teal-500/5 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
              >
                <div className="flex flex-wrap gap-2 overflow-hidden">
                  {formData.serviceCategories.length > 0 ? (
                    formData.serviceCategories.map((cat, idx) => (
                      <span key={idx} className="text-[10px] font-[1000] bg-teal-600 text-white px-3 py-1.5 rounded-xl capitalize tracking-widest">
                        {cat}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] font-[1000] text-gray-400 capitalize tracking-widest opacity-60">Provision Capabilities</span>
                  )}
                </div>
                <FiChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-500 ${isCategoryOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCategoryOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsCategoryOpen(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute z-20 w-full mt-4 bg-white/90 backdrop-blur-xl rounded-[32px] shadow-2xl border border-black/[0.03] max-h-72 overflow-y-auto p-3 scrollbar-hide"
                  >
                    {categories.map((cat, index) => {
                      const isSelected = formData.serviceCategories.includes(cat.title);
                      return (
                        <button
                          key={cat._id || index}
                          type="button"
                          onClick={() => handleCategoryChange(cat.title)}
                          className={`w-full text-left px-5 py-4 rounded-2xl mb-1 transition-all flex items-center justify-between group/cat ${
                            isSelected ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/10' : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <span className="text-xs font-[1000] capitalize tracking-widest">{cat.title}</span>
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            isSelected ? 'bg-white border-white text-teal-600' : 'border-gray-200 group-hover/cat:border-teal-500'
                          }`}>
                            {isSelected && <span className="text-[10px]">✓</span>}
                          </div>
                        </button>
                      );
                    })}
                  </motion.div>
                </>
              )}
              {errors.serviceCategories && <p className="text-rose-500 text-[9px] font-medium capitalize tracking-widest mt-2 px-1">{errors.serviceCategories}</p>}
            </div>

            {/* Range Controller */}
            <div className="group">
              <label className="block text-[10px] font-[1000] text-gray-400 capitalize tracking-[0.2em] mb-2 px-1">
                Operational Radius (Km) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center border border-black/[0.02]">
                  <FiActivity className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  value={formData.serviceRange}
                  onChange={(e) => handleInputChange('serviceRange', e.target.value)}
                  placeholder="Distance radius"
                  className="w-full pl-16 pr-4 py-4 bg-white/70 backdrop-blur-md rounded-3xl border border-white/60 focus:border-teal-500/30 transition-all focus:outline-none focus:ring-4 focus:ring-teal-500/5 font-[1000] text-gray-900 text-sm tracking-tight"
                />
              </div>
              <p className="text-[8px] font-medium text-gray-300 capitalize tracking-[0.15em] mt-3 px-1 leading-relaxed">
                Maximum deployment distance from your primary service hub
              </p>
            </div>

            {/* Document Hub - Aadhar */}
            <div className="space-y-4">
              <label className="block text-[10px] font-[1000] text-gray-400 capitalize tracking-[0.2em] px-1">
                Identity Authentication <span className="text-rose-500">*</span>
              </label>

              <div
                className={`relative rounded-[36px] p-8 text-center border bg-gray-50/50 cursor-not-allowed border-gray-200`}
              >
                <div className="flex flex-col items-center">
                  {aadharFile || formData.aadharDocument ? (
                    <div className="w-full">
                      <div className="w-full h-40 rounded-[28px] overflow-hidden border-2 border-white shadow-xl mb-4 relative">
                        <img
                          src={aadharFile ? URL.createObjectURL(aadharFile) : formData.aadharDocument}
                          alt="Aadhar Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-[10px] font-[1000] capitalize tracking-widest shadow-lg shadow-teal-900/10">
                        <FiCheck className="w-4 h-4" />
                        Authenticated
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4 border border-black/[0.02]">
                        <FiUpload className="w-6 h-6 text-gray-400" />
                      </div>
                      <span className="text-[11px] font-[1000] text-gray-900 capitalize tracking-widest block mb-1">No Identity Proof Uploaded</span>
                    </>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Master Actions */}
          <div className="flex gap-4 pb-10">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(-1)}
              className="flex-1 py-5 rounded-[32px] font-[1000] text-[10px] capitalize tracking-[0.2em] text-gray-500 bg-white border border-white/60 shadow-lg shadow-black/5"
            >
              Cancel
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              className="flex-[1.5] py-5 rounded-[32px] font-[1000] text-[10px] capitalize tracking-[0.2em] text-white bg-teal-600 shadow-2xl shadow-teal-900/20 flex items-center justify-center gap-3 disabled:opacity-50"
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <FiSave className="w-4 h-4" />
                  Commit Changes
                </>
              )}
            </motion.button>
          </div>
        </div>
      </main>

      <AddressSelectionModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        address={(typeof formData.address === 'object' ? formData.address?.fullAddress : formData.address) || ''}
        houseNumber={(typeof formData.address === 'object' ? formData.address?.addressLine1 : '') || ''}
        onHouseNumberChange={(val) => {
          if (typeof formData.address === 'object') {
            setFormData(prev => ({
              ...prev,
              address: { ...prev.address, addressLine1: val }
            }));
          }
        }}
        onSave={handleAddressSave}
      />

      <BottomNav />
    </div>
  );
};

export default EditProfile;

