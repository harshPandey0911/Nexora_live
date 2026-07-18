import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = {
  ACCEPTED:         { fill: '#6366F1', bg: 'bg-indigo-500' },
  ASSIGNED:         { fill: '#F59E0B', bg: 'bg-amber-500' },
  VISITED:          { fill: '#06B6D4', bg: 'bg-cyan-500' },
  JOURNEY_STARTED:  { fill: '#8B5CF6', bg: 'bg-violet-500' },
  WORK_DONE:        { fill: '#10B981', bg: 'bg-emerald-500' },
  FINAL_SETTLEMENT: { fill: '#3B82F6', bg: 'bg-blue-500' },
  COMPLETED:        { fill: '#22C55E', bg: 'bg-green-500' },
  CANCELLED:        { fill: '#EF4444', bg: 'bg-red-500' },
  REJECTED:         { fill: '#F43F5E', bg: 'bg-rose-500' },
  OTHER:            { fill: '#94A3B8', bg: 'bg-slate-400' },
};

const normalizeStatus = (s) => {
  const v = (s || 'OTHER').toString().toUpperCase();
  if (v === 'CANCELED' || v === 'CANCELLED' || v === 'CANCEL') return 'CANCELLED';
  return v;
};

const StatusTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  const total = p.payload?.total || 1;
  const pct = ((p.value / total) * 100).toFixed(1);
  return (
    <div style={{ pointerEvents: 'none' }} className="bg-gray-900 text-white px-2.5 py-1.5 rounded-lg shadow-xl text-[11px] flex items-center gap-2 whitespace-nowrap">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: p.payload.fill }}
      />
      <span className="font-semibold">{p.name}</span>
      <span className="text-gray-400">·</span>
      <span style={{ color: p.payload.fill }}>{p.value} · {pct}%</span>
    </div>
  );
};

const BookingStatusPieChart = ({ bookings = [] }) => {
  const { data, total } = useMemo(() => {
    const map = new Map();
    bookings.forEach((b) => {
      const key = normalizeStatus(b.status);
      map.set(key, (map.get(key) || 0) + 1);
    });
    // Use sum of mapped values — NOT bookings.length — so percentages are always accurate
    let sum = 0;
    map.forEach((v) => { sum += v; });
    const total = sum || 1;
    const entries = Array.from(map.entries()).map(([name, value]) => ({
      name,
      value,
      total,
      fill: (COLORS[name] || COLORS.OTHER).fill,
    }));
    return { data: entries, total: sum };
  }, [bookings]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-gray-800 tracking-tight">Booking Status</h3>
          <p className="text-xs text-gray-400 mt-0.5">Distribution across all statuses</p>
        </div>
        <span className="text-xs font-semibold bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full">
          {total} total
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Donut chart */}
        <div className="relative w-[180px] h-[180px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={82}
                paddingAngle={3}
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<StatusTooltip />} offset={20} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-black text-gray-800">{total}</span>
            <span className="text-[10px] text-gray-400 font-medium">bookings</span>
          </div>
        </div>

        {/* Custom legend */}
        <div className="flex-1 grid grid-cols-1 gap-2 w-full">
          {data.map((entry) => {
            const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0;
            return (
              <div key={entry.name} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: entry.fill }}
                />
                <span className="text-xs text-gray-600 flex-1 truncate capitalize">
                  {entry.name.replace(/_/g, ' ').toLowerCase()}
                </span>
                <span className="text-xs font-bold text-gray-800">{entry.value}</span>
                <span className="text-[10px] text-gray-400 w-10 text-right">{pct}%</span>
              </div>
            );
          })}
          {data.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No data available</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default BookingStatusPieChart;
