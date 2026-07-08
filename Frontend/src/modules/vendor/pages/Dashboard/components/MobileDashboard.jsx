import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { FiBell, FiBriefcase, FiUsers, FiArrowRight, FiCheckCircle, FiStar, FiMapPin, FiClock, FiShoppingBag, FiDollarSign, FiZap } from 'react-icons/fi';
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

      <main className="pt-4 relative z-10">
        {/* Compact Inline Welcome Banner */}
        <div className="px-1.5 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium text-gray-900 leading-none">
              Hello, Partner!
            </h2>
            <p className="text-[9px] font-normal text-gray-500 mt-1.5 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {isOnline ? 'Active & Online' : 'Currently Offline'}
            </p>
          </div>
        </div>
        <div className="px-1.5 pb-5">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-2xl p-5 border border-blue-100/70 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-100/20 rounded-full blur-[60px] -mr-24 -mt-24 group-hover:scale-125 transition-transform duration-1000" />
            
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <p className="text-[8px] font-medium text-blue-500 capitalize tracking-[0.3em]">Efficiency Rating</p>
                </div>
                <h3 className="text-gray-950 text-lg font-medium leading-tight mb-3 tracking-tighter capitalize">
                  Operational <br />Performance
                </h3>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/vendor/jobs')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[8px] font-medium capitalize tracking-widest shadow hover:shadow-blue-500/25 transition-all"
                >
                  Analyze Deployment
                </motion.button>
              </div>

              <div className="relative w-20 h-20 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    stroke="rgba(37,99,235,0.1)"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <motion.circle
                    initial={{ strokeDashoffset: 2 * Math.PI * 32 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 32 * (1 - (stats?.performanceScore || 0) / 100) }}
                    cx="40"
                    cy="40"
                    r="32"
                    stroke="#2563EB"
                    strokeWidth="6"
                    strokeDasharray={2 * Math.PI * 32}
                    strokeLinecap="round"
                    fill="transparent"
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-gray-950 text-xl font-medium tracking-tighter">{stats?.performanceScore || 0}%</span>
                  <span className="text-[6px] font-medium text-gray-400 capitalize tracking-[0.2em] mt-0.5">Score</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-1.5 space-y-6">
          <PendingBookings
            bookings={pendingBookings}
            maxSearchTimeMins={globalConfig?.maxSearchTime || 5}
            setPendingBookings={setPendingBookings}
            setActiveAlertBooking={(booking) => {
              window.dispatchEvent(new CustomEvent('showDashboardBookingAlert', { detail: booking }));
            }}
          />

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Total Orders', value: stats?.totalBookings || 0, icon: FiShoppingBag, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100', change: '+ 18.6%', isUp: true },
              { label: 'Total Earnings', value: `₹${Number(stats?.totalEarnings || 0).toLocaleString('en-IN')}`, icon: FiDollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', change: '+ 22.5%', isUp: true },
              { label: 'Store Rating', value: Number(stats?.rating || 0) > 0 ? Number(stats.rating).toFixed(1) : '0.0', icon: FiStar, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-100', change: 'LIVE', isUp: true },
              { label: 'Online Status', value: isOnline ? 'Online' : 'Offline', icon: FiZap, color: isOnline ? 'text-emerald-600' : 'text-rose-600', bg: isOnline ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100', change: 'STATUS', isUp: isOnline }
            ].map((stat, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col justify-between hover:shadow-md transition-all duration-350 shadow-sm">
                <div className="flex items-center justify-between mb-3 w-full">
                  <div className={`w-8 h-8 rounded-xl ${stat.bg} flex items-center justify-center ${stat.color} border`}>
                    <stat.icon className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-0.5 text-[8px] font-medium text-emerald-600 capitalize tracking-wider">
                    <span>↗</span>
                    <span>{stat.change}</span>
                  </div>
                </div>
                <div>
                  <p className="text-gray-400 text-[8px] font-normal capitalize tracking-wider">{stat.label}</p>
                  <p className="text-lg font-medium text-gray-900 mt-1 tracking-tight truncate leading-tight">
                    {stat.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="pb-24">
            <div className="flex items-center justify-between mb-4 px-1">
              <div>
                <h2 className="text-[10px] font-medium text-gray-500 capitalize tracking-[0.3em]">Service Bookings</h2>
                <p className="text-[9px] font-medium text-blue-500 capitalize tracking-widest mt-1">Active Bookings</p>
              </div>
              {recentJobs.length > 0 && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/vendor/jobs')}
                  className="w-9 h-9 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center text-gray-400 hover:text-blue-600 transition-all"
                >
                  <FiArrowRight className="w-4 h-4" />
                </motion.button>
              )}
            </div>

            {recentJobs.length > 0 ? (
              <div className="space-y-4">
                {recentJobs.map((job) => (
                  <motion.div
                    key={job.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/vendor/booking/${job.id}`)}
                    className="bg-white rounded-2xl p-4 border border-gray-100 cursor-pointer hover:shadow-md transition-all duration-350 group shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100 group-hover:scale-105 transition-transform duration-350">
                        <div className="text-xl">🛠️</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-medium text-gray-900 truncate tracking-tight capitalize">
                            {job.customerName || 'Authorized User'}
                          </h4>
                          <span className="text-[9px] font-medium text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100 tracking-wider">
                            ₹{job.price}
                          </span>
                        </div>
                        <p className="text-[8px] font-medium text-gray-400 capitalize tracking-widest mb-3">
                          {job.serviceType || 'Deployment'}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-50">
                          <div className="flex items-center gap-1.5 text-[8px] font-medium text-gray-500 capitalize tracking-tight">
                            <FiMapPin className="w-3 h-3 text-blue-500" />
                            <span className="truncate max-w-[100px]">{job.location}</span>
                          </div>
                          {job.workerResponse === 'REJECTED' && !job.assignedTo ? (
                            <div className="ml-auto flex items-center gap-1.5 shrink-0">
                              <div className="px-2.5 py-1 rounded-lg text-[6px] md:text-[7px] font-medium capitalize tracking-[0.1em] text-white bg-rose-500 shadow">
                                Rejected by Worker ({job.rejectedWorker?.name || 'Worker'})
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/vendor/booking/${job.id}/assign-worker`);
                                }}
                                className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[7px] font-bold uppercase tracking-wider transition-all"
                              >
                                Reassign
                              </button>
                            </div>
                          ) : (
                            <div className={`ml-auto px-3 py-1 rounded-lg text-[7px] font-medium capitalize tracking-[0.15em] text-white shadow`}
                              style={{ backgroundColor: getStatusColor(job.status) }}>
                              {getStatusLabel(job.status)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-12 border border-gray-100 text-center shadow-sm">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-gray-100">
                  <span className="text-3xl opacity-50">📭</span>
                </div>
                <h3 className="text-sm font-medium text-gray-900 mb-2 capitalize tracking-tighter">Operational Calm</h3>
                <p className="text-[8px] font-medium text-gray-400 capitalize tracking-[0.25em]">System standby for new deployments</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
});

export default MobileDashboard;
