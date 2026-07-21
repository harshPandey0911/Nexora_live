import React, { useState, useEffect } from 'react';
import { FiX, FiUser, FiPhone, FiMail, FiMapPin, FiStar, FiCheckCircle, FiShield, FiBriefcase, FiActivity, FiXCircle } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import adminVendorService from '../../../../services/adminVendorService';
import useScrollLock from '../../../../hooks/useScrollLock';

const AdminVendorProfileModal = ({ vendorId, isOpen, onClose }) => {
  useScrollLock(isOpen);
  const [vendorData, setVendorData] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !vendorId) {
      setVendorData(null);
      setStatsData(null);
      return;
    }

    const fetchVendor = async () => {
      try {
        setLoading(true);
        const res = await adminVendorService.getVendorDetails(vendorId);
        if (res.success && res.data) {
          const v = res.data.vendor || res.data;
          const s = res.data.stats || {};
          setVendorData(v);
          setStatsData(s);
        }
      } catch (err) {
        console.error('Failed to fetch vendor details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchVendor();
  }, [isOpen, vendorId]);

  if (!isOpen) return null;

  const addressText = vendorData?.address?.fullAddress || 
    (vendorData?.address?.addressLine1 ? `${vendorData.address.addressLine1}${vendorData.address.city ? `, ${vendorData.address.city}` : ''}` : null);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh] border border-gray-100"
        >
          {/* Header */}
          <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between relative overflow-hidden">
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-lg border border-white/20 shrink-0">
                <FiUser className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-base leading-tight truncate">
                  {loading ? 'Loading profile...' : (vendorData?.businessName || vendorData?.name || 'Vendor Profile')}
                </h3>
                <p className="text-xs text-blue-100 mt-0.5 truncate">
                  {vendorData?.name ? `Owner: ${vendorData.name}` : 'Vendor Details'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors text-white relative z-10"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {loading ? (
              <div className="py-12 text-center text-xs text-gray-500 font-medium animate-pulse">
                Fetching vendor profile data...
              </div>
            ) : !vendorData ? (
              <div className="py-12 text-center text-xs text-gray-400">
                Unable to load vendor information.
              </div>
            ) : (
              <>
                {/* Status Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${vendorData.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${vendorData.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {vendorData.isOnline ? 'Online' : 'Offline'}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${vendorData.approvalStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {vendorData.approvalStatus?.toUpperCase() || 'APPROVED'}
                  </span>
                  {vendorData.level && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                      Level {vendorData.level}
                    </span>
                  )}
                </div>

                {/* Contact Information */}
                <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5 border border-gray-100 text-xs">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Contact Details</h4>
                  {vendorData.phone ? (
                    <a href={`tel:${vendorData.phone}`} className="flex items-center gap-2 text-gray-800 hover:text-blue-600 font-semibold">
                      <FiPhone className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>{vendorData.phone}</span>
                    </a>
                  ) : (
                    <div className="text-[11px] text-gray-400 italic">No phone provided</div>
                  )}

                  {vendorData.email ? (
                    <a href={`mailto:${vendorData.email}`} className="flex items-center gap-2 text-gray-800 hover:text-blue-600 font-semibold">
                      <FiMail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="truncate">{vendorData.email}</span>
                    </a>
                  ) : (
                    <div className="text-[11px] text-gray-400 italic">No email provided</div>
                  )}

                  {addressText && (
                    <div className="flex items-start gap-2 text-gray-600 pt-2 border-t border-gray-200/60 mt-1">
                      <FiMapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-2 leading-relaxed">{addressText}</span>
                    </div>
                  )}
                </div>

                {/* Performance Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                    <span className="text-[9px] font-bold text-blue-600 uppercase block">Rating</span>
                    <span className="text-base font-black text-blue-900 flex items-center justify-center gap-1">
                      <FiStar className="w-3.5 h-3.5 fill-blue-500 text-blue-500" />
                      {(vendorData.rating || 5.0).toFixed(1)}
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                    <span className="text-[9px] font-bold text-emerald-600 uppercase block">Done Jobs</span>
                    <span className="text-base font-black text-emerald-900">
                      {statsData?.completedBookings ?? vendorData.completedJobs ?? 0}
                    </span>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100 text-center">
                    <span className="text-[9px] font-bold text-purple-600 uppercase block">Score</span>
                    <span className="text-base font-black text-purple-900">
                      {vendorData.performanceScore ?? 100}%
                    </span>
                  </div>
                </div>

                {/* Service Offerings */}
                {((vendorData.categories && vendorData.categories.length > 0) || (vendorData.service && vendorData.service.length > 0)) && (
                  <div>
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Offered Services</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {(vendorData.categories?.length ? vendorData.categories : vendorData.service || []).map((cat, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-gray-100 text-gray-700 text-[10px] font-bold rounded-lg border border-gray-200">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold transition-all shadow-sm"
            >
              Close Profile
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AdminVendorProfileModal;
