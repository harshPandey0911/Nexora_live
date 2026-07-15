import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { FiUser, FiMail, FiPhone, FiLock, FiArrowRight, FiChevronLeft, FiCheckCircle, FiEye, FiEyeOff } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { themeColors } from '../../../theme';
import { userAuthService } from '../../../services/authService';
import Logo from '../../../components/common/Logo';
import LogoLoader from '../../../components/common/LogoLoader';

import { z } from "zod";

// Zod schema
const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").regex(/^[a-zA-Z\s]+$/, "Name can only contain letters"),
  email: z.string().optional().refine(val => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "Invalid email address"),
  phoneNumber: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian phone number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const Signup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [errors, setErrors] = useState({});

  // Refs for auto-focus
  const nameInputRef = useRef(null);

  // Pre-fill from navigation state
  useEffect(() => {
    if (location.state?.phone) {
      setFormData(prev => ({ ...prev, phoneNumber: location.state.phone }));
    }
  }, [location.state]);

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
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Zod Validation
    const validationResult = signupSchema.safeParse(formData);

    if (!validationResult.success) {
      const errMsgs = {};
      validationResult.error.errors.forEach(err => {
        errMsgs[err.path[0]] = err.message;
        toast.error(err.message);
      });
      setErrors(errMsgs);
      return;
    }

    if (!agreeToTerms) {
      setErrors(prev => ({ ...prev, agreeToTerms: 'You must agree to the Terms & Conditions and Privacy Policy' }));
      toast.error('You must agree to the Terms & Conditions and Privacy Policy');
      return;
    }
    setErrors({});

    setIsLoading(true);

    try {
      const response = await userAuthService.register({
        name: formData.name,
        email: formData.email || null,
        phone: formData.phoneNumber,
        password: formData.password
      });

      if (response.success) {
        try {
          const { registerFCMToken } = await import('../../../services/pushNotificationService');
          await registerFCMToken('user', true);
        } catch (e) { 
          console.error(e); 
        }

        toast.success(
          <div className="flex flex-col">
            <span className="font-bold">Welcome to Homestr!</span>
            <span className="text-xs">Your account has been created successfully.</span>
          </div>,
          { icon: <FiCheckCircle className="text-green-500" /> }
        );
        navigate('/user');
      } else {
        toast.error(response.message || 'Registration failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const brandColor = themeColors.brand?.teal || '#347989';

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col justify-start sm:justify-center py-12 sm:px-6 lg:px-8 relative overflow-x-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--brand-teal)] opacity-[0.03] rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--brand-yellow)] opacity-[0.03] rounded-full blur-3xl" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8 relative z-10">
        <Logo className="h-16 w-auto transform hover:scale-110 transition-transform duration-500 mx-auto" />
        <h2 className="mt-4 text-3xl font-extrabold text-gray-900 tracking-tight">
          Create Account
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Join Homestr to start booking services
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 relative z-10">
        <div className="bg-white py-8 px-4 shadow-2xl shadow-gray-200/50 sm:rounded-2xl sm:px-10 border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[var(--brand-teal)] via-[var(--brand-yellow)] to-[var(--brand-orange)]" />

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <div className="relative rounded-xl shadow-sm group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[var(--brand-teal)] transition-colors">
                  <FiUser className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  ref={nameInputRef}
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 hover:border-gray-400"
                  placeholder="Enter your name"
                  style={{ '--tw-ring-color': brandColor }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <div className="relative rounded-xl shadow-sm group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[var(--brand-teal)] transition-colors">
                  <FiPhone className="h-5 w-5 text-gray-400" />
                </div>
                <div className="absolute inset-y-0 left-10 flex items-center pointer-events-none">
                  <span className="text-gray-500 font-medium border-r border-gray-300 pr-2">+91</span>
                </div>
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  required
                  value={formData.phoneNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData(prev => ({ ...prev, phoneNumber: val }));
                    if (errors.phoneNumber) {
                      setErrors(prev => ({ ...prev, phoneNumber: null }));
                    }
                  }}
                  className="block w-full pl-24 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 hover:border-gray-400"
                  placeholder="9876543210"
                  style={{ '--tw-ring-color': brandColor }}
                />
              </div>
              {errors.phoneNumber && (
                <p className="text-red-500 text-xs mt-1 ml-1">{errors.phoneNumber}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative rounded-xl shadow-sm group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[var(--brand-teal)] transition-colors">
                  <FiLock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 hover:border-gray-400"
                  placeholder="Set your password"
                  style={{ '--tw-ring-color': brandColor }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? (
                    <FiEyeOff className="h-5 w-5" />
                  ) : (
                    <FiEye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-gray-400 text-xs font-normal ml-1">(Optional)</span>
              </label>
              <div className="relative rounded-xl shadow-sm group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[var(--brand-teal)] transition-colors">
                  <FiMail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 hover:border-gray-400"
                  placeholder="you@example.com"
                  style={{ '--tw-ring-color': brandColor }}
                />
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="agreeToTerms"
                  name="agreeToTerms"
                  type="checkbox"
                  checked={agreeToTerms}
                  onChange={(e) => {
                    setAgreeToTerms(e.target.checked);
                    if (errors.agreeToTerms) {
                      setErrors(prev => ({ ...prev, agreeToTerms: null }));
                    }
                  }}
                  className="h-4 w-4 rounded cursor-pointer"
                  style={{ accentColor: brandColor }}
                />
              </div>
              <div className="ml-3 text-xs">
                <label htmlFor="agreeToTerms" className="text-gray-500 cursor-pointer select-none">
                  I agree to the{' '}
                  <Link to="/user/terms" className="font-semibold hover:underline" style={{ color: brandColor }}>
                    Terms & Conditions
                  </Link>{' '}
                  and{' '}
                  <Link to="/user/privacy" className="font-semibold hover:underline" style={{ color: brandColor }}>
                    Privacy Policy
                  </Link>
                </label>
                {errors.agreeToTerms && (
                  <p className="text-red-500 text-xs mt-1">{errors.agreeToTerms}</p>
                )}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white transition-all duration-500 shadow-lg hover:shadow-xl hover:-translate-y-1 transform disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                style={{
                  backgroundColor: brandColor,
                  boxShadow: `0 10px 15px -3px ${brandColor}4D`
                }}
              >
                <span className="absolute inset-0 w-full h-full bg-white/10 group-hover:translate-x-full transition-transform duration-700 -translate-x-full" />
                {isLoading ? (
                  <LogoLoader fullScreen={false} inline={true} size="w-6 h-6" />
                ) : (
                  <span className="flex items-center relative z-10">
                    Create Account
                    <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-8 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/user/login" className="font-semibold text-[var(--brand-teal)] hover:text-[var(--brand-yellow)] transition-colors duration-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
