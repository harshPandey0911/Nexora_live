import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiDollarSign, FiTrendingUp, FiCalendar, FiGift, FiAlertCircle, FiPieChart, FiArrowUpRight, FiArrowDownRight } from 'react-icons/fi';
import { FaWallet } from 'react-icons/fa';
import { getEarningsOverview } from '../../services/earningsService';
import LogoLoader from '../../../../components/common/LogoLoader';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Earnings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('monthly'); // for chart: daily, weekly, monthly
  const [filter, setFilter] = useState('all'); // for history and breakdown: all, today, week, month
  
  const [earningsData, setEarningsData] = useState(() => {
    const cached = localStorage.getItem('vendorEarningsData');
    return cached ? JSON.parse(cached) : {
      totals: { total: 0, today: 0, week: 0, month: 0 },
      breakdown: { totalEarnings: 0, totalDeductions: 0, totalBonuses: 0 },
      chartData: [],
      history: []
    };
  });

  const fetchEarnings = async () => {
    try {
      if (!earningsData.history || earningsData.history.length === 0) setLoading(true);
      setError('');
      const res = await getEarningsOverview({ period, filter });
      if (res.success) {
        setEarningsData(res.data);
        localStorage.setItem('vendorEarningsData', JSON.stringify(res.data));
      } else {
        setError(res.message || 'Failed to load earnings data');
      }
    } catch (err) {
      console.error('Fetch earnings error:', err);
      setError('An error occurred while fetching earnings data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, [period, filter]);

  // Format date for chart X-axis
  const formatXAxis = (tickItem) => {
    if (!tickItem) return '';
    const parts = tickItem.split('-');
    if (period === 'daily' && parts.length === 3) {
      return `${parts[2]}/${parts[1]}`; // DD/MM
    }
    if (period === 'weekly') {
      return `W${parts[1]}`;
    }
    if (period === 'monthly' && parts.length >= 2) {
      const date = new Date(parts[0], parseInt(parts[1]) - 1, 1);
      return date.toLocaleString('default', { month: 'short' });
    }
    return tickItem;
  };

  if (loading && !earningsData.chartData.length) {
    return <LogoLoader />;
  }

  const { totals, breakdown, chartData, history } = earningsData;

  return (
    <div className="space-y-3 sm:space-y-4 pb-16">
      {/* Header - Compact & Modern */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs flex flex-row items-center justify-between text-gray-900 border border-gray-100 gap-3">
        <div>
          <h2 className="text-base sm:text-xl font-bold text-gray-900 tracking-tight leading-tight capitalize">
            Revenue Analytics
          </h2>
          <p className="text-gray-500 text-[10px] sm:text-xs font-medium mt-0.5">
            Monitor financial performance, order payouts and gross earnings
          </p>
        </div>
        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
          <FiTrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
          <FiAlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Totals Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600 border border-blue-100">
              <FiCalendar className="w-3.5 h-3.5" />
            </div>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Today</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">₹{(totals.today || 0).toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100">
              <FiTrendingUp className="w-3.5 h-3.5" />
            </div>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">This Week</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">₹{(totals.week || 0).toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600 border border-purple-100">
              <FiPieChart className="w-3.5 h-3.5" />
            </div>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">This Month</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">₹{(totals.month || 0).toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-gradient-to-br from-[#00246b] via-[#001c54] to-[#0d1b3e] text-white rounded-xl p-3.5 shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-white/10 rounded-lg border border-white/20 backdrop-blur-xs">
              <FaWallet className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[9px] font-bold text-blue-200 uppercase tracking-widest">All Time</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-white tracking-tight">₹{(totals.total || 0).toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Revenue Area Chart Section */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-100 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Revenue Growth Trend</h3>
            <p className="text-[9px] font-medium text-gray-400">Historical performance graph</p>
          </div>
          <div className="flex bg-gray-50 rounded-lg p-0.5 border border-gray-100 shrink-0">
            {['daily', 'weekly', 'monthly'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                  period === p ? 'bg-blue-600 text-white shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        
        <div className="h-56 sm:h-64 w-full pt-2">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00246b" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#00246b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="date" tickFormatter={formatXAxis} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} dy={5} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', backgroundColor: '#00246b', border: 'none', color: '#FFFFFF', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  itemStyle={{ color: '#38BDF8', fontWeight: '800', fontSize: '12px' }}
                  labelStyle={{ color: '#93C5FD', fontSize: '10px', fontWeight: '700', marginBottom: '2px', textTransform: 'uppercase' }}
                  formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="amount" stroke="#00246b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAmount)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
             <div className="h-full flex items-center justify-center text-gray-400 text-xs font-bold uppercase tracking-widest">
               No revenue data available
             </div>
          )}
        </div>
      </div>



      {/* Recent Activity List */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-0.5">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Recent Activity</h3>
          <button 
            onClick={() => navigate('/vendor/wallet')} 
            className="text-[10px] font-bold text-blue-600 hover:underline uppercase tracking-wider cursor-pointer"
          >
            Audit Wallet →
          </button>
        </div>
        
        <div className="space-y-2">
          {history.length === 0 ? (
            <div className="bg-white rounded-xl p-8 border border-dashed border-gray-200 text-center shadow-2xs">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No Activity Recorded</p>
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="bg-white rounded-xl p-3 border border-gray-100 hover:border-gray-200 shadow-2xs flex items-center justify-between transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-gray-100 ${item.isDeduction ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                    {item.isDeduction ? <FiArrowDownRight className="w-4 h-4" /> : <FiArrowUpRight className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 capitalize truncate">{item.description || item.type?.replace('_', ' ')}</p>
                    <p className="text-[10px] text-gray-400 font-medium">
                      {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className={`text-xs font-bold ${item.isDeduction ? 'text-rose-600' : 'text-blue-600'}`}>
                    {item.isDeduction ? '-' : '+'}₹{item.amount?.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Earnings;
