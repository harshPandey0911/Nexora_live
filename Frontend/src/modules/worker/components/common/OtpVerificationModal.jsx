import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiShield, FiSmartphone, FiRefreshCw } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const OtpVerificationModal = ({ isOpen, onClose, onVerify, onResend, loading }) => {
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(30);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setOtp('');
      setCooldown(30);
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    let timer = null;
    if (isOpen && cooldown > 0) {
      timer = setInterval(() => {
        setCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, cooldown]);

  useEffect(() => {
    if (otp.length === 4) {
      onVerify(otp);
    }
  }, [otp, onVerify]);

  // Clear OTP on failure
  const prevLoading = useRef(loading);
  useEffect(() => {
    if (prevLoading.current && !loading && isOpen) {
      setOtp('');
      inputRef.current?.focus();
    }
    prevLoading.current = loading;
  }, [loading, isOpen]);

  const handleChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    setOtp(val);
  };

  const handleResendClick = () => {
    if (cooldown === 0 && onResend) {
      onResend();
      setCooldown(30);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md touch-none overscroll-contain">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl relative border border-gray-100 flex flex-col"
        >
          {/* Header */}
          <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 p-4 pt-5 text-center flex flex-col items-center">
            <button
              onClick={onClose}
              className="absolute top-3.5 right-3.5 p-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full text-white transition-all active:scale-95 border border-white/10 cursor-pointer"
            >
              <FiX className="w-4 h-4" />
            </button>

            <div className="w-10 h-10 bg-white/15 backdrop-blur-xl rounded-xl border border-white/20 flex items-center justify-center shadow-md mb-2">
              <FiShield className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-white text-[9px] font-bold uppercase tracking-[0.2em] opacity-85 mb-0.5">Cash Collection</h2>
            <p className="text-white text-base font-bold tracking-tight">Enter Verification Code</p>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 bg-white text-center">
            <p className="text-gray-500 text-xs font-semibold leading-snug mb-4">
              Ask customer for the 4-digit Cash Code shown on their screen
            </p>

            {/* Hidden Input with 4 Styled PIN Boxes */}
            <div className="relative mb-4 cursor-pointer" onClick={() => inputRef.current?.focus()}>
              <input
                ref={inputRef}
                type="number"
                pattern="\d*"
                value={otp}
                onChange={handleChange}
                disabled={loading}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-20"
                autoComplete="one-time-code"
              />
              <div className="flex justify-center gap-2">
                {[0, 1, 2, 3].map((idx) => {
                  const digit = otp[idx] || '';
                  const isFocused = otp.length === idx;
                  return (
                    <div
                      key={idx}
                      className={`w-10 h-12 sm:w-12 sm:h-14 rounded-xl border-2 flex items-center justify-center text-xl sm:text-2xl font-bold transition-all shadow-2xs ${
                        digit
                          ? 'border-blue-600 bg-blue-50/60 text-blue-950 scale-105'
                          : isFocused
                          ? 'border-blue-500 bg-white ring-2 ring-blue-500/10'
                          : 'border-gray-200 bg-gray-50 text-gray-300'
                      }`}
                    >
                      {digit}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Loader / Resend Section */}
            <div className="flex flex-col items-center gap-1 min-h-[36px] justify-center">
              {loading ? (
                <div className="flex items-center gap-2 text-blue-600 font-bold text-xs">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
                  <span>Validating OTP...</span>
                </div>
              ) : (
                <>
                  <div className="text-[10px] font-semibold text-gray-400 flex items-center gap-1">
                    <FiSmartphone className="w-3 h-3 text-blue-600" />
                    Auto-verifies on 4th digit
                  </div>

                  {onResend && (
                    <button
                      type="button"
                      onClick={handleResendClick}
                      disabled={cooldown > 0}
                      className="mt-0.5 text-[11px] font-bold text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <FiRefreshCw className={`w-3 h-3 ${cooldown > 0 ? 'animate-spin' : ''}`} />
                      {cooldown > 0 ? `Resend SMS OTP in ${cooldown}s` : 'Resend SMS OTP'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default OtpVerificationModal;
