import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, memo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { vendorDashboardService } from '../../services/dashboardService';
import { acceptBooking, rejectBooking } from '../../services/bookingService';
import { registerFCMToken } from '../../../../services/pushNotificationService';
import LogoLoader from '../../../../components/common/LogoLoader';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

// New Components
import MobileDashboard from './components/MobileDashboard';
import VendorFullDashboard from './VendorFullDashboard';

const Dashboard = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();

  const [stats, setStats] = useState({
    todayEarnings: 0,
    inProgressBookings: 0,
    pendingAlerts: 0,
    workersOnline: 0,
    totalEarnings: 0,
    completedJobs: 0,
    rating: 0,
    performanceScore: 0,
    level: 1,
    commissionRate: 0
  });
  const [isOnline, setIsOnline] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [vendorProfile, setVendorProfile] = useState({
    name: 'Vendor Name',
    businessName: 'Business Name',
    photo: null,
    service: []
  });
  const [recentJobs, setRecentJobs] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [globalConfig, setGlobalConfig] = useState({ maxSearchTime: 5, waveDuration: 60 });
  const [revenueAnalytics, setRevenueAnalytics] = useState({
    'This Week': [],
    'This Month': [],
    'Last Month': []
  });
  
  // Screen size detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const ignoredBookingIds = useRef(new Set());

  // Process API response
  const processApiResponse = useCallback((response) => {
    if (!response.success) return;

    const { stats: apiStats, recentBookings, config } = response.data;
    if (config) setGlobalConfig(config);

    const requestedBookings = (recentBookings || []).filter(booking => {
      const status = booking.status?.toLowerCase();
      // Only show SERVICES in the pending deployment queue
      return (status === 'requested' || status === 'searching') && booking.offeringType !== 'PRODUCT';
    });
    const otherBookings = (recentBookings || []).filter(booking => {
      const status = booking.status?.toLowerCase();
      return status !== 'requested' && status !== 'searching';
    });

    const mergedMap = new Map();
    const vendorData = JSON.parse(localStorage.getItem('vendorData') || '{}');
    const vendorId = vendorData._id || vendorData.id;

    requestedBookings.forEach(b => {
      const id = String(b._id || b.id);
      let distance = 'N/A';
      if (b.potentialVendors && vendorId) {
        const potentialVendor = b.potentialVendors.find(pv =>
          String(pv.vendorId?._id || pv.vendorId) === String(vendorId)
        );
        if (potentialVendor && potentialVendor.distance) {
          distance = `${potentialVendor.distance.toFixed(1)} km`;
        }
      }

      mergedMap.set(id, {
        ...b,
        id,
        serviceName: b.serviceName || b.serviceId?.title || 'New Booking Request',
        serviceCategory: b.serviceCategory || b.serviceId?.categoryId?.title || 'General Service',
        customerName: b.userId?.name || 'Customer',
        location: {
          address: b.address?.addressLine1 || 'Address not available',
          distance: distance
        },
        price: (b.vendorEarnings > 0 ? b.vendorEarnings : (b.finalAmount > 0 ? b.finalAmount * 0.9 : 0)).toFixed(2),
        vendorEarnings: b.vendorEarnings,
        timeSlot: {
          date: new Date(b.scheduledDate).toLocaleDateString(),
          time: b.scheduledTime 
            ? b.scheduledTime 
            : (b.timeSlot?.start 
                ? `${b.timeSlot.start} - ${b.timeSlot.end}` 
                : 'Time not set')
        },
        status: b.status,
        expiresAt: b.expiresAt || (b.createdAt && config ? new Date(new Date(b.createdAt).getTime() + (config.maxSearchTime || 5) * 60000).toISOString() : null)
      });
    });

    const finalMap = new Map();
    mergedMap.forEach((value, key) => {
      if (!ignoredBookingIds.current.has(key)) {
        finalMap.set(key, value);
      }
    });

    const localPending = JSON.parse(localStorage.getItem('vendorPendingJobs') || '[]');
    const apiPending = Array.from(finalMap.values());
    const mergedPending = [...apiPending];

    localPending.forEach(localJob => {
      const id = String(localJob.id || localJob._id);
      if (!mergedPending.find(job => String(job.id || job._id) === id) && !ignoredBookingIds.current.has(id)) {
        const createdAt = localJob.createdAt ? new Date(localJob.createdAt).getTime() : Date.now();
        const expiresAt = localJob.expiresAt || (localJob.createdAt && config ? new Date(createdAt + (config.maxSearchTime || 5) * 60000).toISOString() : null);
        const isExpired = (expiresAt && new Date(expiresAt) <= new Date()) || (Date.now() - createdAt > 300000);
        const lowerStatus = String(localJob.status || '').toLowerCase();

        if (!isExpired && (lowerStatus === 'requested' || lowerStatus === 'searching')) {
          mergedPending.push({
            ...localJob,
            id,
            serviceName: localJob.serviceName || localJob.serviceId?.title || 'New Booking Request',
            serviceCategory: localJob.serviceCategory || localJob.serviceId?.categoryId?.title || 'General Service',
            customerName: localJob.customerName || localJob.userId?.name || 'Customer',
            expiresAt
          });
        }
      }
    });

    setPendingBookings(mergedPending);
    localStorage.setItem('vendorPendingJobs', JSON.stringify(mergedPending));

    // Deduplicate by string ID to guarantee no duplicate requests are displayed
    const seenIds = new Set();
    const finalPending = [];
    mergedPending.forEach(job => {
      const idStr = String(job._id || job.id || '');
      if (idStr && !seenIds.has(idStr)) {
        seenIds.add(idStr);
        finalPending.push(job);
      }
    });

    setPendingBookings(finalPending);
    localStorage.setItem('vendorPendingJobs', JSON.stringify(finalPending));

    setStats({
      totalBookings: apiStats.totalBookings || 0,
      todayEarnings: apiStats.vendorEarnings || 0,
      inProgressBookings: apiStats.inProgressBookings || 0,
      pendingAlerts: finalPending.length,
      workersOnline: apiStats.workersOnline || 0,
      totalEarnings: apiStats.vendorEarnings || 0,
      completedJobs: apiStats.completedBookings || 0,
      confirmedJobs: apiStats.confirmedBookings || 0,
      cancelledJobs: apiStats.cancelledBookings || 0,
      rating: apiStats.rating || 0,
      performanceScore: apiStats.performanceScore || 0,
      level: apiStats.level || 3,
      commissionRate: apiStats.commissionRate || 15
    });

    if (apiStats.isOnline !== undefined) {
      setIsOnline(apiStats.isOnline);
      const data = localStorage.getItem('vendorData');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.isOnline !== apiStats.isOnline) {
          parsed.isOnline = apiStats.isOnline;
          localStorage.setItem('vendorData', JSON.stringify(parsed));
          window.dispatchEvent(new CustomEvent('vendorStatusChanged', { detail: { isOnline: apiStats.isOnline } }));
        }
      }
    }

    const recentJobsData = otherBookings.slice(0, 3).map(booking => ({
      id: booking._id,
      serviceType: booking.serviceId?.title || 'Service',
      customerName: booking.userId?.name || 'Customer',
      location: booking.address?.addressLine1 || 'Address not available',
      price: (booking.vendorEarnings > 0 ? booking.vendorEarnings : (booking.finalAmount ? booking.finalAmount * 0.9 : 0)).toFixed(2),
      vendorEarnings: booking.vendorEarnings,
      timeSlot: {
        date: new Date(booking.scheduledDate).toLocaleDateString(),
        time: booking.scheduledTime || 'Time not set'
      },
      status: booking.status,
      assignedTo: booking.workerId ? { name: booking.workerId.name } : null,
      workerResponse: booking.workerResponse,
      rejectedWorker: booking.rejectedWorkerId ? { name: booking.rejectedWorkerId.name } : null,
    }));
    setRecentJobs(recentJobsData);

    const profile = JSON.parse(localStorage.getItem('vendorData') || '{}');
    setVendorProfile({
      name: profile.name || 'Vendor Name',
      businessName: profile.businessName || 'Business Name',
      photo: profile.profilePhoto || null,
      service: profile.service || []
    });
  }, []);

  const loadDashboardData = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      setError(null);
      
      const [statsRes, weeklyRes, monthlyRes] = await Promise.all([
        vendorDashboardService.getDashboardStats(),
        vendorDashboardService.getRevenueAnalytics('weekly'),
        vendorDashboardService.getRevenueAnalytics('monthly')
      ]);

      processApiResponse(statsRes);
      
      setRevenueAnalytics({
        'This Week': weeklyRes.data.chartData.map(d => ({ name: d.date, earnings: d.amount, orders: d.bookings })),
        'This Month': monthlyRes.data.chartData.map(d => ({ name: d.date, earnings: d.amount, orders: d.bookings })),
        'Last Month': [] 
      });

    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError(String(err.message || 'Failed to load dashboard data'));
    } finally {
      setLoading(false);
    }
  }, [processApiResponse]);

  useEffect(() => {
    const shouldShowSpinner = !stats.inProgressBookings && recentJobs.length === 0;
    loadDashboardData(shouldShowSpinner);
  }, [loadDashboardData]);

  useEffect(() => {
    const handleUpdate = () => loadDashboardData(false);
    registerFCMToken('vendor', true).catch(err => console.error('FCM registration failed:', err));

    const handleShowAlert = (e) => {
      if (e.detail) {
        // Filter out PRODUCT alerts from the service-partner popup system
        if (e.detail.offeringType === 'PRODUCT') {
          console.log('[Dashboard] Product order received - handled by fulfillment tab');
          // Optional: Show a specific product toast instead of a popup
          toast.success('New product order received! Check Product Orders.', { icon: '📦' });
          return;
        }

        setPendingBookings(prev => {
          if (prev.find(b => b.id === e.detail.id)) return prev;
          return [e.detail, ...prev];
        });
      }
    };

    const handleRemoveBooking = (e) => {
      if (e.detail?.id) {
        const idToRemove = String(e.detail.id);
        ignoredBookingIds.current.add(idToRemove);
        setPendingBookings(prev => prev.filter(b => String(b.id || b._id) !== idToRemove));
        setRecentJobs(prev => prev.filter(b => String(b.id || b._id) !== idToRemove));
        const pendingJobs = JSON.parse(localStorage.getItem('vendorPendingJobs') || '[]');
        const updatedPending = pendingJobs.filter(job => String(job.id || job._id) !== idToRemove);
        localStorage.setItem('vendorPendingJobs', JSON.stringify(updatedPending));
      }
    };

    const handleStatusSync = (e) => {
      if (e.detail && typeof e.detail.isOnline === 'boolean') {
        setIsOnline(e.detail.isOnline);
      }
    };

    window.addEventListener('vendorJobsUpdated', handleUpdate);
    window.addEventListener('vendorStatsUpdated', handleUpdate);
    window.addEventListener('showDashboardBookingAlert', handleShowAlert);
    window.addEventListener('removeVendorBooking', handleRemoveBooking);
    window.addEventListener('vendorStatusChanged', handleStatusSync);

    return () => {
      window.removeEventListener('vendorJobsUpdated', handleUpdate);
      window.removeEventListener('vendorStatsUpdated', handleUpdate);
      window.removeEventListener('showDashboardBookingAlert', handleShowAlert);
      window.removeEventListener('removeVendorBooking', handleRemoveBooking);
      window.removeEventListener('vendorStatusChanged', handleStatusSync);
    };
  }, [loadDashboardData]);

  const handleToggleOnline = async () => {
    try {
      setIsToggling(true);
      const newStatus = !isOnline;
      const response = await vendorDashboardService.updateStatus(newStatus);
      if (response.success) {
        setIsOnline(newStatus);
        
        // Update localStorage
        const data = localStorage.getItem('vendorData');
        if (data) {
          const parsed = JSON.parse(data);
          parsed.isOnline = newStatus;
          localStorage.setItem('vendorData', JSON.stringify(parsed));
        }

        toast.success(`You are now ${newStatus ? 'Online' : 'Offline'}`);
        setStats(prev => ({ ...prev, isOnline: newStatus }));
        window.dispatchEvent(new CustomEvent('vendorStatusChanged', { detail: { isOnline: newStatus } }));
      }
    } catch (error) {
      console.error('Failed to toggle status:', error);
      toast.error('Failed to update status');
    } finally {
      setIsToggling(false);
    }
  };

  const getStatusColor = (status) => {
    const s = String(status).toLowerCase();
    const statusColors = {
      'accepted': '#3B82F6', 'confirmed': '#10B981', 'assigned': '#8B5CF6',
      'journey_started': '#F59E0B', 'visited': '#F59E0B', 'in_progress': '#F59E0B',
      'work_done': '#10B981', 'completed': '#10B981', 'worker_paid': '#06B6D4',
      'settlement_pending': '#F97316',
    };
    return statusColors[s] || '#6B7280';
  };

  const getStatusLabel = (status) => {
    const s = String(status).toLowerCase();
    const labels = {
      'requested': 'Requested', 'searching': 'Searching', 'accepted': 'Accepted',
      'confirmed': 'Confirmed', 'assigned': 'Assigned', 'journey_started': 'On the way',
      'visited': 'Visited', 'in_progress': 'In Progress', 'work_done': 'Work Done',
      'completed': 'Completed', 'worker_paid': 'Payment Done', 'settlement_pending': 'Settlement',
      'cancelled': 'Cancelled', 'rejected': 'Rejected'
    };
    return labels[s] || status;
  };

  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <LogoLoader key="loader" />
      ) : error ? (
        <motion.div 
          key="error"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen flex items-center justify-center text-rose-600 bg-white"
        >
          {error}
        </motion.div>
      ) : isMobile ? (
        <motion.div
          key="mobile"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4 }}
        >
          <MobileDashboard 
            stats={stats}
            isOnline={isOnline}
            handleToggleOnline={handleToggleOnline}
            navigate={navigate}
            pendingBookings={pendingBookings}
            setPendingBookings={setPendingBookings}
            recentJobs={recentJobs}
            getStatusColor={getStatusColor}
            getStatusLabel={getStatusLabel}
            globalConfig={globalConfig}
          />
        </motion.div>
      ) : (
        <motion.div
          key="desktop"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4 }}
        >
          <VendorFullDashboard 
            stats={stats}
            recentJobs={recentJobs}
            vendorProfile={vendorProfile}
            isOnline={isOnline}
            handleToggleOnline={handleToggleOnline}
            revenueAnalytics={revenueAnalytics}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default Dashboard;
