import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { FiUser, FiMail, FiPhone, FiFileText, FiUpload, FiX, FiArrowRight, FiChevronLeft, FiCheckCircle, FiCamera, FiUserPlus, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { vendorTheme as themeColors } from '../../../theme';
import { register, sendOTP as sendVendorOTP, verifyLogin } from '../services/authService';
import LogoLoader from '../../../components/common/LogoLoader';
import Logo from '../../../components/common/Logo';
import { compressImage } from '../../../utils/imageCompression';

import { z } from "zod";

// Zod schema for Vendor Signup
const vendorSignupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").regex(/^[a-zA-Z\s]+$/, "Name can only contain letters"),
  email: z.string().email("Please enter a valid email address"),
  phoneNumber: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian phone number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  aadhar: z.string().regex(/^\d{12}$/, "Aadhar number must be exactly 12 digits"),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format (e.g. ABCDE1234F)")
});

const VendorSignup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState(() => {
    try {
      const saved = sessionStorage.getItem('vendor_signup_form');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          name: parsed.name || '',
          email: parsed.email || '',
          phoneNumber: parsed.phoneNumber || '',
          password: parsed.password || '',
          aadhar: parsed.aadhar || '',
          pan: parsed.pan || '',
          service: parsed.service || '',
          documents: []
        };
      }
    } catch (e) {}
    return {
      name: '',
      email: '',
      phoneNumber: '',
      password: '',
      aadhar: '',
      pan: '',
      service: '',
      documents: []
    };
  });
  const [isLoading, setIsLoading] = useState(false);
  const [documentPreview, setDocumentPreview] = useState({});
  const [uploadingDocs, setUploadingDocs] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(() => {
    return sessionStorage.getItem('vendor_signup_agreeToTerms') === 'true';
  });

  // Sync signup data to sessionStorage so navigating to Terms/Privacy never clears it
  useEffect(() => {
    try {
      sessionStorage.setItem('vendor_signup_form', JSON.stringify({
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        password: formData.password,
        aadhar: formData.aadhar,
        pan: formData.pan,
        service: formData.service
      }));
    } catch (e) {}
  }, [formData]);

  useEffect(() => {
    sessionStorage.setItem('vendor_signup_agreeToTerms', String(agreeToTerms));
  }, [agreeToTerms]);

  // Refs for auto-focus
  const nameInputRef = useRef(null);

  // Unified Flow: Pre-fill
  useEffect(() => {
    if (location.state?.phone) {
      setFormData(prev => ({ ...prev, phoneNumber: location.state.phone }));
    }
  }, [location.state]);

  // Clear any existing vendor tokens on page load
  useEffect(() => {
    localStorage.removeItem('vendorAccessToken');
    localStorage.removeItem('vendorRefreshToken');
    localStorage.removeItem('vendorData');
  }, []);

  // Auto-focus logic
  useEffect(() => {
    if (nameInputRef.current) {
      setTimeout(() => nameInputRef.current.focus(), 100);
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let filteredValue = value;
    if (name === 'name') {
      filteredValue = value.replace(/[^a-zA-Z\s]/g, '');
    } else if (name === 'email') {
      filteredValue = value.toLowerCase();
    }
    setFormData(prev => ({
      ...prev,
      [name]: filteredValue
    }));
  };

  const handleDocumentUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image or PDF');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error('File size should be less than 15MB');
      return;
    }

    setUploadingDocs(prev => ({ ...prev, [type]: true }));
    const loadingToast = toast.loading("Processing file...");

    try {
      let fileToUpload = file;
      let previewUrl = '';

      if (file.type.startsWith('image/')) {
        try {
          const compressedFile = await compressImage(file, {
            maxWidth: 800,
            maxHeight: 800,
            quality: 0.6
          });
          fileToUpload = compressedFile;
          toast.dismiss(loadingToast);
        } catch (compressionError) {
          console.error("Compression failed, using original file", compressionError);
          toast.error("Compression failed, using original");
        }
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        previewUrl = reader.result;
        setFormData(prev => ({
          ...prev,
          documents: [...prev.documents.filter(d => d.type !== type), { type, file: fileToUpload, url: previewUrl }]
        }));
        setDocumentPreview(prev => ({
          ...prev,
          [type]: previewUrl
        }));
        setUploadingDocs(prev => ({ ...prev, [type]: false }));
        toast.success("Image uploaded", { duration: 2000 });
      };

      reader.onerror = () => {
        console.error("FileReader failed");
        toast.error("Failed to read file");
        setUploadingDocs(prev => ({ ...prev, [type]: false }));
      };

      reader.readAsDataURL(fileToUpload);

    } catch (error) {
      console.error("Upload processing error", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to process file");
      setUploadingDocs(prev => ({ ...prev, [type]: false }));
    }
  };

  const removeDocument = (type) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.filter(d => d.type !== type)
    }));
    setDocumentPreview(prev => {
      const newPreview = { ...prev };
      delete newPreview[type];
      return newPreview;
    });
  };

  const handleDetailsSubmit = async (e) => {
    e.preventDefault();

    if (!agreeToTerms) {
      toast.error('You must agree to the Terms & Conditions and Privacy Policy');
      return;
    }

    // Zod Validation
    const validationResult = vendorSignupSchema.safeParse({
      name: formData.name,
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      password: formData.password,
      aadhar: formData.aadhar,
      pan: formData.pan
    });

    if (!validationResult.success) {
      toast.dismiss();
      toast.error(validationResult.error.issues[0].message);
      return;
    }

    const hasAadharDoc = formData.documents.some(d => d.type === 'aadhar');
    const hasAadharBackDoc = formData.documents.some(d => d.type === 'aadharBack');
    const hasPanDoc = formData.documents.some(d => d.type === 'pan');
    if (!hasAadharDoc) { toast.error('Please upload Aadhar Front document'); return; }
    if (!hasAadharBackDoc) { toast.error('Please upload Aadhar Back document'); return; }
    if (!hasPanDoc) { toast.error('Please upload PAN document'); return; }

    setIsLoading(true);

    try {
      const aadharDoc = formData.documents.find(d => d.type === 'aadhar')?.url || null;
      const aadharBackDoc = formData.documents.find(d => d.type === 'aadharBack')?.url || null;
      const panDoc = formData.documents.find(d => d.type === 'pan')?.url || null;
      const otherDocs = formData.documents.filter(d => d.type === 'other').map(d => d.url);

      const registerData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phoneNumber,
        password: formData.password,
        aadhar: formData.aadhar,
        pan: formData.pan,
        service: [],
        aadharDocument: aadharDoc,
        aadharBackDocument: aadharBackDoc,
        panDocument: panDoc,
        otherDocuments: otherDocs
      };

      // Store registration details in sessionStorage (fallback)
      try {
        sessionStorage.setItem('pendingVendorRegistration', JSON.stringify(registerData));
      } catch (quotaError) {
        console.warn('sessionStorage quota exceeded, relying on navigation state:', quotaError);
      }

      toast.success(
        <div className="flex flex-col">
          <span className="font-normal">Details Configured!</span>
          <span className="text-xs">Please complete the training module.</span>
        </div>,
        { icon: <FiCheckCircle className="text-[#00a6a6]" />, duration: 5000 }
      );
      navigate('/vendor/training', { state: { registerData } });
    } catch (error) {
      console.error('Details submit error:', error);
      toast.error(`Failed to configure registration details: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const brandColor = themeColors.brand?.teal || '#347989';

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 bg-gray-50"
    >
      <div className="w-full max-w-4xl">
        {/* White Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Logo className="h-24 w-24 transform hover:scale-110 transition-transform duration-500" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-normal text-gray-900 text-center mb-2">
            Vendor Enrollment
          </h1>
          <p className="text-gray-600 text-center mb-10">
            Join our network and grow your professional service business
          </p>

          {/* Form Content */}
          <form onSubmit={handleDetailsSubmit} className="space-y-12">
            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Identity details */}
              <div className="space-y-6">
                <h3 className="text-sm font-normal text-gray-400 capitalize tracking-widest border-b pb-2">Professional Identity</h3>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Legal Name</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                      <FiUser className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      ref={nameInputRef}
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="John Doe"
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-gray-900 font-medium"
                      onFocus={(e) => {
                        e.target.style.borderColor = themeColors.button;
                        e.target.style.boxShadow = `0 0 0 3px rgba(0, 166, 166, 0.1)`;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                      <FiMail className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="john@example.com"
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-gray-900 font-medium"
                      onFocus={(e) => {
                        e.target.style.borderColor = themeColors.button;
                        e.target.style.boxShadow = `0 0 0 3px rgba(0, 166, 166, 0.1)`;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                      <FiLock className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="••••••••"
                      className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-gray-900 font-medium"
                      onFocus={(e) => {
                        e.target.style.borderColor = themeColors.button;
                        e.target.style.boxShadow = `0 0 0 3px rgba(0, 166, 166, 0.1)`;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none z-10"
                    >
                      {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Number</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 font-normal border-r pr-3">
                      +91
                    </div>
                    <input
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData(p => ({ ...p, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                      placeholder="0000000000"
                      className="w-full pl-16 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-gray-900 font-medium tracking-wider"
                      onFocus={(e) => {
                        e.target.style.borderColor = themeColors.button;
                        e.target.style.boxShadow = `0 0 0 3px rgba(0, 166, 166, 0.1)`;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                      required
                    />
                  </div>
                </div>

                {/* Aadhar */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Aadhar Number</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                      <FiFileText className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={formData.aadhar}
                      onChange={(e) => setFormData(p => ({ ...p, aadhar: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                      placeholder="1234 5678 9012"
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-gray-900 font-medium tracking-widest"
                      onFocus={(e) => {
                        e.target.style.borderColor = themeColors.button;
                        e.target.style.boxShadow = `0 0 0 3px rgba(0, 166, 166, 0.1)`;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                      required
                    />
                  </div>
                </div>

                {/* PAN */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PAN Card Number</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                      <FiFileText className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={formData.pan}
                      onChange={(e) => setFormData(p => ({ ...p, pan: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) }))}
                      placeholder="ABCDE1234F"
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-gray-900 font-medium tracking-widest"
                      onFocus={(e) => {
                        e.target.style.borderColor = themeColors.button;
                        e.target.style.boxShadow = `0 0 0 3px rgba(0, 166, 166, 0.1)`;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div className="space-y-6">
                <h3 className="text-sm font-normal text-gray-400 capitalize tracking-widest border-b pb-2">Verification Documents</h3>

                <div className="grid grid-cols-1 gap-6">
                  {/* Aadhar Front */}
                  <div className="space-y-2">
                    <p className="text-xs font-normal text-gray-600">Aadhar Front</p>
                    {documentPreview.aadhar ? (
                      <div className="relative group overflow-hidden rounded-2xl border-2 border-gray-100">
                        <img src={documentPreview.aadhar} className="w-full h-32 object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button type="button" onClick={() => removeDocument('aadhar')} className="bg-white text-red-500 rounded-full p-2 shadow-lg">
                            <FiX className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:bg-gray-50 transition-colors">
                        <FiUpload className="w-8 h-8 text-gray-400 mb-2" />
                        <span className="text-xs text-gray-500">Upload Aadhar Front</span>
                        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleDocumentUpload(e, 'aadhar')} />
                      </label>
                    )}
                  </div>

                  {/* Aadhar Back */}
                  <div className="space-y-2">
                    <p className="text-xs font-normal text-gray-600">Aadhar Back</p>
                    {documentPreview.aadharBack ? (
                      <div className="relative group overflow-hidden rounded-2xl border-2 border-gray-100">
                        <img src={documentPreview.aadharBack} className="w-full h-32 object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button type="button" onClick={() => removeDocument('aadharBack')} className="bg-white text-red-500 rounded-full p-2 shadow-lg">
                            <FiX className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:bg-gray-50 transition-colors">
                        <FiUpload className="w-8 h-8 text-gray-400 mb-2" />
                        <span className="text-xs text-gray-500">Upload Aadhar Back</span>
                        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleDocumentUpload(e, 'aadharBack')} />
                      </label>
                    )}
                  </div>

                  {/* PAN Document */}
                  <div className="space-y-2">
                    <p className="text-xs font-normal text-gray-600">PAN Card Document</p>
                    {documentPreview.pan ? (
                      <div className="relative group overflow-hidden rounded-2xl border-2 border-gray-100">
                        <img src={documentPreview.pan} className="w-full h-32 object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button type="button" onClick={() => removeDocument('pan')} className="bg-white text-red-500 rounded-full p-2 shadow-lg">
                            <FiX className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:bg-gray-50 transition-colors">
                        <FiUpload className="w-8 h-8 text-gray-400 mb-2" />
                        <span className="text-xs text-gray-500">Upload PAN Document</span>
                        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleDocumentUpload(e, 'pan')} />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Terms and conditions */}
            <div className="flex items-start mb-6">
              <div className="flex items-center h-5">
                <input
                  id="agreeToTerms"
                  name="agreeToTerms"
                  type="checkbox"
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  className="h-4 w-4 rounded cursor-pointer"
                  style={{ accentColor: themeColors.button }}
                />
              </div>
              <div className="ml-3 text-xs">
                <label htmlFor="agreeToTerms" className="text-gray-500 cursor-pointer select-none">
                  I agree to the{' '}
                  <Link to="/vendor/terms" className="font-semibold hover:underline" style={{ color: themeColors.button }}>
                    Terms & Conditions
                  </Link>{' '}
                  and{' '}
                  <Link to="/vendor/privacy" className="font-semibold hover:underline" style={{ color: themeColors.button }}>
                    Privacy Policy
                  </Link>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-2xl text-white font-normal text-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              style={{
                background: `linear-gradient(135deg, ${themeColors.button} 0%, #008a8a 100%)`,
                boxShadow: '0 6px 20px rgba(0, 166, 166, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 166, 166, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 166, 166, 0.3)';
              }}
            >
              {isLoading ? 'Processing...' : 'Submit Application'}
              {!isLoading && <FiArrowRight />}
            </button>
          </form>
        </div>

        {/* Bottom Link */}
        <p className="mt-8 text-center text-gray-500">
          <span className="text-sm">Already a network partner?</span>{' '}
          <Link 
            to="/vendor/login" 
            className="text-sm font-semibold border-b-2 ml-1 transition-all pb-0.5"
            style={{ color: '#00a6a6', borderColor: '#00a6a6' }}
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default VendorSignup;
