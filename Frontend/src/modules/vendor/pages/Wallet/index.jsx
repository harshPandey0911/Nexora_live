import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiDollarSign, FiArrowUp, FiArrowDown, FiArrowRight, FiClock, 
  FiCheckCircle, FiAlertCircle, FiSend, FiChevronRight, FiX, FiCreditCard
} from 'react-icons/fi';
import LogoLoader from '../../../../components/common/LogoLoader';
import vendorWalletService from '../../../../services/vendorWalletService';
import { toast } from 'react-hot-toast';
import Pagination from '../../../../components/common/Pagination';

const Wallet = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(() => {
    const cached = localStorage.getItem('vendorWalletData');
    return cached ? JSON.parse(cached) : {
      balance: 0,
      dues: 0,
      earnings: 0,
      amountDue: 0,
      totalCashCollected: 0,
      totalSettled: 0,
      totalWithdrawn: 0,
      pendingSettlements: 0,
      cashLimit: 10000
    };
  });
  const [transactions, setTransactions] = useState(() => {
    const cached = localStorage.getItem('vendorTransactions');
    return cached ? JSON.parse(cached) : [];
  });
  const [withdrawals, setWithdrawals] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [filter, setFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      if (transactions.length === 0) setLoading(true);
      const [walletRes, txnRes, withRes, setRes] = await Promise.allSettled([
        vendorWalletService.getWallet(),
        vendorWalletService.getTransactions({ limit: 50 }),
        vendorWalletService.getWithdrawals({ limit: 50 }),
        vendorWalletService.getSettlements({ limit: 50 })
      ]);

      if (walletRes.status === 'fulfilled' && walletRes.value?.success) {
        setWallet(walletRes.value.data);
        localStorage.setItem('vendorWalletData', JSON.stringify(walletRes.value.data));
      }

      if (txnRes.status === 'fulfilled' && txnRes.value?.success) {
        const txns = txnRes.value.data || [];
        setTransactions(txns);
        localStorage.setItem('vendorTransactions', JSON.stringify(txns));
      }

      if (withRes.status === 'fulfilled' && withRes.value?.success) {
        setWithdrawals(withRes.value.data || []);
      }

      if (setRes.status === 'fulfilled' && setRes.value?.success) {
        setSettlements(setRes.value.data || []);
      }

      // If main wallet request failed, show single toast
      if (walletRes.status === 'rejected' || (walletRes.value && !walletRes.value.success)) {
        toast.error('Failed to load wallet balance', { id: 'vendor-wallet-load-error' });
      }
    } catch (error) {
      console.error('Error loading wallet:', error);
      toast.error('Failed to load wallet data', { id: 'vendor-wallet-load-error' });
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(txn => {
    if (filter === 'all' || filter === 'withdrawal_requests') return true;
    return txn.type === filter;
  });

  const activeItems = filter === 'withdrawal_requests'
    ? withdrawals
    : filter === 'settlement'
      ? (settlements.length > 0 ? settlements : filteredTransactions)
      : filteredTransactions;

  const totalEntries = activeItems.length;
  const totalPages = Math.ceil(totalEntries / PAGE_SIZE) || 1;
  const paginatedItems = activeItems.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleFilterChange = (f) => {
    setFilter(f);
    setCurrentPage(1);
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'cash_collected':
        return <FiArrowDown className="w-4 h-4 text-rose-500" />;
      case 'earnings_credit':
        return <FiArrowUp className="w-4 h-4 text-emerald-500" />;
      case 'settlement':
        return <FiSend className="w-4 h-4 text-blue-500" />;
      case 'withdrawal':
        return <FiDollarSign className="w-4 h-4 text-purple-500" />;
      case 'tds_deduction':
        return <FiAlertCircle className="w-4 h-4 text-amber-500" />;
      case 'commission':
        return <FiDollarSign className="w-4 h-4 text-amber-500" />;
      case 'platform_fee':
        return <FiAlertCircle className="w-4 h-4 text-rose-500" />;
      case 'worker_payment':
        return <FiArrowDown className="w-4 h-4 text-rose-500" />;
      default:
        return <FiDollarSign className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTransactionLabel = (type) => {
    switch (type) {
      case 'cash_collected':
        return 'Cash Collected';
      case 'earnings_credit':
        return 'Earnings Credited';
      case 'settlement':
        return 'Settlement Paid';
      case 'withdrawal':
        return 'Withdrawal Payout';
      case 'tds_deduction':
        return 'TDS Deduction';
      case 'commission':
        return 'Commission';
      case 'platform_fee':
        return 'Platform Charge';
      case 'worker_payment':
        return 'Worker Salary Paid';
      default:
        return type;
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) return <LogoLoader />;

  return (
    <div className="space-y-3 sm:space-y-4 pb-16">
      {/* Net Available Earnings Card (Navy Gradient Credit Card Aesthetic) */}
      <div className="bg-gradient-to-br from-[#00246b] via-[#001c54] to-[#0d1b3e] text-white rounded-2xl p-4 sm:p-5 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-xs">
                <FiCreditCard className="w-4 h-4 text-blue-300" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest">Net Available Balance</p>
                <p className="text-[8px] text-blue-200/70 font-medium">Real-time wallet sync</p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-400/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active Payout
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-1">
            <div>
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                ₹{Number(wallet.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-blue-200/80 font-medium mt-0.5">Available for instant withdrawal request</p>
            </div>

            <button
              onClick={() => navigate('/vendor/wallet/withdraw')}
              className="w-full sm:w-auto px-5 py-2 bg-white text-gray-900 font-bold text-xs rounded-xl shadow hover:bg-gray-100 active:scale-95 transition-all cursor-pointer border border-white"
            >
              Request Withdrawal
            </button>
          </div>
        </div>
      </div>

      {/* Pending Withdrawal Request Alert Banner */}
      {wallet.pendingWithdrawalAmount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3 shadow-2xs">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow">
            <FiClock className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-amber-900 text-xs truncate">Pending Withdrawal Request</p>
              <span className="text-xs font-bold text-amber-900 shrink-0">₹{Number(wallet.pendingWithdrawalAmount).toFixed(2)}</span>
            </div>
            <p className="text-amber-800 text-[10px] mt-0.5 leading-snug">
              Awaiting Admin Approval & Payout. Funds held in reserve.
            </p>
          </div>
        </div>
      )}

      {/* Active Dues & Total Settled 2-Card Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Active Dues */}
        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <FiArrowDown className="w-3.5 h-3.5" />
              </div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Active Dues</p>
            </div>
            <p className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">₹{wallet.amountDue || 0}</p>
            <p className="text-[9px] font-medium text-gray-400">Current Liability</p>
          </div>

          <button
            onClick={() => navigate('/vendor/wallet/settle')}
            className="mt-3 w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider shadow-2xs transition-all active:scale-95 cursor-pointer"
          >
            Clear Dues
          </button>
        </div>

        {/* Total Settled */}
        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <FiCheckCircle className="w-3.5 h-3.5" />
              </div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Total Settled</p>
            </div>
            <p className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">₹{wallet.totalSettled || 0}</p>
            <p className="text-[9px] font-medium text-gray-400">Lifetime Paid</p>
          </div>

          <div className="mt-3 flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Verified Portfolio</span>
          </div>
        </div>
      </div>

      {/* Cash Collection Limit Visualizer */}
      <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-gray-100 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiClock className="text-blue-600 w-4 h-4" />
            <p className="text-xs font-bold text-gray-900">Cash Collection Limit</p>
          </div>
          <p className="text-xs font-bold text-blue-600">
            ₹{(wallet.dues || 0).toLocaleString()} <span className="text-gray-300">/</span> ₹{(wallet.cashLimit || 10000).toLocaleString()}
          </p>
        </div>

        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden p-0.5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (wallet.dues / (wallet.cashLimit || 10000)) * 100)}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full rounded-full transition-all duration-500 ${(wallet.dues / (wallet.cashLimit || 10000)) > 0.8 ? 'bg-rose-500' : 'bg-blue-600'}`}
          />
        </div>

        <p className="text-[9px] text-gray-400 font-medium leading-relaxed">
          💡 Maintain cash dues below 80% to ensure uninterrupted platform order allocation.
        </p>
      </div>

      {/* Transactions Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-0.5">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Audit Ledger</h3>
          
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-0.5">
            {[
              { id: 'all', label: `All (${transactions.length})` },
              { id: 'withdrawal_requests', label: `Withdrawals (${withdrawals.length})` },
              { id: 'cash_collected', label: `Cash (${transactions.filter(t => t.type === 'cash_collected').length})` },
              { id: 'settlement', label: `Settlements (${settlements.length})` }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => handleFilterChange(f.id)}
                className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-lg transition-all border whitespace-nowrap cursor-pointer ${filter === f.id 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filter === 'withdrawal_requests' ? (
          withdrawals.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-dashed border-gray-200 shadow-2xs">
              <FiDollarSign className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-gray-900 uppercase">No Withdrawal Requests</h4>
              <p className="text-[10px] text-gray-400 mt-0.5">Request payouts anytime from available earnings</p>
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedItems.map((item) => {
                const isPending = item.status === 'pending';
                const isApproved = item.status === 'approved';

                return (
                  <div
                    key={item._id}
                    onClick={() => setSelectedWithdrawal(item)}
                    className="bg-white rounded-xl p-3 border border-gray-100 hover:border-gray-200 shadow-2xs flex items-center justify-between gap-3 cursor-pointer group transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-gray-100 ${
                        isPending ? 'bg-amber-50 text-amber-600' :
                        isApproved ? 'bg-emerald-50 text-emerald-600' :
                        'bg-rose-50 text-rose-600'
                      }`}>
                        {isPending ? <FiClock className="w-4 h-4" /> :
                         isApproved ? <FiCheckCircle className="w-4 h-4" /> :
                         <FiAlertCircle className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-gray-900 truncate">
                            ₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                            isPending ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                            isApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            {isPending ? 'Pending' : isApproved ? 'Approved' : 'Rejected'}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 truncate">
                          {formatDate(item.createdAt || item.requestDate)}
                        </p>
                      </div>
                    </div>

                    <div className="w-6 h-6 rounded-lg bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center transition-colors text-gray-400 group-hover:text-blue-600 shrink-0">
                      <FiChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : filteredTransactions.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-dashed border-gray-200 shadow-2xs">
            <FiDollarSign className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-gray-900 uppercase">No Activity Recorded</p>
          </div>
        ) : (
          <div className="space-y-2">
            {paginatedItems.map((txn) => {
              const isNegative = ['cash_collected', 'tds_deduction', 'withdrawal', 'platform_fee', 'worker_payment'].includes(txn.type);

              return (
                <div
                  key={txn._id}
                  onClick={() => setSelectedTransaction(txn)}
                  className="bg-white rounded-xl p-3 border border-gray-100 hover:border-gray-200 shadow-2xs flex items-center justify-between gap-3 cursor-pointer group transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-gray-100 ${ 
                      isNegative ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {getTransactionIcon(txn.type)}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                        {getTransactionLabel(txn.type)}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {formatDate(txn.createdAt)} • {txn.description || 'System entry'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-bold ${isNegative ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {isNegative ? '-' : '+'}₹{Math.abs(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <div className="w-6 h-6 rounded-lg bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center transition-colors text-gray-400 group-hover:text-blue-600">
                      <FiChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Global Pagination */}
        {totalEntries > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalEntries}
            pageSize={PAGE_SIZE}
            onPageChange={(p) => setCurrentPage(p)}
            className="mt-3"
          />
        )}
      </div>

      {/* Detailed Withdrawal Receipt Modal */}
      <AnimatePresence>
        {selectedWithdrawal && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl relative border border-gray-100 flex flex-col z-10"
            >
              <div className="bg-[#00246b] px-4 py-3.5 text-center text-white relative flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-blue-200">Withdrawal Receipt</p>
                  <p className="text-lg font-bold">₹{Number(selectedWithdrawal.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
                <button
                  onClick={() => setSelectedWithdrawal(null)}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 text-xs">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className="font-bold text-gray-900 uppercase">{selectedWithdrawal.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Requested Date</span>
                    <span className="font-bold text-gray-900">{formatDate(selectedWithdrawal.createdAt || selectedWithdrawal.requestDate)}</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedWithdrawal(null)}
                  className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Close Receipt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transaction Detail Modal */}
      <AnimatePresence>
        {selectedTransaction && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl relative border border-gray-100 flex flex-col z-10"
            >
              <div className="bg-[#00246b] px-4 py-3.5 text-center text-white relative flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-blue-200">{getTransactionLabel(selectedTransaction.type)}</p>
                  <p className="text-lg font-bold">₹{Math.abs(selectedTransaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 text-xs">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date</span>
                    <span className="font-bold text-gray-900">{formatDate(selectedTransaction.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Description</span>
                    <span className="font-bold text-gray-900">{selectedTransaction.description || 'System entry'}</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Close Receipt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Wallet;
