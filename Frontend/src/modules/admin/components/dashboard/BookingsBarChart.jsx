import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { filterByDateRange, getDateRange, formatDate } from '../../utils/adminHelpers';

const BookingsTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl text-xs min-w-[100px]">
      <p className="text-gray-400 mb-1 font-medium">{label}</p>
      <p className="font-bold text-emerald-400">{payload[0].value} bookings</p>
    </div>
  );
};

const BookingsBarChart = ({ data, period = 'month' }) => {
  const filteredData = useMemo(() => {
    const range = getDateRange(period);
    const filtered = filterByDateRange(data, range.start, range.end);
    const daysToShow = period === 'week' ? 7 : 14;
    return filtered.slice(-daysToShow).map((item) => ({
      ...item,
      dateLabel: formatDate(item.date, { month: 'short', day: 'numeric' }),
    }));
  }, [data, period]);

  const totalBookings = filteredData.reduce((s, d) => s + (d.orders || 0), 0);
  const maxVal = Math.max(...filteredData.map((d) => d.orders || 0), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
    >
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-gray-800 tracking-tight">Booking Volume</h3>
          <p className="text-xs text-gray-400 mt-0.5">Daily booking count</p>
        </div>
        <div className="text-right">
          <p className="text-base font-black text-gray-800">{totalBookings}</p>
          <p className="text-[10px] text-gray-400">period total</p>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <ResponsiveContainer width="100%" height={220} minHeight={180}>
          <BarChart data={filteredData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#10B981" stopOpacity={1} />
                <stop offset="100%" stopColor="#14B8A6" stopOpacity={0.7} />
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
              allowDecimals={false}
              width={30}
              tick={{ fill: '#94A3B8' }}
            />
            <Tooltip content={<BookingsTooltip />} cursor={{ fill: '#F8FAFC' }} />
            <Bar dataKey="orders" name="Bookings" radius={[6, 6, 0, 0]} maxBarSize={36}>
              {filteredData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.orders === maxVal ? '#10B981' : 'url(#barGradient)'}
                  opacity={entry.orders === maxVal ? 1 : 0.75}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default BookingsBarChart;
