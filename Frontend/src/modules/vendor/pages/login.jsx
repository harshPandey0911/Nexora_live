import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiPhone, FiArrowRight, FiCheckCircle, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { vendorTheme as themeColors } from '../../../theme';
import { login } from '../services/authService';
import Logo from '../../../components/common/Logo';

import { z } from "zod";

// Zod schema
const loginSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian phone number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const VendorLogin = () => {
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState(() => {
    return sessionStorage.getItem('vendor_login_phone') || '';
  });
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Sync phoneNumber to sessionStorage so navigating to Terms/Privacy never clears it
  useEffect(() => {
    if (phoneNumber) {
      sessionStorage.setItem('vendor_login_phone', phoneNumber);
    }
  }, [phoneNumber]);

  // Refs for auto-focus
  const phoneInputRef = useRef(null);

  // Auto-focus logic
  useEffect(() => {
    // Redirect if already logged in
    if (localStorage.getItem('vendorAccessToken')) {
      navigate('/vendor', { replace: true });
      return;
    }

    if (phoneInputRef.current) {
      setTimeout(() => phoneInputRef.current.focus(), 100);
    }
  }, [navigate]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    // Zod Validation
    const validationResult = loginSchema.safeParse({ phone: phoneNumber, password });
    if (!validationResult.success) {
      toast.dismiss();
      toast.error(validationResult.error.issues[0].message);
      return;
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    setIsLoading(true);
    try {
      const response = await login({
        phone: cleanPhone,
        password: password
      });

      if (response.success) {
        setIsLoading(false);

        // Check for admin approval status
        if (response.vendor?.adminApproval === 'PENDING' || response.vendor?.adminApproval === 'pending') {
          toast.error('Your account is currently under review. Please wait for admin approval.', {
            duration: 5000,
            icon: '⏳'
          });
          // Clear tokens if they were set by the service
          localStorage.removeItem('vendorAccessToken');
          localStorage.removeItem('vendorRefreshToken');
          localStorage.removeItem('vendorData');
          return;
        }

        toast.success(
          <div className="flex flex-col">
            <span className="font-normal">Welcome Back!</span>
            <span className="text-xs">Successfully logged into your vendor account.</span>
          </div>,
          { icon: <FiCheckCircle className="text-green-500" /> }
        );
        navigate('/vendor', { replace: true });
      } else {
        setIsLoading(false);
        toast.error(response.message || 'Login failed');
      }
    } catch (error) {
      setIsLoading(false);
      const errorMessage = error.response?.data?.message || 'Login failed. Please try again.';
      toast.error(errorMessage);
    }
  };

  const brandColor = themeColors.brand?.teal || '#347989';

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 bg-gray-50"
    >
      <div className="w-full max-w-md">
        {/* White Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Logo className="h-24 w-24 transform hover:scale-110 transition-transform duration-500" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-normal text-gray-900 text-center mb-2">
            Vendor Login
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Enter your mobile number and password to access your portal
          </p>

          {/* Form Content */}
          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mobile Number
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                  <FiPhone className="w-5 h-5 text-gray-400" />
                </div>
                <div className="absolute left-12 top-1/2 transform -translate-y-1/2 text-gray-400 font-medium border-r pr-3 mr-2">
                  +91
                </div>
                <input
                  ref={phoneInputRef}
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="0000000000"
                  className="w-full pl-24 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-gray-900 font-medium tracking-wider"
                  onFocus={(e) => {
                    e.target.style.borderColor = themeColors.button;
                    e.target.style.boxShadow = `0 0 0 3px rgba(30, 58, 138, 0.1)`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.boxShadow = 'none';
                  }}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                  <FiLock className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-gray-900 font-medium tracking-wider"
                  onFocus={(e) => {
                    e.target.style.borderColor = themeColors.button;
                    e.target.style.boxShadow = `0 0 0 3px rgba(30, 58, 138, 0.1)`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.boxShadow = 'none';
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none z-10"
                >
                  {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link 
                to="/vendor/forgot-password" 
                className="text-sm font-semibold transition-all hover:opacity-80"
                style={{ color: themeColors.button }}
              >
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading || !phoneNumber || phoneNumber.length < 10 || !password || password.length < 6}
              className="w-full py-3 rounded-xl text-white font-medium text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${themeColors.button} 0%, #1e40af 100%)`,
                boxShadow: '0 4px 12px rgba(30, 58, 138, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(30, 58, 138, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(30, 58, 138, 0.3)';
              }}
            >
              {isLoading ? 'Verifying...' : 'Login'}
              {!isLoading && <FiArrowRight />}
            </button>
          </form>
        </div>

        {/* Bottom Link */}
        <p className="mt-8 text-center text-gray-500">
          <span className="text-sm">New to the network?</span>{' '}
          <Link 
            to="/vendor/signup" 
            className="text-sm font-semibold border-b-2 ml-1 transition-all pb-0.5"
            style={{ color: '#00a6a6', borderColor: '#00a6a6' }}
          >
            Apply Now
          </Link>
        </p>

        <div className="mt-4 text-center text-xs text-gray-500">
          By signing in, you agree to our{' '}
          <Link to="/vendor/terms" className="font-semibold hover:underline" style={{ color: themeColors.button }}>
            Terms &amp; Conditions
          </Link>{' '}
          and{' '}
          <Link to="/vendor/privacy" className="font-semibold hover:underline" style={{ color: themeColors.button }}>
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VendorLogin;
