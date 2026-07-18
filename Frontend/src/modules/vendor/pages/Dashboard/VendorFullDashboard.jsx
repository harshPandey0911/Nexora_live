import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FiShoppingBag, FiDollarSign, FiStar, FiZap,
  FiArrowUpRight, FiArrowDownRight, FiCalendar,
  FiPackage, FiUser, FiChevronRight
} from 'react-icons/fi';
import {
  AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { useNavigate } from 'react-router-dom';

/* ─── Tooltip components defined OUTSIDE to avoid Recharts reference churn ─── */
const RevenueTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white rounded-xl px-3 py-2 shadow-2xl text-xs min-w-[130px]">
      <p className="text-gray-400 mb-1 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-bold">
          {p.dataKey === 'earnings' ? `₹${Number(p.value).toLocaleString('en-IN')}` : `${p.value} orders`}
        </p>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-gray-900 text-white rounded-lg px-2.5 py-1.5 shadow-xl text-[11px] flex items-center gap-2 whitespace-nowrap">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.payload.color }} />
      <span className="font-semibold">{p.name}</span>
      <span className="text-gray-400">·</span>
      <span style={{ color: p.payload.color }}>{p.value}</span>
    </div>
  );
};

/* ─── STATUS BADGE ─── */
const StatusBadge = ({ status, workerResponse, assignedTo }) => {
  const rejected = workerResponse === 'REJECTED' && !assignedTo;
  const map = {
    completed:  { label: 'Completed',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    assigned:   { label: 'Assigned',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    accepted:   { label: 'Accepted',   cls: 'bg-teal-50 text-teal-700 border-teal-200' },
    requested:  { label: 'Pending',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    cancelled:  { label: 'Cancelled',  cls: 'bg-red-50 text-red-700 border-red-200' },
  };
  const key = (status || '').toLowerCase();
  const cfg = rejected
    ? { label: 'Rejected', cls: 'bg-rose-50 text-rose-700 border-rose-200' }
    : (map[key] || { label: status, cls: 'bg-gray-50 text-gray-600 border-gray-200' });
  return (
    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-lg border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */
const VendorFullDashboard = ({ stats, recentJobs, vendorProfile, isOnline, handleToggleOnline, revenueAnalytics }) => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('This Week');

  const activeData = useMemo(() => revenueAnalytics?.[period] || [], [revenueAnalytics, period]);

  const totalRevenue = useMemo(
    () => activeData.reduce((s, d) => s + (d.earnings || 0), 0),
    [activeData]
  );

  const orderStatusData = useMemo(() => [
    { name: 'Delivered',   value: stats?.completedJobs    || 0, color: '#10B981' },
    { name: 'Confirmed',   value: stats?.confirmedJobs    || 0, color: '#3B82F6' },
    { name: 'Processing',  value: stats?.inProgressBookings || 0, color: '#F59E0B' },
    { name: 'Cancelled',   value: stats?.cancelledJobs    || 0, color: '#EF4444' },
  ], [stats]);

  const totalJobs = orderStatusData.reduce((s, d) => s + d.value, 0) || 1;

  const statCards = useMemo(() => [
    {
      label: 'Total Orders',
      value: stats?.totalBookings || 0,
      change: '+ 18.6%', isUp: true,
      icon: FiShoppingBag,
      gradient: 'from-violet-500 to-purple-600',
      lightBg: 'bg-violet-50',
      textColor: 'text-violet-600',
      onClick: () => navigate('/vendor/jobs'),
    },
    {
      label: 'Total Earnings',
      value: `₹${Number(stats?.totalEarnings || 0).toLocaleString('en-IN')}`,
      change: '+ 22.5%', isUp: true,
      icon: FiDollarSign,
      gradient: 'from-emerald-500 to-teal-600',
      lightBg: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      onClick: () => navigate('/vendor/earnings'),
    },
    {
      label: 'Store Rating',
      value: Number(stats?.rating || 0) > 0 ? Number(stats.rating).toFixed(1) : '—',
      change: 'Live', isUp: true,
      icon: FiStar,
      gradient: 'from-amber-400 to-orange-500',
      lightBg: 'bg-amber-50',
      textColor: 'text-amber-600',
      onClick: () => navigate('/vendor/my-ratings'),
    },
    {
      label: 'Online Status',
      value: isOnline ? 'Online' : 'Offline',
      change: 'Status', isUp: isOnline,
      icon: FiZap,
      gradient: isOnline ? 'from-emerald-400 to-green-500' : 'from-rose-400 to-red-500',
      lightBg: isOnline ? 'bg-emerald-50' : 'bg-rose-50',
      textColor: isOnline ? 'text-emerald-600' : 'text-rose-600',
      isToggle: true,
      onClick: handleToggleOnline,
    },
  ], [stats, isOnline, navigate, handleToggleOnline]);

  return (
    <div className="space-y-5 pb-12">

      {/* ── WELCOME BANNER ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 shadow-lg">
        {/* decorative blobs */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-violet-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {/* avatar */}
            <div className="w-14 h-14 rounded-2xl ring-2 ring-teal-400/30 overflow-hidden bg-gray-700 shrink-0">
              {vendorProfile?.photo
                ? <img src={vendorProfile.photo} alt="Profile" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><FiUser className="text-gray-400 w-6 h-6" /></div>
              }
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1 font-medium tracking-widest uppercase">Welcome back</p>
              <h2 className="text-xl font-bold text-white tracking-tight leading-none">
                {String(vendorProfile?.name || 'Vendor').split(' ')[0]}
              </h2>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-teal-400 font-medium">{vendorProfile?.businessName || 'Business'}</span>
                <span className="text-gray-600">·</span>
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-widest">
                  LEVEL L{stats?.level || 2}
                </span>
                <span className="text-gray-600">·</span>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                  {isOnline ? 'System Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Availability toggle */}
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 backdrop-blur-sm">
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Availability</p>
              <p className={`text-xs font-bold ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isOnline ? 'Active' : 'Hidden'}
              </p>
            </div>
            <button
              onClick={handleToggleOnline}
              className={`relative w-11 h-6 rounded-full transition-all duration-500 ${isOnline ? 'bg-emerald-500' : 'bg-gray-600'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-500 ${isOnline ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            onClick={card.onClick}
            className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
          >
            {/* gradient top strip */}
            <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${card.gradient}`} />
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                <card.icon className="w-4 h-4 text-white" />
              </div>
              <div className={`flex items-center gap-0.5 text-[10px] font-bold ${card.isUp ? 'text-emerald-600' : 'text-rose-500'}`}>
                {card.isUp ? <FiArrowUpRight className="w-3 h-3" /> : <FiArrowDownRight className="w-3 h-3" />}
                {card.change}
              </div>
            </div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">{card.label}</p>
            <h3 className="text-xl font-black text-gray-900 tracking-tight">{card.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* ── CHARTS ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Revenue Area Chart */}
        <div className="lg:col-span-8 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-gray-800 tracking-tight">Revenue Overview</h3>
              <p className="text-xs text-gray-400 mt-0.5">Performance analytics · {period.toLowerCase()}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-base font-black text-gray-900">₹{totalRevenue.toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-gray-400">period total</p>
              </div>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
              >
                <option>This Week</option>
                <option>This Month</option>
                <option>Last Month</option>
              </select>
            </div>
          </div>

          {/* Revenue chart — graceful sparse-data handling */}
          {activeData.length <= 1 ? (
            <div className="h-[280px] w-full flex flex-col items-center justify-center gap-4 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              <div className="text-center">
                <p className="text-3xl font-black text-gray-900 mb-1">₹{totalRevenue.toLocaleString('en-IN')}</p>
                <p className="text-xs text-gray-400 font-medium">
                  {activeData.length === 1 ? `Single data point · ${activeData[0]?.name}` : 'No revenue data yet for this period'}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="w-6 h-px bg-gray-300" />
                Not enough data to draw a trend
                <span className="w-6 h-px bg-gray-300" />
              </div>
              <p className="text-[10px] text-gray-400">Try switching to <strong>This Month</strong> or <strong>Last Month</strong></p>
            </div>
          ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activeData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="vendorEarningsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#0D9488" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#0D9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="name"
                  axisLine={false} tickLine={false}
                  tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 600 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false} tickLine={false}
                  tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 600 }}
                  tickFormatter={(v) => `₹${v / 1000}k`}
                  width={42}
                />
                <Tooltip content={<RevenueTooltip />} cursor={{ stroke: '#0D9488', strokeWidth: 1, strokeDasharray: '4 2' }} />
                <Area
                  type="monotone" dataKey="earnings"
                  stroke="#0D9488" strokeWidth={2.5}
                  fill="url(#vendorEarningsGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#0D9488', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          )}
        </div>

        {/* Order Status Donut */}
        <div className="lg:col-span-4 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-800 tracking-tight">Order Status</h3>
              <p className="text-xs text-gray-400 mt-0.5">All time distribution</p>
            </div>
            <span className="bg-gray-50 border border-gray-200 text-gray-600 text-[10px] font-bold px-2.5 py-1 rounded-full">
              {totalJobs} jobs
            </span>
          </div>

          <div className="relative h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={orderStatusData}
                  cx="50%" cy="50%"
                  innerRadius={58} outerRadius={80}
                  paddingAngle={3} strokeWidth={0}
                  dataKey="value"
                >
                  {orderStatusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} offset={16} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-gray-900">{stats?.totalBookings || 0}</span>
              <span className="text-[10px] text-gray-400 font-medium">Total Jobs</span>
            </div>
          </div>

          {/* Progress legend */}
          <div className="mt-3 space-y-3">
            {orderStatusData.map((item, idx) => {
              const pct = ((item.value / totalJobs) * 100).toFixed(0);
              return (
                <div key={idx}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-600 font-semibold">{item.name}</span>
                    </div>
                    <span className="font-bold text-gray-800">{item.value} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: idx * 0.1 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── RECENT ACTIVITY ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-bold text-gray-800 tracking-tight">Recent Activity</h3>
            <p className="text-xs text-gray-400 mt-0.5">Your latest bookings</p>
          </div>
          <button
            onClick={() => navigate('/vendor/jobs')}
            className="flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
          >
            View All <FiChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentJobs?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentJobs.slice(0, 6).map((order, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => navigate(`/vendor/booking/${order.id}`)}
                className="bg-gray-50 hover:bg-white border border-gray-100 hover:border-teal-200 hover:shadow-md rounded-xl p-4 cursor-pointer transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 group-hover:scale-110 transition-transform shrink-0">
                    <FiPackage className="w-4 h-4" />
                  </div>
                  <StatusBadge status={order.status} workerResponse={order.workerResponse} assignedTo={order.assignedTo} />
                </div>

                <h4 className="text-sm font-semibold text-gray-800 capitalize truncate mb-0.5">{order.serviceType || 'Service Booking'}</h4>
                <p className="text-xs text-gray-500 truncate">{order.customerName}</p>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200/60">
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                    <FiCalendar className="w-3 h-3" />
                    {order.timeSlot?.date}
                  </div>
                  <span className="text-sm font-bold text-gray-900">₹{order.price}</span>
                </div>

                {order.workerResponse === 'REJECTED' && !order.assignedTo && (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/vendor/booking/${order.id}/assign-worker`); }}
                    className="mt-2 w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-bold uppercase tracking-widest transition-all"
                  >
                    Reassign Worker
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <FiPackage className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">No recent activity</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorFullDashboard;
