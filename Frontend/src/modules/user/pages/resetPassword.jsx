import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FiLock, FiArrowRight, FiCheckCircle, FiAlertTriangle, FiCheck, FiX, FiEye, FiEyeOff } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { themeColors } from '../../../theme';
import { userAuthService } from '../../../services/authService';
import Logo from '../../../components/common/Logo';
import LogoLoader from '../../../components/common/LogoLoader';
import { z } from "zod";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password criteria checklist states
  const passwordCriteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    specialChar: /[^A-Za-z0-9]/.test(password),
    match: password && password === confirmPassword
  };

  useEffect(() => {
    const validateToken = async () => {
      try {
        const response = await userAuthService.verifyResetToken(token);
        if (response.valid) {
          setIsTokenValid(true);
        } else {
          setIsTokenValid(false);
          setErrorMessage(response.message || 'Reset link expired or invalid.');
        }
      } catch (error) {
        setIsTokenValid(false);
        setErrorMessage(error.response?.data?.message || 'Failed to verify reset link.');
      } finally {
        setIsValidating(false);
      }
    };

    if (token) {
      validateToken();
    } else {
      setIsValidating(false);
      setIsTokenValid(false);
      setErrorMessage('Token is missing.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Perform validation
    const validationResult = passwordSchema.safeParse(password);
    if (!validationResult.success) {
      toast.error(validationResult.error.issues[0].message);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const response = await userAuthService.resetPassword(token, password);
      if (response.success) {
        setIsSuccess(true);
        toast.success('Password updated successfully!');
        setTimeout(() => {
          navigate('/user/login');
        }, 3000);
      } else {
        toast.error(response.message || 'Failed to reset password');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const brandColor = themeColors.brand?.teal || '#347989';

  if (isValidating) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <LogoLoader size="w-12 h-12" />
          <p className="text-sm font-medium text-gray-500">Verifying secure token...</p>
        </div>
      </div>
    );
  }

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
          Reset Password
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Enter and confirm your new secure password below
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 relative z-10">
        <div className="bg-white py-8 px-4 shadow-2xl shadow-gray-200/50 sm:rounded-2xl sm:px-10 border border-gray-100 relative overflow-hidden animate-slide-in-bottom">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[var(--brand-teal)] via-[var(--brand-yellow)] to-[var(--brand-orange)]" />

          {!isTokenValid ? (
            <div className="text-center py-6 space-y-4">
              <div className="flex justify-center">
                <FiAlertTriangle className="h-16 w-16 text-amber-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Reset Link Expired</h3>
              <p className="text-sm text-gray-600">
                {errorMessage || 'This link has expired, been used, or is invalid. Please request a new link.'}
              </p>
              <div className="pt-4">
                <Link
                  to="/user/forgot-password"
                  className="inline-flex justify-center items-center px-6 py-3 border border-transparent text-sm font-bold rounded-xl text-white shadow-md hover:shadow-lg transition-all duration-300"
                  style={{ backgroundColor: brandColor }}
                >
                  Request New Link
                </Link>
              </div>
            </div>
          ) : isSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="flex justify-center">
                <FiCheckCircle className="h-16 w-16 text-emerald-500 animate-bounce" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Password Reset Done!</h3>
              <p className="text-sm text-gray-600">
                Your password was updated successfully. Redirecting you to login screen in a few seconds...
              </p>
              <div className="pt-4">
                <Link
                  to="/user/login"
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
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <div className="relative rounded-xl shadow-sm group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[var(--brand-teal)] transition-colors">
                    <FiLock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-3.5 border border-gray-300 rounded-xl focus:ring-[var(--brand-teal)] focus:border-[var(--brand-teal)] sm:text-sm transition-all duration-300 ease-in-out hover:border-gray-400"
                    placeholder="••••••••"
                    style={{ '--tw-ring-color': brandColor }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative rounded-xl shadow-sm group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[var(--brand-teal)] transition-colors">
                    <FiLock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-3.5 border border-gray-300 rounded-xl focus:ring-[var(--brand-teal)] focus:border-[var(--brand-teal)] sm:text-sm transition-all duration-300 ease-in-out hover:border-gray-400"
                    placeholder="••••••••"
                    style={{ '--tw-ring-color': brandColor }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirmPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Security rules checklist */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-xs space-y-2.5">
                <div className="font-semibold text-gray-700 uppercase tracking-wider text-[10px]">Password Strength Rules</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-600">
                  <div className="flex items-center gap-1.5">
                    {passwordCriteria.length ? <FiCheck className="text-emerald-500 w-4 h-4" /> : <FiX className="text-gray-300 w-4 h-4" />}
                    <span>Min 8 characters</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {passwordCriteria.uppercase ? <FiCheck className="text-emerald-500 w-4 h-4" /> : <FiX className="text-gray-300 w-4 h-4" />}
                    <span>Uppercase letter</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {passwordCriteria.lowercase ? <FiCheck className="text-emerald-500 w-4 h-4" /> : <FiX className="text-gray-300 w-4 h-4" />}
                    <span>Lowercase letter</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {passwordCriteria.number ? <FiCheck className="text-emerald-500 w-4 h-4" /> : <FiX className="text-gray-300 w-4 h-4" />}
                    <span>Number digit</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {passwordCriteria.specialChar ? <FiCheck className="text-emerald-500 w-4 h-4" /> : <FiX className="text-gray-300 w-4 h-4" />}
                    <span>Special character</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {passwordCriteria.match ? <FiCheck className="text-emerald-500 w-4 h-4" /> : <FiX className="text-gray-300 w-4 h-4" />}
                    <span>Passwords match</span>
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading || !Object.values(passwordCriteria).every(Boolean)}
                  className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl text-sm font-bold text-white transition-all duration-500 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-teal)] disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1 transform shadow-lg shadow-[var(--brand-teal)]/30 hover:shadow-[var(--brand-teal)]/40 overflow-hidden"
                  style={{ backgroundColor: brandColor }}
                >
                  <span className="absolute inset-0 w-full h-full bg-white/10 group-hover:translate-x-full transition-transform duration-700 -translate-x-full" />
                  {isLoading ? (
                    <LogoLoader fullScreen={false} inline={true} size="w-6 h-6" />
                  ) : (
                    <span className="flex items-center gap-2 relative z-10">
                      Update Password <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </button>
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

export default ResetPassword;
