import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBriefcase, FiCheckCircle, FiClock, FiTrendingUp, FiChevronRight, FiUser, FiBell, FiMapPin, FiArrowRight, FiSettings } from 'react-icons/fi';
import { FaWallet, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { workerTheme as themeColors, vendorTheme } from '../../../../theme';
import Header from '../../components/layout/Header';
import workerService from '../../../../services/workerService';
import { registerFCMToken } from '../../../../services/pushNotificationService';
import { SkeletonProfileHeader, SkeletonDashboardStats, SkeletonList } from '../../../../components/common/SkeletonLoaders';
import OptimizedImage from '../../../../components/common/OptimizedImage';
import { useSocket } from '../../../../context/SocketContext';
import WorkerJobAlertModal from '../../components/bookings/WorkerJobAlertModal';
import LogoLoader from '../../../../components/common/LogoLoader';


const Dashboard = () => {
  const navigate = useNavigate();

  // Helper function to convert hex to rgba
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Helper function to get status label
  const getStatusLabel = (status) => {
    const statusMap = {
      'PENDING': 'Pending',
      'ACCEPTED': 'Accepted',
      'REJECTED': 'Rejected',
      'COMPLETED': 'Completed',
      'ASSIGNED': 'Assigned',
      'VISITED': 'Visited',
      'WORK_DONE': 'Work Done',
    };
    return statusMap[status] || status;
  };

  const [stats, setStats] = useState({
    pendingJobs: 0,
    acceptedJobs: 0,
    completedJobs: 0,
    totalEarnings: 0,
    thisMonthEarnings: 0,
    rating: 0,
  });
  const [workerProfile, setWorkerProfile] = useState({
    name: 'Worker Name',
    phone: '+91 9876543210',
    photo: null,
    categories: [],
    address: null,
  });
  const [recentJobs, setRecentJobs] = useState([]);
  const [isOnline, setIsOnline] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Set background gradient
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const bgStyle = themeColors.backgroundGradient;

    if (html) html.style.background = bgStyle;
    if (body) body.style.background = bgStyle;
    if (root) root.style.background = bgStyle;

    return () => {
      if (html) html.style.background = '';
      if (body) body.style.background = '';
      if (root) root.style.background = '';
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const socket = useSocket();

  const [alertJobId, setAlertJobId] = useState(null);


  // Fetch Dashboard Data Function
  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch Profile, Stats and Recent Jobs in parallel (Stats also includes recent jobs but let's be robust)
      const [profileRes, statsRes] = await Promise.all([
        workerService.getProfile(),
        workerService.getDashboardStats()
      ]);

      if (profileRes.success) {
        const profile = profileRes.worker;
        setWorkerProfile({
          name: profile.name || 'Worker Name',
          phone: profile.phone || '',
          photo: profile.profilePhoto || null,
          categories: profile.serviceCategories || (profile.serviceCategory ? [profile.serviceCategory] : []),
          address: profile.address,
        });
      }

      if (statsRes.success) {
        const { totalEarnings, activeJobs, completedJobs, rating, recentJobs: apiRecentJobs } = statsRes.data;

        setStats(prev => ({
          ...prev,
          totalEarnings: totalEarnings || 0,
          thisMonthEarnings: totalEarnings || 0, // Assuming total is this month for now or total
          pendingJobs: activeJobs || 0, // Using active for pending display for now, or map specifically if needed
          acceptedJobs: activeJobs || 0, // Overlap in meaning, simplify
          completedJobs: completedJobs || 0,
          rating: rating || 0
        }));

        // Use recent jobs from stats API
        if (apiRecentJobs && apiRecentJobs.length > 0) {
          setRecentJobs(apiRecentJobs.map(job => ({
            id: job._id,
            serviceType: job.serviceId?.title || job.serviceName || 'Service',
            customerName: job.userId?.name || 'Customer',
            location: job.address?.city || 'Location N/A',
            time: job.scheduledTime || 'N/A',
            status: job.status,
            price: job.finalAmount,
          })));
        }
      }

      if (profileRes.success) {
        setIsOnline(profileRes.worker.status === 'ONLINE');
      }

      setLoading(false);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard data');
      setLoading(false);
    }
  };

  // Load real data from API
  useEffect(() => {
    fetchDashboardData();

    // Ask for notification permission and register FCM
    registerFCMToken('worker', true).catch(err => console.error('FCM registration failed:', err));

    // Listen for updates
    const handleUpdate = () => {
      fetchDashboardData();
    };
    window.addEventListener('workerJobsUpdated', handleUpdate);

    return () => {
      window.removeEventListener('workerJobsUpdated', handleUpdate);
    };

  }, []);



  // Socket Listener for New Jobs
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notif) => {
      // Listen for new job assignments
      if ((notif.type === 'booking_created' || notif.type === 'job_assigned') && notif.relatedId) {
        setAlertJobId(notif.relatedId);
      }
    };

    socket.on('notification', handleNotification);
    return () => socket.off('notification', handleNotification);
  }, [socket]);

  const toggleStatus = async () => {
    try {
      setStatusUpdating(true);
      const newStatus = isOnline ? 'OFFLINE' : 'ONLINE';
      const response = await workerService.updateStatus(newStatus);

      if (response.success) {
        setIsOnline(!isOnline);
        toast.success(`You are now ${newStatus === 'ONLINE' ? 'Online' : 'Offline'}`);
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

  // Share toggle state and handler globally with Header
  useEffect(() => {
    window.isWorkerOnlineGlobally = isOnline;
    window.handleWorkerToggleGlobally = async () => {
      if (!statusUpdating) {
        await toggleStatus();
      }
    };
    // Force React to re-render header component by dispatching a custom event if needed
    window.dispatchEvent(new Event('workerStatusUpdated'));
    return () => {
      delete window.isWorkerOnlineGlobally;
      delete window.handleWorkerToggleGlobally;
    };
  }, [isOnline, statusUpdating]);

  if (loading) {
    return (
      <div className="min-h-screen pb-20" style={{ background: themeColors.backgroundGradient }}>
        <Header title="Dashboard" showBack={false} />
        <main className="px-4 py-4 space-y-6">
          <SkeletonProfileHeader />
          <SkeletonDashboardStats />
          <div className="space-y-4">
            <div className="h-6 w-32 bg-slate-200 rounded animate-pulse"></div>
            <SkeletonList count={3} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: themeColors.backgroundGradient }}>
      <Header title="Dashboard" showBack={false} notificationCount={stats.pendingJobs} />

      <main className="pt-0">
        {/* Sections removed (Profile welcome card & service categories) */}

        {/* Earnings Highlight - Full Width */}
        <div className="px-4 pt-4">
          <div
            onClick={() => navigate('/worker/wallet')}
            className="rounded-2xl p-5 relative overflow-hidden cursor-pointer active:scale-98 transition-all"
            style={{
              background: 'linear-gradient(135deg, #F0FDFA 0%, #CCFBF1 100%)',
              boxShadow: '0 10px 25px rgba(13, 148, 136, 0.05)',
              border: '1.5px solid #99F6E4',
            }}
          >
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-teal-800 font-bold opacity-75 uppercase tracking-[0.2em] mb-1">Total Earnings</p>
                <h3 className="text-3xl font-black text-teal-950 tracking-tight">
                  ₹{stats.thisMonthEarnings.toLocaleString()}
                </h3>
                <div className="flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full bg-teal-800/10 border border-teal-200/50 w-fit">
                  <FiTrendingUp className="w-3 h-3 text-emerald-700" />
                  <span className="text-[10px] text-teal-800 font-bold">This Month</span>
                </div>
              </div>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid #CCFBF1',
                }}
              >
                <FaWallet className="w-7 h-7 text-teal-700" />
              </div>
            </div>
            {/* Decorative background shape */}
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
          </div>
        </div>

        {/* Stats Grid - 3 Cards in a Row */}
        <div className="px-4 pt-4">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {/* Pending Jobs */}
            <div
              onClick={() => navigate('/worker/jobs')}
              className="rounded-2xl p-3 flex flex-col items-center justify-center relative active:scale-95 transition-all text-center"
              style={{
                background: '#fef3c7', // light amber
                border: '1px solid #fde68a',
                boxShadow: '0 4px 10px rgba(251, 191, 36, 0.1)',
              }}
            >
              <div className="w-10 h-10 rounded-xl mb-2 flex items-center justify-center bg-white shadow-sm">
                <FiClock className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-[14px] font-black text-amber-900 leading-tight">{stats.pendingJobs}</p>
              <p className="text-[9px] font-bold text-amber-700 uppercase tracking-tighter">Pending</p>
              <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-md">
                <FiArrowRight className="w-3 h-3 text-white" />
              </div>
            </div>

            {/* Accepted Jobs */}
            <div
              onClick={() => navigate('/worker/jobs')}
              className="rounded-2xl p-3 flex flex-col items-center justify-center relative active:scale-95 transition-all text-center"
              style={{
                background: '#e0f2fe', // light blue
                border: '1px solid #bae6fd',
                boxShadow: '0 4px 10px rgba(14, 165, 233, 0.1)',
              }}
            >
              <div className="w-10 h-10 rounded-xl mb-2 flex items-center justify-center bg-white shadow-sm">
                <FiCheckCircle className="w-5 h-5 text-sky-500" />
              </div>
              <p className="text-[14px] font-black text-sky-900 leading-tight">{stats.acceptedJobs}</p>
              <p className="text-[9px] font-bold text-sky-700 uppercase tracking-tighter">Accepted</p>
              <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center shadow-md">
                <FiArrowRight className="w-3 h-3 text-white" />
              </div>
            </div>

            {/* Completed Jobs */}
            <div
              onClick={() => navigate('/worker/jobs')}
              className="rounded-2xl p-3 flex flex-col items-center justify-center relative active:scale-95 transition-all text-center"
              style={{
                background: '#f0fdf4', // light green
                border: '1px solid #dcfce7',
                boxShadow: '0 4px 10px rgba(34, 197, 94, 0.1)',
              }}
            >
              <div className="w-10 h-10 rounded-xl mb-2 flex items-center justify-center bg-white shadow-sm">
                <FiBriefcase className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-[14px] font-black text-green-900 leading-tight">{stats.completedJobs}</p>
              <p className="text-[9px] font-bold text-green-700 uppercase tracking-tighter">Completed</p>
              <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                <FiArrowRight className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>
        </div>


        {/* Recent Jobs Section */}
        <div className="px-4 pt-4 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Recent Jobs</h2>
            {recentJobs.length > 0 && (
              <button
                onClick={() => navigate('/worker/jobs')}
                className="px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 active:scale-95 text-teal-800"
                style={{
                  background: 'linear-gradient(135deg, #F0FDFA 0%, #CCFBF1 100%)',
                  border: '1.5px solid #99F6E4',
                  boxShadow: '0 4px 12px rgba(13, 148, 136, 0.05)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                View All
              </button>
            )}
          </div>
          {recentJobs.length > 0 ? (
            <div className="space-y-3">
              {recentJobs.map((job, index) => {
                // Alternating colors (softer premium light-teals)
                const isEven = index % 2 === 0;
                const accentColor = isEven ? '#14B8A6' : '#2DD4BF';

                return (
                  <div
                    key={job.id}
                    onClick={() => navigate(`/worker/job/${job.id}`)}
                    className="bg-white rounded-xl shadow-lg cursor-pointer active:scale-98 transition-all duration-200 relative overflow-hidden"
                    style={{
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.08)',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    {/* Left accent border */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl"
                      style={{
                        background: `linear-gradient(180deg, ${accentColor} 0%, ${accentColor}dd 100%)`,
                      }}
                    />

                    {/* Compact Content */}
                    <div className="px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        {/* Profile Image Circle */}
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                          style={{
                            border: `2.5px solid ${accentColor}40`,
                            boxShadow: `0 2px 8px ${accentColor}40, inset 0 1px 0 rgba(255, 255, 255, 0.4)`,
                            background: `linear-gradient(135deg, ${accentColor}20 0%, ${accentColor}10 100%)`,
                          }}
                        >
                          <FiUser className="w-5 h-5" style={{ color: accentColor }} />
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                          {/* Name and Service in one line */}
                          <div className="flex items-center gap-2 mb-1.5">
                            <p className="text-sm font-bold text-gray-800 truncate">{job.customerName}</p>
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-lg shrink-0"
                              style={{
                                background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%)`,
                                color: '#FFFFFF',
                                boxShadow: `0 2px 5px ${hexToRgba(accentColor, 0.3)}`,
                              }}
                            >
                              {job.serviceType || 'Service'}
                            </span>
                          </div>

                          {/* Address, Time, Status in one line */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <div
                              className="flex items-center gap-1 px-2 py-0.5 rounded"
                              style={{
                                background: 'rgba(0, 166, 166, 0.1)',
                                border: '1px solid rgba(0, 166, 166, 0.2)',
                              }}
                            >
                              <FiMapPin className="w-3 h-3" style={{ color: themeColors.button }} />
                              <span className="text-xs font-semibold text-gray-700 truncate max-w-[100px]">{job.location}</span>
                            </div>
                            <div
                              className="flex items-center gap-1 px-2 py-0.5 rounded"
                              style={{
                                background: 'rgba(245, 158, 11, 0.1)',
                                border: '1px solid rgba(245, 158, 11, 0.2)',
                              }}
                            >
                              <FiClock className="w-3 h-3" style={{ color: '#F59E0B' }} />
                              <span className="text-xs font-semibold text-gray-700">{job.time}</span>
                            </div>
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{
                                background: `${accentColor}15`,
                                color: accentColor,
                                border: `1px solid ${accentColor}30`,
                              }}
                            >
                              {getStatusLabel(job.status)}
                            </span>
                          </div>
                        </div>

                        {/* Navigate Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/worker/job/${job.id}`);
                          }}
                          className="p-2 rounded-lg shrink-0 transition-all duration-300 active:scale-95"
                          style={{
                            background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%)`,
                            boxShadow: `0 3px 10px ${hexToRgba(accentColor, 0.3)}, 0 2px 5px ${hexToRgba(accentColor, 0.2)}`,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.boxShadow = `0 5px 14px ${hexToRgba(accentColor, 0.4)}, 0 3px 7px ${hexToRgba(accentColor, 0.3)}`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = `0 3px 10px ${hexToRgba(accentColor, 0.3)}, 0 2px 5px ${hexToRgba(accentColor, 0.2)}`;
                          }}
                        >
                          <FiArrowRight className="w-4 h-4" style={{ color: '#FFFFFF' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className="bg-white rounded-xl p-8 text-center shadow-md"
              style={{
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              }}
            >
              <FiBriefcase className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-600 font-semibold mb-2">No jobs assigned yet</p>
              <p className="text-sm text-gray-500">
                You'll see assigned jobs here when vendors assign work to you
              </p>
            </div>
          )}
        </div>
      </main>


      <WorkerJobAlertModal
        isOpen={!!alertJobId}
        jobId={alertJobId}
        onClose={() => setAlertJobId(null)}
        onJobAccepted={(id) => {
          fetchDashboardData();
          navigate(`/worker/job/${id}`);
        }}
      />


    </div >
  );
};

export default Dashboard;

