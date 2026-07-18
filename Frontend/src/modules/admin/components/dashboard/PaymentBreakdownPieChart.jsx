import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#10B981', '#F59E0B'];
const LABELS = ['Paid to Worker', 'Pending Payment'];

const PaymentCustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  const total = p.payload?.total || 1;
  const pct = ((p.value / total) * 100).toFixed(1);
  return (
    <div style={{ pointerEvents: 'none' }} className="bg-gray-900 text-white px-2.5 py-1.5 rounded-lg shadow-xl text-[11px] flex items-center gap-2 whitespace-nowrap">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.payload.fill }} />
      <span className="font-semibold">{p.name}</span>
      <span className="text-gray-400">·</span>
      <span style={{ color: p.payload.fill }}>{p.value} · {pct}%</span>
    </div>
  );
};

const PaymentBreakdownPieChart = ({ bookings = [] }) => {
  const { data, total } = useMemo(() => {
    let paid = 0;
    let pending = 0;
    bookings.forEach((b) => {
      const isWorkDoneStage = ['WORK_DONE', 'FINAL_SETTLEMENT', 'COMPLETED'].includes(
        (b.status || '').toUpperCase()
      );
      if (!isWorkDoneStage) return;
      if ((b.workerPaymentStatus || '').toUpperCase() === 'PAID') paid += 1;
      else pending += 1;
    });
    const t = paid + pending;
    return {
      total: t,
      data: [
        { name: 'Paid to Worker',        value: paid,    fill: COLORS[0], total: t },
        { name: 'Pending Worker Payment', value: pending, fill: COLORS[1], total: t },
      ],
    };
  }, [bookings]);

  const paidPct = total > 0 ? ((data[0].value / total) * 100).toFixed(0) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-gray-800 tracking-tight">Worker Payment</h3>
          <p className="text-xs text-gray-400 mt-0.5">Paid vs pending after work done</p>
        </div>
        <span className="text-xs font-semibold bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full">
          {paidPct}% paid
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
              <Tooltip content={<PaymentCustomTooltip />} offset={20} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-black text-gray-800">{total}</span>
            <span className="text-[10px] text-gray-400 font-medium">eligible</span>
          </div>
        </div>

        {/* Custom legend */}
        <div className="flex-1 flex flex-col gap-3 w-full">
          {data.map((entry) => {
            const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0;
            return (
              <div key={entry.name} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                    <span className="text-gray-600 font-medium">{entry.name}</span>
                  </div>
                  <span className="font-bold text-gray-800">{entry.value} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: entry.fill }}
                  />
                </div>
              </div>
            );
          })}
          {total === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No eligible bookings yet</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default PaymentBreakdownPieChart;
