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
    const socket = io(socketUrl, {
      auth: { token: localStorage.getItem('accessToken') }
    });

    const handleEscalation = async (data) => {
      const bId = data.bookingId || data.id;
      if (bId) {
        try {
          const res = await adminBookingService.getBookingById(bId);
          if (res.success && res.data) {
            setActiveAlert(res.data);
            startAlarm();
          }
        } catch (err) {
          console.error(err);
        }
      }
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
    };

    socket.on('adminBookingEscalated', handleEscalation);
    socket.on('adminBookingDecline', handleEscalation);
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

  const handleAssignVendor = async (vendorId) => {
    try {
      const res = await adminBookingService.assignVendor(activeAlert._id, vendorId);
      if (res.success) {
        toast.success('Vendor assigned successfully!');
        stopAlarm();
        setActiveAlert(null);
        setShowVendorsModal(false);
        // Dispatch custom event to reload list views
        window.dispatchEvent(new Event('adminBookingAssigned'));
      }
    } catch (e) {
      toast.error(e.message || 'Failed to assign vendor');
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
                      <h4 className="font-bold text-gray-900 text-xs">{vendor.businessName || vendor.name}</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">{vendor.phone}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${vendor.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="text-[10px] text-gray-400">{vendor.isOnline ? 'Online' : 'Offline'} • {vendor.availability || 'N/A'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAssignVendor(vendor._id)}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded-lg transition-colors"
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
    </div>
  );
};

export default AdminLayout;

