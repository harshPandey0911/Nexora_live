import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { BookingAlertModal } from '../bookings';
import { acceptBooking, rejectBooking, assignWorker } from '../../services/bookingService';
import { playAlertRing, stopAlertRing } from '../../../../utils/notificationSound';

export default function GlobalBookingAlert() {
  const [activeAlertBookings, setActiveAlertBookings] = useState([]);
  const ignoredBookingIds = useRef(new Set());
  const navigate = useNavigate();
  const location = useLocation();

  const [maxSearchTime, setMaxSearchTime] = useState(1);

  useEffect(() => {
    // 1. Logic to sync with localStorage and optionally Server
    const syncAlerts = async (forceServerSync = false) => {
      try {
        const now = Date.now();
        let pendingJobs = JSON.parse(localStorage.getItem('vendorPendingJobs') || '[]');

        // Every few heartbeats or if forced, sync with Server API for missed sockets
        const token = localStorage.getItem('vendorAccessToken') || sessionStorage.getItem('vendorAccessToken');
        if (token && (forceServerSync || (Math.random() > 0.8))) {
          try {
            const { getBookings } = await import('../../services/bookingService');
            const response = await getBookings();
            if (response.success && response.data) {
              const vendorData = JSON.parse(localStorage.getItem('vendorData') || '{}');
              const vId = String(vendorData._id || vendorData.id);
              
              const serverJobs = response.data
                .filter(b => {
                  const status = b.status?.toLowerCase();
                  const isRelevant = status === 'searching' || status === 'requested';
                  const isMine = !b.vendorId || String(b.vendorId?._id || b.vendorId) === vId;
                  return isRelevant && isMine;
                })
                .map(b => ({
                  ...b,
                  id: b._id || b.id,
                  serviceType: b.serviceName || b.serviceId?.title,
                  customerName: b.userId?.name || 'Customer'
                }));

              const existingIds = new Set(pendingJobs.map(j => String(j.id || j._id)));
              let updated = false;
              serverJobs.forEach(sj => {
                if (!existingIds.has(String(sj.id))) {
                  pendingJobs.unshift(sj);
                  updated = true;
                }
              });
              if (updated) localStorage.setItem('vendorPendingJobs', JSON.stringify(pendingJobs));
            }
          } catch (e) { console.error("Server sync error:", e); }
        }

        const validJobs = pendingJobs.filter(job => {
          const jId = String(job.id || job._id);
          if (ignoredBookingIds.current.has(jId)) return false;
          if (!job.expiresAt) return true;
          const isValid = new Date(job.expiresAt).getTime() > now;
          if (!isValid) {
            console.log(`[GlobalAlert] Filtered out expired job ${jId}. Expires at: ${job.expiresAt}, Now: ${new Date(now).toISOString()}`);
          }
          return isValid;
        });

        console.log('[GlobalAlert] pendingJobs:', pendingJobs.length, 'validJobs:', validJobs.length);

        if (validJobs.length > 0) {
          setActiveAlertBookings(prev => {
            const currentIds = new Set(prev.map(b => String(b.id || b._id)));
            const newJobsToAdd = validJobs.filter(v => !currentIds.has(String(v.id || v._id)));
            if (newJobsToAdd.length === 0) return prev;
            console.log('[GlobalAlert] Adding new active alert bookings:', newJobsToAdd);
            return [...newJobsToAdd, ...prev];
          });
        } else {
          // If validJobs is 0, make sure we clear the modal
          setActiveAlertBookings([]);
        }
      } catch (err) {
        console.error('[GlobalAlert] Sync error:', err);
      }
    };

    // 2. Foreground Sync: Sync immediately when vendor resumes app
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncAlerts(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Fetch global config for accurate timer
    const fetchConfig = async () => {
      const token = localStorage.getItem('vendorAccessToken') || sessionStorage.getItem('vendorAccessToken');
      if (!token) return;

      try {
        const { vendorDashboardService } = await import('../../services/dashboardService');
        const response = await vendorDashboardService.getDashboardStats();
        if (response.success && response.data.config) {
          setMaxSearchTime(response.data.config.maxSearchTime || 1);
        }
      } catch (error) {
        console.error('Failed to fetch config for GlobalAlert:', error);
      }
    };

    syncAlerts(true);
    fetchConfig();

    // 3. Heartbeat: Periodic sync
    const heartbeat = setInterval(() => syncAlerts(false), 5000);

    // Listen for custom dashboard events from SocketContext
    const handleShowAlert = (e) => {
      console.log('[GlobalAlert] showDashboardBookingAlert custom event caught:', e.detail);
      if (e.detail) {
        const bId = String(e.detail.id || e.detail._id);
        if (e.detail.force) {
          ignoredBookingIds.current.delete(bId);
        }
        if (ignoredBookingIds.current.has(bId)) return;
        setActiveAlertBookings(prev => {
          const filtered = prev.filter(b => String(b.id || b._id) !== bId);
          console.log('[GlobalAlert] Adding alert booking to active state:', e.detail);
          return [e.detail, ...filtered];
        });
      }
    };

    const handleRemoveBooking = (e) => {
      if (e.detail?.id) {
        const idToRemove = String(e.detail.id);
        ignoredBookingIds.current.add(idToRemove);
        setActiveAlertBookings(prev => prev.filter(b => String(b.id || b._id) !== idToRemove));
      }
    };

    window.addEventListener('showDashboardBookingAlert', handleShowAlert);
    window.addEventListener('removeVendorBooking', handleRemoveBooking);

    return () => {
      window.removeEventListener('showDashboardBookingAlert', handleShowAlert);
      window.removeEventListener('removeVendorBooking', handleRemoveBooking);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(heartbeat);
    };
  }, []);

  // Effect to manage sound based on pending bookings
  useEffect(() => {
    if (activeAlertBookings.length > 0) {
      playAlertRing(true); // Always loop for vendor until actioned
    } else {
      stopAlertRing();
    }
    return () => stopAlertRing();
  }, [activeAlertBookings.length]);

  if (activeAlertBookings.length === 0) return null;

  return (
    <BookingAlertModal
      isOpen={activeAlertBookings.length > 0}
      bookings={activeAlertBookings}
      maxSearchTimeMins={maxSearchTime}
      onAccept={async (id) => {
        ignoredBookingIds.current.add(String(id));
        try {
          const targetJob = activeAlertBookings.find(b => String(b.id || b._id) === String(id));
          const isProductOrder = targetJob?.isProductOrder || targetJob?.orderId || (targetJob?.items && targetJob?.items.length > 0);

          if (isProductOrder) {
            const { default: vendorService } = await import('../../services/vendorService');
            await vendorService.acceptProductOrder(id);
          } else {
            await acceptBooking(id);
          }

          // ✅ IMMEDIATELY clear from localStorage and dismiss modal
          const pendingJobs = JSON.parse(localStorage.getItem('vendorPendingJobs') || '[]');
          const updated = pendingJobs.filter(b => String(b.id || b._id) !== String(id));
          localStorage.setItem('vendorPendingJobs', JSON.stringify(updated));

          window.dispatchEvent(new CustomEvent('removeVendorBooking', { detail: { id } }));
          setActiveAlertBookings(prev => prev.filter(b => String(b.id || b._id) !== String(id)));

          window.dispatchEvent(new Event('vendorJobsUpdated'));
          window.dispatchEvent(new Event('vendorStatsUpdated'));
          toast.success(isProductOrder ? 'Product Order Accepted!' : 'Job accepted! Assigning to you...');

          if (!isProductOrder) {
            assignWorker(id, 'SELF').catch(err => {
              console.warn('[GlobalAlert] assignWorker SELF failed (non-critical):', err?.message);
            });
          }

        } catch (e) {
          console.error('[GlobalAlert] Accept order failed:', e);
          toast.error(e?.response?.data?.message || 'Failed to accept order. Please try again.');
        }
      }}
      onAssign={async (id) => {
        ignoredBookingIds.current.add(String(id));
        try {
          const targetJob = activeAlertBookings.find(b => String(b.id || b._id) === String(id));
          const isProductOrder = targetJob?.isProductOrder || targetJob?.orderId || (targetJob?.items && targetJob?.items.length > 0);

          if (isProductOrder) {
            const { default: vendorService } = await import('../../services/vendorService');
            await vendorService.acceptProductOrder(id);
          } else {
            await acceptBooking(id);
          }

          const pendingJobs = JSON.parse(localStorage.getItem('vendorPendingJobs') || '[]');
          const updated = pendingJobs.filter(b => String(b.id || b._id) !== String(id));
          localStorage.setItem('vendorPendingJobs', JSON.stringify(updated));

          window.dispatchEvent(new CustomEvent('removeVendorBooking', { detail: { id } }));
          setActiveAlertBookings(prev => prev.filter(b => String(b.id || b._id) !== String(id)));

          window.dispatchEvent(new Event('vendorJobsUpdated'));
          window.dispatchEvent(new Event('vendorStatsUpdated'));

          if (isProductOrder) {
            toast.success('Product Order claimed! Redirecting to assign worker...');
            navigate(`/vendor/booking/${id}/assign-worker`);
          } else {
            toast.success('Job claimed! Redirecting to assign...');
            navigate(`/vendor/booking/${id}/assign-worker`);
          }
        } catch (e) {
          console.error('[GlobalAlert] Forward/Claim order failed:', e);
          toast.error(e?.response?.data?.message || 'Failed to claim job');
        }
      }}
      onReject={async (id, reason) => {
        ignoredBookingIds.current.add(String(id));
        try {
          await rejectBooking(id, reason);
        } catch (error) {
          console.error("Failed to reject job via API, removing locally");
        } finally {
          const pendingJobs = JSON.parse(localStorage.getItem('vendorPendingJobs') || '[]');
          const updated = pendingJobs.filter(b => String(b.id || b._id) !== String(id));
          localStorage.setItem('vendorPendingJobs', JSON.stringify(updated));

          window.dispatchEvent(new CustomEvent('removeVendorBooking', { detail: { id } }));
          setActiveAlertBookings(prev => prev.filter(b => String(b.id || b._id) !== String(id)));

          toast.success('Booking application rejected');
          window.dispatchEvent(new Event('vendorJobsUpdated'));
        }
      }}
      onMinimize={() => {
        activeAlertBookings.forEach(b => {
          const bId = String(b.id || b._id);
          ignoredBookingIds.current.add(bId);
        });
        setActiveAlertBookings([]);
      }}
    />
  );
}
