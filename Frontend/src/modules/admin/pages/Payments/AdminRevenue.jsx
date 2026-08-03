import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FiSearch,
  FiDownload,
  FiDollarSign,
  FiPieChart,
  FiActivity
} from 'react-icons/fi';
import { adminTransactionService } from '../../../../services/adminTransactionService';
import toast from 'react-hot-toast';
import { exportToCSV } from '../../../../utils/csvExport';
import { formatCurrency } from '../../utils/adminHelpers';

const AdminRevenue = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalCommission: 0,
    pendingSettlements: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    type: 'all',
    period: 'all'
  });

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedRevenue, setSelectedRevenue] = useState(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 500);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    fetchData();
  }, [pagination.page, debouncedSearch, filters.status, filters.type, filters.period]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [response, statsRes] = await Promise.all([
        adminTransactionService.getAllTransactions({
          page: pagination.page,
          limit: pagination.limit,
          search: debouncedSearch,
          status: filters.status,
          type: filters.type,
          period: filters.period,
          entity: 'admin'
        }),
        adminTransactionService.getTransactionStats({ entity: 'admin', period: filters.period })
      ]);

      if (response && response.success) {
        setTransactions(response.data || []);
        if (response.pagination) {
          setPagination(prev => ({
            ...prev,
            total: response.pagination.total || 0,
            pages: response.pagination.pages || 0
          }));
        }
      }

      if (statsRes && statsRes.success) {
        setStats(statsRes.data || {});
      }
    } catch (error) {
      console.error('Error fetching admin revenue:', error);
      toast.error('Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'failed': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const handleExport = () => {
    if (!transactions || transactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }
    exportToCSV(transactions, 'admin_revenue', [
      { key: '_id', label: 'Transaction ID' },
      { key: 'bookingNumber', label: 'Booking Number' },
      { key: 'grandTotal', label: 'Grand Total', type: 'currency' },
      { key: 'gstAmount', label: 'GST Collected', type: 'currency' },
      { key: 'companyIncome', label: 'Net Revenue', type: 'currency' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Date', type: 'datetime' }
    ]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* 1. Total Customer Bill (GMV) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gray-50 rounded-xl">
              <FiDollarSign className="w-5 h-5 text-gray-700" />
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">Gross GMV</span>
          </div>
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Customer Billing</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">
            {loading ? (
              <div className="h-8 w-24 bg-gray-100 animate-pulse rounded"></div>
            ) : (
              formatCurrency(stats.totalRevenue || 0)
            )}
          </h3>
        </motion.div>

        {/* 2. Total GST Tax Collected */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 rounded-xl">
              <FiPieChart className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full border border-purple-100">Tax</span>
          </div>
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">GST Tax Collected</p>
          <h3 className="text-2xl font-bold text-purple-600 mt-1">
            {loading ? (
              <div className="h-8 w-24 bg-purple-50 animate-pulse rounded"></div>
            ) : (
              formatCurrency(stats.totalGST || 0)
            )}
          </h3>
        </motion.div>

        {/* 3. Net Platform Income */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <FiActivity className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">Net Profit</span>
          </div>
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Net Platform Revenue</p>
          <h3 className="text-2xl font-bold text-emerald-600 mt-1">
            {loading ? (
              <div className="h-8 w-24 bg-emerald-50 animate-pulse rounded"></div>
            ) : (
              formatCurrency(stats.netRevenue || stats.totalCommission || 0)
            )}
          </h3>
        </motion.div>

        {/* 4. Total Vendor Payouts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-50 rounded-xl">
              <FiDollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-100">Vendor Share</span>
          </div>
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Vendor Payouts</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">
            {loading ? (
              <div className="h-8 w-24 bg-amber-50 animate-pulse rounded"></div>
            ) : (
              formatCurrency(stats.totalVendorEarnings || 0)
            )}
          </h3>
        </motion.div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by booking number..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={filters.period || 'all'}
            onChange={(e) => setFilters(prev => ({ ...prev, period: e.target.value }))}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium text-gray-700 cursor-pointer min-w-[140px]"
          >
            <option value="all">📅 All Time</option>
            <option value="today">☀️ Today</option>
            <option value="this_week">📆 This Week</option>
            <option value="this_month">🗓️ This Month</option>
            <option value="this_year">📊 This Year</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium text-gray-600 min-w-[130px]"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
          </select>

          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <FiDownload className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Grouped Bookings Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading revenue details...</div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FiDollarSign className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No revenue records found</h3>
            <p className="text-gray-500 mt-1">Transactions will appear here once bookings are completed.</p>
          </div>
        ) : (
          <div className="w-full">
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100">
                  <th className="px-3 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Booking Ref</th>
                  <th className="px-3 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Customer / Vendor</th>
                  <th className="px-3 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Customer Bill</th>
                  <th className="px-3 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">GST Tax</th>
                  <th className="px-3 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Net Revenue</th>
                  <th className="px-3 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-3 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <tr
                    key={tx._id}
                    onClick={() => setSelectedRevenue(tx)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  >
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs sm:text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {tx.bookingNumber || tx.referenceId}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium truncate max-w-[140px]">
                          Ref: {tx.referenceId}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-800 truncate max-w-[120px]">{tx.userId?.name || 'Customer'}</span>
                        <span className="text-[10px] text-gray-500 font-medium truncate max-w-[120px]">Vendor: {tx.vendorId?.name || 'Assigned Vendor'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <span className="text-xs sm:text-sm font-black text-gray-900">
                        {formatCurrency(tx.grandTotal || 0)}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-black text-purple-600">
                          {formatCurrency(tx.gstAmount || 0)}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-bold border border-purple-100 shrink-0">
                          GST Tax
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-black text-emerald-600">
                          +{formatCurrency(tx.companyIncome || 0)}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 shrink-0">
                          Net Income
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusColor(tx.status)}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-xs text-gray-500 font-medium whitespace-nowrap">
                      <div>{new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      <div className="text-[10px] text-gray-400">{new Date(tx.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="px-3 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedRevenue(tx); }}
                        className="px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all border border-blue-100 cursor-pointer"
                      >
                        View Table
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && transactions.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
            <p className="text-xs text-gray-500 font-medium">
              Showing {transactions.length} of {pagination.total} booking entries
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xs"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Breakdown Audit Modal */}
      {selectedRevenue && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Financial Audit Ledger</p>
                <h3 className="text-lg font-bold">Booking #{selectedRevenue.bookingNumber}</h3>
              </div>
              <button
                onClick={() => setSelectedRevenue(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Customer Bill</p>
                  <p className="text-base font-black text-gray-900">{formatCurrency(selectedRevenue.grandTotal || 0)}</p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase">Vendor Earning</p>
                  <p className="text-base font-black text-emerald-800">{formatCurrency(selectedRevenue.vendorEarning || 0)}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-600 uppercase">Net Income</p>
                  <p className="text-base font-black text-blue-800">{formatCurrency(selectedRevenue.companyIncome || 0)}</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                  <p className="text-[10px] font-bold text-purple-600 uppercase">GST Tax Collected</p>
                  <p className="text-base font-black text-purple-800">{formatCurrency(selectedRevenue.gstAmount || 0)}</p>
                </div>
              </div>

              {/* Revenue Breakdown Table */}
              <div>
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Itemized Financial Table</h4>
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase text-[10px]">
                        <th className="p-3">Component</th>
                        <th className="p-3">Type</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3 text-right">Destination</th>
                      </tr>
                    </thead>
                    {(() => {
                      const vEarning = selectedRevenue.vendorEarning || 0;
                      const comm = selectedRevenue.commission || 0;
                      const totalBase = vEarning + comm;

                      let commPctStr = '';
                      let vendorPctStr = '';

                      if (totalBase > 0) {
                        const rawCommPct = ((comm / totalBase) * 100).toFixed(1);
                        const rawVendorPct = ((vEarning / totalBase) * 100).toFixed(1);
                        const commPct = rawCommPct.endsWith('.0') ? rawCommPct.slice(0, -2) : rawCommPct;
                        const vendorPct = rawVendorPct.endsWith('.0') ? rawVendorPct.slice(0, -2) : rawVendorPct;
                        commPctStr = ` (${commPct}%)`;
                        vendorPctStr = ` (${vendorPct}% Base)`;
                      }

                      const gstAmt = selectedRevenue.gstAmount || 0;
                      let gstPctStr = ' (18%)';
                      if (totalBase > 0 && gstAmt > 0) {
                        const rawGstPct = ((gstAmt / totalBase) * 100).toFixed(1);
                        const gstPct = rawGstPct.endsWith('.0') ? rawGstPct.slice(0, -2) : rawGstPct;
                        gstPctStr = ` (${gstPct}%)`;
                      }

                      return (
                        <tbody className="divide-y divide-gray-100">
                          <tr>
                            <td className="p-3 font-semibold text-gray-800">Platform Commission{commPctStr}</td>
                            <td className="p-3"><span className="px-2 py-0.5 rounded bg-green-50 text-green-700 font-bold text-[10px]">Commission</span></td>
                            <td className="p-3 text-right font-bold text-emerald-600">+{formatCurrency(comm)}</td>
                            <td className="p-3 text-right font-medium text-gray-500">Admin Account</td>
                          </tr>
                          <tr>
                            <td className="p-3 font-semibold text-gray-800">Convenience / Visiting Fee</td>
                            <td className="p-3"><span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">Platform Fee</span></td>
                            <td className="p-3 text-right font-bold text-blue-600">+{formatCurrency(selectedRevenue.convenienceFee || 0)}</td>
                            <td className="p-3 text-right font-medium text-gray-500">Admin Account</td>
                          </tr>
                          <tr>
                            <td className="p-3 font-semibold text-gray-800">Government GST{gstPctStr}</td>
                            <td className="p-3"><span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold text-[10px]">Tax</span></td>
                            <td className="p-3 text-right font-bold text-purple-600">+{formatCurrency(gstAmt)}</td>
                            <td className="p-3 text-right font-medium text-gray-500">Govt Treasury</td>
                          </tr>
                          <tr>
                            <td className="p-3 font-semibold text-gray-800">Vendor Net Payout{vendorPctStr}</td>
                            <td className="p-3"><span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-[10px]">Payout</span></td>
                            <td className="p-3 text-right font-bold text-gray-900">{formatCurrency(vEarning)}</td>
                            <td className="p-3 text-right font-medium text-gray-500">Vendor Wallet</td>
                          </tr>
                          <tr className="bg-gray-50 font-bold border-t border-gray-200">
                            <td className="p-3 text-gray-900" colSpan={2}>Grand Total Customer Paid</td>
                            <td className="p-3 text-right text-gray-900 text-sm">{formatCurrency(selectedRevenue.grandTotal || 0)}</td>
                            <td className="p-3 text-right text-gray-500">Invoice Total</td>
                          </tr>
                        </tbody>
                      );
                    })()}
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedRevenue(null)}
                className="px-5 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default AdminRevenue;
