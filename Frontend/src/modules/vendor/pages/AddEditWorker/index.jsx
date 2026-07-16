import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSave, FiX, FiLink, FiUserPlus, FiSearch, FiChevronDown, FiCamera, FiUpload, FiMapPin, FiPlusCircle, FiCheck, FiUser, FiEye, FiEyeOff } from 'react-icons/fi';
import AddressSelectionModal from '../../../user/pages/Checkout/components/AddressSelectionModal';
import { vendorTheme as themeColors } from '../../../../theme';
import Header from '../../components/layout/Header';
import { createWorker, updateWorker, getWorkerById, linkWorker } from '../../services/workerService';
import { publicCatalogService } from '../../../../services/catalogService';
import { toast } from 'react-hot-toast';
import { z } from "zod";

// Zod schemas
const addWorkerSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter valid 10-digit phone number starting with 6, 7, 8, or 9"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  serviceCategories: z.array(z.string()).min(1, "Select at least one category"),
  aadhar: z.object({
    number: z.string().regex(/^\d{12}$/, "Aadhar must be 12 digits"),
    // document: z.any() 
  }),
  address: z.object({
    addressLine1: z.string().trim().min(1, "Please set location coordinates"),
    city: z.string().trim().min(1, "City is required"),
    state: z.string().trim().min(1, "State is required"),
    pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits")
  })
});

const editWorkerSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter valid 10-digit phone number starting with 6, 7, 8, or 9"),
  email: z.string().trim().email("Enter a valid email address"),
  serviceCategories: z.array(z.string()).min(1, "Select at least one category"),
});

const AddEditWorker = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [showPassword, setShowPassword] = useState(false);

  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'link'
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isServicesOpen, setIsServicesOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    aadhar: {
      number: '',
      document: '' // Base64 string ideally
    },
    serviceCategories: [],
    address: {
      addressLine1: '',
      city: '',
      state: '',
      pincode: ''
    },
    status: 'active',
    profilePhoto: '', // URL
  });

  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [aadharFile, setAadharFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const [linkPhone, setLinkPhone] = useState('');

  const [errors, setErrors] = useState({});

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
    const initData = async () => {
      try {
        const catRes = await publicCatalogService.getCategories();
        if (catRes.success) {
          console.log('Loaded Categories:', catRes.categories || []);
          setCategories(catRes.categories || []);
        }

        if (isEdit) {
          setLoading(true);
          const res = await getWorkerById(id);
          if (res.success) {
            const w = res.data;
            setFormData({
              name: w.name || '',
              phone: w.phone || '',
              email: w.email || '',
              aadhar: {
                number: w.aadhar?.number || '',
                document: w.aadhar?.document || ''
              },
              serviceCategories: w.serviceCategories || (w.serviceCategory ? [w.serviceCategory] : []),
              address: {
                addressLine1: w.address?.addressLine1 || '',
                city: w.address?.city || '',
                state: w.address?.state || '',
                pincode: w.address?.pincode || ''
              },
              status: w.status || 'active',
              profilePhoto: w.profilePhoto || ''
            });

            if (w.profilePhoto) {
              setPhotoPreview(w.profilePhoto);
            }
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Init error:', error);
        toast.error('Failed to load data');
        setLoading(false);
      }
    };
    initData();
  }, [id, isEdit]);

  // Upload file helper
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
      filteredValue = value.replace(/[^a-zA-Z\s]/g, '').replace(/\b\w/g, c => c.toUpperCase());
    } else if (field === 'phone') {
      const digits = value.replace(/\D/g, '');
      if (digits.length > 0 && !['6', '7', '8', '9'].includes(digits[0])) {
        filteredValue = formData.phone;
      } else {
        filteredValue = digits.slice(0, 10);
      }
    } else if (field === 'email') {
      filteredValue = value.toLowerCase();
    }
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: filteredValue }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: filteredValue }));
    }
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const toggleCategory = (val) => {
    setFormData(prev => {
      const serviceCategories = prev.serviceCategories.includes(val)
        ? prev.serviceCategories.filter(c => c !== val)
        : [...prev.serviceCategories, val];

      return {
        ...prev,
        serviceCategories
      };
    });
  };

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
        ...prev.address,
        addressLine1: houseNumber,
        addressLine2: addressLine2,
        city: city,
        state: state,
        pincode: pincode,
        fullAddress: location.address
      }
    }));
    setIsAddressModalOpen(false);
  };

  // toggleSkill removed


  const handleSubmit = async () => {
    // Zod Validation depending on mode
    const schema = isEdit ? editWorkerSchema : addWorkerSchema;

    // Construct validation object
    const validationData = {
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      serviceCategories: formData.serviceCategories,
      ...(isEdit ? { email: formData.email } : { 
        password: formData.password, 
        aadhar: { number: formData.aadhar.number },
        address: {
          addressLine1: formData.address.addressLine1,
          city: formData.address.city,
          state: formData.address.state,
          pincode: formData.address.pincode
        }
      })
    };

    const validationResult = schema.safeParse(validationData);

    if (!validationResult.success) {
      toast.error(validationResult.error.errors[0].message);
      return;
    }

    // Additional manual check for Aadhar doc on 'new'
    if (!isEdit && !formData.aadhar.document && !aadharFile) {
      toast.error("Aadhar document is required");
      return;
    }

    try {
      setLoading(true);
      setUploading(true);

      let photoUrl = formData.profilePhoto;
      let aadharUrl = formData.aadhar.document;

      // Upload photo if selected
      if (photoFile) {
        try {
          photoUrl = await uploadFile(photoFile);
        } catch (err) {
          console.error('Photo upload failed:', err);
          toast.error('Failed to upload profile photo');
          setLoading(false);
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
          toast.error('Failed to upload Aadhar document');
          setLoading(false);
          setUploading(false);
          return;
        }
      }

      // Clean payload
      const payload = {
        ...formData,
        profilePhoto: photoUrl,
        aadhar: {
          ...formData.aadhar,
          document: aadharUrl || 'pending_upload' // Ensure strictly that we have something
        }
      };

      if (!payload.aadhar.document && !isEdit) {
        // Should have been caught by validation, but double check
        // If still empty and no file, maybe error?
        // For now let backend handle it or user re-try
      }

      if (isEdit) {
        await updateWorker(id, payload);
        toast.success('Worker updated');
      } else {
        await createWorker(payload);
        toast.success('Worker added');
      }
      window.dispatchEvent(new Event('vendorWorkersUpdated'));
      navigate('/vendor/workers');
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error.response?.data?.message || 'Failed to save');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleLinkWorker = async () => {
    if (!linkPhone.trim() || linkPhone.length < 10) {
      toast.error('Enter valid phone number');
      return;
    }
    try {
      setLoading(true);
      await linkWorker(linkPhone);
      toast.success('Worker linked successfully!');
      window.dispatchEvent(new Event('vendorWorkersUpdated'));
      navigate('/vendor/workers');
    } catch (error) {
      console.error('Link error:', error);
      toast.error(error.response?.data?.message || 'Failed to link worker');
    } finally {
      setLoading(false);
    }
  };

  // selectedCategoriesData and allAvailableSkills removed as they are no longer needed

  return (
    <div className="min-h-screen pb-20 bg-white">
      <main className="px-4 pt-6 max-w-lg mx-auto">
        {/* Tabs */}
        {!isEdit && (
          <div className="flex bg-gray-100 rounded-xl p-1 mb-8">
            <button
              onClick={() => setActiveTab('new')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === 'new'
                ? 'bg-blue-900 text-white shadow-sm'
                : 'text-gray-600 hover:text-blue-900'
                }`}
            >
              <FiUserPlus className="w-4 h-4" />
              Direct Entry
            </button>
            <button
              onClick={() => setActiveTab('link')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === 'link'
                ? 'bg-blue-900 text-white shadow-sm'
                : 'text-gray-600 hover:text-blue-900'
                }`}
            >
              <FiLink className="w-4 h-4" />
              Link Phone
            </button>
          </div>
        )}

        {/* Link Existing Mode */}
        {activeTab === 'link' && !isEdit && (
          <div className="space-y-6 py-4">
            <div className="w-16 h-16 rounded-xl bg-blue-50 flex items-center justify-center mx-auto text-blue-900">
              <FiSearch className="w-8 h-8" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Sync Existing Worker</h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                Enter the verified phone number to instantly link a registered worker.
              </p>
            </div>

            <div>
              <input
                type="tel"
                value={linkPhone}
                onChange={(e) => setLinkPhone(e.target.value)}
                placeholder="0000000000"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-900 focus:bg-white outline-none text-center text-xl font-bold text-gray-900"
                maxLength={10}
              />
            </div>

            <button
              onClick={handleLinkWorker}
              disabled={loading}
              className="w-full py-3 text-white rounded-xl text-xs font-semibold bg-blue-900 hover:bg-blue-800 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Searching...' : 'Search & Link'}
            </button>
          </div>
        )}

        {/* Create / Edit Mode */}
        {(activeTab === 'new' || isEdit) && (
          <div className="space-y-6">
            
            {/* Profile Photo Upload */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 shadow-sm bg-white flex items-center justify-center group relative">
                  {photoPreview || formData.profilePhoto ? (
                    <img
                      src={photoPreview || formData.profilePhoto}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-blue-900">
                      <FiUserPlus className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-blue-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                    <FiCamera className="text-white w-5 h-5" />
                  </div>
                  <input
                    id="worker-photo-upload"
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handlePhotoChange}
                  />
                </div>
              </div>
              <p className="text-gray-500 text-xs mt-3">Worker Photo</p>
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Personal Details</h4>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 ml-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter full name"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:border-blue-900 focus:bg-white outline-none text-sm text-gray-900 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 ml-1">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="Enter phone number"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:border-blue-900 focus:bg-white outline-none text-sm text-gray-900 transition-all"
                    maxLength={10}
                  />
                </div>

                {!isEdit && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 ml-1">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        placeholder="Set password (min 6 characters)"
                        className="w-full pl-4 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:border-blue-900 focus:bg-white outline-none text-sm text-gray-900 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                      >
                        {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 ml-1">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Enter email address"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:border-blue-900 focus:bg-white outline-none text-sm text-gray-900 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Address Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Operational Location</h4>

              <div className="p-4 bg-blue-50/30 rounded-xl border border-blue-100/30 flex items-start gap-3">
                <FiMapPin className="text-blue-900 w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-xs font-medium text-gray-800 leading-relaxed">
                  {formData.address?.fullAddress ||
                    (formData.address?.addressLine1 ? `${formData.address.addressLine1}, ${formData.address.city}` : 'No address assigned')
                  }
                </p>
              </div>

              <button
                onClick={() => setIsAddressModalOpen(true)}
                className="w-full py-2.5 bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
              >
                Set Location Coordinates
              </button>
            </div>

            {/* Work Profile */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Expertise Profile</h4>

              {/* Category Dropdown */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block ml-1">Specializations</label>
                <div className="relative">
                  <button
                    onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                    className="w-full px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between focus:border-blue-900 outline-none"
                  >
                    <span className={`text-xs font-medium truncate ${formData.serviceCategories.length > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                      {formData.serviceCategories.length > 0
                        ? `${formData.serviceCategories.length} Selected`
                        : 'Select Skillsets'}
                    </span>
                    <FiChevronDown className={`w-4 h-4 text-blue-900 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isCategoryOpen && (
                    <React.Fragment>
                      <div className="fixed inset-0 z-10 bg-transparent" onClick={() => setIsCategoryOpen(false)} />
                      <div className="absolute z-20 w-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto p-2">
                        {categories.length > 0 ? (
                          categories.map(cat => (
                            <button
                              key={cat._id || cat.title}
                              onClick={() => toggleCategory(cat.title)}
                              className="w-full text-left px-4 py-2.5 hover:bg-blue-50/50 rounded-lg transition-all border-b border-gray-50 last:border-0 flex items-center justify-between group"
                            >
                              <span className="text-xs font-medium text-gray-700 group-hover:translate-x-0.5 transition-transform">{cat.title}</span>
                              {formData.serviceCategories.includes(cat.title) && (
                                <div className="w-2 h-2 rounded-full bg-blue-900 shadow-sm" />
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-4 text-gray-400 text-xs text-center">No categories found</div>
                        )}
                      </div>
                    </React.Fragment>
                  )}
                </div>

                {/* Selected Categories Tags */}
                {formData.serviceCategories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {formData.serviceCategories.map((cat, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-900 rounded-md text-xs font-medium border border-blue-100"
                      >
                        {cat}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleCategory(cat); }}
                          className="ml-2 text-blue-300 hover:text-blue-900 transition-colors"
                        >
                          <FiX className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Documents */}
            {!isEdit && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Identity Verification</h4>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 ml-1">Aadhar Identification</label>
                  <input
                    type="text"
                    value={formData.aadhar.number}
                    onChange={(e) => handleInputChange('aadhar.number', e.target.value)}
                    placeholder="Enter 12-digit Aadhar number"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:border-blue-900 focus:bg-white outline-none text-sm text-gray-900 transition-all"
                    maxLength={12}
                  />
                </div>

                <div 
                  onClick={() => document.getElementById('worker-aadhar-upload').click()}
                  className="border border-dashed border-gray-300 rounded-lg p-6 text-center transition-all hover:border-blue-900 bg-gray-50/50 group cursor-pointer relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-blue-900/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <input
                    id="worker-aadhar-upload"
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleAadharChange}
                  />
                  <div className="flex flex-col items-center relative z-10">
                    {aadharFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 bg-blue-900 text-white rounded-lg flex items-center justify-center shadow-sm">
                          <FiCheck className="w-4 h-4" />
                        </div>
                        <span className="text-xs text-gray-800 truncate max-w-[180px]">{aadharFile.name}</span>
                      </div>
                    ) : formData.aadhar.document && formData.aadhar.document !== 'data:image/png;base64,placeholder' ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 bg-white border border-blue-100 text-blue-900 rounded-lg flex items-center justify-center shadow-sm">
                          <FiUpload className="w-4 h-4" />
                        </div>
                        <p className="text-xs text-blue-900">Document Verified</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 bg-white border border-gray-200 text-gray-400 rounded-lg flex items-center justify-center mb-2 group-hover:scale-105 transition-transform shadow-sm">
                          <FiUpload className="w-4 h-4" />
                        </div>
                        <span className="text-xs text-gray-500">Upload Digital Identity</span>
                        <span className="text-[10px] text-gray-400 mt-1">Government Issued ID</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3.5 text-white rounded-lg text-sm font-semibold shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (isEdit ? 'Update Credentials' : 'Add Worker')}
            </button>
          </div>
        )}
      </main >

      <AddressSelectionModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        address={formData.address?.fullAddress || ''}
        houseNumber={formData.address?.addressLine1 || ''}
        onHouseNumberChange={(val) => handleInputChange('address.addressLine1', val)}
        onSave={handleAddressSave}
      />
    </div >
  );
};

export default AddEditWorker;
