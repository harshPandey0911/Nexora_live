import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FiPieChart,
  FiTrendingUp,
  FiUsers,
  FiBriefcase,
  FiActivity,
  FiLoader,
  FiAward,
  FiCheckCircle,
  FiClock,
  FiXCircle,
  FiSlash
} from 'react-icons/fi';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { toast } from 'react-hot-toast';
import adminReportService from '../../../../services/adminReportService';

// Custom Tooltip for Registration Trend
const CustomTrendTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-2xl border border-slate-700/60">
        <p className="font-bold text-slate-300 mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="font-semibold text-white">{payload[0].value} new vendors</span>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Donut Chart
const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-2xl border border-slate-700/60">
        <p className="font-bold capitalize text-slate-200 mb-0.5">{data.name}</p>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.payload.fill }} />
          <span className="font-bold text-white">{data.value} vendors</span>
        </div>
      </div>
    );
  }
  return null;
};

const STATUS_CONFIG = {
  approved: { label: 'Approved', color: '#10B981', icon: FiCheckCircle },
  pending: { label: 'Pending', color: '#F59E0B', icon: FiClock },
  rejected: { label: 'Rejected', color: '#EF4444', icon: FiXCircle },
  suspended: { label: 'Suspended', color: '#8B5CF6', icon: FiSlash }
};

const VendorAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await adminReportService.getVendorReport();
      if (res.success) {
        setData(res.data);
      }
    } catch (error) {
      console.error('Vendor analytics error:', error);
      toast.error('Failed to load vendor analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <FiLoader className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase">Loading Analytics...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalVendors = data.totalVendors || 0;
  const totalBookings = data.totalBookings || 0;
  const rawStatusDist = data.statusDistribution || [];
  const approvedCount = rawStatusDist.find(s => s._id === 'approved')?.count || 0;
  const activeRate = totalVendors > 0 ? Math.round((approvedCount / totalVendors) * 100) : 100;

  // Format Status Distribution for Donut
  const statusDist = rawStatusDist.map(item => {
    const key = (item._id || 'approved').toLowerCase();
    const config = STATUS_CONFIG[key] || { label: item._id || 'Other', color: '#3B82F6' };
    return {
      name: config.label,
      value: item.count,
      color: config.color,
      key
    };
  });

  const topVendorsFormatted = (data.topVendors || []).map((v, i) => ({
    id: i + 1,
    businessName: v.businessName || v.name || `Vendor #${i + 1}`,
    bookingCount: v.bookingCount !== undefined ? v.bookingCount : (v.bookingsCount || 0),
    totalRevenue: v.totalRevenue || 0
  }));

  const maxBookings = Math.max(...topVendorsFormatted.map(v => v.bookingCount), 1);

  const monthlyTrendFormatted = (data.monthlyTrend || []).map(t => ({
    name: typeof t._id === 'string' ? t._id : (t.name || 'Month'),
    count: t.count || 0
  }));

  return (
    <div className="space-y-6">

      {/* KPI Cards Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Vendors */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <FiUsers className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
              Active Network
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Total Vendors</p>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight mt-0.5">{totalVendors.toLocaleString()}</h3>
          </div>
        </div>

        {/* Total Bookings */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600">
              <FiBriefcase className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 bg-teal-50 px-2 py-1 rounded-md">
              Fulfilled Jobs
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Total Bookings</p>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight mt-0.5">{totalBookings.toLocaleString()}</h3>
          </div>
        </div>

        {/* Growth Rate */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <FiTrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
              MoM Growth
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Growth</p>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight mt-0.5">{data.growth || '+12.5%'}</h3>
          </div>
        </div>

        {/* Active Rate */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
              <FiActivity className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-1 rounded-md">
              Approval Rate
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Active Rate</p>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight mt-0.5">{activeRate}%</h3>
          </div>
        </div>
      </div>

      {/* Middle Grid: Status Donut & Top Performers Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Status Distribution */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 tracking-tight">Status Distribution</h3>
                <p className="text-xs text-gray-400 mt-0.5">Vendor approval verification statuses</p>
              </div>
              <span className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full">
                {totalVendors} total
              </span>
            </div>

            {/* Donut Chart with Center Label */}
            <div className="relative h-[200px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDist}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={85}
                    paddingAngle={4}
                    strokeWidth={0}
                  >
                    {statusDist.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-gray-900">{totalVendors}</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Vendors</span>
              </div>
            </div>
          </div>

          {/* Progress Rows for Statuses */}
          <div className="space-y-3 mt-4 pt-4 border-t border-gray-100">
            {statusDist.map((item, idx) => {
              const pct = totalVendors > 0 ? ((item.value / totalVendors) * 100).toFixed(0) : 0;
              return (
                <div key={idx}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-700 font-semibold">{item.name}</span>
                    </div>
                    <span className="font-bold text-gray-900">
                      {item.value} <span className="text-gray-400 font-normal">({pct}%)</span>
                    </span>
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

        {/* Top Performers Leaderboard */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-gray-900 tracking-tight">Top Performers</h3>
                <p className="text-xs text-gray-400 mt-0.5">Leading vendors by completed bookings</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <FiAward className="w-5 h-5" />
              </div>
            </div>

            {/* Leaderboard List */}
            <div className="space-y-4">
              {topVendorsFormatted.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs font-semibold">
                  No vendor activity recorded yet
                </div>
              ) : (
                topVendorsFormatted.slice(0, 5).map((vendor, idx) => {
                  const pct = Math.round((vendor.bookingCount / maxBookings) * 100);
                  const rankColors = [
                    'bg-amber-100 text-amber-700 border-amber-200',
                    'bg-slate-100 text-slate-700 border-slate-200',
                    'bg-orange-100 text-orange-700 border-orange-200',
                    'bg-gray-100 text-gray-600 border-gray-200',
                    'bg-gray-100 text-gray-600 border-gray-200'
                  ];

                  return (
                    <div key={idx} className="group p-3 rounded-xl bg-gray-50/70 hover:bg-blue-50/30 border border-gray-100 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center border shrink-0 ${rankColors[idx] || rankColors[3]}`}>
                            #{vendor.id}
                          </span>
                          <span className="text-xs font-bold text-gray-900 truncate">
                            {vendor.businessName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="text-xs font-black text-gray-900">{vendor.bookingCount} bookings</span>
                          {vendor.totalRevenue > 0 && (
                            <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                              ₹{vendor.totalRevenue.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Animated Progress Bar */}
                      <div className="h-2 w-full bg-gray-200/70 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(pct, 8)}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: idx * 0.1 }}
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-teal-500"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Monthly Registration Trend Area Chart */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-gray-900 tracking-tight">Registration Trend</h3>
            <p className="text-xs text-gray-400 mt-0.5">Monthly vendor onboarding trajectory (last 6 months)</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <span className="text-xs font-bold text-gray-600">New Onboardings</span>
          </div>
        </div>

        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyTrendFormatted} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="vendorTrendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTrendTooltip />} cursor={{ stroke: '#2563EB', strokeWidth: 1, strokeDasharray: '4 2' }} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#2563EB"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#vendorTrendGrad)"
                dot={false}
                activeDot={{ r: 5, fill: '#2563EB', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};

export default VendorAnalytics;
