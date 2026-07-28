import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiPlus, FiSearch, FiUser, FiBriefcase, FiChevronRight, FiStar, FiRefreshCw, FiDollarSign, FiX, FiCheck, FiClock, FiFileText } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { vendorTheme as themeColors } from '../../../../theme';
import { getWorkers, deleteWorker, linkWorker, payAndResetWorkerSalary, getWorkerPaymentHistory } from '../../services/workerService';
import Pagination from '../../../../components/common/Pagination';

const WorkersList = () => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [workers, setWorkers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  // Pay & Reset Modal State
  const [selectedWorkerForPay, setSelectedWorkerForPay] = useState(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payoutAmountInput, setPayoutAmountInput] = useState('');
  const [paymentMethodInput, setPaymentMethodInput] = useState('cash');
  const [payoutNotesInput, setPayoutNotesInput] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Salary History Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedWorkerForHistory, setSelectedWorkerForHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [paymentHistoryList, setPaymentHistoryList] = useState([]);
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotalItems, setHistoryTotalItems] = useState(0);

  const loadWorkers = async () => {
    try {
      setLoading(true);
      const params = filter === 'past' ? { status: 'past' } : {};
      const response = await getWorkers(params);
      const mapped = (response.data || response).map(w => ({
        ...w,
        id: w._id || w.id
      }));
      setWorkers(mapped || []);
    } catch (error) {
      console.error('Error loading workers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkers();
    window.addEventListener('vendorWorkersUpdated', loadWorkers);

    return () => {
      window.removeEventListener('vendorWorkersUpdated', loadWorkers);
    };
  }, [filter]);

  const handleDelete = async (workerId) => {
    if (window.confirm('Are you sure you want to remove this worker from your team?')) {
      try {
        await deleteWorker(workerId);
        setWorkers(workers.filter(w => w.id !== workerId));
        toast.success('Worker removed from your active fleet');
        window.dispatchEvent(new Event('vendorWorkersUpdated'));
      } catch (error) {
        console.error('Error deleting worker:', error);
        toast.error(error.response?.data?.message || 'Failed to remove worker');
      }
    }
  };

  const handleRelink = async (phone) => {
    if (window.confirm('Re-hire and add this past operative back to your active fleet?')) {
      try {
        await linkWorker(phone);
        toast.success('Worker re-hired successfully!');
        setFilter('all');
        window.dispatchEvent(new Event('vendorWorkersUpdated'));
      } catch (error) {
        console.error('Error re-hiring worker:', error);
        toast.error(error.response?.data?.message || 'Failed to re-hire worker');
      }
    }
  };

  const handleOpenPayModal = (worker) => {
    setSelectedWorkerForPay(worker);
    setPayoutAmountInput(worker.salaryOwed !== undefined ? String(worker.salaryOwed) : '0');
    setPaymentMethodInput('cash');
    setPayoutNotesInput('');
    setPayModalOpen(true);
  };

  const handleConfirmPayAndReset = async (e) => {
    if (e) e.preventDefault();
    if (!selectedWorkerForPay) return;
    try {
      setIsSubmittingPay(true);
      const res = await payAndResetWorkerSalary(selectedWorkerForPay.id || selectedWorkerForPay._id, {
        amount: Number(payoutAmountInput),
        paymentMethod: paymentMethodInput,
        notes: payoutNotesInput
      });

      toast.success(res.message || 'Salary paid and worker balance reset to ₹0!');
      setPayModalOpen(false);
      loadWorkers();
      window.dispatchEvent(new Event('vendorWorkersUpdated'));
    } catch (err) {
      console.error('Pay and reset salary error:', err);
      toast.error(err.response?.data?.message || 'Failed to settle worker salary');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const handleOpenHistoryModal = async (worker, page = 1) => {
    try {
      setSelectedWorkerForHistory(worker);
      setHistoryModalOpen(true);
      setHistoryLoading(true);
      setHistoryCurrentPage(page);
      const res = await getWorkerPaymentHistory(worker.id || worker._id, { page, limit: 5 });
      if (res.success) {
        setPaymentHistoryList(res.data || []);
        setHistoryTotalPages(res.pagination?.pages || 1);
        setHistoryTotalItems(res.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Error fetching payment history:', err);
      toast.error('Failed to load salary payment history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredWorkers = workers.filter(worker => {
    const workerStatus = (worker.status || 'OFFLINE').toUpperCase();
    const isOnline = workerStatus === 'ONLINE';
    const isOffline = workerStatus !== 'ONLINE';

    let matchesFilter = true;
    if (filter === 'online') matchesFilter = isOnline;
    if (filter === 'offline') matchesFilter = isOffline;

    const matchesSearch = searchQuery === '' ||
      (worker.name && worker.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (worker.phone && worker.phone.includes(searchQuery));

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-4 sm:space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between text-gray-900 border border-gray-100 gap-3 sm:gap-6">
        <div>
          <h2 className="text-xl sm:text-3xl font-bold text-gray-900 tracking-tight leading-tight">
            Team Management
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5 sm:mt-1">
            Monitor and coordinate your field operatives and deployment fleet
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/vendor/workers/new')}
          className="w-full md:w-auto px-4 py-2.5 sm:px-6 sm:py-3.5 bg-[#2874F0] text-white font-medium text-xs capitalize tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 shrink-0"
        >
          <FiPlus className="w-4 h-4" />
          <span>Deploy New Operative</span>
        </motion.button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 bg-white p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm overflow-x-auto scrollbar-hide">
        {[
          { id: 'all', label: 'All Fleet' },
          { id: 'online', label: 'Active Fleet' },
          { id: 'offline', label: 'Standby Fleet' },
          { id: 'past', label: 'Past Operatives' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`
              flex items-center gap-1.5 px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold capitalize tracking-wider transition-all duration-300 whitespace-nowrap
              ${filter === tab.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative group max-w-2xl">
        <FiSearch className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5 group-focus-within:text-blue-500 transition-colors" />
        <input
          type="text"
          placeholder="Search operative by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-xl sm:rounded-2xl py-2.5 sm:py-3.5 pl-10 sm:pl-12 pr-4 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all shadow-sm"
        />
      </div>

      {/* Workers List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3.5 sm:gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-gray-100 animate-pulse h-40 shadow-sm" />
          ))}
        </div>
      ) : filteredWorkers.length === 0 ? (
        <div className="bg-white rounded-2xl sm:rounded-[32px] p-10 sm:p-20 text-center border border-gray-100 shadow-sm">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <FiUsers className="w-8 h-8 sm:w-10 sm:h-10 text-gray-300" />
          </div>
          <h3 className="text-lg sm:text-xl font-normal text-gray-800 mb-1.5 sm:mb-2">No Operatives Found</h3>
          <p className="text-xs sm:text-sm text-gray-500 font-medium max-w-xs mx-auto">
            {searchQuery ? "Your search query didn't match any team records." : 'You don\'t have any operatives in this fleet category.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3.5 sm:gap-6">
          {filteredWorkers
            .slice((currentPage - 1) * pageSize, currentPage * pageSize)
            .map((worker) => {
              const workerStatus = (worker.status || 'OFFLINE').toUpperCase();
              const isOnline = workerStatus === 'ONLINE';
              const isPast = filter === 'past';
              const approval = worker.approvalStatus || 'approved';

              return (
                <motion.div
                  key={worker.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 relative flex flex-col justify-between overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3 mb-3.5 sm:mb-5">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="relative shrink-0">
                        <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-base sm:text-xl uppercase shadow-xs">
                          {worker.name ? worker.name.charAt(0) : 'W'}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 border-white ${
                          isPast ? 'bg-amber-500' : isOnline ? 'bg-emerald-500' : 'bg-gray-300'
                        }`} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">{worker.name}</h3>
                          {worker.rating > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] sm:text-xs font-bold text-amber-500 bg-amber-50 px-1.5 sm:px-2 py-0.5 rounded-md border border-amber-100/60">
                              <FiStar className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-amber-400 text-amber-400" />
                              {worker.rating.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] sm:text-xs text-gray-500 font-medium truncate mt-0.5">{worker.phone}</p>
                        
                        <div className="flex flex-wrap gap-1.5 mt-1 sm:mt-1.5">
                          {isPast ? (
                            <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-semibold border bg-slate-100 border-slate-200 text-slate-700">
                              Past Operative
                            </span>
                          ) : (
                            <span className={`text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                              approval === 'approved' 
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                                : approval === 'rejected'
                                ? 'bg-rose-50 border-rose-100 text-rose-700'
                                : 'bg-amber-50 border-amber-100 text-amber-700'
                            }`}>
                              {approval === 'approved' ? 'Approved' : approval === 'rejected' ? 'Rejected' : 'Pending Approval'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between pt-3 sm:pt-4 border-t border-gray-100 gap-2.5 sm:gap-3">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-medium capitalize tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                        <FiBriefcase className="w-3 h-3" />
                        <span>{worker.completedJobs || 0} Jobs</span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold tracking-wide text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                        <FiDollarSign className="w-3 h-3 text-emerald-600" />
                        <span>Owed: ₹{Number(worker.salaryOwed || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <span className={`text-[9px] sm:text-[10px] font-medium capitalize tracking-wider ${isPast ? 'text-amber-600' : isOnline ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {isPast ? 'Removed' : isOnline ? 'Active' : 'Standby'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 z-10">
                      {isPast ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRelink(worker.phone);
                          }}
                          className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-semibold transition-all shadow-md flex items-center gap-1.5 active:scale-95"
                        >
                          <FiRefreshCw className="w-3 h-3" />
                          Re-hire
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (Number(worker.salaryOwed || 0) <= 0) {
                                toast.info(`No pending salary owed for ${worker.name}`);
                                return;
                              }
                              handleOpenPayModal(worker);
                            }}
                            className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-bold transition-all flex items-center gap-1 active:scale-95 ${
                              Number(worker.salaryOwed || 0) > 0
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20'
                                : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                            }`}
                          >
                            <FiDollarSign className="w-3 h-3" />
                            {Number(worker.salaryOwed || 0) > 0 ? 'Pay & Reset' : 'Settled (₹0)'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenHistoryModal(worker);
                            }}
                            className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-bold border border-blue-200 transition-all flex items-center gap-1 active:scale-95"
                          >
                            <FiClock className="w-3 h-3 text-blue-600" />
                            History
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/vendor/workers/edit/${worker.id}`);
                            }}
                            className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-700 rounded-lg text-[10px] sm:text-[11px] font-medium border border-gray-100 transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(worker.id);
                            }}
                            className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-lg text-[10px] sm:text-[11px] font-medium border border-rose-100 transition-all"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
        </div>
      )}

      {/* Pagination Bar */}
      {!loading && filteredWorkers.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(filteredWorkers.length / pageSize) || 1}
          totalItems={filteredWorkers.length}
          pageSize={pageSize}
          onPageChange={(p) => setCurrentPage(p)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          className="mt-4"
        />
      )}

      {/* PAY & RESET SALARY MODAL */}
      {payModalOpen && selectedWorkerForPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-gray-100 text-gray-900"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <FiDollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Pay & Reset Salary</h3>
                  <p className="text-xs text-gray-500">{selectedWorkerForPay.name}</p>
                </div>
              </div>
              <button
                onClick={() => setPayModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayAndReset} className="space-y-4">
              {Number(selectedWorkerForPay.salaryOwed || 0) <= 0 ? (
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-amber-900 space-y-1">
                  <p className="text-xs font-bold flex items-center gap-1.5 text-amber-800">
                    <span>ℹ️ No Pending Salary Owed</span>
                  </p>
                  <p className="text-[11px] text-amber-700 leading-snug">
                    All completed jobs for <strong>{selectedWorkerForPay.name}</strong> are already fully settled (₹0 pending).
                  </p>
                </div>
              ) : (
                <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-100">
                  <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Total Pending Salary Owed</p>
                  <p className="text-2xl font-black text-emerald-700">₹{Number(selectedWorkerForPay.salaryOwed || 0).toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-emerald-600 mt-1">Paying will mark pending job payouts as paid and reset worker salary balance to ₹0.</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Payout Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={payoutAmountInput}
                  onChange={(e) => setPayoutAmountInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-gray-900 text-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Mode</label>
                <select
                  value={paymentMethodInput}
                  onChange={(e) => setPaymentMethodInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-gray-800 text-sm"
                >
                  <option value="cash">Cash (Direct Handover)</option>
                  <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="bank_transfer">Bank Transfer / NEFT / IMPS</option>
                </select>
              </div>

              {/* DYNAMIC WORKER PAYMENT DETAILS BASED ON DROPDOWN SELECTION */}
              {paymentMethodInput === 'cash' && (
                <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-100 text-xs space-y-1 text-emerald-900">
                  <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                    <span>💵 Physical Cash Settlement</span>
                  </p>
                  <p className="text-[11px] text-emerald-700">
                    Hand over <strong>₹{Number(payoutAmountInput || 0).toLocaleString('en-IN')}</strong> in cash directly to <strong>{selectedWorkerForPay.name}</strong> ({selectedWorkerForPay.phone}).
                  </p>
                </div>
              )}

              {paymentMethodInput === 'upi' && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2.5">
                  <p className="font-bold text-slate-800 flex items-center justify-between">
                    <span>📱 UPI & GPay Details</span>
                    <span className="text-[10px] text-slate-500 font-normal">Operative: {selectedWorkerForPay.name}</span>
                  </p>

                  {/* Custom UPI ID if present */}
                  {selectedWorkerForPay.bankDetails?.upiId ? (
                    <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">Custom UPI ID</span>
                        <span className="font-bold text-slate-900 text-sm">{selectedWorkerForPay.bankDetails.upiId}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedWorkerForPay.bankDetails.upiId);
                          toast.success('UPI ID copied!');
                        }}
                        className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-all flex items-center gap-1"
                      >
                        Copy UPI
                      </button>
                    </div>
                  ) : null}

                  {/* GPay / PhonePe Mobile Number */}
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block uppercase">GPay / PhonePe / Paytm Phone</span>
                      <span className="font-bold text-slate-900 text-sm">{selectedWorkerForPay.phone}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedWorkerForPay.phone);
                        toast.success('Phone number copied!');
                      }}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-all flex items-center gap-1"
                    >
                      Copy Phone
                    </button>
                  </div>
                </div>
              )}

              {paymentMethodInput === 'bank_transfer' && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2">
                  <p className="font-bold text-slate-800 flex items-center justify-between">
                    <span>🏛️ Bank Account Details</span>
                    <span className="text-[10px] text-slate-500 font-normal">Operative: {selectedWorkerForPay.name}</span>
                  </p>

                  {selectedWorkerForPay.bankDetails?.accountNumber ? (
                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 text-[11px]">
                      {selectedWorkerForPay.bankDetails.accountHolderName && (
                        <div className="flex justify-between items-center pb-1.5 border-b border-gray-100">
                          <span className="text-slate-400 font-medium">Account Holder:</span>
                          <span className="font-bold text-slate-900">{selectedWorkerForPay.bankDetails.accountHolderName}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Bank Name:</span>
                        <span className="font-bold text-slate-800">{selectedWorkerForPay.bankDetails.bankName || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium">A/C Number:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 text-xs">{selectedWorkerForPay.bankDetails.accountNumber}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedWorkerForPay.bankDetails.accountNumber);
                              toast.success('Account number copied!');
                            }}
                            className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold hover:bg-blue-100"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium">IFSC Code:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 text-xs">{selectedWorkerForPay.bankDetails.ifscCode}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedWorkerForPay.bankDetails.ifscCode);
                              toast.success('IFSC Code copied!');
                            }}
                            className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold hover:bg-blue-100"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-[11px] text-amber-800 leading-snug">
                      ⚠️ No bank account added by {selectedWorkerForPay.name} yet. Pay via GPay/UPI (Phone: <strong>{selectedWorkerForPay.phone}</strong>) or Cash.
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Settlement Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., July Monthly Salary Settlement"
                  value={payoutNotesInput}
                  onChange={(e) => setPayoutNotesInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-gray-800"
                />
              </div>

              <div className="pt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay || Number(selectedWorkerForPay?.salaryOwed || 0) <= 0}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {isSubmittingPay ? 'Processing...' : Number(selectedWorkerForPay?.salaryOwed || 0) <= 0 ? (
                    'No Pending Salary (₹0)'
                  ) : (
                    <>
                      <FiCheck className="w-4 h-4" />
                      Confirm & Reset ₹{Number(payoutAmountInput || 0).toLocaleString('en-IN')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* SALARY HISTORY MODAL - LIGHT THEME */}
      {historyModalOpen && selectedWorkerForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100 text-gray-900 overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Light Emerald Gradient Header Bar */}
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/80 p-6 flex items-center justify-between shrink-0 border-b border-emerald-100">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                  <FiClock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">Salary Payout History</h3>
                  <p className="text-xs text-gray-600 font-semibold">{selectedWorkerForHistory.name} • {selectedWorkerForHistory.phone}</p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-gray-500 hover:bg-gray-100 border border-gray-200 transition-all active:scale-90 shadow-sm"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Light Summary Stat Banner */}
            <div className="bg-emerald-50/50 px-6 py-3 border-b border-emerald-100 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-800 font-semibold">Pending Balance:</span>
                <span className="font-bold text-emerald-700">₹{Number(selectedWorkerForHistory.salaryOwed || 0).toLocaleString('en-IN')}</span>
              </div>
              <span className="text-emerald-800 text-[11px] font-bold bg-white px-2.5 py-0.5 rounded-lg border border-emerald-200 shadow-sm">
                {historyTotalItems} Payout Record{historyTotalItems !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3.5 custom-scrollbar bg-slate-50/50">
              {historyLoading ? (
                <div className="py-16 text-center text-gray-500 space-y-3">
                  <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-semibold text-gray-600">Loading payout history...</p>
                </div>
              ) : paymentHistoryList.length === 0 ? (
                <div className="py-16 text-center text-gray-400 space-y-3">
                  <div className="w-14 h-14 rounded-3xl bg-white border border-gray-200 flex items-center justify-center mx-auto text-gray-400 shadow-sm">
                    <FiFileText className="w-7 h-7 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-700 text-sm">No Payout Records Found</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">When you pay and reset salary for {selectedWorkerForHistory.name}, the transaction records will appear here.</p>
                  </div>
                </div>
              ) : (
                paymentHistoryList.map((txn) => {
                  const formattedDateStr = new Date(txn.createdAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  });

                  return (
                    <div
                      key={txn._id}
                      className="bg-white p-4.5 rounded-2xl border border-gray-200/80 hover:border-emerald-400 hover:shadow-md transition-all duration-200 space-y-3"
                    >
                      {/* Header Row: Mode Badge + Date + Amount */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-900 border border-emerald-200">
                            {txn.paymentMethod === 'upi' ? '📱 UPI Transfer' : txn.paymentMethod === 'bank_transfer' ? '🏛️ Bank Transfer' : '💵 Cash Handover'}
                          </span>
                          <p className="text-[11px] text-gray-500 font-medium pl-0.5">{formattedDateStr}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black text-emerald-600 block tracking-tight">
                            + ₹{Number(txn.amount || 0).toLocaleString('en-IN')}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                            ✓ Salary Reset to ₹0
                          </span>
                        </div>
                      </div>

                      {/* Settlement Summary */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-gray-700 space-y-1">
                        <p className="font-bold text-gray-900">{txn.description || 'Full Salary Payout & Balance Reset by Vendor'}</p>
                        {txn.metadata?.notes && (
                          <p className="text-[11px] text-gray-500 italic">Notes: "{txn.metadata.notes}"</p>
                        )}
                      </div>

                      {/* Footer Reference */}
                      {txn.referenceId && (
                        <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono pt-1.5 border-t border-gray-100">
                          <span>Ref / Txn ID:</span>
                          <span className="font-bold text-gray-700">{txn.referenceId}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Light Pagination Footer */}
            {!historyLoading && paymentHistoryList.length > 0 && (
              <div className="p-4 bg-white border-t border-gray-100 shrink-0">
                <Pagination
                  currentPage={historyCurrentPage}
                  totalPages={historyTotalPages}
                  totalItems={historyTotalItems}
                  pageSize={5}
                  onPageChange={(p) => handleOpenHistoryModal(selectedWorkerForHistory, p)}
                  onPageSizeChange={() => {}}
                  className="my-0"
                />
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default WorkersList;
