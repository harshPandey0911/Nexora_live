import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { FiBell, FiBriefcase, FiUsers, FiArrowRight, FiCheckCircle, FiStar, FiMapPin, FiClock } from 'react-icons/fi';
import { FaWallet } from 'react-icons/fa';
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
    <div className="min-h-screen pb-28 relative overflow-x-hidden">
      {/* Premium Background Pattern */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gray-50" />
      </div>

      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-100 px-8 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20 border border-blue-400/20">
            <span className="text-white font-black text-xl tracking-tighter">N</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-black text-gray-900 tracking-tight leading-none uppercase">
              Operational
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[8px] font-black text-blue-500 uppercase tracking-[0.3em]">Intelligence Hub</span>
              <span className="bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded-lg text-[7px] font-black border border-blue-500/20">L{stats?.level || 3}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <motion.div 
            whileTap={{ scale: 0.95 }}
            className={`relative w-16 h-8 rounded-full transition-all duration-700 cursor-pointer p-1 shadow-inner ${
              isOnline ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-gray-200'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleOnline();
            }}
          >
            <motion.div
              animate={{ x: isOnline ? 32 : 0 }}
              className="w-6 h-6 bg-white rounded-full shadow-2xl flex items-center justify-center"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-600 animate-pulse' : 'bg-gray-400'}`} />
            </motion.div>
          </motion.div>

          <motion.div
            whileTap={{ scale: 0.9 }}
            className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center relative cursor-pointer group"
            onClick={() => navigate('/vendor/notifications')}
          >
            <FiBell className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
            {stats?.pendingAlerts > 0 && (
              <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-blue-600 rounded-full border-2 border-white shadow-lg animate-pulse" />
            )}
          </motion.div>
        </div>
      </header>

      <main className="pt-6 relative z-10">
        <div className="px-8 pb-10">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[40px] p-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] -mr-32 -mt-32 group-hover:scale-125 transition-transform duration-1000" />
            
            <div className="relative z-10 flex items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <p className="text-[9px] font-black text-blue-100/60 uppercase tracking-[0.4em]">Efficiency Rating</p>
                </div>
                <h3 className="text-white text-2xl font-black leading-tight mb-6 tracking-tighter uppercase">
                  Operational <br />Performance
                </h3>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/vendor/jobs')}
                  className="bg-white text-blue-600 px-6 py-3 rounded-[18px] text-[9px] font-black uppercase tracking-widest shadow-xl hover:shadow-blue-900/40 transition-all"
                >
                  Analyze Deployment
                </motion.button>
              </div>

              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <motion.circle
                    initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 40 * (1 - (stats?.performanceScore || 0) / 100) }}
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="#FFFFFF"
                    strokeWidth="8"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeLinecap="round"
                    fill="transparent"
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-white text-2xl font-black tracking-tighter">{stats?.performanceScore || 0}%</span>
                  <span className="text-[7px] font-black text-blue-100/50 uppercase tracking-[0.2em] mt-1">Score</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 space-y-10">
          <PendingBookings
            bookings={pendingBookings}
            maxSearchTimeMins={globalConfig?.maxSearchTime || 5}
            setPendingBookings={setPendingBookings}
            setActiveAlertBooking={(booking) => {
              window.dispatchEvent(new CustomEvent('showDashboardBookingAlert', { detail: booking }));
            }}
          />

          <div className="grid grid-cols-2 gap-6">
            {[
              { label: 'Deployed', value: stats?.completedJobs || 0, icon: FiCheckCircle, color: 'text-blue-500', onClick: () => navigate('/vendor/jobs') },
              { label: 'Reputation', value: (stats?.rating > 0) ? stats.rating.toFixed(1) : '5.0', icon: FiStar, color: 'text-amber-500', onClick: () => navigate('/vendor/my-ratings') },
            ].map((stat, idx) => (
              <div 
                key={idx} 
                onClick={stat.onClick}
                className="bg-white rounded-[32px] p-6 border border-gray-100 flex flex-col items-center text-center group hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500 shadow-sm cursor-pointer"
              >
                <div className={`w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-4 ${stat.color} group-hover:scale-110 transition-transform shadow-inner border border-gray-100`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <p className="text-2xl font-black text-gray-900 tracking-tighter leading-none">
                  {stat.value}
                </p>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.3em] mt-3">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="pb-24">
            <div className="flex items-center justify-between mb-8 px-2">
              <div>
                <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.4em]">Operational Stream</h2>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-2">Active Deployments</p>
              </div>
              {recentJobs.length > 0 && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/vendor/jobs')}
                  className="w-11 h-11 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center text-gray-400 hover:text-blue-600 transition-all"
                >
                  <FiArrowRight className="w-5 h-5" />
                </motion.button>
              )}
            </div>

            {recentJobs.length > 0 ? (
              <div className="space-y-6">
                {recentJobs.map((job) => (
                  <motion.div
                    key={job.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/vendor/booking/${job.id}`)}
                    className="bg-white rounded-[40px] p-6 border border-gray-100 cursor-pointer hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500 group shadow-sm"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-[24px] bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100 group-hover:scale-105 transition-transform duration-500">
                        <div className="text-2xl">🛠️</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-[15px] font-black text-gray-900 truncate tracking-tight uppercase">
                            {job.customerName || 'Authorized User'}
                          </h4>
                          <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-xl border border-blue-100 tracking-widest">
                            ₹{job.price}
                          </span>
                        </div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">
                          {job.serviceType || 'Deployment'}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-50">
                          <div className="flex items-center gap-2 text-[9px] font-black text-gray-500 uppercase tracking-tight">
                            <FiMapPin className="w-3.5 h-3.5 text-blue-500" />
                            <span className="truncate max-w-[120px]">{job.location}</span>
                          </div>
                          <div className={`ml-auto px-4 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-[0.2em] text-white shadow-lg`}
                            style={{ backgroundColor: getStatusColor(job.status) }}>
                            {getStatusLabel(job.status)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-[48px] p-20 border border-gray-100 text-center shadow-sm">
                <div className="w-24 h-24 bg-gray-50 rounded-[32px] flex items-center justify-center mx-auto mb-10 border border-gray-100">
                  <span className="text-4xl opacity-50">📭</span>
                </div>
                <h3 className="text-lg font-black text-gray-900 mb-3 uppercase tracking-tighter">Operational Calm</h3>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em]">System standby for new deployments</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
});

export default MobileDashboard;
