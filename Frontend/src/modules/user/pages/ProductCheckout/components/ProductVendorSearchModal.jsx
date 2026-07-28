import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheckCircle, FiXCircle, FiPackage, FiTruck } from 'react-icons/fi';

const ProductVendorSearchModal = ({ isOpen, onClose, currentStep, acceptedVendor, onRetry }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={currentStep === 'searching' ? null : onClose}
      />

      {/* Modal Content */}
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white w-full max-w-sm rounded-[24px] p-6 shadow-2xl relative z-10 border border-gray-100 flex flex-col items-center text-center overflow-hidden"
      >
        {/* Step: SEARCHING / WAITING */}
        {(currentStep === 'searching' || currentStep === 'waiting') && (
          <div className="py-6 flex flex-col items-center">
            {/* Animated Radar Pulse */}
            <div className="relative w-24 h-24 flex items-center justify-center mb-6">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
              <div className="absolute inset-2 bg-blue-500/10 rounded-full animate-pulse" />
              <div className="w-16 h-16 bg-[#00246b] rounded-full flex items-center justify-center text-white z-10 shadow-lg shadow-blue-900/30">
                <FiPackage className="w-8 h-8 animate-bounce" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-gray-900 mb-2">Finding Nearby Product Vendors...</h3>
            <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
              We are broadcasting your product order to active local vendors. Please wait while a vendor accepts your order.
            </p>

            {/* Visible Countdown Timer */}
            <div className="mt-4 px-4 py-2 bg-slate-100 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-700 border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              <span>Redirecting to Tracking Page in 10s...</span>
            </div>

            <div className="mt-3 flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-bold">
              <FiTruck className="w-4 h-4" />
              Real-time Vendor Dispatch
            </div>
          </div>
        )}

        {/* Step: ACCEPTED */}
        {currentStep === 'accepted' && (
          <div className="py-6 flex flex-col items-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-4 animate-bounce">
              <FiCheckCircle className="w-10 h-10" />
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-1">Order Accepted!</h3>
            <p className="text-sm font-semibold text-emerald-600 mb-4">
              {acceptedVendor?.businessName || acceptedVendor?.name || 'Local Partner Vendor'} has accepted your order.
            </p>

            <div className="bg-gray-50 rounded-2xl p-4 w-full border border-gray-100 text-left space-y-2 mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 font-semibold uppercase">Vendor</span>
                <span className="font-bold text-gray-900">{acceptedVendor?.businessName || acceptedVendor?.name}</span>
              </div>
              {acceptedVendor?.phone && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 font-semibold uppercase">Contact</span>
                  <span className="font-bold text-gray-900">{acceptedVendor.phone}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 font-semibold uppercase">Status</span>
                <span className="font-bold text-emerald-600">Preparing Order</span>
              </div>
            </div>

            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Redirecting to Order Confirmation...</p>
          </div>
        )}

        {/* Step: FAILED */}
        {currentStep === 'failed' && (
          <div className="py-6 flex flex-col items-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
              <FiXCircle className="w-10 h-10" />
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-1">No Vendors Available</h3>
            <p className="text-xs text-gray-500 mb-6">
              Currently no nearby product vendors responded to your order alert. Please try again shortly.
            </p>

            <div className="flex gap-3 w-full">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 text-xs uppercase"
              >
                Close
              </button>
              <button
                onClick={onRetry}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-[#00246b] text-xs uppercase shadow-md active:scale-95 transition-all"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ProductVendorSearchModal;
