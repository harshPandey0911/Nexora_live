import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { filterByDateRange, getDateRange, formatDate, formatCurrency } from '../../utils/adminHelpers';

const RevenueTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl text-xs min-w-[120px]">
      <p className="text-gray-400 mb-1 font-medium">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="font-bold" style={{ color: '#93C5FD' }}>
          {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
};

const RevenueLineChart = ({ data, period = 'month' }) => {
  const filteredData = useMemo(() => {
    const range = getDateRange(period);
    const filtered = filterByDateRange(data, range.start, range.end);
    return filtered.map((item) => ({
      ...item,
      dateLabel: formatDate(item.date, { month: 'short', day: 'numeric' }),
    }));
  }, [data, period]);

  const totalRevenue = filteredData.reduce((s, d) => s + (d.revenue || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
    >
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-gray-800 tracking-tight">Revenue Trend</h3>
          <p className="text-xs text-gray-400 mt-0.5">Track revenue over time</p>
        </div>
        <div className="text-right">
          <p className="text-base font-black text-gray-800">{formatCurrency(totalRevenue)}</p>
          <p className="text-[10px] text-gray-400">period total</p>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <ResponsiveContainer width="100%" height={220} minHeight={180}>
          <AreaChart data={filteredData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#3B82F6" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis
              dataKey="dateLabel"
              stroke="#CBD5E1"
              fontSize={9}
              tickLine={false}
              axisLine={false}
              angle={-30}
              textAnchor="end"
              height={50}
              tick={{ fill: '#94A3B8' }}
            />
            <YAxis
              stroke="#CBD5E1"
              fontSize={9}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
              width={42}
              tick={{ fill: '#94A3B8' }}
            />
            <Tooltip content={<RevenueTooltip />} cursor={{ stroke: '#3B82F6', strokeWidth: 1, strokeDasharray: '4 2' }} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#3B82F6"
              strokeWidth={2.5}
              fill="url(#revGradient)"
              name="Revenue"
              dot={false}
              activeDot={{ r: 4, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default RevenueLineChart;
