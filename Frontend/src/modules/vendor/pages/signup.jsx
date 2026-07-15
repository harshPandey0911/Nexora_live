import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { FiUser, FiMail, FiPhone, FiFileText, FiUpload, FiX, FiArrowRight, FiChevronLeft, FiCheckCircle, FiCamera, FiUserPlus } from 'react-icons/fi';
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
  aadhar: z.string().regex(/^\d{12}$/, "Aadhar number must be exactly 12 digits"),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format (e.g. ABCDE1234F)")
});

const VendorSignup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState('details'); // 'details' or 'otp'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    aadhar: '',
    pan: '',
    service: '',
    documents: []
  });
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpToken, setOtpToken] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [documentPreview, setDocumentPreview] = useState({});
  const [uploadingDocs, setUploadingDocs] = useState({});
  const [resendTimer, setResendTimer] = useState(0);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  // Timer countdown effect
  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Refs for auto-focus
  const nameInputRef = useRef(null);
  const otpInputRefs = useRef([]);

  // Unified Flow: Pre-fill
  useEffect(() => {
    if (location.state?.phone && location.state?.verificationToken) {
      setFormData(prev => ({ ...prev, phoneNumber: location.state.phone }));
      setVerificationToken(location.state.verificationToken);
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
    if (step === 'details' && nameInputRef.current) {
      setTimeout(() => nameInputRef.current.focus(), 100);
    } else if (step === 'otp' && otpInputRefs.current[0]) {
      setTimeout(() => otpInputRefs.current[0].focus(), 100);
    }
  }, [step]);

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

      // Compress if it is an image
      if (file.type.startsWith('image/')) {
        try {
          const compressedFile = await compressImage(file, {
            maxWidth: 1280, // Reasonable max width for documents
            maxHeight: 1280,
            quality: 0.8
          });
          fileToUpload = compressedFile;
          toast.dismiss(loadingToast); // Dismiss compression loading
        } catch (compressionError) {
          console.error("Compression failed, using original file", compressionError);
          toast.error("Compression failed, using original");
          // fileToUpload remains original
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

  const [isLoading, setIsLoading] = useState(false);

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
      aadhar: formData.aadhar,
      pan: formData.pan
    });

    if (!validationResult.success) {
      validationResult.error.issues.forEach(err => toast.error(err.message));
      return;
    }

    // Manual Document Validation remains
    const hasAadharDoc = formData.documents.some(d => d.type === 'aadhar');
    const hasAadharBackDoc = formData.documents.some(d => d.type === 'aadharBack');
    const hasPanDoc = formData.documents.some(d => d.type === 'pan');
    if (!hasAadharDoc) { toast.error('Please upload Aadhar Front document'); return; }
    if (!hasAadharBackDoc) { toast.error('Please upload Aadhar Back document'); return; }
    if (!hasPanDoc) { toast.error('Please upload PAN document'); return; }

    setIsLoading(true);

    if (verificationToken) {
      try {
        const aadharDoc = formData.documents.find(d => d.type === 'aadhar')?.url || null;
        const aadharBackDoc = formData.documents.find(d => d.type === 'aadharBack')?.url || null;
        const panDoc = formData.documents.find(d => d.type === 'pan')?.url || null;
        const otherDocs = formData.documents.filter(d => d.type === 'other').map(d => d.url);

        const registerData = {
          name: formData.name,
          email: formData.email,
          phone: formData.phoneNumber,
          aadhar: formData.aadhar,
          pan: formData.pan,
          service: [],
          aadharDocument: aadharDoc,
          aadharBackDocument: aadharBackDoc,
          panDocument: panDoc,
          otherDocuments: otherDocs,
          verificationToken
        };

        const response = await register(registerData);

        if (response.success) {
          toast.success(
            <div className="flex flex-col">
              <span className="font-bold">Application Submitted!</span>
              <span className="text-xs">Please complete the training module.</span>
            </div>,
            { icon: <FiCheckCircle className="text-[#D68F35]" />, duration: 5000 }
          );
          navigate('/vendor/training');
        } else {
          toast.error(response.message || 'Registration failed');
        }
      } catch (error) {
        toast.error(error.response?.data?.message || 'Registration failed');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const response = await sendVendorOTP(formData.phoneNumber);
      if (response.success) {
        if (response.vendor?.adminApproval?.toLowerCase() === 'pending') {
          setIsLoading(false);
          toast.error('Your account is currently under review. Please wait for admin approval.', {
            duration: 5000,
            icon: '⏳'
          });
          return;
        }

        if (!response.token) {
          setIsLoading(false);
          toast.error(response.message || 'Failed to initialize verification.');
          return;
        }

        setOtpToken(response.token);
        setIsLoading(false);
        setStep('otp');
        setResendTimer(120); // Start timer
        toast.success('OTP sent successfully');
      } else {
        setIsLoading(false);
        toast.error(response.message || 'Failed to send OTP');
      }
    } catch (error) {
      setIsLoading(false);
      toast.error(error.response?.data?.message || 'Failed to send OTP');
    }
  };

  const handleOtpChange = (index, value) => {
    const cleanValue = value.replace(/\D/g, '').slice(0, 1);
    const newOtp = [...otp];
    newOtp[index] = cleanValue;
    setOtp(newOtp);

    if (cleanValue && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Auto-verify as last digit enters
  useEffect(() => {
    const otpValue = otp.join('');
    if (otpValue.length === 6 && !isLoading && otpToken) {
      handleOtpSubmit();
    }
  }, [otp]);

  const handleOtpSubmit = async (e) => {
    if (e) e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      toast.error('Please enter complete OTP');
      return;
    }
    if (!otpToken) {
      toast.error('Please request OTP first');
      return;
    }
    setIsLoading(true);
    try {
      // 1. Verify OTP using the unified verify-login endpoint
      // This will return isNewUser: true and a verificationToken for new vendors
      const response = await verifyLogin({ 
        phone: formData.phoneNumber, 
        otp: otpValue 
      });

      if (response.success && response.isNewUser) {
        setIsLoading(false);
        toast.success('OTP Verified! Please complete the training module.');
        
        // Prepare registration data to be passed to Training page
        const aadharDoc = formData.documents.find(d => d.type === 'aadhar')?.url || null;
        const aadharBackDoc = formData.documents.find(d => d.type === 'aadharBack')?.url || null;
        const panDoc = formData.documents.find(d => d.type === 'pan')?.url || null;
        const otherDocs = formData.documents.filter(d => d.type === 'other').map(d => d.url);

        const pendingRegisterData = {
          name: formData.name,
          email: formData.email,
          phone: formData.phoneNumber,
          aadhar: formData.aadhar,
          pan: formData.pan,
          service: [], // Default empty
          aadharDocument: aadharDoc,
          aadharBackDocument: aadharBackDoc,
          panDocument: panDoc,
          otherDocuments: otherDocs,
          verificationToken: response.verificationToken
        };

        // Store in sessionStorage as fallback
        sessionStorage.setItem('pendingVendorRegistration', JSON.stringify(pendingRegisterData));
        
        // Navigate to training with data
        navigate('/vendor/training', { state: { registerData: pendingRegisterData } });
      } else if (response.success && !response.isNewUser) {
        // This shouldn't happen if they came through signup flow with a new number,
        // but if they are already a vendor, they might be logged in now.
        setIsLoading(false);
        toast.success('Account already exists. Logged in successfully.');
        navigate('/vendor/dashboard');
      } else {
        setIsLoading(false);
        toast.error(response.message || 'Verification failed');
      }
    } catch (error) {
      setIsLoading(false);
      toast.error(error.response?.data?.message || 'Verification failed');
    }
  };

  const brandColor = themeColors.brand?.teal || '#347989';

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4"
      style={{
        background: 'linear-gradient(135deg, #00a6a6 0%, #008a8a 50%, #006b6b 100%)'
      }}
    >
      <div className="w-full max-w-4xl">
        {/* White Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${themeColors.button} 0%, #008a8a 100%)`,
                boxShadow: `0 4px 12px rgba(0, 166, 166, 0.3)`
              }}
            >
              <FiUserPlus className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">
            {step === 'details' ? 'Vendor Enrollment' : 'Verify Security'}
          </h1>
          <p className="text-gray-600 text-center mb-10">
            {step === 'details' 
              ? 'Join our network and grow your professional service business' 
              : `Enter the verification code sent to +91 ${formData.phoneNumber}`}
          </p>

          {/* Form Content */}
          {step === 'details' ? (
            <form onSubmit={handleDetailsSubmit} className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                {/* Basic Details */}
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b pb-2">Professional Identity</h3>

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Legal Name</label>
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
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

                  {/* Phone */}
                  {!verificationToken && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Mobile Number</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 font-bold border-r pr-3">
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
                  )}

                  {/* Aadhar */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Aadhar Number</label>
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">PAN Card Number</label>
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
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b pb-2">Verification Documents</h3>

                  <div className="grid grid-cols-1 gap-6">
                    {/* Aadhar Front */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-600">Aadhar Front</p>
                      {documentPreview.aadhar ? (
                        <div className="relative group overflow-hidden rounded-2xl border-2 border-gray-100">
                          <img src={documentPreview.aadhar} className="w-full h-32 object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button type="button" onClick={() => removeDocument('aadhar')} className="bg-white text-red-500 rounded-full p-2 shadow-lg">
                              <FiX size={20} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-2xl hover:border-teal-500 transition-all cursor-pointer bg-gray-50 group">
                          <FiUpload className="w-8 h-8 text-gray-300 group-hover:text-teal-500 transition-colors mb-2" />
                          <span className="text-xs font-semibold text-gray-400 group-hover:text-teal-600">Upload Front</span>
                          <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleDocumentUpload(e, 'aadhar')} disabled={uploadingDocs.aadhar} />
                        </label>
                      )}
                    </div>

                    {/* Aadhar Back */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-600">Aadhar Back</p>
                      {documentPreview.aadharBack ? (
                        <div className="relative group overflow-hidden rounded-2xl border-2 border-gray-100">
                          <img src={documentPreview.aadharBack} className="w-full h-32 object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button type="button" onClick={() => removeDocument('aadharBack')} className="bg-white text-red-500 rounded-full p-2 shadow-lg">
                              <FiX size={20} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-2xl hover:border-teal-500 transition-all cursor-pointer bg-gray-50 group">
                          <FiUpload className="w-8 h-8 text-gray-300 group-hover:text-teal-500 transition-colors mb-2" />
                          <span className="text-xs font-semibold text-gray-400 group-hover:text-teal-600">Upload Back</span>
                          <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleDocumentUpload(e, 'aadharBack')} disabled={uploadingDocs.aadharBack} />
                        </label>
                      )}
                    </div>

                    {/* PAN */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-600">PAN Card</p>
                      {documentPreview.pan ? (
                        <div className="relative group overflow-hidden rounded-2xl border-2 border-gray-100">
                          <img src={documentPreview.pan} className="w-full h-32 object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button type="button" onClick={() => removeDocument('pan')} className="bg-white text-red-500 rounded-full p-2 shadow-lg">
                              <FiX size={20} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-2xl hover:border-teal-500 transition-all cursor-pointer bg-gray-50 group">
                          <FiUpload className="w-8 h-8 text-gray-300 group-hover:text-teal-500 transition-colors mb-2" />
                          <span className="text-xs font-semibold text-gray-400 group-hover:text-teal-600">Upload PAN</span>
                          <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleDocumentUpload(e, 'pan')} disabled={uploadingDocs.pan} />
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
                className="w-full py-4 rounded-2xl text-white font-bold text-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
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
                {isLoading ? 'Processing...' : (verificationToken ? 'Submit Application' : 'Continue to Verification')}
                {!isLoading && <FiArrowRight />}
              </button>
            </form>
          ) : (
            <div className="space-y-8">
              <button
                onClick={() => setStep('details')}
                className="inline-flex items-center text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
              >
                <FiChevronLeft className="mr-1" /> Edit details
              </button>

              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Security Verification</h3>
                <p className="text-gray-600">Enter the 6-digit code sent to your phone</p>
              </div>

              <form onSubmit={handleOtpSubmit} className="space-y-10">
                <div className="flex justify-between gap-2 max-w-xs mx-auto">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpInputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:outline-none transition-all"
                      style={{
                        borderColor: digit ? themeColors.button : '#e5e7eb',
                        boxShadow: digit ? `0 0 0 3px rgba(0, 166, 166, 0.1)` : 'none'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = themeColors.button;
                        e.target.style.boxShadow = `0 0 0 3px rgba(0, 166, 166, 0.1)`;
                      }}
                    />
                  ))}
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={async () => {
                      if (resendTimer > 0) return;
                      try {
                        const response = await sendVendorOTP(formData.phoneNumber);
                        if (response.success) {
                          setOtpToken(response.token);
                          setResendTimer(120);
                          toast.success('Code re-sent');
                        }
                      } catch (e) { toast.error('Failed to re-send'); }
                    }}
                    disabled={resendTimer > 0}
                    className="text-sm font-bold transition-all"
                    style={{ color: resendTimer > 0 ? '#d1d5db' : themeColors.button }}
                  >
                    {resendTimer > 0
                      ? `Resend available in ${Math.floor(resendTimer / 60)}:${String(resendTimer % 60).padStart(2, '0')}`
                      : 'Resend Verification Code'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otp.join('').length !== 6}
                  className="w-full py-4 rounded-2xl text-white font-bold text-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  style={{
                    background: `linear-gradient(135deg, ${themeColors.button} 0%, #008a8a 100%)`,
                    boxShadow: '0 6px 20px rgba(0, 166, 166, 0.3)'
                  }}
                >
                  {isLoading ? 'Verifying...' : 'Complete Registration'}
                  {!isLoading && <FiCheckCircle />}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Bottom Link */}
        <p className="mt-8 text-center text-white/90">
          <span className="text-sm">Already a network partner?</span>{' '}
          <Link 
            to="/vendor/login" 
            className="text-sm font-bold border-b-2 border-white ml-1 hover:text-white transition-all pb-0.5"
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default VendorSignup;
