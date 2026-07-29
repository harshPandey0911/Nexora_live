import React from 'react';
import { FiX, FiDollarSign, FiCheckCircle } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import flutterBridge from '../../../../utils/flutterBridge';

const WorkCompletionModal = ({ isOpen, onClose, job, onComplete, loading }) => {

  const calculateTotal = () => {
    // For Plan Benefit, user only pays for Extra Charges
    if (job?.paymentMethod === 'plan_benefit') {
      return job?.extraChargesTotal || 0;
    }

    // For normal bookings, prefer finalAmount (even if 0)
    if (typeof job?.finalAmount === 'number') {
      return job.finalAmount;
    }

    return ((job?.basePrice || 0) + (job?.tax || 0) - (job?.discount || 0));
  };

  const handleSubmit = () => {
    // Photos no longer mandatory as per simplified flow
    onComplete([]);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="bg-white w-full max-w-sm sm:max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden"
          >
            <div className="flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="px-5 pt-5 pb-3 flex justify-between items-start flex-shrink-0 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">Complete Work</h3>
                  <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider mt-0.5">Final Step</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 active:scale-95 cursor-pointer"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="px-5 py-4 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                <p className="text-xs text-gray-500 font-medium leading-relaxed">
                  Confirm all tasks are completed as per the quality standards.
                </p>

                {/* Quality Checklist */}
                <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-2 text-emerald-700 mb-2">
                    <FiCheckCircle className="w-4 h-4 shrink-0" />
                    <span className="font-bold text-xs">Quality Checklist</span>
                  </div>
                  <ul className="space-y-1.5">
                    {[
                      'Double checked the results',
                      'Cleaned up work area',
                      'Customer satisfaction confirmed'
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-[11px] font-semibold text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Payment Info */}
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Bill Value</p>
                    <p className="text-base font-bold text-gray-800">₹{calculateTotal().toFixed(2)}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center text-green-600 shadow-2xs">
                    <FiDollarSign className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Action Buttons (Fixed at Bottom) */}
              <div className="px-5 py-3.5 bg-white border-t border-gray-100 flex-shrink-0">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={onClose}
                    className="py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors active:scale-95 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="py-2.5 rounded-xl text-xs font-bold text-white shadow-md shadow-green-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
                    style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
                  >
                    {loading ? 'Confirming...' : 'Complete Work'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default WorkCompletionModal;
