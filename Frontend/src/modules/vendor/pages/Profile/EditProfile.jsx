import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiSave, FiUser, FiBriefcase, FiPhone, FiMail, FiMapPin, 
  FiChevronDown, FiCamera, FiUpload, FiEdit2, FiArrowLeft, FiActivity, FiCheck, FiX, FiLock
} from 'react-icons/fi';
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
  serviceCategories: z.any().optional(),
});

const EditProfile = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
    phone: '',
    email: '',
    address: '',
    serviceCategories: [],
    profilePhoto: '',
    aadharDocument: '',
    serviceRange: 10,
  });

  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [aadharFile, setAadharFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const [categories, setCategories] = useState([]);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [isFlutter, setIsFlutter] = useState(flutterBridge.isFlutter);

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

  useEffect(() => {
    const loadProfile = async () => {
      try {
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

          localStorage.setItem('vendorProfile', JSON.stringify(v));
          localStorage.setItem('vendorData', JSON.stringify(v));
        } else {
          const vendorProfile = JSON.parse(localStorage.getItem('vendorProfile') || '{}');
          const vendorData = JSON.parse(localStorage.getItem('vendorData') || '{}');
          const storedData = { ...vendorProfile, ...vendorData };

          if (Object.keys(storedData).length > 0) {
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

    if (location.components) {
      location.components.forEach(comp => {
        if (comp.types.includes('locality')) city = comp.long_name;
        if (comp.types.includes('administrative_area_level_1')) state = comp.long_name;
        if (comp.types.includes('postal_code')) pincode = comp.long_name;
        if (comp.types.includes('sublocality')) addressLine2 = comp.long_name;
      });
    }

    setFormData(prev => ({
      ...prev,
      address: {
        ...(typeof prev.address === 'object' ? prev.address : {}),
        fullAddress: location.address,
        addressLine1: houseNumber,
        addressLine2: addressLine2,
        city: city,
        state: state,
        pincode: pincode,
        lat: location.lat,
        lng: location.lng
      }
    }));
    setIsAddressModalOpen(false);
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    let baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    if (!baseUrl) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        baseUrl = 'http://localhost:5000';
      } else {
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
        toast.error('File size should be less than 5MB');
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
        toast.error('File size should be less than 5MB');
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

      return {
        ...prev,
        serviceCategories: updated,
      };
    });
  };

  const handleSubmit = async () => {
    const validationResult = vendorProfileSchema.safeParse({
      name: formData.name,
      businessName: formData.businessName,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      serviceCategories: formData.serviceCategories,
    });

    if (!validationResult.success) {
      const errorMessage = validationResult.error?.errors?.[0]?.message || 'Validation failed';
      toast.error(errorMessage);
      return;
    }

    try {
      setUploading(true);
      let photoUrl = formData.profilePhoto;
      let aadharUrl = formData.aadharDocument;

      if (photoFile) {
        try {
          photoUrl = await uploadFile(photoFile);
        } catch (err) {
          console.error('Photo upload failed:', err);
          toast.error('Failed to upload profile photo');
          setUploading(false);
          return;
        }
      }

      if (aadharFile) {
        try {
          aadharUrl = await uploadFile(aadharFile);
        } catch (err) {
          console.error('Aadhar upload failed:', err);
          toast.error('Failed to upload Aadhar document');
          setUploading(false);
          return;
        }
      }

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
          const updatedProfile = { ...response.vendor, skills: formData.skills };

          localStorage.setItem('vendorProfile', JSON.stringify(updatedProfile));
          localStorage.setItem('vendorData', JSON.stringify(updatedProfile));

          window.dispatchEvent(new Event('vendorProfileUpdated'));
          window.dispatchEvent(new Event('vendorDataUpdated'));

          toast.success('Profile updated successfully!');
          navigate('/vendor/profile');
        } else {
          throw new Error(response.message || 'Failed to update profile');
        }
      } catch (apiError) {
        console.error('API update failed:', apiError);
        toast.error(apiError.message || 'Failed to save profile on server.');
      }

    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setUploading(false);
    }
  };

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
              Store & Partner Profile Details
            </h2>
            <p className="text-gray-500 text-[10px] sm:text-xs font-medium mt-0.5 truncate">
              Update store branding, business entity name and service radius
            </p>
          </div>
        </div>
        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
          <FiEdit2 className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      {/* Main Profile Edit Container */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-100 shadow-2xs space-y-4 max-w-xl mx-auto">
        
        {/* Profile Photo Avatar Dropzone */}
        <div className="flex flex-col items-center justify-center py-2">
          <div className="relative group cursor-pointer" onClick={() => handleImageClick('photo')}>
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-gray-200 shadow-2xs bg-gray-50 flex items-center justify-center relative">
              {photoPreview || formData.profilePhoto ? (
                <img
                  src={photoPreview || formData.profilePhoto}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400">
                  <FiUser className="w-7 h-7" />
                </div>
              )}
              <div className="absolute inset-0 bg-gray-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs">
                <FiCamera className="text-white w-5 h-5" />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-blue-600 text-white shadow-2xs border-2 border-white">
              <FiCamera className="w-3.5 h-3.5" />
            </div>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Partner Logo / Photo</p>
        </div>

        {/* Identity Credentials (Read Only) */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">
            Identity Credentials
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                <span>Partner Name *</span>
                <span className="text-gray-400 font-medium flex items-center gap-1"><FiLock className="w-2.5 h-2.5" /> Locked</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.name}
                  disabled
                  className="w-full pl-9 pr-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-500 font-bold cursor-not-allowed"
                />
                <FiUser className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Business Entity / Store Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => handleInputChange('businessName', e.target.value)}
                  placeholder="e.g. Apex Home Care Solutions"
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs text-gray-900 font-medium transition-all"
                />
                <FiBriefcase className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                  <span>Phone Number *</span>
                  <span className="text-gray-400 font-medium flex items-center gap-1"><FiLock className="w-2.5 h-2.5" /> Locked</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={formData.phone}
                    disabled
                    className="w-full pl-9 pr-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-500 font-bold cursor-not-allowed"
                  />
                  <FiPhone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                  <span>Email Address</span>
                  <span className="text-gray-400 font-medium flex items-center gap-1"><FiLock className="w-2.5 h-2.5" /> Locked</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full pl-9 pr-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-500 font-bold cursor-not-allowed"
                  />
                  <FiMail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Base Location & Radius Section */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">
            Base Location & Radius
          </h3>

          <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 shadow-2xs space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg shrink-0 mt-0.5">
                <FiMapPin className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 leading-snug">
                  {formData.address?.fullAddress ||
                    (typeof formData.address === 'string' ? formData.address : '') ||
                    `${formData.address?.addressLine1 || ''} ${formData.address?.city || ''}` || 'Coordinates Not Set'
                  }
                </p>
                <p className="text-[9px] font-medium text-gray-400 mt-0.5">Verified Primary Store Location</p>
              </div>
            </div>

            <button
              onClick={() => setIsAddressModalOpen(true)}
              className="w-full py-2 bg-white hover:bg-gray-100 text-gray-800 rounded-lg text-xs font-bold border border-gray-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <FiMapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>Recalibrate Base Location</span>
            </button>
          </div>

          <div>
            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Operational Radius (Km) *</label>
            <div className="relative">
              <input
                type="number"
                value={formData.serviceRange}
                onChange={(e) => handleInputChange('serviceRange', e.target.value)}
                placeholder="Distance radius in km"
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs text-gray-900 font-medium transition-all"
              />
              <FiActivity className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <p className="text-[9px] text-gray-400 font-medium mt-1">Maximum service distance radius from store base for dispatch matching.</p>
          </div>
        </div>

        {/* Specializations Section */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">
            Service Specializations
          </h3>

          <div>
            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Opted Categories *</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                className="w-full px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between focus:outline-none text-xs font-medium cursor-pointer"
              >
                <span className={`truncate ${formData.serviceCategories.length > 0 ? 'text-gray-900 font-bold' : 'text-gray-400'}`}>
                  {formData.serviceCategories.length > 0
                    ? `${formData.serviceCategories.length} Categories Opted`
                    : 'Select Specializations...'}
                </span>
                <FiChevronDown className={`w-4 h-4 text-blue-600 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCategoryOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsCategoryOpen(false)} />
                  <div className="absolute z-20 w-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 max-h-52 overflow-y-auto p-1.5">
                    {categories.map((cat, index) => {
                      const isSelected = formData.serviceCategories.includes(cat.title);
                      return (
                        <button
                          key={cat._id || index}
                          type="button"
                          onClick={() => handleCategoryChange(cat.title)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded-lg transition-all border-b border-gray-50 last:border-0 flex items-center justify-between text-xs font-bold text-gray-800 cursor-pointer"
                        >
                          <span>{cat.title}</span>
                          {isSelected && <FiCheck className="w-3.5 h-3.5 text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {formData.serviceCategories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {formData.serviceCategories.map((cat, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-bold border border-blue-100">
                    <span>{cat}</span>
                    <button
                      type="button"
                      onClick={() => handleCategoryChange(cat)}
                      className="text-blue-400 hover:text-blue-700 cursor-pointer"
                    >
                      <FiX className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Identity Verification Document Banner */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <FiCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900">Aadhaar Identity Authenticated</p>
              <p className="text-[9px] text-emerald-700 font-medium">Government identity verified by Nexora Partner Network</p>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={uploading}
            className="flex-1 py-2.5 rounded-xl bg-[#00246b] hover:bg-[#001c54] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
          >
            {uploading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <FiSave className="w-3.5 h-3.5" />
                <span>Save Profile</span>
              </>
            )}
          </button>
        </div>
      </div>

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
    </div>
  );
};

export default EditProfile;
