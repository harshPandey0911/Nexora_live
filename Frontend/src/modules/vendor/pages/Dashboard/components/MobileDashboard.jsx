import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { FiBell, FiBriefcase, FiUsers, FiArrowRight, FiCheckCircle, FiStar, FiMapPin, FiClock, FiShoppingBag, FiDollarSign, FiZap } from 'react-icons/fi';
import PendingBookings from './PendingBookings';

const MobileDashboard = memo(({ 
  stats, 
  isOnline, 
  handleToggleOnline, 
  navigate, 
  pendingBookings, 
  setPendingBookings, 
  recentJobs, 
  getStatusColor, 
  getStatusLabel,
  globalConfig
}) => {
  return (
    <div className="min-h-screen pb-20 relative">
      <main className="space-y-4">
        {/* Welcome & Operational Performance Hero Card */}
        <div className="bg-gradient-to-br from-[#00246b] via-[#001c54] to-[#0d1b3e] text-white rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                <p className="text-[9px] font-bold text-blue-200 uppercase tracking-wider">
                  {isOnline ? 'System Online & Active' : 'Currently Offline'}
                </p>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight tracking-tight capitalize">
                Operational Score
              </h2>
              <p className="text-[10px] text-blue-100/80 mt-0.5">Deployment efficiency rating</p>

              <button
                onClick={() => navigate('/vendor/jobs')}
                className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 active:scale-95 transition-all rounded-lg text-[10px] font-bold text-white border border-white/20 backdrop-blur-md cursor-pointer"
              >
                <span>View Deployments</span>
                <FiArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Circular Performance Gauge */}
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="5"
                  fill="transparent"
                />
                <motion.circle
                  initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - (stats?.performanceScore || 0) / 100) }}
                  cx="32"
                  cy="32"
                  r="26"
                  stroke="#38BDF8"
                  strokeWidth="5"
                  strokeDasharray={2 * Math.PI * 26}
                  strokeLinecap="round"
                  fill="transparent"
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-white text-base sm:text-lg font-bold tracking-tight">{stats?.performanceScore || 0}%</span>
                <span className="text-[7px] font-bold text-blue-200 uppercase tracking-widest">Score</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Requests Alert Section */}
        <PendingBookings
          bookings={pendingBookings}
          maxSearchTimeMins={globalConfig?.maxSearchTime || 5}
          setPendingBookings={setPendingBookings}
          setActiveAlertBooking={(booking) => {
            window.dispatchEvent(new CustomEvent('showDashboardBookingAlert', { detail: booking }));
          }}
        />

        {/* 2x2 Metrics Cards Grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Orders', value: stats?.totalBookings || 0, icon: FiShoppingBag, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100', change: '+18%', onClick: () => navigate('/vendor/jobs') },
            { label: 'Total Revenue', value: `₹${Number(stats?.totalEarnings || 0).toLocaleString('en-IN')}`, icon: FiDollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', change: '+22%', onClick: () => navigate('/vendor/earnings') },
            { label: 'Store Rating', value: Number(stats?.rating || 0) > 0 ? Number(stats.rating).toFixed(1) : '4.9', icon: FiStar, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', change: 'LIVE', onClick: () => navigate('/vendor/my-ratings') },
            { label: 'Online Status', value: isOnline ? 'Online' : 'Offline', icon: FiZap, color: isOnline ? 'text-emerald-600' : 'text-rose-600', bg: isOnline ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100', change: 'TOGGLE', onClick: handleToggleOnline }
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              whileTap={{ scale: 0.97 }}
              onClick={stat.onClick}
              className="bg-white rounded-xl p-3.5 border border-gray-100 hover:border-gray-200 shadow-2xs transition-all flex flex-col justify-between cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center ${stat.color} border shrink-0`}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                  {stat.change}
                </span>
              </div>
              <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-base font-bold text-gray-900 mt-0.5 truncate tracking-tight">
                  {stat.value}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Recent Service Deployments */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs p-3.5 space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Recent Deployments</h3>
              <p className="text-[9px] font-medium text-gray-400">Latest active service requests</p>
            </div>
            {recentJobs.length > 0 && (
              <button
                onClick={() => navigate('/vendor/jobs')}
                className="w-7 h-7 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 transition-colors cursor-pointer"
                title="View All"
              >
                <FiArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {recentJobs.length > 0 ? (
            <div className="space-y-2">
              {recentJobs.map((job) => (
                <motion.div
                  key={job.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/vendor/booking/${job.id}`)}
                  className="bg-white rounded-xl p-3 border border-gray-100 hover:border-gray-200 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 text-sm shrink-0">
                        🛠️
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-gray-900 truncate uppercase tracking-tight">
                          {job.customerName || 'Customer'}
                        </h4>
                        <p className="text-[9px] font-semibold text-gray-400 truncate">
                          {job.serviceType}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-blue-600 shrink-0">₹{job.price}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[10px] text-gray-500">
                    <span className="truncate max-w-[140px] flex items-center gap-1">
                      <FiMapPin className="w-3 h-3 text-gray-400 shrink-0" />
                      {job.location}
                    </span>

                    {job.workerResponse === 'REJECTED' && !job.assignedTo ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[8px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                          Declined
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/vendor/booking/${job.id}/assign-worker`);
                          }}
                          className="px-2 py-0.5 rounded bg-blue-600 text-white text-[8px] font-bold uppercase"
                        >
                          Reassign
                        </button>
                      </div>
                    ) : (
                      <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-gray-100 text-white`}
                        style={{ backgroundColor: getStatusColor(job.status) }}>
                        {getStatusLabel(job.status)}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="p-8 border border-dashed border-gray-200 rounded-xl text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No Recent Bookings</p>
              <p className="text-[9px] text-gray-400 mt-0.5">System ready for incoming orders</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
});

export default MobileDashboard;
