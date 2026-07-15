import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiSearch, FiBell, FiMessageSquare, FiChevronDown, 
  FiArrowUpRight, FiArrowDownRight, FiShoppingBag, 
  FiDollarSign, FiBox, FiStar, FiTrendingUp,
  FiCalendar, FiFilter, FiMoreHorizontal, FiZap, FiPackage, FiUser, FiUsers
} from 'react-icons/fi';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  PieChart, Pie, Cell, ResponsiveContainer, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ComposedChart
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { acceptBooking, rejectBooking } from '../../services/bookingService';

// Mock Data for Charts
// Real-time Analytics Engine Active

const VendorFullDashboard = ({ stats, recentJobs, vendorProfile, isOnline, handleToggleOnline, revenueAnalytics }) => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('This Week');
  
  const activeData = useMemo(() => {
    return revenueAnalytics?.[period] || [];
  }, [revenueAnalytics, period]);

  const handlePeriodChange = (e) => {
    setPeriod(e.target.value);
  };

  const orderStatusData = useMemo(() => [
    { name: 'Delivered', value: stats?.completedJobs || 0, color: '#10B981' },
    { name: 'Confirmed', value: stats?.confirmedJobs || 0, color: '#3B82F6' },
    { name: 'Processing', value: stats?.inProgressBookings || 0, color: '#F59E0B' },
    { name: 'Cancelled', value: stats?.cancelledJobs || 0, color: '#EF4444' },
  ], [stats]);

  const vendorDashboardStats = useMemo(() => [
    { label: 'Total Orders', value: stats?.totalBookings || 0, change: '+ 18.6%', isUp: true, icon: FiShoppingBag, color: 'text-purple-600', bg: 'bg-purple-100', sparkline: activeData.map(d => ({ v: d.orders })), onClick: () => navigate('/vendor/jobs') },
    { label: 'Total Earnings', value: `₹${Number(stats?.totalEarnings || 0).toLocaleString('en-IN')}`, change: '+ 22.5%', isUp: true, icon: FiDollarSign, color: 'text-green-600', bg: 'bg-green-100', sparkline: activeData.map(d => ({ v: d.earnings })), onClick: () => navigate('/vendor/earnings') },
    { label: 'Store Rating', value: Number(stats?.rating || 0) > 0 ? Number(stats.rating).toFixed(1) : '0.0', change: 'Live', isUp: true, icon: FiStar, color: 'text-yellow-600', bg: 'bg-yellow-100', sparkline: activeData.map(d => ({ v: d.orders * 0.5 })), onClick: () => navigate('/vendor/my-ratings') },
    { label: 'Online Status', value: isOnline ? 'Online' : 'Offline', change: 'Status', isUp: isOnline, icon: FiZap, color: isOnline ? 'text-emerald-600' : 'text-rose-600', bg: isOnline ? 'bg-emerald-100' : 'bg-rose-100', isToggle: true, onClick: handleToggleOnline },
  ], [stats, activeData, isOnline, navigate, handleToggleOnline]);

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome Header - Light Style */}
      <div className="bg-white p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between text-gray-900 border border-gray-100 gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#0D9488] to-teal-600 p-0.5 shadow-lg">
            <div className="w-full h-full rounded-[10px] bg-white flex items-center justify-center overflow-hidden">
              {vendorProfile?.photo ? (
                <img src={vendorProfile.photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <FiUser className="text-gray-300 w-6 h-6" />
              )}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight leading-none">
              Hello, {String(vendorProfile?.name || 'Vendor').split(' ')[0]}!
            </h2>
            <p className="text-gray-500 text-[10px] font-medium mt-1.5 flex items-center gap-2">
              <span className="text-[#0D9488] font-bold uppercase tracking-tight">{vendorProfile?.businessName || 'Business'}</span>
              <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg text-[9px] font-black border border-blue-100">LEVEL L{stats?.level || 3}</span>
              <span className="text-gray-300">•</span> 
              <span className={`flex items-center gap-1.5 ${isOnline ? 'text-emerald-600' : 'text-rose-600'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {isOnline ? 'System Online' : 'Currently Offline'}
              </span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
           <div className="text-right">
             <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.15em] mb-0.5">Availability</p>
             <p className={`text-[9px] font-black uppercase tracking-widest ${isOnline ? 'text-emerald-600' : 'text-rose-600'}`}>
                {isOnline ? 'Active' : 'Hidden'}
             </p>
           </div>
           <button 
              onClick={handleToggleOnline}
              className={`w-9 h-4.5 rounded-full relative transition-all duration-500 ${isOnline ? 'bg-emerald-100' : 'bg-gray-200'}`}
            >
              <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-md transition-all duration-500 ${isOnline ? 'right-0.5 bg-emerald-500 shadow-sm' : 'left-0.5 bg-gray-400'}`} />
            </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {vendorDashboardStats.map((stat, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={stat.onClick}
            className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${stat.isUp ? 'text-green-600' : 'text-rose-600'}`}>
                {stat.isUp ? <FiArrowUpRight /> : <FiArrowDownRight />}
                {stat.change}
              </div>
            </div>
            
            <div className="relative z-10">
              <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-2xl font-black text-gray-900 mt-0.5 tracking-tighter">{stat.value}</h3>
            </div>

            {!stat.isToggle && (
              <div className="absolute bottom-0 left-0 right-0 h-10 opacity-10 group-hover:opacity-20 transition-opacity">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stat.sparkline}>
                    <Area type="monotone" dataKey="v" stroke={stat.isUp ? '#10B981' : '#EF4444'} fill={stat.isUp ? '#10B981' : '#EF4444'} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-gray-800 tracking-tight">Revenue Overview</h3>
              <p className="text-sm text-gray-500 font-medium">Performance analytics for {period.toLowerCase()}</p>
            </div>
            <select 
              value={period}
              onChange={handlePeriodChange}
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-700 focus:outline-none cursor-pointer hover:bg-gray-100 transition-colors"
            >
              <option>This Week</option>
              <option>This Month</option>
              <option>Last Month</option>
            </select>
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={activeData}>
                <defs>
                  <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2874F0" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2874F0" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} tickFormatter={(v) => `₹${v/1000}k`} />
                <Tooltip contentStyle={{backgroundColor: '#fff', border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                <Area type="monotone" dataKey="earnings" stroke="#2874F0" strokeWidth={3} fillOpacity={1} fill="url(#colorEarnings)" />
                <Line type="monotone" dataKey="orders" stroke="#818CF8" strokeWidth={2} dot={{fill: '#818CF8', r: 4}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col">
          <h3 className="text-xl font-bold text-gray-800 tracking-tight mb-8">Order Status</h3>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="h-[240px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={orderStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {orderStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl font-black text-gray-800 tracking-tighter">{stats?.totalBookings || 0}</span>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Total Jobs</span>
              </div>
            </div>

            <div className="w-full space-y-4 mt-6">
              {orderStatusData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: item.color}} />
                    <span className="text-sm font-semibold text-gray-600">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity List */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold text-gray-800 tracking-tight">Recent Activity</h3>
          <button className="text-blue-600 text-sm font-bold hover:underline" onClick={() => navigate('/vendor/jobs')}>View All History</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(recentJobs && recentJobs.length > 0) ? recentJobs.slice(0, 6).map((order, idx) => (
            <div key={idx} className="bg-gray-50 border border-gray-100 rounded-2xl p-6 group cursor-pointer hover:bg-white hover:shadow-md transition-all border-l-4 border-l-blue-500" onClick={() => navigate(`/vendor/booking/${order.id}`)}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                  <FiPackage className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-800">₹{order.price}</p>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                    {order.status}
                  </span>
                </div>
              </div>
              <h4 className="text-sm font-bold text-gray-800 uppercase truncate">{order.serviceType}</h4>
              <p className="text-xs text-gray-500 font-medium mt-1">{order.customerName}</p>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200/50">
                <FiCalendar className="text-gray-400 w-3 h-3" />
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{order.timeSlot.date}</span>
              </div>
            </div>
          )) : (
            <div className="col-span-full text-center py-16 bg-gray-50 rounded-2xl border border-gray-100">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">No recent activity</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendorFullDashboard;
