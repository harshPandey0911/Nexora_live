import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiAlertCircle, FiRefreshCw, FiX } from 'react-icons/fi';

const CategoryConflictModal = ({
  isOpen,
  conflictType = 'category',
  existingShopName = '',
  newShopName = '',
  onReplace,
  onCancel
}) => {
  if (!isOpen) return null;

  const isShopConflict = conflictType === 'shop';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 z-10 space-y-5"
        >
          {/* Close button */}
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <FiX className="w-5 h-5" />
          </button>

          {/* Header Icon & Title */}
          <div className="flex items-center gap-3 pr-8">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shrink-0">
              <FiAlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                {isShopConflict ? 'Different Shop / Restaurant' : 'Different Service Category'}
              </h3>
            </div>
          </div>

          {/* Dialog Message */}
          <div className="space-y-3 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <p>
              {isShopConflict
                ? `Your cart contains items from ${existingShopName ? `"${existingShopName}"` : 'another shop/restaurant'}. You can only order items from one shop or restaurant at a time.`
                : 'Your cart already contains services from another category. You can only book one service category in a single booking.'}
            </p>
            <p className="font-bold text-slate-900">
              {isShopConflict
                ? `Would you like to clear your cart and add items from ${newShopName ? `"${newShopName}"` : 'the new shop'} instead?`
                : 'Would you like to replace your current cart with this new service?'}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={onReplace}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
            >
              <FiRefreshCw className="w-3.5 h-3.5" />
              <span>Replace</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CategoryConflictModal;
