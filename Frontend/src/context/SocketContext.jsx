import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { playNotificationSound, isSoundEnabled, playAlertRing } from '../utils/notificationSound';
import { registerFCMToken } from '../services/pushNotificationService';
import { acceptBooking, rejectBooking, assignWorker } from '../modules/vendor/services/bookingService';
import { FiX } from 'react-icons/fi';

const SwipeableNotification = ({ t, data, onClick, onReassign, onSelfAssignSuccess }) => {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-200, 0, 200], [0, 1, 0]);
  const [isActionLoading, setIsActionLoading] = useState(null);

  const handleAction = async (e, action) => {
    e.stopPropagation();
    if (!data.bookingId) return;
    
    setIsActionLoading(action);
    try {
      if (action === 'accept') {
        await acceptBooking(data.bookingId);
        // Clear from localStorage so the modal doesn't reappear
        const pending = JSON.parse(localStorage.getItem('vendorPendingJobs') || '[]');
        localStorage.setItem('vendorPendingJobs', JSON.stringify(
          pending.filter(j => String(j.id || j._id) !== String(data.bookingId))
        ));
        window.dispatchEvent(new CustomEvent('removeVendorBooking', { detail: { id: data.bookingId } }));
        assignWorker(data.bookingId, 'SELF').catch(() => {});
        toast.success('Job Accepted!');
      } else if (action === 'reassign') {
        onReassign?.();
        toast.dismiss(t.id);
      } else if (action === 'self_assign') {
        await assignWorker(data.bookingId, 'SELF');
        window.dispatchEvent(new Event('vendorJobsUpdated'));
        toast.success('Assigned to yourself!');
        toast.dismiss(t.id);
        onSelfAssignSuccess?.();
      } else {
        await rejectBooking(data.bookingId, 'Rejected from notification');
        toast.success('Job Skipped');
      }
      window.dispatchEvent(new Event('vendorJobsUpdated'));
      toast.dismiss(t.id);
    } catch (err) {
      console.error(`Error ${action}ing job:`, err);
      toast.error(`Failed to ${action} job`);
    } finally {
      setIsActionLoading(null);
    }
  };

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      style={{ x, opacity }}
      onDragEnd={(e, { offset, velocity }) => {
        const swipe = Math.abs(offset.x) * velocity.x;
        if (Math.abs(offset.x) > 80) { // Threshold
          toast.dismiss(t.id);
        }
      }}
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{
        opacity: t.visible ? 1 : 0,
        y: t.visible ? 0 : -20,
        scale: t.visible ? 1 : 0.95
      }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      whileTap={{ scale: 0.98 }}
      className="w-full min-w-[340px] sm:min-w-[500px] md:min-w-[560px] max-w-2xl bg-[#1A1D21] border border-white/10 shadow-2xl rounded-2xl sm:rounded-3xl pointer-events-auto flex flex-col ring-1 ring-white/5 cursor-pointer overflow-hidden relative"
      onClick={onClick}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toast.dismiss(t.id);
        }}
        className="absolute top-2.5 right-2.5 z-20 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        title="Dismiss Notification"
      >
        <FiX className="w-4 h-4" />
      </button>

      <div className="w-full p-4 sm:p-5 pr-9">
        <div className="flex items-center gap-3.5">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg border border-white/10 shrink-0">
              <span className="text-lg sm:text-xl">{data.type === 'new_booking_request' ? '⚡' : '🔔'}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-bold text-white tracking-tight shrink-0 uppercase">
                {data.title}
              </p>
              {data.message && (
                <span className="hidden sm:inline text-gray-500 text-xs font-bold">•</span>
              )}
              <p className="text-xs font-normal text-gray-300 leading-snug sm:truncate">
                {data.message}
              </p>
            </div>
            {data.type === 'new_booking_request' && (
              <span className="text-[9px] font-black px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/20 uppercase tracking-widest animate-pulse shrink-0 self-start sm:self-auto">
                Urgent
              </span>
            )}
          </div>
        </div>
      </div>
      
      {data.type === 'new_booking_request' && (
        <div className="flex border-t border-white/5 p-3 gap-3 bg-white/[0.02]">
          <button
            disabled={!!isActionLoading}
            onClick={(e) => handleAction(e, 'accept')}
            className="flex-1 bg-emerald-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all active:scale-95 disabled:opacity-50"
          >
            {isActionLoading === 'accept' ? '...' : 'Accept Job'}
          </button>
          <button
            disabled={!!isActionLoading}
            onClick={(e) => handleAction(e, 'reject')}
            className="flex-1 bg-white/5 text-gray-500 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-gray-300 transition-all active:scale-95 disabled:opacity-50 border border-white/5"
          >
            {isActionLoading === 'reject' ? '...' : 'Reject'}
          </button>
        </div>
      )}

      {data.type === 'worker_job_rejected' && (
        <div className="flex border-t border-white/5 p-3 gap-3 bg-white/[0.02]">
          <button
            disabled={!!isActionLoading}
            onClick={(e) => handleAction(e, 'reassign')}
            className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all active:scale-95 disabled:opacity-50"
          >
            {isActionLoading === 'reassign' ? '...' : 'Reassign Worker'}
          </button>
          <button
            disabled={!!isActionLoading}
            onClick={(e) => handleAction(e, 'self_assign')}
            className="flex-1 bg-white/5 text-gray-300 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all active:scale-95 disabled:opacity-50 border border-white/5"
          >
            {isActionLoading === 'self_assign' ? '...' : 'Do It Myself'}
          </button>
        </div>
      )}
    </motion.div>
  );
};

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/api$/, '') || 'http://localhost:5000';

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Determine user type based on path
  const getUserType = (path) => {
    if (path.startsWith('/vendor')) return 'vendor';
    if (path.startsWith('/worker')) return 'worker';
    if (path.startsWith('/admin')) return 'admin';
    if (path.startsWith('/user')) return 'user';
    return null;
  };

  const userType = getUserType(location.pathname);

  useEffect(() => {
    if (!userType) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    let tokenKey = 'accessToken';
    switch (userType) {
      case 'vendor':
        tokenKey = 'vendorAccessToken';
        break;
      case 'worker':
        tokenKey = 'workerAccessToken';
        break;
      case 'admin':
        tokenKey = 'adminAccessToken';
        break;
      case 'user':
      default:
        tokenKey = 'accessToken';
        break;
    }

    const token = localStorage.getItem(tokenKey);
    // If no token, we don't connect
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Reuse existing socket if userType hasn't changed (effectively) is handled by React deps
    // But basic useEffect will re-run if dependencies change.
    // userType changes -> re-run.

    // Disconnect previous if any
    if (socket) {
      // Optimization: if we are already connected with same token/auth, maybe don't reconnect?
      // But determining that is hard. Simpler to reconnect.
      socket.disconnect();
    }

    // Use HTTP URL for socket.io client - it handles WS upgrade automatically
    const socketBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/api$/, '') || 'http://localhost:5000';

    const newSocket = io(socketBaseUrl, {
      auth: {
        token: token
      },
      extraHeaders: {
        Authorization: `Bearer ${token}`
      },
      transports: ['websocket', 'polling'], // Prioritize websocket for speed
      path: '/socket.io/',
      secure: window.location.protocol === 'https:',
      rejectUnauthorized: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      // console.log(`✅ ${userType.toUpperCase()} App Socket connected`);

      // Register FCM token for push notifications (on page load/refresh)
      if (userType && token) {
        // console.log(`[SocketContext] Registering FCM token for ${userType}...`);
        registerFCMToken(userType, true).then((fcmToken) => {
          if (fcmToken) {
            // console.log(`[SocketContext] ✅ FCM token registered for ${userType}`);
          } else {
            // console.log(`[SocketContext] ⚠️ FCM token registration returned null for ${userType}`);
          }
        }).catch((err) => {
          // console.error(`[SocketContext] ❌ FCM token registration failed for ${userType}:`, err);
        });
      }

      // If vendor, join vendor-specific room just in case backend expects it
      if (userType === 'vendor') {
        const vendorData = JSON.parse(localStorage.getItem('vendorData') || '{}');
        const vendorId = vendorData.id || vendorData._id;
        if (vendorId) {
          newSocket.emit('join_vendor_room', vendorId);
        }
      }

      // If admin, explicitly join admin_room
      if (userType === 'admin') {
        newSocket.emit('join_admin_room');
      }
    });

    newSocket.on('disconnect', () => {
      // console.log(`❌ ${userType.toUpperCase()} App Socket disconnected`);
    });

    newSocket.on('connect_error', (err) => {
      // Silently handle typical connection errors to avoid spam, or log only critical ones
      // console.error(`Socket connection error (${userType}):`, err);
    });

    // Listen for generic notifications
    newSocket.on('notification', (data) => {
      // Skip showing generic notification to vendor if it's a new booking request,
      // since 'new_booking_request' event handles this interactively.
      if (userType === 'vendor' && (data.type === 'booking_request' || data.type === 'booking_requested')) {
        return;
      }

      if (isSoundEnabled(userType)) {
        playNotificationSound();
      }

      // Show custom toast for all notifications
      toast.custom((t) => (
        <SwipeableNotification
          t={t}
          data={data}
          onClick={() => {
            toast.dismiss(t.id);
            // Optional: navigate based on relatedId
            if (data.relatedId) {
              if (userType === 'vendor') navigate(`/vendor/booking/${data.relatedId}`);
              else if (userType === 'worker') navigate(`/worker/job/${data.relatedId}`);
              else navigate(`/user/booking/${data.relatedId}`);
            }
          }}
        />
      ), {
        id: 'socket-notification', // Prevent stacking
        duration: 3500, // Slightly longer to allow interaction/reading since it's dismissible
        position: 'top-right',
        style: { maxWidth: '100%', width: 'auto' }
      });

      // Dispatch update events to refresh UI components
      if (userType === 'worker') {
        window.dispatchEvent(new Event('workerJobsUpdated'));
        window.dispatchEvent(new Event('workerNotificationsUpdated'));
      }
      if (userType === 'vendor') {
        window.dispatchEvent(new Event('vendorJobsUpdated'));
        window.dispatchEvent(new Event('vendorNotificationsUpdated'));
        window.dispatchEvent(new Event('vendorStatsUpdated'));
      }
      if (userType === 'user') {
        window.dispatchEvent(new Event('userBookingsUpdated'));
      }
    });

    // Listen for real-time booking updates
    newSocket.on('booking_updated', (data) => {
      // console.log('Booking Updated:', data);
      if (userType === 'user') window.dispatchEvent(new Event('userBookingsUpdated'));
      if (userType === 'vendor') window.dispatchEvent(new Event('vendorJobsUpdated'));
      if (userType === 'worker') window.dispatchEvent(new Event('workerJobsUpdated'));
    });

    // Listen for product order status updates (user & vendor)
    newSocket.on('product_order_status_update', (data) => {
      if (userType === 'user') {
        window.dispatchEvent(new CustomEvent('productOrderStatusUpdate', { detail: data }));
      }
      if (userType === 'vendor') {
        window.dispatchEvent(new Event('vendorJobsUpdated'));
        window.dispatchEvent(new Event('vendorNotificationsUpdated'));
      }
    });

    // ─── DELIVERY OTP — USER SIDE ────────────────────────────────────────────
    // When worker initiates OTP, user sees a big prominent OTP popup
    if (userType === 'user') {
      newSocket.on('product_delivery_otp', (data) => {
        const { otp, customOrderId, message } = data;

        // Play notification sound
        if (isSoundEnabled('user')) playNotificationSound();

        // Show a large persistent toast with the OTP prominently displayed
        toast.custom(
          (t) => (
            <motion.div
              initial={{ opacity: 0, y: -30, scale: 0.9 }}
              animate={{ opacity: t.visible ? 1 : 0, y: t.visible ? 0 : -30, scale: t.visible ? 1 : 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-emerald-400 pointer-events-auto"
            >
              {/* Header */}
              <div className="bg-emerald-500 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📦</span>
                  <div>
                    <p className="text-white font-black text-sm uppercase tracking-wide">Delivery OTP</p>
                    <p className="text-emerald-100 text-xs font-medium">Order #{customOrderId}</p>
                  </div>
                </div>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="text-white/80 hover:text-white w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              {/* OTP Display */}
              <div className="px-5 py-5 text-center">
                <p className="text-slate-500 text-sm font-medium mb-3">Share this OTP with the delivery person</p>
                <div className="flex gap-2 justify-center mb-4">
                  {String(otp).split('').map((digit, i) => (
                    <div
                      key={i}
                      className="w-14 h-14 bg-emerald-50 border-2 border-emerald-400 rounded-2xl flex items-center justify-center text-2xl font-black text-emerald-700 shadow-sm"
                    >
                      {digit}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 font-medium">Valid for 15 minutes</p>
                <p className="text-xs text-slate-500 mt-1">{message}</p>
              </div>

              {/* Dismiss */}
              <div className="px-5 pb-4">
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm active:scale-95 transition-transform"
                >
                  Got it!
                </button>
              </div>
            </motion.div>
          ),
          {
            id: `delivery-otp-${data.orderId}`,
            duration: 180000, // 3 minutes — stays until dismissed
            position: 'top-center',
            style: { maxWidth: '100%', width: 'auto', padding: 0 }
          }
        );

        // Also dispatch event so order detail page can refresh if open
        window.dispatchEvent(new CustomEvent('productOrderStatusUpdate', { detail: data }));
      });
    }


    // Listen for special Vendor Booking Requests & Product Orders
    if (userType === 'vendor') {
      const handleVendorBookingAlert = (data) => {
        console.log('🚨 New Vendor Request Alert Received on Socket:', data);

        // Acknowledge receipt to server
        newSocket.emit('booking_alert_received', { bookingId: data.bookingId || data.orderId });

        // Play urgent alert ring
        playAlertRing();

        // Save to localStorage for the Alert screen and Dashboard to read
        const newJob = {
          id: data.bookingId || data.orderId,
          orderId: data.orderId || data.customOrderId,
          isProductOrder: !!(data.orderId || data.customOrderId),
          serviceType: data.serviceName || 'Product Order',
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          location: {
            address: data.address?.addressLine1 || 'Location shared',
            distance: data.distance ? `${data.distance.toFixed(1)} km` : 'Near you'
          },
          price: data.price || data.totalAmount,
          vendorEarnings: data.vendorEarnings,
          serviceCategory: data.serviceCategory || 'Product',
          brandName: data.brandName,
          brandIcon: data.brandIcon,
          categoryIcon: data.categoryIcon,
          scheduledDate: data.scheduledDate,
          timeSlot: {
            date: (data.scheduledDate && !isNaN(new Date(data.scheduledDate).getTime()))
              ? new Date(data.scheduledDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
              : (data.createdAt && !isNaN(new Date(data.createdAt).getTime()) 
                  ? new Date(data.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'Today'),
            time: data.scheduledTime || 'Immediate'
          },
          status: 'requested',
          createdAt: data.createdAt || new Date().toISOString(),
          expiresAt: data.expiresAt,
          assignedByAdmin: data.assignedByAdmin,
          force: true
        };

        const pendingJobs = JSON.parse(localStorage.getItem('vendorPendingJobs') || '[]');
        const existingIndex = pendingJobs.findIndex(job => String(job.id || job._id) === String(newJob.id));
        if (existingIndex !== -1) {
          pendingJobs.splice(existingIndex, 1);
        }
        pendingJobs.unshift(newJob);
        localStorage.setItem('vendorPendingJobs', JSON.stringify(pendingJobs));

        // Update stats
        const stats = JSON.parse(localStorage.getItem('vendorStats') || '{}');
        stats.pendingAlerts = (stats.pendingAlerts || 0) + 1;
        localStorage.setItem('vendorStats', JSON.stringify(stats));

        // Instantly trigger global booking alert modal
        window.dispatchEvent(new CustomEvent('showDashboardBookingAlert', { detail: newJob }));

        // Show interactive toast notification with buttons
        toast.custom((t) => (
          <SwipeableNotification
            t={t}
            data={{
              ...data,
              type: 'new_booking_request',
              title: newJob.isProductOrder ? '📦 NEW PRODUCT ORDER' : '⚡ NEW BOOKING SIGNAL',
              message: `Incoming ${newJob.serviceType} request from ${data.customerName}. Accept now to secure order.`
            }}
            onClick={() => {
              toast.dismiss(t.id);
              if (newJob.isProductOrder) {
                navigate('/vendor/product-orders');
              } else {
                navigate(`/vendor/booking/${data.bookingId}`);
              }
            }}
          />
        ), {
          id: `new-booking-${newJob.id}`,
          duration: 10000,
          position: 'top-right',
          style: { maxWidth: '100%', width: 'auto' }
        });

        // Notify app components to refresh
        window.dispatchEvent(new Event('vendorJobsUpdated'));
        window.dispatchEvent(new Event('vendorStatsUpdated'));
        window.dispatchEvent(new Event('vendorNotificationsUpdated'));
      };

      newSocket.on('new_product_order_alert', handleVendorBookingAlert);
      newSocket.on('new_booking_request', handleVendorBookingAlert);

      // Listen for booking_taken - when another vendor accepts a job
      newSocket.on('booking_taken', (data) => {
        // console.log('⚡ Booking taken by another vendor:', data);
        const takenBookingId = String(data.bookingId);

        // Remove from localStorage
        const pendingJobs = JSON.parse(localStorage.getItem('vendorPendingJobs') || '[]');
        const updatedPending = pendingJobs.filter(job => {
          const jobId = String(job.id || job._id);
          return jobId !== takenBookingId;
        });
        localStorage.setItem('vendorPendingJobs', JSON.stringify(updatedPending));

        // Update stats
        const stats = JSON.parse(localStorage.getItem('vendorStats') || '{}');
        if (stats.pendingAlerts > 0) {
          stats.pendingAlerts = Math.max(0, (stats.pendingAlerts || 0) - 1);
          localStorage.setItem('vendorStats', JSON.stringify(stats));
        }

        // Show toast notification
        toast.error(data.message || 'Job taken by another vendor', { icon: '⚡' });

        // Dispatch specific remove event for instant UI update
        window.dispatchEvent(new CustomEvent('removeVendorBooking', { detail: { id: takenBookingId } }));

        // Notify app components to refresh
        window.dispatchEvent(new Event('vendorJobsUpdated'));
        window.dispatchEvent(new Event('vendorStatsUpdated'));
      });

      // Listen for removeVendorBooking - generic removal (timeout, cancellation, etc.)
      newSocket.on('removeVendorBooking', (data) => {
        const bookingId = String(data.bookingId || data.id);

        // Remove from localStorage
        const pendingJobs = JSON.parse(localStorage.getItem('vendorPendingJobs') || '[]');
        const updatedPending = pendingJobs.filter(job => String(job.id || job._id) !== bookingId);
        localStorage.setItem('vendorPendingJobs', JSON.stringify(updatedPending));

        // Update stats
        const stats = JSON.parse(localStorage.getItem('vendorStats') || '{}');
        if (stats.pendingAlerts > 0) {
          stats.pendingAlerts = Math.max(0, (stats.pendingAlerts || 0) - 1);
          localStorage.setItem('vendorStats', JSON.stringify(stats));
        }

        // Dispatch specific remove event for instant UI update
        window.dispatchEvent(new CustomEvent('removeVendorBooking', { detail: { id: bookingId } }));
        window.dispatchEvent(new Event('vendorJobsUpdated'));
        window.dispatchEvent(new Event('vendorStatsUpdated'));
      });

      // Listen for worker responses to assignments
      newSocket.on('worker_job_accepted', (data) => {
        toast.success(`Worker accepted job #${data.bookingNumber || ''}`);
        window.dispatchEvent(new CustomEvent('workerJobStatusChanged', { detail: { bookingId: data.bookingId, status: 'ACCEPTED' } }));
        window.dispatchEvent(new Event('vendorJobsUpdated'));
      });

      newSocket.on('worker_job_rejected', (data) => {
        window.dispatchEvent(new CustomEvent('workerJobStatusChanged', { detail: { bookingId: data.bookingId, status: 'REJECTED' } }));
        window.dispatchEvent(new Event('vendorJobsUpdated'));

        if (isSoundEnabled('vendor')) {
          playNotificationSound();
        }

        toast.custom((t) => (
          <SwipeableNotification
            t={t}
            data={{
              bookingId: data.bookingId,
              type: 'worker_job_rejected',
              title: 'Worker Declined Job',
              message: `Worker declined job #${data.bookingNumber || ''}`
            }}
            onClick={() => {
              toast.dismiss(t.id);
              navigate(`/vendor/booking/${data.bookingId}`);
            }}
            onReassign={() => {
              navigate(`/vendor/booking/${data.bookingId}/assign-worker`);
            }}
            onSelfAssignSuccess={() => {
              navigate(`/vendor/booking/${data.bookingId}`);
            }}
          />
        ), {
          id: `worker-rejected-${data.bookingId}`,
          duration: 10000,
          position: 'top-right',
          style: { maxWidth: '100%', width: 'auto' }
        });
      });
    }

    // Listen for special Worker Job Assignments
    if (userType === 'worker') {
      newSocket.on('new_job_assigned', (data) => {
        // Play urgent alert ring
        playAlertRing();

        const newJob = {
          id: data.bookingId,
          _id: data.bookingId,
          serviceType: data.serviceName || 'Service',
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          location: {
            address: data.address?.addressLine1 || 'Location shared',
          },
          price: data.price,
          scheduledDate: data.scheduledDate,
          scheduledTime: data.scheduledTime,
          timeSlot: {
            date: new Date(data.scheduledDate).toLocaleDateString(),
            time: data.scheduledTime
          },
          status: 'ASSIGNED',
          createdAt: new Date().toISOString()
        };

        const pendingJobs = JSON.parse(localStorage.getItem('workerPendingJobs') || '[]');
        if (!pendingJobs.find(job => String(job.id || job._id) === String(newJob.id))) {
          pendingJobs.unshift(newJob);
          localStorage.setItem('workerPendingJobs', JSON.stringify(pendingJobs));
        }

        // Notify app components to refresh
        window.dispatchEvent(new Event('workerJobsUpdated'));

        // Always show the global alert 
        const event = new CustomEvent('showWorkerJobAlert', { detail: newJob });
        window.dispatchEvent(event);
      });

      // Listen for Product Order delivery task assignments
      newSocket.on('new_product_delivery_task', (data) => {
        // Play urgent alert ring
        playAlertRing();

        const addr = data.deliveryAddress;
        const addressStr = addr
          ? (addr.addressLine1 ? `${addr.addressLine1}, ${addr.city || ''}`.trim().replace(/,\s*$/, '') : addr.fullAddress || addr.address || 'Location shared')
          : 'Location shared';

        const newJob = {
          id: String(data.orderId || data.customOrderId),
          _id: String(data.orderId || data.customOrderId),
          serviceType: data.items?.[0]?.title || 'Product Delivery',
          customerName: data.contactDetails?.name || data.contactDetails?.fullName || 'Customer',
          customerPhone: data.contactDetails?.phone || data.contactDetails?.mobile || '',
          location: { address: addressStr },
          price: data.totalAmount || 0,
          isProductOrder: true,
          orderId: data.customOrderId || String(data.orderId),
          items: data.items || [],
          status: 'ASSIGNED',
          createdAt: new Date().toISOString()
        };

        const pendingJobs = JSON.parse(localStorage.getItem('workerPendingJobs') || '[]');
        if (!pendingJobs.find(job => String(job.id || job._id) === String(newJob.id))) {
          pendingJobs.unshift(newJob);
          localStorage.setItem('workerPendingJobs', JSON.stringify(pendingJobs));
        }

        // Notify app components to refresh
        window.dispatchEvent(new Event('workerJobsUpdated'));

        // Show the global alert popup to worker
        const event = new CustomEvent('showWorkerJobAlert', { detail: newJob });
        window.dispatchEvent(event);
      });
    }

    // Listen for Special Admin Escalation Signals & Notifications
    if (userType === 'admin') {
      const handleAdminEscalation = (data) => {
        if (isSoundEnabled('admin')) playAlertRing();

        const orderNum = data.customOrderId || data.orderId || data.bookingNumber || data.bookingId;
        const sName = data.serviceName || 'Order / Booking';

        toast.custom(
          (t) => (
            <motion.div
              initial={{ opacity: 0, y: -30, scale: 0.9 }}
              animate={{ opacity: t.visible ? 1 : 0, y: t.visible ? 0 : -30, scale: t.visible ? 1 : 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="w-full max-w-sm bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border-2 border-amber-500 pointer-events-auto text-white p-5 relative"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl animate-bounce">⚠️</span>
                <div>
                  <p className="font-black text-amber-400 text-xs uppercase tracking-widest">Escalated To Admin</p>
                  <p className="font-bold text-sm text-white">Order #{orderNum}</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                {data.message || `No vendor accepted ${sName}. Manual assignment required.`}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    navigate('/admin/bookings/manual');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider transition-all"
                >
                  Assign Vendor Now
                </button>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="px-3 py-2.5 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          ),
          {
            id: `admin-escalate-${data.bookingId || data.orderId}`,
            duration: 15000,
            position: 'top-right'
          }
        );

        window.dispatchEvent(new Event('adminBookingsUpdated'));
      };

      newSocket.on('adminBookingEscalated', handleAdminEscalation);
    }

    return () => {
      newSocket.disconnect();
    };
  }, [userType, localStorage.getItem(userType ? (userType === 'vendor' ? 'vendorAccessToken' : userType === 'worker' ? 'workerAccessToken' : userType === 'admin' ? 'adminAccessToken' : 'accessToken') : '')]); // Re-run when userType OR token changes

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
