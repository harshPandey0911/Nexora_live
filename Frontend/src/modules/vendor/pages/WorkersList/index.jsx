import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiUsers, FiPlus, FiSearch, FiUser, FiBriefcase, FiChevronRight, 
  FiStar, FiRefreshCw, FiDollarSign, FiX, FiCheck, FiClock, FiFileText, FiPhone, FiCopy
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
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
    <div className="space-y-3 sm:space-y-4 pb-16">
      {/* Header - Compact & Modern */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs flex flex-row items-center justify-between text-gray-900 border border-gray-100 gap-3">
        <div>
          <h2 className="text-base sm:text-xl font-bold text-gray-900 tracking-tight leading-tight capitalize">
            Team Management
          </h2>
          <p className="text-gray-500 text-[10px] sm:text-xs font-medium mt-0.5">
            Monitor and coordinate your field operatives and deployment fleet
          </p>
        </div>
        <button
          onClick={() => navigate('/vendor/workers/new')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00246b] hover:bg-[#001c54] text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider shadow-2xs active:scale-95 transition-all shrink-0 cursor-pointer"
        >
          <FiPlus className="w-3.5 h-3.5" />
          <span>Deploy Operative</span>
        </button>
      </div>

      {/* Navigation Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-100 shadow-2xs overflow-x-auto scrollbar-hide">
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
                px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold tracking-wider uppercase transition-all duration-200 whitespace-nowrap cursor-pointer
                ${filter === tab.id
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative group flex-1 max-w-xs">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5 group-focus-within:text-blue-600 transition-colors" />
          <input
            type="text"
            placeholder="Search operative..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl py-1.5 pl-9 pr-3 text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all shadow-2xs placeholder-gray-300"
          />
        </div>
      </div>

      {/* Workers Grid */}
      {loading ? (
        <div className="bg-white rounded-xl p-10 text-center border border-gray-100 shadow-2xs">
          <div className="w-7 h-7 border-2 border-[#00246b] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Loading Operatives...</p>
        </div>
      ) : filteredWorkers.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center border border-dashed border-gray-200 shadow-2xs">
          <FiUsers className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <h3 className="text-xs font-bold text-gray-900 uppercase">No Operatives Found</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {searchQuery ? "Your search query didn't match any records." : 'No operatives in this fleet category.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl p-3.5 border border-gray-100 hover:border-gray-200 shadow-2xs transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Avatar + Info */}
                    <div className="flex items-start justify-between gap-2.5 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-base uppercase shadow-2xs">
                            {worker.name ? worker.name.charAt(0) : 'W'}
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                            isPast ? 'bg-slate-400' : isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'
                          }`} />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-gray-900 text-xs sm:text-sm truncate uppercase tracking-tight">{worker.name}</h3>
                            {worker.rating > 0 && (
                              <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 shrink-0">
                                <FiStar className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                {worker.rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 font-medium truncate mt-0.5 flex items-center gap-1">
                            <FiPhone className="w-3 h-3 text-gray-400" />
                            {worker.phone}
                          </p>
                          
                          <div className="mt-1">
                            {isPast ? (
                              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold border bg-slate-50 border-slate-200 text-slate-600 uppercase tracking-wider">
                                Past Operative
                              </span>
                            ) : (
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
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

                    {/* Stats Pill Row */}
                    <div className="flex items-center justify-between bg-gray-50/60 p-2 rounded-lg border border-gray-100 text-[10px] mb-3">
                      <div className="flex items-center gap-1 font-semibold text-blue-700">
                        <FiBriefcase className="w-3 h-3 text-blue-500" />
                        <span>{worker.completedJobs || 0} Jobs</span>
                      </div>
                      <div className="flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        <FiDollarSign className="w-3 h-3 text-emerald-600" />
                        <span>Owed: ₹{Number(worker.salaryOwed || 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between gap-1.5">
                    {isPast ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRelink(worker.phone);
                        }}
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shadow-2xs flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                      >
                        <FiRefreshCw className="w-3 h-3" />
                        Re-hire Operative
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
                          className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                            Number(worker.salaryOwed || 0) > 0
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                              : 'bg-gray-100 text-gray-500 border border-gray-200'
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
                          className="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold border border-blue-100 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                          title="Salary History"
                        >
                          <FiClock className="w-3 h-3 text-blue-600" />
                          <span>History</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/vendor/workers/edit/${worker.id}`);
                          }}
                          className="py-1.5 px-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-[10px] font-bold border border-gray-200 transition-all cursor-pointer"
                        >
                          Edit
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(worker.id);
                          }}
                          className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-bold border border-rose-100 transition-all cursor-pointer"
                          title="Remove Worker"
                        >
                          <FiX className="w-3 h-3" />
                        </button>
                      </>
                    )}
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
          className="mt-3"
        />
      )}

      {/* ── PAY & RESET SALARY MODAL ── */}
      <AnimatePresence>
        {payModalOpen && selectedWorkerForPay && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-gray-100 text-gray-900 z-10"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                    <FiDollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Pay & Reset Salary</h3>
                    <p className="text-[10px] text-gray-500 font-semibold">{selectedWorkerForPay.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPayModalOpen(false)}
                  className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all cursor-pointer"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmPayAndReset} className="space-y-3.5">
                {Number(selectedWorkerForPay.salaryOwed || 0) <= 0 ? (
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-amber-900 space-y-1">
                    <p className="text-[10px] font-bold flex items-center gap-1 text-amber-800 uppercase tracking-wider">
                      <span>ℹ️ Fully Settled</span>
                    </p>
                    <p className="text-[10px] text-amber-700 leading-snug">
                      All jobs for <strong>{selectedWorkerForPay.name}</strong> are settled (₹0 pending).
                    </p>
                  </div>
                ) : (
                  <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-100">
                    <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest">Total Pending Owed</p>
                    <p className="text-xl font-bold text-emerald-700">₹{Number(selectedWorkerForPay.salaryOwed || 0).toLocaleString('en-IN')}</p>
                    <p className="text-[9px] text-emerald-600 mt-0.5">Paying resets worker balance to ₹0.</p>
                  </div>
                )}

                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Payout Amount (₹)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={payoutAmountInput}
                    onChange={(e) => setPayoutAmountInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-gray-900 text-base"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Payment Mode</label>
                  <select
                    value={paymentMethodInput}
                    onChange={(e) => setPaymentMethodInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold text-gray-800 text-xs"
                  >
                    <option value="cash">Cash (Direct Handover)</option>
                    <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="bank_transfer">Bank Transfer / NEFT / IMPS</option>
                  </select>
                </div>

                {/* DYNAMIC WORKER PAYMENT DETAILS */}
                {paymentMethodInput === 'cash' && (
                  <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100 text-[10px] space-y-1 text-emerald-900">
                    <p className="font-bold flex items-center gap-1 text-emerald-800">
                      <span>💵 Physical Cash Settlement</span>
                    </p>
                    <p className="text-[10px] text-emerald-700">
                      Hand over <strong>₹{Number(payoutAmountInput || 0).toLocaleString('en-IN')}</strong> in cash directly to <strong>{selectedWorkerForPay.name}</strong> ({selectedWorkerForPay.phone}).
                    </p>
                  </div>
                )}

                {paymentMethodInput === 'upi' && (
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-[10px] space-y-2">
                    <p className="font-bold text-gray-800 flex items-center justify-between">
                      <span>📱 UPI & GPay Details</span>
                      <span className="text-[9px] text-gray-500 font-normal">{selectedWorkerForPay.name}</span>
                    </p>

                    {selectedWorkerForPay.bankDetails?.upiId ? (
                      <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-gray-200">
                        <div>
                          <span className="text-[8px] text-gray-400 font-bold block uppercase">Custom UPI ID</span>
                          <span className="font-bold text-gray-900 text-xs">{selectedWorkerForPay.bankDetails.upiId}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedWorkerForPay.bankDetails.upiId);
                            toast.success('UPI ID copied!');
                          }}
                          className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-[9px] font-bold hover:bg-blue-100 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <FiCopy className="w-2.5 h-2.5" /> Copy
                        </button>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-gray-200">
                      <div>
                        <span className="text-[8px] text-gray-400 font-bold block uppercase">PhonePe / GPay Phone</span>
                        <span className="font-bold text-gray-900 text-xs">{selectedWorkerForPay.phone}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedWorkerForPay.phone);
                          toast.success('Phone number copied!');
                        }}
                        className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-[9px] font-bold hover:bg-emerald-100 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <FiCopy className="w-2.5 h-2.5" /> Copy
                      </button>
                    </div>
                  </div>
                )}

                {paymentMethodInput === 'bank_transfer' && (
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-[10px] space-y-2">
                    <p className="font-bold text-gray-800 flex items-center justify-between">
                      <span>🏛️ Bank Account Details</span>
                      <span className="text-[9px] text-gray-500 font-normal">{selectedWorkerForPay.name}</span>
                    </p>

                    {selectedWorkerForPay.bankDetails?.accountNumber ? (
                      <div className="bg-white p-2.5 rounded-lg border border-gray-200 space-y-1.5 text-[10px]">
                        {selectedWorkerForPay.bankDetails.accountHolderName && (
                          <div className="flex justify-between items-center pb-1 border-b border-gray-100">
                            <span className="text-gray-400 font-medium">Account Holder:</span>
                            <span className="font-bold text-gray-900">{selectedWorkerForPay.bankDetails.accountHolderName}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 font-medium">A/C Number:</span>
                          <div className="flex items-center gap-1">
                            <span className="font-mono font-bold text-gray-900">{selectedWorkerForPay.bankDetails.accountNumber}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(selectedWorkerForPay.bankDetails.accountNumber);
                                toast.success('Account copied!');
                              }}
                              className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[8px] font-bold hover:bg-blue-100 cursor-pointer"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 font-medium">IFSC Code:</span>
                          <div className="flex items-center gap-1">
                            <span className="font-mono font-bold text-gray-900">{selectedWorkerForPay.bankDetails.ifscCode}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(selectedWorkerForPay.bankDetails.ifscCode);
                                toast.success('IFSC copied!');
                              }}
                              className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[8px] font-bold hover:bg-blue-100 cursor-pointer"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-100 text-[10px] text-amber-800 leading-snug">
                        ⚠️ No bank account added. Pay via GPay/UPI (Phone: <strong>{selectedWorkerForPay.phone}</strong>) or Cash.
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Settlement Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g., Monthly Salary Settlement"
                    value={payoutNotesInput}
                    onChange={(e) => setPayoutNotesInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs text-gray-800 placeholder-gray-300"
                  />
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPayModalOpen(false)}
                    className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPay || Number(selectedWorkerForPay?.salaryOwed || 0) <= 0}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1 disabled:opacity-50 disabled:bg-gray-300 disabled:shadow-none cursor-pointer"
                  >
                    {isSubmittingPay ? 'Processing...' : (
                      <>
                        <FiCheck className="w-3.5 h-3.5" />
                        Confirm Payout
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SALARY HISTORY MODAL ── */}
      <AnimatePresence>
        {historyModalOpen && selectedWorkerForHistory && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 text-gray-900 overflow-hidden flex flex-col max-h-[85vh] z-10"
            >
              {/* Light Emerald Gradient Header Bar */}
              <div className="bg-emerald-50/80 p-4 flex items-center justify-between shrink-0 border-b border-emerald-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-2xs">
                    <FiClock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Salary Payout History</h3>
                    <p className="text-[10px] text-gray-600 font-semibold">{selectedWorkerForHistory.name} • {selectedWorkerForHistory.phone}</p>
                  </div>
                </div>
                <button
                  onClick={() => setHistoryModalOpen(false)}
                  className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-gray-500 hover:bg-gray-100 border border-gray-200 transition-all cursor-pointer"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              {/* Light Summary Stat Banner */}
              <div className="bg-emerald-50/40 px-4 py-2 border-b border-emerald-100 flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-800 font-semibold">Pending Balance:</span>
                  <span className="font-bold text-emerald-700">₹{Number(selectedWorkerForHistory.salaryOwed || 0).toLocaleString('en-IN')}</span>
                </div>
                <span className="text-emerald-800 text-[9px] font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">
                  {historyTotalItems} Record{historyTotalItems !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Content List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-gray-50/40">
                {historyLoading ? (
                  <div className="py-12 text-center text-gray-500 space-y-2">
                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Loading history...</p>
                  </div>
                ) : paymentHistoryList.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 space-y-2">
                    <FiFileText className="w-8 h-8 text-gray-300 mx-auto" />
                    <div>
                      <p className="font-bold text-gray-800 text-xs uppercase">No Payout Records Found</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Salary payout records will appear here after settlement.</p>
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
                        className="bg-white p-3 rounded-xl border border-gray-100 shadow-2xs space-y-2"
                      >
                        {/* Header Row: Mode Badge + Date + Amount */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-100">
                              {txn.paymentMethod === 'upi' ? '📱 UPI Transfer' : txn.paymentMethod === 'bank_transfer' ? '🏛️ Bank Transfer' : '💵 Cash Handover'}
                            </span>
                            <p className="text-[9px] text-gray-400 font-medium mt-1">{formattedDateStr}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-emerald-600 block">
                              + ₹{Number(txn.amount || 0).toLocaleString('en-IN')}
                            </span>
                            <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 inline-block mt-0.5">
                              ✓ Reset to ₹0
                            </span>
                          </div>
                        </div>

                        {/* Settlement Summary */}
                        <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 text-[10px] text-gray-700">
                          <p className="font-bold text-gray-900">{txn.description || 'Salary Payout & Balance Reset'}</p>
                          {txn.metadata?.notes && (
                            <p className="text-[9px] text-gray-500 italic mt-0.5">Notes: "{txn.metadata.notes}"</p>
                          )}
                        </div>

                        {/* Footer Reference */}
                        {txn.referenceId && (
                          <div className="flex items-center justify-between text-[8px] text-gray-400 font-mono pt-1 border-t border-gray-100">
                            <span>Ref ID:</span>
                            <span className="font-bold text-gray-600">{txn.referenceId}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination Footer */}
              {!historyLoading && paymentHistoryList.length > 0 && (
                <div className="p-3 bg-white border-t border-gray-100 shrink-0">
                  <Pagination
                    currentPage={historyCurrentPage}
                    totalPages={historyTotalPages}
                    totalItems={historyTotalItems}
                    pageSize={5}
                    onPageChange={(p) => handleOpenHistoryModal(selectedWorkerForHistory, p)}
                    onPageSizeChange={() => {}}
                    className="my-0 text-xs"
                  />
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkersList;
