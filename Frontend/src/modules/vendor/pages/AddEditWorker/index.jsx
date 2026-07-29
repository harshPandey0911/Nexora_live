import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiCamera, FiUpload, FiMapPin, FiCheck, FiUser, FiEye, FiEyeOff,
  FiArrowLeft, FiPhone, FiMail, FiLock, FiChevronDown, FiX, FiShield
} from 'react-icons/fi';
import AddressSelectionModal from '../../../user/pages/Checkout/components/AddressSelectionModal';
import { createWorker, updateWorker, getWorkerById } from '../../services/workerService';
import vendorService from '../../services/vendorService';
import { toast } from 'react-hot-toast';
import { z } from "zod";

// Zod schemas
const addWorkerSchema = z.object({
  name: z.string().trim().min(2, "Name is required").regex(/^[a-zA-Z\s]+$/, "Name should only contain alphabets and spaces"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter valid 10-digit phone number starting with 6, 7, 8, or 9"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  serviceCategories: z.array(z.string()).min(1, "Select at least one category"),
  aadhar: z.object({
    number: z.string().regex(/^\d{12}$/, "Aadhar must be 12 digits"),
  }),
  address: z.object({
    addressLine1: z.string().trim().min(1, "Please set location coordinates"),
    city: z.string().trim().min(1, "City is required"),
    state: z.string().trim().min(1, "State is required"),
    pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits")
  })
});

const editWorkerSchema = z.object({
  name: z.string().trim().min(2, "Name is required").regex(/^[a-zA-Z\s]+$/, "Name should only contain alphabets and spaces"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter valid 10-digit phone number starting with 6, 7, 8, or 9"),
  email: z.string().trim().email("Enter a valid email address"),
  serviceCategories: z.array(z.string()).min(1, "Select at least one category"),
});

const AddEditWorker = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    aadhar: {
      number: '',
      document: ''
    },
    serviceCategories: [],
    address: {
      addressLine1: '',
      city: '',
      state: '',
      pincode: ''
    },
    status: 'active',
    profilePhoto: '',
  });

  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [aadharFile, setAadharFile] = useState(null);
  const [aadharPreview, setAadharPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const initData = async () => {
      try {
        const customRes = await vendorService.getMyCustomContent();
        let optedList = [];
        const seenTitles = new Set();

        if (customRes?.success) {
          const allItems = customRes.data?.services || [];
          allItems.forEach(s => {
            const type = s.offeringType === 'PRODUCT' ? 'PRODUCT' : 'SERVICE';
            // Add item title
            if (s.title && !seenTitles.has(s.title.toLowerCase().trim())) {
              seenTitles.add(s.title.toLowerCase().trim());
              optedList.push({ _id: s._id || s.id, title: s.title, offeringType: type });
            }
            const catTitle = s.category || s.categoryId?.title;
            if (catTitle && typeof catTitle === 'string' && !seenTitles.has(catTitle.toLowerCase().trim())) {
              seenTitles.add(catTitle.toLowerCase().trim());
              optedList.push({ _id: catTitle, title: catTitle, offeringType: type });
            }
          });
        }

        if (isEdit) {
          setLoading(true);
          const res = await getWorkerById(id);
          if (res.success) {
            const w = res.data;
            const existingCats = w.serviceCategories || (w.serviceCategory ? [w.serviceCategory] : []);

            existingCats.forEach(catName => {
              if (catName && !seenTitles.has(catName.toLowerCase().trim())) {
                seenTitles.add(catName.toLowerCase().trim());
                optedList.push({ _id: catName, title: catName });
              }
            });

            setFormData({
              name: w.name || '',
              phone: w.phone || '',
              email: w.email || '',
              aadhar: {
                number: w.aadhar?.number || '',
                document: w.aadhar?.document || ''
              },
              serviceCategories: existingCats,
              address: {
                addressLine1: w.address?.addressLine1 || w.address?.fullAddress || '',
                addressLine2: w.address?.addressLine2 || '',
                city: w.address?.city || '',
                state: w.address?.state || '',
                pincode: w.address?.pincode || '',
                fullAddress: w.address?.fullAddress || w.address?.addressLine1 || [w.address?.addressLine1, w.address?.addressLine2, w.address?.city, w.address?.state, w.address?.pincode].filter(Boolean).join(', '),
                lat: w.address?.lat ?? w.location?.lat ?? null,
                lng: w.address?.lng ?? w.location?.lng ?? null
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

        setCategories(optedList);
      } catch (error) {
        console.error('Init error:', error);
        toast.error('Failed to load data');
        setLoading(false);
      }
    };
    initData();
  }, [id, isEdit]);

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
      if (file.type.startsWith('image/')) {
        setAadharPreview(URL.createObjectURL(file));
      } else {
        setAadharPreview(null);
      }
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

    if (location && location.components) {
      location.components.forEach(comp => {
        if (comp.types.includes('locality')) city = comp.long_name;
        if (comp.types.includes('administrative_area_level_1')) state = comp.long_name;
        if (comp.types.includes('postal_code')) pincode = comp.long_name;
        if (comp.types.includes('sublocality')) addressLine2 = comp.long_name;
      });
    }

    const fullAddrFromLocation = location?.address || '';
    const computedFullAddress = [houseNumber, addressLine2, city, state, pincode].filter(Boolean).join(', ');
    const finalFullAddress = fullAddrFromLocation || computedFullAddress;
    const finalAddressLine1 = (houseNumber && houseNumber.length > 5) ? houseNumber : (fullAddrFromLocation || houseNumber);

    setFormData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        addressLine1: finalAddressLine1 || prev.address.addressLine1,
        addressLine2: addressLine2 || prev.address.addressLine2,
        city: city || prev.address.city,
        state: state || prev.address.state,
        pincode: pincode || prev.address.pincode,
        fullAddress: finalFullAddress || prev.address.fullAddress,
        lat: location?.lat !== undefined ? location.lat : prev.address.lat,
        lng: location?.lng !== undefined ? location.lng : prev.address.lng
      }
    }));
    setIsAddressModalOpen(false);
  };

  const handleSubmit = async () => {
    const schema = isEdit ? editWorkerSchema : addWorkerSchema;

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
      toast.error(validationResult.error.issues[0].message);
      return;
    }

    if (!isEdit && !formData.aadhar.document && !aadharFile) {
      toast.error("Aadhar document is required");
      return;
    }

    try {
      setLoading(true);
      setUploading(true);

      let photoUrl = formData.profilePhoto;
      let aadharUrl = formData.aadhar.document;

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

      const payload = {
        ...formData,
        profilePhoto: photoUrl,
        aadhar: {
          ...formData.aadhar,
          document: aadharUrl || 'pending_upload'
        }
      };

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
      const validationErrorMsg = error.response?.data?.errors?.[0]?.msg
        ? `${error.response.data.errors[0].path ? error.response.data.errors[0].path + ': ' : ''}${error.response.data.errors[0].msg}`
        : null;
      toast.error(validationErrorMsg || error.response?.data?.message || 'Failed to save');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 pb-16">
      {/* Header Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs flex flex-row items-center justify-between text-gray-900 border border-gray-100 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/vendor/workers')}
            className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors shrink-0 cursor-pointer"
          >
            <FiArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-bold text-gray-900 tracking-tight leading-tight capitalize truncate">
              {isEdit ? 'Configure Operative Credentials' : 'Register New Operative'}
            </h2>
            <p className="text-gray-500 text-[10px] sm:text-xs font-medium mt-0.5 truncate">
              {isEdit ? 'Update worker specializations and phone number' : 'Create new worker account for task deployments'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-100 shadow-2xs space-y-4 max-w-xl mx-auto">

        {/* Profile Photo Avatar Dropzone */}
        <div className="flex flex-col items-center justify-center py-2">
          <div className="relative">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-gray-200 shadow-2xs bg-gray-50 flex items-center justify-center group relative cursor-pointer">
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
              <input
                id="worker-photo-upload"
                type="file"
                accept="image/*"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handlePhotoChange}
              />
            </div>
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Operative Photo</p>
        </div>

        {/* Personal Details Section */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">
            Personal Credentials
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Full Name *</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter full name"
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs text-gray-900 font-medium transition-all"
                />
                <FiUser className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Phone Number *</label>
              <div className="relative">
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Enter 10-digit mobile number"
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs text-gray-900 font-medium transition-all"
                  maxLength={10}
                />
                <FiPhone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {!isEdit && (
              <div>
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Set Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full pl-9 pr-9 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs text-gray-900 font-medium transition-all"
                  />
                  <FiLock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                  >
                    {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Email Address *</label>
              <div className="relative">
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter email address"
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs text-gray-900 font-medium transition-all"
                />
                <FiMail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Operational Location Section */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">
            Operational Base
          </h3>

          {(() => {
            const addr = formData.address || {};
            const parts = [addr.addressLine1, addr.addressLine2, addr.city, addr.state, addr.pincode ? `PIN: ${addr.pincode}` : null].filter(Boolean);
            const displayAddress = (addr.fullAddress && addr.fullAddress.length > 5)
              ? addr.fullAddress
              : (parts.length > 0 ? parts.join(', ') : 'No location coordinates set');
            const hasCoordinates = addr.lat !== undefined && addr.lat !== null && addr.lng !== undefined && addr.lng !== null;

            return (
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 shadow-2xs space-y-2">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg shrink-0 mt-0.5">
                    <FiMapPin className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 leading-snug">
                      {displayAddress}
                    </p>
                    {hasCoordinates && (
                      <p className="text-[9px] font-bold text-emerald-600 mt-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        GPS: {Number(addr.lat).toFixed(4)}, {Number(addr.lng).toFixed(4)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          <button
            onClick={() => setIsAddressModalOpen(true)}
            className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold border border-gray-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <FiMapPin className="w-3.5 h-3.5 text-blue-600" />
            <span>Set Location Coordinates</span>
          </button>
        </div>

        {/* Expertise Profile Section */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">
            Specialization Skillsets
          </h3>

          <div>
            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Selected Categories *</label>
            <div className="relative">
              <button
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                className="w-full px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between focus:outline-none text-xs font-medium cursor-pointer"
              >
                <span className={`truncate ${formData.serviceCategories.length > 0 ? 'text-gray-900 font-bold' : 'text-gray-400'}`}>
                  {formData.serviceCategories.length > 0
                    ? `${formData.serviceCategories.length} Category Selected`
                    : 'Select Skillsets...'}
                </span>
                <FiChevronDown className={`w-4 h-4 text-blue-600 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCategoryOpen && (
                <React.Fragment>
                  <div className="fixed inset-0 z-10 bg-transparent" onClick={() => setIsCategoryOpen(false)} />
                  <div className="absolute z-20 w-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto p-2">
                    {categories.length > 0 ? (
                      categories.map(cat => (
                        <button
                          key={cat._id || cat.title}
                          type="button"
                          onClick={() => toggleCategory(cat.title)}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50/50 rounded-lg transition-all border-b border-gray-50 last:border-0 flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-700 group-hover:translate-x-0.5 transition-transform">{cat.title}</span>
                            {cat.offeringType && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold tracking-wider ${cat.offeringType === 'PRODUCT' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                                {cat.offeringType}
                              </span>
                            )}
                          </div>
                          {formData.serviceCategories.includes(cat.title) && (
                            <div className="w-2 h-2 rounded-full bg-blue-900 shadow-sm" />
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-4 text-gray-400 text-xs text-center space-y-2">
                        <p>No products or services found in portfolio.</p>
                        <div className="flex justify-center gap-3">
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); navigate('/vendor/my-services'); }}
                            className="text-blue-600 font-semibold underline text-[11px] hover:text-blue-800"
                          >
                            + Add Services
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); navigate('/vendor/my-products'); }}
                            className="text-purple-600 font-semibold underline text-[11px] hover:text-purple-800"
                          >
                            + Add Products
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              )}
            </div>

            {formData.serviceCategories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {formData.serviceCategories.map((cat, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-bold border border-blue-100"
                  >
                    <span>{cat}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleCategory(cat); }}
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

        {/* Identity Verification Section (for new worker) */}
        {!isEdit && (
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">
              Identity Verification
            </h3>

            <div>
              <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">12-Digit Aadhaar Number *</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.aadhar.number}
                  onChange={(e) => handleInputChange('aadhar.number', e.target.value)}
                  placeholder="Enter 12-digit Aadhaar number"
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs text-gray-900 font-medium transition-all"
                  maxLength={12}
                />
                <FiShield className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div
              onClick={() => document.getElementById('worker-aadhar-upload').click()}
              className="border border-dashed border-gray-300 rounded-xl p-4 text-center transition-all hover:border-blue-600 bg-gray-50/50 cursor-pointer relative overflow-hidden"
            >
              <input
                id="worker-aadhar-upload"
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleAadharChange}
              />
              <div className="flex flex-col items-center relative z-10 w-full">
                {aadharPreview || (formData.aadhar.document && !formData.aadhar.document.toLowerCase().endsWith('.pdf') && formData.aadhar.document !== 'data:image/png;base64,placeholder') ? (
                  <div className="flex flex-col items-center gap-2">
                    <img
                      src={aadharPreview || formData.aadhar.document}
                      alt="Identity Preview"
                      className="max-h-36 rounded-lg object-contain shadow-2xs border border-gray-200 bg-white"
                    />
                    <span className="text-[9px] text-gray-500 font-bold">
                      {aadharFile ? aadharFile.name : "Uploaded Document"} (Tap to change)
                    </span>
                  </div>
                ) : aadharFile ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-2xs">
                      <FiCheck className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-gray-900 truncate max-w-[180px]">{aadharFile.name}</span>
                    <span className="text-[9px] text-gray-400">(Tap to change)</span>
                  </div>
                ) : (
                  <>
                    <div className="w-8 h-8 bg-white border border-gray-200 text-gray-400 rounded-lg flex items-center justify-center mb-1 shadow-2xs">
                      <FiUpload className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-gray-800">Upload Aadhaar Identification</span>
                    <span className="text-[9px] text-gray-400 mt-0.5">Government Issued ID Document</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-3">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-2.5 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-2xs active:scale-95 transition-all flex items-center justify-center gap-2 bg-[#00246b] hover:bg-[#001c54] cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (isEdit ? 'Update Credentials' : 'Add Operative')}
          </button>
        </div>
      </div>

      <AddressSelectionModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        address={formData.address?.fullAddress || ''}
        houseNumber={formData.address?.addressLine1 || ''}
        city={formData.address?.city || ''}
        state={formData.address?.state || ''}
        pincode={formData.address?.pincode || ''}
        onHouseNumberChange={(val) => handleInputChange('address.addressLine1', val)}
        onSave={handleAddressSave}
      />
    </div>
  );
};

export default AddEditWorker;
