import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPhone, FiArrowRight, FiCheckCircle, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { themeColors } from '../../../theme';
import { workerAuthService } from '../../../services/authService';
import Logo from '../../../components/common/Logo';
import LogoLoader from '../../../components/common/LogoLoader';

import { z } from "zod";

// Zod schema
const loginSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian phone number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const WorkerLogin = () => {
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const phoneInputRef = useRef(null);

  // Auto-focus logic
  useEffect(() => {
    // Redirect if already logged in
    if (localStorage.getItem('workerAccessToken')) {
      navigate('/worker', { replace: true });
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
      toast.error(validationResult.error.errors[0].message);
      return;
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    setIsLoading(true);
    try {
      const response = await workerAuthService.login({
        phone: cleanPhone,
        password
      });

      if (response.success) {
        setIsLoading(false);

        toast.success(
          <div className="flex flex-col">
            <span className="font-bold">Welcome Back!</span>
            <span className="text-xs">Successfully logged into your worker account.</span>
          </div>,
          { icon: <FiCheckCircle className="text-green-500" /> }
        );
        navigate('/worker', { replace: true });
      } else {
        setIsLoading(false);
        toast.error(response.message || 'Login failed');
      }
    } catch (error) {
      setIsLoading(false);
      const errMsg = error.response?.data?.message || 'Login failed';
      if (errMsg.includes('pending admin approval') || errMsg.includes('under review')) {
        toast(
          <div className="flex flex-col text-amber-800">
            <span className="font-bold text-sm">Approval Pending</span>
            <span className="text-xs mt-0.5">{errMsg}</span>
          </div>,
          {
            icon: '⚠️',
            style: {
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
            },
            duration: 5000
          }
        );
      } else {
        toast.error(errMsg);
      }
    }
  };

  const brandColor = themeColors.brand?.teal || '#347989';

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col justify-start sm:justify-center py-12 sm:px-6 lg:px-8 relative overflow-x-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#347989] opacity-[0.03] rounded-full blur-3xl animate-floating" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#D68F35] opacity-[0.03] rounded-full blur-3xl animate-floating" style={{ animationDelay: '2s' }} />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8 relative z-10 animate-fade-in">
        <Logo className="h-24 w-24 mx-auto transform hover:scale-110 transition-transform duration-500" />
        <h2 className="mt-4 text-3xl font-extrabold text-gray-900 tracking-tight">
          Nexora Sign In
        </h2>
        <p className="mt-2 text-sm text-gray-600 animate-stagger-1 animate-fade-in">
          Access your tasks and earnings
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 relative z-10">
        <div className="bg-white py-8 px-4 shadow-2xl shadow-gray-200/50 sm:rounded-2xl sm:px-10 border border-gray-100 relative overflow-hidden animate-slide-in-bottom">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#347989] via-[#D68F35] to-[#BB5F36]" />

          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <div className="animate-stagger-1 animate-fade-in">
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <div className="relative rounded-xl shadow-sm group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[#347989] transition-colors">
                  <FiPhone className="h-5 w-5 text-gray-400" />
                </div>
                <div className="absolute inset-y-0 left-10 flex items-center pointer-events-none">
                  <span className="text-gray-500 font-medium border-r border-gray-300 pr-2">+91</span>
                </div>
                <input
                  ref={phoneInputRef}
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="block w-full pl-24 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 hover:border-gray-400"
                  placeholder="9876543210"
                  style={{ '--tw-ring-color': brandColor }}
                />
              </div>
            </div>

            <div className="animate-stagger-2 animate-fade-in">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative rounded-xl shadow-sm group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[#347989] transition-colors">
                  <FiLock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 hover:border-gray-400"
                  placeholder="••••••••"
                  style={{ '--tw-ring-color': brandColor }}
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

            <div className="animate-stagger-3 animate-fade-in">
              <button
                type="submit"
                disabled={isLoading || !phoneNumber || phoneNumber.length < 10 || !password || password.length < 6}
                className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white transition-all duration-500 shadow-lg hover:shadow-xl hover:-translate-y-1 transform disabled:opacity-50 overflow-hidden"
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
                    Sign In
                    <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </button>
            </div>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500 animate-fade-in animate-stagger-5">
            Want to join the fleet?{' '}
            <Link to="/worker/signup" className="font-semibold text-[#347989] hover:text-[#D68F35] transition-colors duration-300">
              Register as Xpert
            </Link>
          </p>

          <div className="mt-4 text-center text-xs text-gray-400 animate-fade-in">
            By signing in, you agree to our{' '}
            <Link to="/worker/terms" className="font-semibold hover:underline" style={{ color: brandColor }}>
              Terms &amp; Conditions
            </Link>{' '}
            and{' '}
            <Link to="/worker/privacy" className="font-semibold hover:underline" style={{ color: brandColor }}>
              Privacy Policy
            </Link>
        </div>
      </div>
    </div>
  );
};

export default WorkerLogin;
