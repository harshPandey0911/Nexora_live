import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiPhone, FiArrowRight, FiCheckCircle } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { vendorTheme as themeColors } from '../../../theme';
import { forgotPassword } from '../services/authService';
import Logo from '../../../components/common/Logo';
import LogoLoader from '../../../components/common/LogoLoader';
import { z } from "zod";

// Zod schema for validating the mobile number
const forgotSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"),
});

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const phoneInputRef = useRef(null);

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Zod validation
    const validationResult = forgotSchema.safeParse({ phone });
    if (!validationResult.success) {
      toast.error(validationResult.error.issues[0].message);
      return;
    }

    setIsLoading(true);
    try {
      const response = await forgotPassword(phone);
      if (response.success) {
        setIsSuccess(true);
        toast.success(response.message || 'Reset link sent successfully!');
      } else {
        toast.error(response.message || 'Something went wrong');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to request reset link.');
    } finally {
      setIsLoading(false);
    }
  };

  const brandColor = themeColors.button || '#1e3a8a';

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
          Forgot Password?
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Enter your registered mobile number below to reset your password
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 relative z-10">
        <div className="bg-white py-8 px-4 shadow-2xl shadow-gray-200/50 sm:rounded-2xl sm:px-10 border border-gray-100 relative overflow-hidden animate-slide-in-bottom">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[var(--brand-teal)] via-[var(--brand-yellow)] to-[var(--brand-orange)]" />

          {isSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="flex justify-center">
                <FiCheckCircle className="h-16 w-16 text-emerald-500 animate-bounce" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Check Your Email</h3>
              <p className="text-sm text-gray-600">
                If an account exists for that mobile number, we've sent password reset instructions to the registered email address.
              </p>
              <div className="pt-4">
                <Link
                  to="/vendor/login"
                  className="inline-flex justify-center items-center px-6 py-3 border border-transparent text-sm font-bold rounded-xl text-white shadow-md hover:shadow-lg transition-all duration-300"
                  style={{ backgroundColor: brandColor }}
                >
                  Go To Login
                </Link>
              </div>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
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
                    id="phone"
                    name="phone"
                    className="block w-full pl-24 pr-4 py-3.5 border border-gray-300 rounded-xl focus:ring-[var(--brand-teal)] focus:border-[var(--brand-teal)] sm:text-sm transition-all duration-300 ease-in-out hover:border-gray-400"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 10) setPhone(val);
                    }}
                    style={{ '--tw-ring-color': brandColor }}
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading || phone.length < 10}
                  className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl text-sm font-bold text-white transition-all duration-500 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-teal)] disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1 transform shadow-lg shadow-[var(--brand-teal)]/30 hover:shadow-[var(--brand-teal)]/40 overflow-hidden"
                  style={{ backgroundColor: brandColor }}
                >
                  <span className="absolute inset-0 w-full h-full bg-white/10 group-hover:translate-x-full transition-transform duration-700 -translate-x-full" />
                  {isLoading ? (
                    <LogoLoader fullScreen={false} inline={true} size="w-6 h-6" />
                  ) : (
                    <span className="flex items-center gap-2 relative z-10">
                      Continue <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <Link
                  to="/vendor/login"
                  className="text-sm font-medium text-gray-500 hover:text-[var(--brand-teal)] transition-colors"
                >
                  Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} Nexora Go. All rights reserved.
      </div>
    </div>
  );
};

export default ForgotPassword;
