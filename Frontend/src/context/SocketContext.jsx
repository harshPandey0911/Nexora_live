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

    // Listen for special Vendor Booking Requests
    if (userType === 'vendor') {
      newSocket.on('new_booking_request', (data) => {
        console.log('🚨 New Booking Request Alert Received on Socket:', data);

        // Acknowledge receipt to server
        newSocket.emit('booking_alert_received', { bookingId: data.bookingId });

        // Play urgent alert ring
        playAlertRing();

        // Save to localStorage for the Alert screen and Dashboard to read
        // Note: Even though we are moving to backend, keeping this for immediate UI responsiveness before potential refresh lag
        const newJob = {
          id: data.bookingId,
          serviceType: data.serviceName,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          location: {
            address: data.address?.addressLine1 || 'Location shared',
            distance: data.distance ? `${data.distance.toFixed(1)} km` : 'Near you'
          },
          price: data.price,
          vendorEarnings: data.vendorEarnings,
          serviceCategory: data.serviceCategory,
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
              title: '⚡ NEW BOOKING SIGNAL',
              message: `Incoming ${data.serviceName} request from ${data.customerName}. Accept now to secure deployment.`
            }}
            onClick={() => {
              toast.dismiss(t.id);
              navigate(`/vendor/booking/${data.bookingId}`);
            }}
            actions={[
              {
                label: 'Accept',
                onClick: () => {
                  acceptBooking(data.bookingId).then(() => {
                    // Clear from localStorage so the modal doesn't reappear
                    const pending = JSON.parse(localStorage.getItem('vendorPendingJobs') || '[]');
                    localStorage.setItem('vendorPendingJobs', JSON.stringify(
                      pending.filter(j => String(j.id || j._id) !== String(data.bookingId))
                    ));
                    window.dispatchEvent(new CustomEvent('removeVendorBooking', { detail: { id: data.bookingId } }));
                    assignWorker(data.bookingId, 'SELF').catch(() => {});
                  }).catch(() => {});
                  toast.dismiss(t.id);
                }
              },
              {
                label: 'Reject',
                onClick: () => {
                  rejectBooking(data.bookingId);
                  toast.dismiss(t.id);
                }
              }
            ]}
          />
        ), {
          id: `new-booking-${data.bookingId}`,
          duration: 10000, // Longer duration for critical alerts
          position: 'top-right',
          style: { maxWidth: '100%', width: 'auto' }
        });

        // Notify app components to refresh
        window.dispatchEvent(new Event('vendorJobsUpdated'));
        window.dispatchEvent(new Event('vendorStatsUpdated'));
        window.dispatchEvent(new Event('vendorNotificationsUpdated'));
      });

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
