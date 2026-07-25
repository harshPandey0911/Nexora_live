import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiBriefcase, FiCheckCircle, FiClock, FiTrendingUp, 
  FiUser, FiBell, FiMapPin, FiArrowRight, FiSettings, 
  FiRefreshCw, FiStar, FiZap, FiCalendar, FiDollarSign, FiChevronRight 
} from 'react-icons/fi';
import { FaWallet } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { workerTheme as themeColors } from '../../../../theme';
import Header from '../../components/layout/Header';
import workerService from '../../../../services/workerService';
import workerWalletService from '../../../../services/workerWalletService';
import { registerFCMToken } from '../../../../services/pushNotificationService';
import { SkeletonProfileHeader, SkeletonDashboardStats, SkeletonList } from '../../../../components/common/SkeletonLoaders';
import { useSocket } from '../../../../context/SocketContext';
import WorkerJobAlertModal from '../../components/bookings/WorkerJobAlertModal';
import WorkerRatingsModal from '../../components/ratings/WorkerRatingsModal';
import Pagination from '../../../../components/common/Pagination';

const Dashboard = () => {
  const navigate = useNavigate();
  const socket = useSocket();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const getStatusBadge = (status, job) => {
    const s = String(status || '').toUpperCase();

    // Check if completed job has pending worker payout from vendor
    if ((s === 'COMPLETED' || s === 'WORK_DONE') && !(job?.rawJob?.isWorkerPaid || job?.rawJob?.workerPaymentStatus === 'PAID' || job?.rawJob?.workerPaymentStatus === 'SUCCESS')) {
      return { label: 'Payout Pending', bg: 'bg-amber-100 text-amber-900 border-amber-300' };
    }
    if ((s === 'COMPLETED' || s === 'WORK_DONE') && (job?.rawJob?.isWorkerPaid || job?.rawJob?.workerPaymentStatus === 'PAID' || job?.rawJob?.workerPaymentStatus === 'SUCCESS')) {
      return { label: 'Paid by Vendor', bg: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
    }

    const config = {
      'PENDING': { label: 'Pending', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
      'ASSIGNED': { label: 'Assigned', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
      'ACCEPTED': { label: 'Accepted', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
      'CONFIRMED': { label: 'Confirmed', bg: 'bg-sky-50 text-sky-700 border-sky-200' },
      'JOURNEY_STARTED': { label: 'On The Way', bg: 'bg-sky-50 text-sky-700 border-sky-200' },
      'VISITED': { label: 'Visited', bg: 'bg-teal-50 text-teal-700 border-teal-200' },
      'IN_PROGRESS': { label: 'In Progress', bg: 'bg-sky-50 text-sky-700 border-sky-200' },
      'WORK_DONE': { label: 'Work Done', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      'COMPLETED': { label: 'Completed', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      'CANCELLED': { label: 'Cancelled', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
    };
    return config[s] || { label: s, bg: 'bg-gray-50 text-gray-700 border-gray-200' };
  };

  // Profile & Stats State
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const [workerProfile, setWorkerProfile] = useState({
    name: '',
    phone: '',
    photo: null,
    categories: [],
    address: ''
  });

  const [stats, setStats] = useState({
    totalEarnings: 0,
    receivedSalary: 0,
    cashCollectedOnField: 0,
    pendingJobs: 0,
    acceptedJobs: 0,
    inProgressJobs: 0,
    completedJobs: 0,
    rating: 5.0
  });

  const [recentJobs, setRecentJobs] = useState([]);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'PENDING' | 'ACTIVE' | 'COMPLETED'
  const [alertJobId, setAlertJobId] = useState(null);

  // Pagination & Date Filter States
  const [dateFilter, setDateFilter] = useState('ALL'); // 'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'CUSTOM'
  const [customDate, setCustomDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Ratings Modal
  const [showRatingsModal, setShowRatingsModal] = useState(false);
  const [reviewsList, setReviewsList] = useState([]);
  const [totalReviews, setTotalReviews] = useState(0);

  // Background gradient setup
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const bgStyle = '#F8FAFC';

    if (html) html.style.background = bgStyle;
    if (body) body.style.background = bgStyle;
    if (root) root.style.background = bgStyle;

    return () => {
      if (html) html.style.background = '';
      if (body) body.style.background = '';
      if (root) root.style.background = '';
    };
  }, []);

  // Main Data Fetcher
  const fetchDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setIsRefreshing(true);

      const [profileRes, statsRes, jobsRes, walletRes] = await Promise.all([
        workerService.getProfile().catch(() => ({ success: false })),
        workerService.getDashboardStats().catch(() => ({ success: false })),
        workerService.getAssignedJobs({ limit: 100 }).catch(() => ({ success: false })),
        workerWalletService.getWallet().catch(() => ({ success: false }))
      ]);

      if (profileRes.success && profileRes.worker) {
        const profile = profileRes.worker;
        let addrStr = '';
        if (typeof profile.address === 'string') {
          addrStr = profile.address;
        } else if (profile.address && typeof profile.address === 'object') {
          addrStr = profile.address.city || profile.address.fullAddress || profile.address.addressLine1 || '';
        }

        setWorkerProfile({
          name: profile.name || 'Worker Partner',
          phone: profile.phone || '',
          photo: profile.profilePhoto || null,
          categories: Array.isArray(profile.serviceCategories) 
            ? profile.serviceCategories 
            : (profile.serviceCategory ? [profile.serviceCategory] : []),
          address: addrStr,
        });
        setIsOnline(profile.status === 'ONLINE');
      }

      const parseLocation = (addr) => {
        if (!addr) return 'Local Area';
        if (typeof addr === 'string') return addr;
        if (typeof addr === 'object') return addr.city || addr.addressLine1 || addr.fullAddress || 'Local Area';
        return 'Local Area';
      };

      const formatAssignedTime = (dateStr) => {
        if (!dateStr) return 'Recently';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'Recently';
        return d.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      };

      let fetchedJobsList = [];
      if (jobsRes.success && Array.isArray(jobsRes.data)) {
        fetchedJobsList = jobsRes.data.map(job => ({
          id: job._id || job.id,
          serviceType: typeof job.serviceId === 'object' ? (job.serviceId?.title || 'Service Request') : (job.serviceName || 'Service Request'),
          customerName: typeof job.userId === 'object' ? (job.userId?.name || 'Customer') : 'Authorized Customer',
          location: parseLocation(job.address),
          time: job.scheduledTime || (job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString() : 'Today'),
          assignedAt: formatAssignedTime(job.createdAt || job.assignedAt || job.rawJob?.createdAt),
          status: (job.status || 'PENDING').toUpperCase(),
          price: job.vendorEarnings || job.finalAmount || 0,
          rawJob: job
        }));
        setRecentJobs(fetchedJobsList);
      } else if (statsRes.success && Array.isArray(statsRes.data?.recentJobs)) {
        fetchedJobsList = statsRes.data.recentJobs.map(job => ({
          id: job._id || job.id,
          serviceType: typeof job.serviceId === 'object' ? (job.serviceId?.title || 'Service Request') : (job.serviceName || 'Service Request'),
          customerName: typeof job.userId === 'object' ? (job.userId?.name || 'Customer') : 'Customer',
          location: parseLocation(job.address),
          time: job.scheduledTime || 'Today',
          assignedAt: formatAssignedTime(job.createdAt || job.assignedAt || job.rawJob?.createdAt),
          status: (job.status || 'PENDING').toUpperCase(),
          price: job.finalAmount || 0,
          rawJob: job
        }));
        setRecentJobs(fetchedJobsList);
      }

      if (statsRes.success && statsRes.data) {
        const { totalEarnings } = statsRes.data;

        // Use database totals from stats API, fallback to current 15-job slice counts
        const pending = (typeof statsRes.data.pendingJobs === 'number')
          ? statsRes.data.pendingJobs
          : fetchedJobsList.filter(j => ['ASSIGNED', 'PENDING', 'REQUESTED'].includes(j.status)).length;

        const active = (typeof statsRes.data.activeJobs === 'number')
          ? statsRes.data.activeJobs
          : fetchedJobsList.filter(j => ['ACCEPTED', 'CONFIRMED', 'VISITED', 'IN_PROGRESS', 'JOURNEY_STARTED'].includes(j.status)).length;

        const completed = (typeof statsRes.data.completedJobs === 'number')
          ? statsRes.data.completedJobs
          : fetchedJobsList.filter(j => ['COMPLETED', 'WORK_DONE'].includes(j.status)).length;

        const fetchedRating = (typeof statsRes.data?.rating === 'number')
          ? statsRes.data.rating
          : (typeof profileRes.worker?.rating === 'number' ? profileRes.worker.rating : 0);

        const receivedSalary = (walletRes.success && walletRes.data)
          ? (walletRes.data.receivedSalary ?? walletRes.data.balance ?? 0)
          : (statsRes.data?.receivedSalary ?? profileRes.worker?.wallet?.balance ?? 0);

        const cashCollectedOnField = (walletRes.success && walletRes.data)
          ? (walletRes.data.cashCollectedOnField ?? 0)
          : (statsRes.data?.cashCollectedOnField ?? 0);

        setStats({
          totalEarnings: totalEarnings || 0,
          receivedSalary,
          cashCollectedOnField,
          pendingJobs: pending,
          acceptedJobs: 0,
          inProgressJobs: active,
          completedJobs: completed,
          rating: fetchedRating
        });

        if (Array.isArray(statsRes.data?.reviewsList)) {
          setReviewsList(statsRes.data.reviewsList);
        }
        if (typeof statsRes.data?.totalReviews === 'number') {
          setTotalReviews(statsRes.data.totalReviews);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial Load + Auto Polling (Every 10s)
  useEffect(() => {
    fetchDashboardData();

    registerFCMToken('worker', true).catch(err => console.error('FCM registration failed:', err));

    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 10000);

    const handleUpdate = () => fetchDashboardData(true);
    window.addEventListener('workerJobsUpdated', handleUpdate);
    window.addEventListener('workerWalletUpdated', handleUpdate);
    window.addEventListener('focus', handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('workerJobsUpdated', handleUpdate);
      window.removeEventListener('workerWalletUpdated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, [fetchDashboardData]);

  // Socket Listener for Dynamic Real-Time Updates
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notif) => {
      if ((notif.type === 'booking_created' || notif.type === 'job_assigned') && notif.relatedId) {
        setAlertJobId(notif.relatedId);
      }
      fetchDashboardData(true);
    };

    socket.on('notification', handleNotification);
    socket.on('job_status_updated', () => fetchDashboardData(true));
    socket.on('booking_updated', () => fetchDashboardData(true));
    socket.on('payment_received', () => fetchDashboardData(true));
    socket.on('wallet_updated', () => fetchDashboardData(true));
    socket.on('cash_collected', () => fetchDashboardData(true));

    return () => {
      socket.off('notification', handleNotification);
      socket.off('job_status_updated');
      socket.off('booking_updated');
      socket.off('payment_received');
      socket.off('wallet_updated');
      socket.off('cash_collected');
    };
  }, [socket, fetchDashboardData]);

  // Toggle Online/Offline Status
  const toggleStatus = async () => {
    if (statusUpdating) return;
    try {
      setStatusUpdating(true);
      const newStatus = isOnline ? 'OFFLINE' : 'ONLINE';
      const response = await workerService.updateStatus(newStatus);

      if (response.success) {
        setIsOnline(!isOnline);
        toast.success(`You are now ${newStatus === 'ONLINE' ? 'Online' : 'Offline'}`);
        window.dispatchEvent(new Event('workerStatusUpdated'));
      } else {
        toast.error(response.message || 'Failed to update status');
      }
    } catch (err) {
      console.error('Status update error:', err);
      toast.error('Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  // Sync state with global Header toggle handler
  useEffect(() => {
    window.isWorkerOnlineGlobally = isOnline;
    window.handleWorkerToggleGlobally = toggleStatus;
    window.dispatchEvent(new Event('workerStatusUpdated'));
    return () => {
      delete window.isWorkerOnlineGlobally;
      delete window.handleWorkerToggleGlobally;
    };
  }, [isOnline, statusUpdating]);

  // Filter Jobs list by status tab AND date filter
  const dateFilteredJobs = useMemo(() => {
    return recentJobs.filter(job => {
      // 1. Status Tab filter
      if (activeTab === 'PENDING' && !['ASSIGNED', 'PENDING', 'REQUESTED', 'ACCEPTED'].includes(job.status)) return false;
      if (activeTab === 'ACTIVE' && !['VISITED', 'IN_PROGRESS', 'JOURNEY_STARTED', 'CONFIRMED'].includes(job.status)) return false;
      if (activeTab === 'COMPLETED' && !['COMPLETED', 'WORK_DONE'].includes(job.status)) return false;

      // 2. Date filter
      if (dateFilter === 'ALL') return true;

      const rawDateStr = job.rawJob?.createdAt || job.rawJob?.assignedAt || job.createdAt;
      if (!rawDateStr) return true;
      const jobDate = new Date(rawDateStr);
      if (isNaN(jobDate.getTime())) return true;

      const now = new Date();
      const isSameDay = (d1, d2) => (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
      );

      if (dateFilter === 'TODAY') return isSameDay(jobDate, now);
      if (dateFilter === 'YESTERDAY') {
        const yest = new Date();
        yest.setDate(now.getDate() - 1);
        return isSameDay(jobDate, yest);
      }
      if (dateFilter === 'WEEK') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return jobDate >= weekAgo;
      }
      if (dateFilter === 'CUSTOM' && customDate) {
        const target = new Date(customDate);
        return isSameDay(jobDate, target);
      }

      return true;
    }).sort((a, b) => {
      const timeA = new Date(a.rawJob?.createdAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.rawJob?.createdAt || b.createdAt || 0).getTime();
      return timeB - timeA; // Newest assigned jobs first
    });
  }, [recentJobs, activeTab, dateFilter, customDate]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, dateFilter, customDate]);

  const totalPages = Math.ceil(dateFilteredJobs.length / pageSize) || 1;

  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return dateFilteredJobs.slice(start, start + pageSize);
  }, [dateFilteredJobs, currentPage, pageSize]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 pb-24">
        <Header title="Dashboard" showBack={false} />
        <main className="px-4 py-4 space-y-6 max-w-7xl mx-auto">
          <SkeletonProfileHeader />
          <SkeletonDashboardStats />
          <SkeletonList count={3} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-12">
      <Header title="Dashboard" showBack={false} notificationCount={stats.pendingJobs} />

      <main className="px-4 pt-4 pb-8 max-w-7xl mx-auto">
        
        {/* ── RESPONSIVE GRID LAYOUT (1 col on mobile, 2 cols on Desktop lg:grid-cols-12) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ── LEFT COLUMN (Hero, Earnings & Stats) ── */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* HERO BANNER: Profile & Online Status */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-gray-900 to-teal-950 p-5 shadow-xl text-white">
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl ring-2 ring-teal-400/40 overflow-hidden bg-slate-800 flex items-center justify-center shrink-0 shadow-inner">
                      {workerProfile.photo ? (
                        <img src={workerProfile.photo} alt={workerProfile.name} className="w-full h-full object-cover" />
                      ) : (
                        <FiUser className="w-7 h-7 text-teal-300" />
                      )}
                    </div>
                    <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-extrabold tracking-tight text-white">{workerProfile.name}</h2>
                      <span 
                        onClick={() => navigate('/worker/reviews')}
                        className="bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer hover:bg-teal-500/30 transition-colors"
                        title="View Customer Ratings & Reviews"
                      >
                        <FiStar className="w-3 h-3 text-amber-400 fill-amber-400" />
                        {typeof stats.rating === 'number' ? stats.rating.toFixed(1) : '0.0'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 mt-0.5 flex items-center gap-1.5 font-medium">
                      <span>{workerProfile.categories.slice(0, 2).join(', ') || 'Certified Partner'}</span>
                      {workerProfile.address && (
                        <>
                          <span className="text-gray-500">•</span>
                          <span className="text-gray-400 truncate max-w-[120px]">{workerProfile.address}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Quick Online Switcher */}
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/15 px-4 py-2 rounded-2xl w-full sm:w-auto justify-between">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Duty Status</p>
                    <p className={`text-xs font-bold ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isOnline ? 'Online & Ready' : 'Offline'}
                    </p>
                  </div>

                  <button
                    onClick={toggleStatus}
                    disabled={statusUpdating}
                    className={`relative w-12 h-6.5 rounded-full transition-all duration-300 ${isOnline ? 'bg-emerald-500' : 'bg-gray-600'} disabled:opacity-50`}
                  >
                    <div className={`absolute top-0.5 w-5.5 h-5.5 rounded-full bg-white shadow-md transition-all duration-300 ${isOnline ? 'left-6' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* TOTAL EARNINGS & CASH HANDOVER HIGHLIGHT CARD */}
            <div 
              onClick={() => navigate('/worker/wallet')}
              className="rounded-3xl p-5 bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 text-white shadow-xl cursor-pointer hover:shadow-2xl transition-all relative overflow-hidden group"
            >
              <div className="absolute right-0 top-0 w-48 h-48 bg-white/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />
              
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-teal-200 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <FiDollarSign className="w-3.5 h-3.5 text-teal-300" />
                    Pending Salary Owed (By Vendor)
                  </p>
                  <h3 className="text-3xl font-black tracking-tight text-white">
                    ₹{Number(stats.salaryOwed !== undefined ? stats.salaryOwed : (stats.receivedSalary || 0)).toLocaleString('en-IN')}
                  </h3>

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {stats.cashCollectedOnField > 0 && (
                      <span className="text-[11px] font-bold text-amber-200 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-400/30 backdrop-blur-sm flex items-center gap-1">
                        💵 ₹{Number(stats.cashCollectedOnField).toLocaleString('en-IN')} Cash to Hand Over
                      </span>
                    )}
                    <span className="text-[11px] text-teal-200 font-semibold underline flex items-center gap-0.5">
                      View Wallet <FiChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>

                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                  <FaWallet className="w-7 h-7 text-teal-200" />
                </div>
              </div>
            </div>

            {/* KPI METRICS STATS GRID (4 Cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3">
              {/* Pending / Alerts */}
              <div 
                onClick={() => navigate('/worker/notifications')}
                className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all active:scale-95 bg-white"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-700">
                    <FiClock className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-widest">Pending</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-amber-950">{stats.pendingJobs}</p>
                  <p className="text-[10px] text-amber-700 font-semibold mt-0.5">Needs Response</p>
                </div>
              </div>

              {/* Active / In-Progress */}
              <div 
                onClick={() => navigate('/worker/jobs')}
                className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all active:scale-95 bg-white"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-700">
                    <FiZap className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-extrabold text-sky-800 uppercase tracking-widest">Active</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-sky-950">{stats.inProgressJobs + stats.acceptedJobs}</p>
                  <p className="text-[10px] text-sky-700 font-semibold mt-0.5">In Progress</p>
                </div>
              </div>

              {/* Completed Jobs */}
              <div 
                onClick={() => navigate('/worker/jobs')}
                className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all active:scale-95 bg-white"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-700">
                    <FiCheckCircle className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-widest">Done</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-emerald-950">{stats.completedJobs}</p>
                  <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">Completed</p>
                </div>
              </div>

              {/* Rating Score */}
              <div 
                onClick={() => navigate('/worker/reviews')}
                className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all active:scale-95 bg-white"
                title="Click to view Customer Ratings & Reviews"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-700">
                    <FiStar className="w-4 h-4 fill-purple-600" />
                  </div>
                  <span className="text-[10px] font-extrabold text-purple-800 uppercase tracking-widest">Rating</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-purple-950">
                    {typeof stats.rating === 'number' ? stats.rating.toFixed(1) : '0.0'}★
                  </p>
                  <p className="text-[10px] text-purple-700 font-semibold mt-0.5">Customer Score</p>
                </div>
              </div>
            </div>

          </div>

          {/* ── RIGHT COLUMN: RECENT JOBS FEED (lg:col-span-7) ── */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-md">
              
              {/* Header & Refresh */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Recent Assigned Jobs</h3>
                  <p className="text-xs text-slate-500 font-medium">Real-time deployments and task history</p>
                </div>

                <button
                  onClick={() => fetchDashboardData(true)}
                  disabled={isRefreshing}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1 text-xs font-semibold"
                  title="Refresh Dashboard Data"
                >
                  <FiRefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3 overflow-x-auto no-scrollbar">
                {[
                  { id: 'ALL', label: 'All Jobs', count: recentJobs.length },
                  { id: 'PENDING', label: 'Pending', count: stats.pendingJobs },
                  { id: 'ACTIVE', label: 'In Progress', count: stats.inProgressJobs + stats.acceptedJobs },
                  { id: 'COMPLETED', label: 'Completed', count: stats.completedJobs },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                      activeTab === tab.id
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Date Filter Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-3 mb-4 border-b border-slate-50 text-xs">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 shrink-0 flex items-center gap-1">
                  <FiCalendar className="w-3 h-3 text-teal-600" /> Filter Date:
                </span>
                {[
                  { id: 'ALL', label: 'All Time' },
                  { id: 'TODAY', label: 'Today' },
                  { id: 'YESTERDAY', label: 'Yesterday' },
                  { id: 'WEEK', label: 'Last 7 Days' },
                  { id: 'CUSTOM', label: 'Pick Date' },
                ].map(df => (
                  <button
                    key={df.id}
                    onClick={() => setDateFilter(df.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase transition-all shrink-0 ${
                      dateFilter === df.id
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {df.label}
                  </button>
                ))}
                {dateFilter === 'CUSTOM' && (
                  <input
                    type="date"
                    max={todayStr}
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="px-2 py-0.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white cursor-pointer"
                  />
                )}
              </div>

              {/* Jobs List */}
              {paginatedJobs.length > 0 ? (
                <div className="space-y-3">
                  {paginatedJobs.map((job) => {
                    const badge = getStatusBadge(job.status, job);
                    return (
                      <div
                        key={job.id}
                        onClick={() => navigate(`/worker/job/${job.id}`)}
                        className="p-4 rounded-2xl border border-slate-200/70 bg-slate-50/50 hover:bg-white hover:border-teal-300 hover:shadow-lg transition-all duration-300 cursor-pointer group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-teal-500/10 border border-teal-200 flex items-center justify-center shrink-0 text-teal-800 font-bold group-hover:scale-105 transition-transform">
                              <FiBriefcase className="w-5 h-5" />
                            </div>

                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-slate-900 truncate tracking-tight">{job.customerName}</h4>
                              <p className="text-xs font-semibold text-teal-700 mt-0.5">{job.serviceType}</p>
                              
                              <div className="flex items-center gap-2.5 mt-2 flex-wrap text-xs text-slate-500 font-medium">
                                <span className="flex items-center gap-1">
                                  <FiMapPin className="w-3.5 h-3.5 text-slate-400" />
                                  {job.location}
                                </span>
                                <span className="flex items-center gap-1 text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100/80">
                                  <FiClock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                  Assigned: {job.assignedAt}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-lg border ${badge.bg}`}>
                              {badge.label}
                            </span>

                            {job.price > 0 && (
                              <span className="text-sm font-black text-slate-900">
                                ₹{Number(job.price).toLocaleString('en-IN')}
                              </span>
                            )}

                            <div className="w-7 h-7 rounded-xl bg-slate-100 group-hover:bg-teal-600 group-hover:text-white flex items-center justify-center text-slate-500 transition-all mt-1">
                              <FiArrowRight className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Pagination Controls */}
                  {dateFilteredJobs.length > 0 && (
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={dateFilteredJobs.length}
                      pageSize={pageSize}
                      onPageChange={(p) => setCurrentPage(p)}
                      onPageSizeChange={(newSize) => {
                        setPageSize(newSize);
                        setCurrentPage(1);
                      }}
                      className="mt-4 border-t border-slate-100 pt-4"
                    />
                  )}
                </div>
              ) : (
                <div className="py-16 px-4 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200">
                  <div className="w-14 h-14 bg-slate-200/60 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <FiBriefcase className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No Jobs Found</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto font-medium">
                    {activeTab === 'ALL' 
                      ? 'No tasks assigned matching your filters. Stay online to receive new job alerts!' 
                      : `No ${activeTab.toLowerCase()} jobs at the moment.`}
                  </p>
                  
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button
                      onClick={() => navigate('/worker/jobs')}
                      className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md hover:bg-slate-800 transition-all active:scale-95"
                    >
                      View All Jobs
                    </button>
                    <button
                      onClick={() => {
                        setDateFilter('ALL');
                        setActiveTab('ALL');
                        fetchDashboardData(true);
                      }}
                      className="px-4 py-2 bg-teal-50 text-teal-800 border border-teal-200 rounded-xl text-xs font-bold hover:bg-teal-100 transition-all active:scale-95"
                    >
                      Reset Filters
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

      </main>

      {/* ── RATINGS & REVIEWS MODAL ── */}
      <WorkerRatingsModal
        isOpen={showRatingsModal}
        onClose={() => setShowRatingsModal(false)}
        rating={stats.rating}
        totalReviews={totalReviews}
        reviewsList={reviewsList}
      />

      {/* ── JOB ALERT POPUP MODAL ── */}
      <WorkerJobAlertModal
        isOpen={!!alertJobId}
        jobId={alertJobId}
        onClose={() => setAlertJobId(null)}
        onJobAccepted={(id) => {
          fetchDashboardData(true);
          navigate(`/worker/job/${id}`);
        }}
      />
    </div>
  );
};

export default Dashboard;
