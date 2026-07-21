import React, { useState } from 'react';
import { FiX, FiAlertTriangle } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import useScrollLock from '../../../../hooks/useScrollLock';

const PRESET_REASONS = [
  'Currently busy with another booking',
  'Out of service area / Too far',
  'Staff or workers unavailable',
  'Equipment or tools unavailable',
  'Schedule conflict',
  'Other (Specify below)'
];

const RejectionReasonModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Decline Booking Request'
}) => {
  useScrollLock(isOpen);
  const [selectedReason, setSelectedReason] = useState(PRESET_REASONS[0]);
  const [customReason, setCustomReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalReason = selectedReason.startsWith('Other') 
      ? (customReason.trim() || 'Declined by vendor')
      : selectedReason;

    if (onConfirm) {
      onConfirm(finalReason);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 relative z-10 overflow-hidden border border-rose-100"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
            >
              <FiX className="w-5 h-5" />
            </button>

            {/* Header Icon */}
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-4 text-rose-500 shadow-sm">
              <FiAlertTriangle className="w-7 h-7" />
            </div>

            <div className="text-center mb-5">
              <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
              <p className="text-xs text-gray-500">
                Please select or enter a reason for declining this booking request.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Radio List of Reasons */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {PRESET_REASONS.map((r) => (
                  <label
                    key={r}
                    onClick={() => setSelectedReason(r)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                      selectedReason === r
                        ? 'border-rose-500 bg-rose-50/60 text-rose-900 shadow-sm'
                        : 'border-gray-100 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="rejectionReason"
                      checked={selectedReason === r}
                      onChange={() => setSelectedReason(r)}
                      className="accent-rose-500 w-4 h-4"
                    />
                    <span className="leading-tight">{r}</span>
                  </label>
                ))}
              </div>

              {/* Custom Reason Textarea if "Other" is chosen */}
              {selectedReason.startsWith('Other') && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <textarea
                    rows={2}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Type specific reason..."
                    className="w-full p-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-gray-800"
                    required
                  />
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl font-bold text-xs text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
                >
                  Keep Order
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-md shadow-rose-200"
                >
                  Confirm Decline
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default RejectionReasonModal;
