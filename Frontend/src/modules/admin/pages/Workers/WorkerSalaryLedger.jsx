import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiDollarSign,
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiCheckCircle,
  FiPlusCircle,
  FiMinusCircle,
  FiUser,
  FiBriefcase,
  FiCalendar,
  FiClock,
  FiX,
  FiEdit2,
  FiFileText,
  FiInfo,
  FiChevronRight
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import workerService from '../../services/workerService';
import Pagination from '../../../../components/common/Pagination';

const WorkerSalaryLedger = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('vendors'); // 'vendors' | 'audit'
  const [vendorSummaries, setVendorSummaries] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [stats, setStats] = useState({
    totalSalaryPaid: 0,
    totalPendingOwed: 0,
    totalSettlementsCount: 0
  });

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Vendor Operatives Breakdown Drawer State
  const [selectedVendorForBreakdown, setSelectedVendorForBreakdown] = useState(null);

  // Manual Adjustment Modal State
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('credit');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Vendor Breakdown Modal State
  const [vendorModalOpen, setVendorModalOpen] = useState(false);

  useEffect(() => {
    fetchLedgers();
  }, [currentPage, pageSize, paymentMethod, statusFilter]);

  const fetchLedgers = async () => {
    try {
      setLoading(true);
      const response = await workerService.getSalaryLedgers({
        search,
        paymentMethod,
        statusFilter,
        page: currentPage,
        limit: pageSize
      });

      if (response.success) {
        setLedgers(response.data || []);
        setVendorSummaries(response.vendorSummaries || []);
        if (response.stats) {
          setStats(response.stats);
        }
        if (response.pagination) {
          setTotalPages(response.pagination.pages || 1);
          setTotalItems(response.pagination.total || 0);
        }
      }
    } catch (error) {
      console.error('Error fetching salary ledgers:', error);
      toast.error('Failed to load salary ledgers');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchLedgers();
  };

  const handleOpenAdjustModal = (worker) => {
    setSelectedWorker(worker);
    setAdjustmentAmount('');
    setAdjustmentType('credit');
    setAdjustmentReason('');
    setAdjustModalOpen(true);
  };

  const handleConfirmAdjustment = async (e) => {
    e.preventDefault();
    if (!selectedWorker?._id) return;

    const maxDebit = selectedWorker.walletBalance || selectedWorker.wallet?.balance || selectedWorker.salaryOwed || 0;
    const numAmount = Number(adjustmentAmount);

    if (adjustmentType === 'debit' && numAmount > maxDebit) {
      toast.error(`Debit amount cannot exceed current balance of ₹${Number(maxDebit).toLocaleString('en-IN')}`);
      return;
    }

    try {
      setAdjustSubmitting(true);
      const res = await workerService.adjustWorkerSalary(selectedWorker._id, {
        amount: numAmount,
        adjustmentType,
        reason: adjustmentReason
      });

      if (res.success) {
        toast.success(res.message || 'Worker salary adjusted successfully');
        setAdjustModalOpen(false);
        fetchLedgers();
      }
    } catch (error) {
      console.error('Error adjusting worker salary:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to adjust salary');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-100 mb-1">Total Platform Salary Paid</p>
              <h3 className="text-3xl font-black tracking-tight">₹{Number(stats.totalSalaryPaid || 0).toLocaleString('en-IN')}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
              <FiCheckCircle className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-emerald-100/90 font-medium">Released & reset by vendors across platform</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-100 mb-1">Total Pending Salary Owed</p>
              <h3 className="text-3xl font-black tracking-tight">₹{Number(stats.totalPendingOwed || 0).toLocaleString('en-IN')}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
              <FiDollarSign className="w-6 h-6" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-amber-100/90 font-medium">Active un-reset balance owed to operatives</p>
            {stats.vendorSalaryBreakdown?.length > 0 && (
              <button
                type="button"
                onClick={() => setVendorModalOpen(true)}
                className="text-[11px] font-extrabold bg-white/25 hover:bg-white/35 text-white px-2.5 py-1 rounded-xl transition-all shadow-sm flex items-center gap-1 shrink-0"
              >
                View Vendor Breakdown →
              </button>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-100 mb-1">Total Settlement Logs</p>
              <h3 className="text-3xl font-black tracking-tight">{stats.totalSettlementsCount || 0}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
              <FiFileText className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-blue-100/90 font-medium">Recorded settlement payout transactions</p>
        </div>
      </div>

      {/* Navigation Sub-Tabs & Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab('vendors');
                setCurrentPage(1);
              }}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
                activeTab === 'vendors'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FiBriefcase className="w-4 h-4" />
              Vendor Monthly Salary Status Overview ({vendorSummaries.length})
            </button>

            <button
              onClick={() => {
                setActiveTab('audit');
                setCurrentPage(1);
              }}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
                activeTab === 'audit'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FiFileText className="w-4 h-4" />
              Past Settlement Logs ({totalItems})
            </button>
          </div>

          <button
            onClick={() => fetchLedgers()}
            className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-all self-end md:self-auto"
            title="Refresh Data"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Select Filters */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={
                  activeTab === 'vendors'
                    ? "Search vendor name (e.g. riya, rimzim), business, or phone..."
                    : "Search by worker name, vendor, or transaction ref..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 font-medium text-gray-800"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-md shadow-amber-500/20 transition-all"
            >
              Search
            </button>
          </form>

          {activeTab === 'vendors' ? (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <FiFilter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none"
              >
                <option value="all">All Vendor Statuses</option>
                <option value="due">🟠 Salary Payout Due Only</option>
                <option value="settled">🟢 Fully Settled Only</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <FiFilter className="w-4 h-4 text-gray-400" />
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none"
              >
                <option value="all">All Payment Modes</option>
                <option value="cash">Cash Handover</option>
                <option value="upi">UPI Transfer</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Body */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400 space-y-3">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-gray-600">Loading vendor salary data...</p>
          </div>
        ) : activeTab === 'vendors' ? (
          /* TAB 1: Vendor Monthly Salary Status Overview */
          vendorSummaries.length === 0 ? (
            <div className="py-20 text-center text-gray-400 space-y-3">
              <FiBriefcase className="w-12 h-12 mx-auto text-gray-300" />
              <p className="font-bold text-gray-700 text-base">No Matching Vendors Found</p>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">No matching vendors found for query "{search}".</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 uppercase text-[11px] font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Vendor Details</th>
                    <th className="px-6 py-4 text-center">Operatives Managed</th>
                    <th className="px-6 py-4 text-right">Pending Salary Owed</th>
                    <th className="px-6 py-4 text-right">Lifetime Salary Paid</th>
                    <th className="px-6 py-4 text-center">Payout Status</th>
                    <th className="px-6 py-4 text-center">Operatives Breakdown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs font-medium text-gray-800">
                  {vendorSummaries.map((vendor) => (
                    <tr key={vendor.vendorId} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-800 font-black flex items-center justify-center text-sm shrink-0 border border-amber-200">
                            {vendor.vendorName?.charAt(0)?.toUpperCase() || 'V'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{vendor.vendorName}</p>
                            <p className="text-[11px] text-gray-500 font-mono">
                              {vendor.businessName ? `${vendor.businessName} • ` : ''}{vendor.phone}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center font-bold text-gray-700">
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-xl text-slate-800 text-xs">
                          <FiUser className="w-3 h-3 text-gray-500" />
                          {vendor.workerCount} Operative(s)
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className={`text-base font-black ${vendor.pendingSalaryOwed > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                          ₹{Number(vendor.pendingSalaryOwed || 0).toLocaleString('en-IN')}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right font-bold text-emerald-600">
                        ₹{Number(vendor.totalSalaryPaid || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="px-6 py-4 text-center">
                        {vendor.pendingSalaryOwed > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-[11px] font-black uppercase tracking-wider border border-amber-200">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            Payout Due
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-900 rounded-full text-[11px] font-black uppercase tracking-wider border border-emerald-200">
                            <FiCheckCircle className="w-3 h-3 text-emerald-600" />
                            All Settled
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedVendorForBreakdown(vendor)}
                          className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 mx-auto"
                        >
                          View Workers ({vendor.workerCount})
                          <FiChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* TAB 2: Payout Settlement Audit Logs */
          ledgers.length === 0 ? (
            <div className="py-16 text-center text-gray-400 space-y-3 px-4">
              <FiFileText className="w-12 h-12 mx-auto text-gray-300" />
              <p className="font-bold text-gray-700 text-base">No Settlement Logs Found {search ? `for "${search}"` : ''}</p>
              
              {search && (
                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl max-w-md mx-auto text-xs text-amber-900 text-left space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <FiInfo className="w-4 h-4 shrink-0 text-amber-600" />
                    Notice on Settlement Logs
                  </div>
                  <p className="text-amber-800">
                    Vendor <strong>{search}</strong> has not recorded any salary settlement logs yet. To view pending monthly salary owed to {search}'s workers, check the <strong>Vendor Monthly Salary Status Overview</strong> tab.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 uppercase text-[11px] font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Ref / Txn ID</th>
                    <th className="px-6 py-4">Worker Details</th>
                    <th className="px-6 py-4">Vendor Boss</th>
                    <th className="px-6 py-4">Payment Mode</th>
                    <th className="px-6 py-4 text-right">Settled Amount</th>
                    <th className="px-6 py-4 text-right">Timestamp</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs font-medium text-gray-800">
                  {ledgers.map((txn) => {
                    const formattedDate = new Date(txn.createdAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    });

                    return (
                      <tr key={txn._id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-gray-900">
                          {txn.referenceId || txn._id?.slice(-8).toUpperCase()}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 text-blue-600 font-bold flex items-center justify-center text-xs shrink-0">
                              {txn.workerId?.name?.charAt(0) || 'W'}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{txn.workerId?.name || 'Worker'}</p>
                              <p className="text-[11px] text-gray-400">{txn.workerId?.phone}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          {txn.vendorId ? (
                            <div>
                              <p className="font-bold text-gray-900">{txn.vendorId.name}</p>
                              <p className="text-[11px] text-gray-400">{txn.vendorId.businessName || txn.vendorId.phone}</p>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">Direct Platform</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-800 border border-slate-200">
                            {txn.paymentMethod === 'upi' ? '📱 UPI' : txn.paymentMethod === 'bank_transfer' ? '🏛️ Bank' : '💵 Cash'}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-black text-emerald-600 block">
                            ₹{Number(txn.amount || 0).toLocaleString('en-IN')}
                          </span>
                          <span className="inline-block text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase">
                            ✓ Reset to ₹0
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right text-gray-500 font-mono text-[11px]">
                          {formattedDate}
                        </td>

                        <td className="px-6 py-4 text-center">
                          {txn.workerId && (
                            <button
                              type="button"
                              onClick={() => handleOpenAdjustModal(txn.workerId)}
                              className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 mx-auto"
                            >
                              <FiEdit2 className="w-3 h-3" />
                              Adjust Salary
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Global Standard Pagination Component */}
        {!loading && activeTab === 'audit' && ledgers.length > 0 && (
          <div className="p-4 border-t border-gray-100">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={(p) => setCurrentPage(p)}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              className="my-0"
            />
          </div>
        )}
      </div>

      {/* Vendor Operatives Breakdown Drawer / Modal */}
      {selectedVendorForBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-gray-100 text-gray-900 flex flex-col max-h-[85vh]"
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 font-bold">
                  {selectedVendorForBreakdown.vendorName?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedVendorForBreakdown.vendorName}'s Operatives</h3>
                  <p className="text-xs text-gray-500">Managed Workers Salary Owed Breakdown</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedVendorForBreakdown(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {selectedVendorForBreakdown.workerBreakdown && selectedVendorForBreakdown.workerBreakdown.length > 0 ? (
                selectedVendorForBreakdown.workerBreakdown.map((w) => (
                  <div
                    key={w._id}
                    className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 hover:bg-white hover:border-amber-300 transition-all"
                  >
                    <div className="space-y-0.5">
                      <p className="font-bold text-gray-900 text-sm">{w.name}</p>
                      <p className="text-xs text-gray-500 font-mono">{w.phone} • {w.completedJobs || 0} Completed Job(s)</p>
                    </div>

                    <div className="text-right shrink-0 space-y-1">
                      <span className={`text-base font-black ${w.salaryOwed > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                        ₹{Number(w.salaryOwed || 0).toLocaleString('en-IN')}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVendorForBreakdown(null);
                          handleOpenAdjustModal(w);
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 block ml-auto"
                      >
                        Adjust Salary
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500 text-center py-6">No workers currently assigned to this vendor.</p>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 shrink-0 text-right">
              <button
                type="button"
                onClick={() => setSelectedVendorForBreakdown(null)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all"
              >
                Close Breakdown
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Manual Admin Salary Adjustment Modal (Clean Essential Fields) */}
      {adjustModalOpen && selectedWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100 text-gray-900"
          >
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <FiDollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Admin Salary Adjustment</h3>
                  <p className="text-xs text-gray-500">{selectedWorker.name} ({selectedWorker.phone})</p>
                </div>
              </div>
              <button
                onClick={() => setAdjustModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAdjustment} className="space-y-4">
              {(() => {
                const currentSalaryOwed = selectedWorker.salaryOwed !== undefined && selectedWorker.salaryOwed !== null
                  ? selectedWorker.salaryOwed
                  : (selectedWorker.wallet?.balance || selectedWorker.walletBalance || 0);

                return (
                  <>
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
                      <p className="text-gray-500 font-medium">Worker Pending Salary Owed:</p>
                      <p className="text-xl font-black text-amber-600 mt-0.5">₹{Number(currentSalaryOwed).toLocaleString('en-IN')}</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Adjustment Action</label>
                      <select
                        value={adjustmentType}
                        onChange={(e) => setAdjustmentType(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="credit">➕ Credit Worker Wallet (Add Money)</option>
                        <option value="debit">➖ Debit Worker Wallet (Deduct Money)</option>
                        <option value="reset">🔄 Force Reset Salary Balance to ₹0</option>
                      </select>
                    </div>

                    {adjustmentType !== 'reset' && (() => {
                      const maxDebitable = currentSalaryOwed;
                      const isOverMax = adjustmentType === 'debit' && Number(adjustmentAmount) > maxDebitable;

                      return (
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-semibold text-gray-700">Adjustment Amount (₹)</label>
                            {adjustmentType === 'debit' && (
                              <span className={`text-[10px] font-bold ${isOverMax ? 'text-rose-600 font-extrabold' : 'text-amber-600'}`}>
                                Max Debit: ₹{Number(maxDebitable).toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            required
                            min="1"
                            max={adjustmentType === 'debit' ? maxDebitable : undefined}
                            value={adjustmentAmount}
                            onChange={(e) => setAdjustmentAmount(e.target.value)}
                            onBlur={() => {
                              if (adjustmentType === 'debit' && Number(adjustmentAmount) > maxDebitable) {
                                setAdjustmentAmount(maxDebitable.toString());
                                toast.error(`Amount capped to max debitable balance ₹${Number(maxDebitable).toLocaleString('en-IN')}`);
                              }
                            }}
                            placeholder="Enter amount..."
                            className={`w-full px-4 py-3 rounded-xl border font-bold text-lg focus:outline-none transition-all text-gray-900 ${
                              isOverMax
                                ? 'border-rose-500 bg-rose-50/30 focus:ring-2 focus:ring-rose-500'
                                : 'border-gray-200 focus:ring-2 focus:ring-blue-500'
                            }`}
                          />
                          {isOverMax && (
                            <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                              ⚠️ Amount exceeds max debitable balance ₹{Number(maxDebitable).toLocaleString('en-IN')}. (Will auto-cap on submit)
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </>
                );
              })()}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Audit Reason (Required)</label>
                <textarea
                  required
                  rows={2}
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="State administrative reason for audit logs..."
                  className="w-full p-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {adjustSubmitting ? 'Processing...' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Vendor Pending Salary Breakdown Modal */}
      {vendorModalOpen && stats.vendorSalaryBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-gray-100 text-gray-900 flex flex-col max-h-[85vh]"
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                  <FiBriefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Per-Vendor Pending Salary Breakdown</h3>
                  <p className="text-xs text-gray-500">Which vendors owe pending salary to their workers</p>
                </div>
              </div>
              <button
                onClick={() => setVendorModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {stats.vendorSalaryBreakdown.map((item) => (
                <div
                  key={item.vendorId}
                  className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 hover:bg-white hover:border-amber-300 hover:shadow-md transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900 text-sm">{item.vendorName}</p>
                      {item.businessName && (
                        <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-bold">
                          {item.businessName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{item.phone} • {item.workerCount} Operative(s) Managed</p>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <span className="text-lg font-black text-amber-600 block">
                      ₹{Number(item.pendingSalaryOwed || item.totalOwed || 0).toLocaleString('en-IN')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSearch(item.vendorName);
                        setActiveTab('vendors');
                        setVendorModalOpen(false);
                        setCurrentPage(1);
                        fetchLedgers();
                      }}
                      className="text-[10px] font-extrabold text-blue-600 hover:text-blue-700 underline"
                    >
                      Filter Overview →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-100 shrink-0 text-right">
              <button
                type="button"
                onClick={() => setVendorModalOpen(false)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all"
              >
                Close Breakdown
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default WorkerSalaryLedger;
