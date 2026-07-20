import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { FiPhone, FiLock, FiArrowRight, FiCheckCircle, FiEye, FiEyeOff } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { themeColors } from '../../../theme';
import { userAuthService } from '../../../services/authService';
import Logo from '../../../components/common/Logo';
import LogoLoader from '../../../components/common/LogoLoader';

import { z } from "zod";

// Zod schema
const loginSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian phone number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    phone: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  // Refs for focus management
  const phoneInputRef = useRef(null);

  // Auto-focus logic + restore phone from navigation state
  useEffect(() => {
    // Redirect if already logged in
    if (localStorage.getItem('accessToken')) {
      navigate('/user', { replace: true });
      return;
    }

    // Pre-fill phone if coming back from forgot-password
    const prefilledPhone = location.state?.phone;
    if (prefilledPhone) {
      setFormData(prev => ({ ...prev, phone: prefilledPhone }));
    }

    if (phoneInputRef.current) {
      setTimeout(() => phoneInputRef.current.focus(), 100);
    }
  }, [navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    // Zod Validation
    const validationResult = loginSchema.safeParse(formData);
    if (!validationResult.success) {
      const errMsgs = {};
      validationResult.error.issues.forEach(err => {
        errMsgs[err.path[0]] = err.message;
      });
      setErrors(errMsgs);
      toast.dismiss();
      toast.error(validationResult.error.issues[0].message);
      return;
    }
    setErrors({});

    setIsLoading(true);
    try {
      const cleanPhone = formData.phone.replace(/\D/g, '');
      const response = await userAuthService.login({
        phone: cleanPhone,
        password: formData.password
      });

      if (response.success) {
        toast.success('Welcome back!');
        navigate('/user', { replace: true });
      } else {
        toast.error(response.message || 'Login failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Brand Colors from theme
  const brandColor = themeColors.brand?.teal || '#347989';

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col justify-start sm:justify-center py-12 sm:px-6 lg:px-8 relative overflow-x-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--brand-teal)] opacity-[0.03] rounded-full blur-3xl animate-floating" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--brand-yellow)] opacity-[0.03] rounded-full blur-3xl animate-floating" style={{ animationDelay: '2s' }} />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8 relative z-10">
        <div className="flex justify-center mb-6">
          <Logo className="h-24 w-24 transform hover:scale-110 transition-transform duration-500" />
        </div>
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
          Sign in to account
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Enter your mobile number and password to get started
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 relative z-10">
        <div className="bg-white py-8 px-4 shadow-2xl shadow-gray-200/50 sm:rounded-2xl sm:px-10 border border-gray-100 relative overflow-hidden animate-slide-in-bottom">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[var(--brand-teal)] via-[var(--brand-yellow)] to-[var(--brand-orange)]" />

          <form className="space-y-6" onSubmit={handleLoginSubmit} autoComplete="off">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Mobile Number
              </label>
              <div className="relative rounded-xl shadow-sm group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[var(--brand-teal)] transition-colors">
                  <FiPhone className="h-5 w-5 text-gray-400" />
                </div>
                <div className="absolute inset-y-0 left-10 flex items-center pointer-events-none">
                  <span className="text-gray-500 font-medium border-r pr-2 border-gray-300 sm:text-sm">+91</span>
                </div>
                <input
                  ref={phoneInputRef}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="off"
                  id="phone"
                  name="phone"
                  className="block w-full pl-24 pr-4 py-3.5 border-gray-300 rounded-xl focus:ring-[var(--brand-teal)] focus:border-[var(--brand-teal)] sm:text-sm transition-all duration-300 ease-in-out hover:border-gray-400"
                  placeholder="9876543210"
                  value={formData.phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val.length <= 10) {
                      setFormData(prev => ({ ...prev, phone: val }));
                    }
                    if (errors.phone) {
                      setErrors(prev => ({ ...prev, phone: null }));
                    }
                  }}
                  style={{ '--tw-ring-color': brandColor }}
                />
              </div>
              {errors.phone && (
                <p className="text-red-500 text-xs mt-1 ml-1">{errors.phone}</p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <Link
                  to="/user/forgot-password"
                  state={{ phone: formData.phone }}
                  className="text-xs font-semibold text-gray-500 hover:text-[var(--brand-teal)] transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative rounded-xl shadow-sm group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[var(--brand-teal)] transition-colors">
                  <FiLock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="block w-full pl-10 pr-10 py-3.5 border border-gray-300 rounded-xl focus:ring-[var(--brand-teal)] focus:border-[var(--brand-teal)] sm:text-sm transition-all duration-300 ease-in-out hover:border-gray-400"
                  placeholder="••••••••"
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
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl text-sm font-bold text-white transition-all duration-500 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-teal)] disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1 transform shadow-lg shadow-[var(--brand-teal)]/30 hover:shadow-[var(--brand-teal)]/40 overflow-hidden"
                style={{ backgroundColor: brandColor }}
              >
                <span className="absolute inset-0 w-full h-full bg-white/10 group-hover:translate-x-full transition-transform duration-700 -translate-x-full" />
                {isLoading ? (
                  <LogoLoader fullScreen={false} inline={true} size="w-6 h-6" />
                ) : (
                  <span className="flex items-center gap-2 relative z-10">
                    Sign In <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </button>
            </div>

            <div className="text-center text-xs text-gray-500 mt-4 select-none">
              By signing in, you agree to our{' '}
              <Link to="/user/terms" className="font-semibold hover:underline" style={{ color: brandColor }}>
                Terms & Conditions
              </Link>{' '}
              and{' '}
              <Link to="/user/privacy" className="font-semibold hover:underline" style={{ color: brandColor }}>
                Privacy Policy
              </Link>
            </div>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">New to Nexora Go?</span>
                </div>
              </div>

              <div className="mt-6">
                <Link
                  to="/user/signup"
                  className="w-full inline-flex justify-center py-3 px-4 rounded-xl shadow-sm bg-white text-sm font-medium text-gray-500 hover:text-[var(--brand-teal)] hover:bg-gray-50 border border-gray-200 transition-all duration-300 hover:border-[var(--brand-teal)]/30"
                >
                  Create an account
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} Nexora Go. All rights reserved.
      </div>
    </div>
  );
};

export default Login;
