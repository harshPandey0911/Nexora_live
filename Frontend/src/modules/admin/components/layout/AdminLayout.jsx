import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import { FiAlertTriangle, FiVolumeX, FiUserCheck, FiX } from 'react-icons/fi';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import AdminBottomNav from './AdminBottomNav';
import useAdminHeaderHeight from '../../hooks/useAdminHeaderHeight';
import adminVendorService from '../../../../services/adminVendorService';
import { adminBookingService } from '../../../../services/adminBookingService';
import useScrollLock from '../../../../hooks/useScrollLock';
import AdminVendorProfileModal from '../common/AdminVendorProfileModal';

const playBuzzerSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const playNote = (freq, duration, startTime) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    const now = audioCtx.currentTime;
    playNote(880, 0.25, now);
    playNote(660, 0.25, now + 0.25);
  } catch (e) {
    console.error('Failed to play synthesizer chime:', e);
  }
};

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const headerHeight = useAdminHeaderHeight();

  // Scroll main container to top on page transition
  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Bottom nav height is 64px (h-16)
  const bottomNavHeight = 64;

  // Add small buffer to prevent content overlap (8px)
  const topPadding = headerHeight + 8;
  const bottomPadding = bottomNavHeight + 8;

  // Global Alert Popup States
  const [activeAlert, setActiveAlert] = useState(null);
  const [showVendorsModal, setShowVendorsModal] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [viewingVendorId, setViewingVendorId] = useState(null);

  // Prevent background scroll when alerts or modals are open
  useScrollLock(!!activeAlert || showVendorsModal || !!viewingVendorId);

  const alarmIntervalRef = useRef(null);

  const startAlarm = () => {
    playBuzzerSound();
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    alarmIntervalRef.current = setInterval(playBuzzerSound, 1200);
  };

  const stopAlarm = () => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
  };

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/api$/, '') || 'http://localhost:5000';
    const adminToken = localStorage.getItem('adminAccessToken') || localStorage.getItem('accessToken');
    const socket = io(socketUrl, {
      auth: { token: adminToken },
      extraHeaders: { Authorization: `Bearer ${adminToken}` }
    });

    socket.on('connect', () => {
      console.log('✅ Admin socket connected:', socket.id);
      socket.emit('join_admin_room');
    });

    const handleEscalation = async (data) => {
      console.log('🚨 [AdminLayout] Received vendor cancellation/decline socket event:', data);
      const bId = data.bookingId || data.id;

      let bookingDetails = {
        _id: bId,
        id: bId,
        bookingNumber: data.bookingNumber || bId,
        declinedVendorName: data.vendorName || data.declinedVendorName || 'Vendor',
        declinedVendorId: data.vendorId || data.declinedVendorId,
        declineReason: data.reason || data.declineReason || 'Vendor declined booking / Pool exhausted',
        serviceName: data.serviceName || data.service || 'Service Booking'
      };

      try {
        const res = await adminBookingService.getBookingById(bId);
        if (res?.success && res.data) {
          bookingDetails = {
            ...bookingDetails,
            ...res.data,
            bookingNumber: res.data.bookingNumber || res.data._id,
            declinedVendorName: data.vendorName || res.data.declinedVendorName || 'Vendor',
            declineReason: data.reason || res.data.declineReason || 'Vendor declined booking / Pool exhausted'
          };
        }
      } catch (e) {
        console.error('Failed to fetch full booking details for escalation popup:', e);
      }

      setActiveAlert(bookingDetails);
      startAlarm();

      // Dispatch event to reload active booking lists across admin UI
      window.dispatchEvent(new CustomEvent('adminBookingStatusChanged', { detail: { bookingId: bId, status: data.status || 'ESCALATED' } }));
      window.dispatchEvent(new Event('adminBookingAssigned'));
    };

    const handleAcceptance = (data) => {
      const bId = data.bookingId || data.id;
      setActiveAlert(prev => {
        if (prev && String(prev._id || prev.id) === String(bId)) {
          stopAlarm();
          return null;
        }
        return prev;
      });
      // Trigger a window event to reload lists if needed
      window.dispatchEvent(new CustomEvent('adminBookingStatusChanged', { detail: { bookingId: bId, status: 'ACCEPTED' } }));
      window.dispatchEvent(new Event('adminBookingAssigned'));
    };

    socket.on('adminBookingDecline', handleEscalation);
    socket.on('vendor_cancelled_booking', handleEscalation);
    socket.on('vendor_rejected_booking', handleEscalation);
    socket.on('booking_cancelled_by_vendor', handleEscalation);
    socket.on('adminBookingAccept', handleAcceptance);

    return () => {
      socket.disconnect();
      stopAlarm();
    };
  }, []);

  const openVendorsList = async () => {
    setShowVendorsModal(true);
    setVendorsLoading(true);
    try {
      const res = await adminVendorService.getAllVendors({ status: 'approved' });
      if (res.success) {
        setVendors(res.data || []);
      }
    } catch (e) {
      toast.error('Failed to load active vendors');
    } finally {
      setVendorsLoading(false);
    }
  };

  const handleAssignVendor = async (vendorId, forceAssign = false) => {
    try {
      const res = await adminBookingService.assignVendor(activeAlert._id, vendorId, forceAssign);
      if (res.success) {
        toast.success('Vendor assigned successfully!');
        stopAlarm();
        setActiveAlert(null);
        setShowVendorsModal(false);
        // Dispatch custom event to reload list views
        window.dispatchEvent(new Event('adminBookingAssigned'));
      }
    } catch (e) {
      if (e.requireConfirmation || e.response?.data?.requireConfirmation) {
        const msg = e.message || e.response?.data?.message || 'Vendor does not hold active subscription. Force assign anyway?';
        if (window.confirm(`${msg}\n\nClick OK to Force Assign.`)) {
          handleAssignVendor(vendorId, true);
        }
      } else {
        toast.error(e.message || 'Failed to assign vendor');
      }
    }
  };

  const closeAlert = () => {
    stopAlarm();
    setActiveAlert(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-[278px] min-w-0 max-w-full overflow-x-hidden transition-all duration-300">
        {/* Header */}
        <AdminHeader onMenuClick={() => setSidebarOpen(true)} />

        {/* Page Content - with dynamic padding to account for fixed header and bottom nav */}
        <main
          className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto overflow-x-hidden lg:pb-6 lg:pt-24 scrollbar-admin w-full min-w-0"
          style={{
            // Mobile: Use calculated heights with safe area support
            // Desktop: Tailwind classes override these (lg:pt-24, lg:pb-6)
            paddingTop: `${Math.max(topPadding, 80)}px`,
            paddingBottom: `calc(${Math.max(bottomPadding, 80)}px + env(safe-area-inset-bottom, 0px))`,
          }}
        >
          <div className="w-full max-w-full overflow-x-hidden min-w-0">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom Navigation - Mobile Only */}
      <AdminBottomNav />

      {/* Global Urgent Booking Overlay Alert Pop-up */}
      {activeAlert && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-rose-100 flex flex-col"
          >
            {/* Header flashing */}
            <div className="p-4 bg-rose-500 text-white flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2">
                <FiAlertTriangle className="w-5 h-5" />
                <span className="font-bold text-sm uppercase tracking-wider">Urgent Manual Allocation</span>
              </div>
              <button
                onClick={closeAlert}
                className="p-1 hover:bg-rose-600 rounded-full transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Content info */}
            <div className="p-6 space-y-4">
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Order Identifier</span>
                <h3 className="font-black text-gray-900 text-base">#{activeAlert.bookingNumber}</h3>
              </div>

              {/* Show Declined Vendor Info if available */}
              {(activeAlert.declinedVendorName || activeAlert.declineReason || activeAlert.activityLog?.slice(-1)[0]?.action?.includes('Rejected')) && (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 space-y-1">
                  <span className="text-[9px] text-rose-500 font-bold uppercase tracking-wide">Declined By Vendor</span>
                  <p className="text-xs text-rose-800 font-bold">
                    <button
                      type="button"
                      onClick={() => setViewingVendorId(activeAlert.declinedVendorId || activeAlert.vendorId?._id || activeAlert.vendorId)}
                      className="hover:underline text-rose-900 cursor-pointer text-left"
                    >
                      {activeAlert.declinedVendorName || 'Vendor'} ↗
                    </button>
                  </p>
                  {(activeAlert.declineReason || activeAlert.activityLog?.slice(-1)[0]?.note) && (
                    <p className="text-[11px] text-rose-600 font-medium italic">
                      "{activeAlert.declineReason || activeAlert.activityLog?.slice(-1)[0]?.note}"
                    </p>
                  )}
                </div>
              )}

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
                <span className="text-[9px] text-gray-400 font-bold uppercase">Requested Service</span>
                <h4 className="font-bold text-gray-800 text-sm">
                  {activeAlert.items?.[0]?.serviceId?.title || activeAlert.serviceName || 'Nexora Service'}
                </h4>
                <p className="text-xs text-gray-500 font-semibold">
                  Scheduled Time: {activeAlert.timeSlot?.time || 'ASAP'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] text-gray-400 font-bold uppercase">Customer Details</span>
                <p className="text-xs text-gray-800 font-bold">
                  {activeAlert.userId?.name || activeAlert.customerName || 'Guest'}
                </p>
                <p className="text-xs text-gray-500 font-medium">
                  Phone: {activeAlert.userId?.phone || activeAlert.customerPhone}
                </p>
                <p className="text-[11px] text-gray-500 leading-tight">
                  Address: {activeAlert.location?.address}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={closeAlert}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-white transition-all flex items-center justify-center gap-1.5"
              >
                <FiVolumeX className="w-4 h-4" /> Stop & Close
              </button>
              <button
                onClick={openVendorsList}
                className="flex-[2] py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-1.5"
              >
                <FiUserCheck className="w-4 h-4" /> Assign Vendor
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Global Approved Vendor List Modal */}
      {showVendorsModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">Select Vendor</h3>
              <button
                onClick={() => setShowVendorsModal(false)}
                className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {vendorsLoading ? (
                <div className="py-8 text-center text-xs text-gray-500">Loading approved vendors...</div>
              ) : vendors.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500">No active vendors found</div>
              ) : (
                vendors.map(vendor => (
                  <div
                    key={vendor._id}
                    className="p-3 border border-gray-100 rounded-xl flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <button
                        type="button"
                        onClick={() => setViewingVendorId(vendor._id)}
                        className="font-bold text-gray-900 text-xs hover:text-blue-600 hover:underline text-left"
                      >
                        {vendor.businessName || vendor.name} ↗
                      </button>
                      <p className="text-[10px] text-gray-400 mt-0.5">{vendor.phone}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${vendor.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="text-[10px] text-gray-400">{vendor.isOnline ? 'Online' : 'Offline'} • {vendor.availability || 'N/A'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAssignVendor(vendor._id)}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Assign
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Vendor Profile Modal */}
      <AdminVendorProfileModal
        vendorId={viewingVendorId}
        isOpen={!!viewingVendorId}
        onClose={() => setViewingVendorId(null)}
      />
    </div>
  );
};

export default AdminLayout;

