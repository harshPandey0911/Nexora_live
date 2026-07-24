import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiDollarSign, FiArrowUp, FiArrowDown, FiArrowRight, FiClock, FiCheckCircle, FiAlertCircle, FiSend, FiChevronRight, FiX } from 'react-icons/fi';
import { vendorTheme as themeColors } from '../../../../theme';
import LogoLoader from '../../../../components/common/LogoLoader';
import vendorWalletService from '../../../../services/vendorWalletService';
import { toast } from 'react-hot-toast';

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
      const [walletRes, txnRes, withRes, setRes] = await Promise.all([
        vendorWalletService.getWallet(),
        vendorWalletService.getTransactions({ limit: 50 }),
        vendorWalletService.getWithdrawals({ limit: 50 }),
        vendorWalletService.getSettlements({ limit: 50 })
      ]);

      if (walletRes.success) {
        setWallet(walletRes.data);
        localStorage.setItem('vendorWalletData', JSON.stringify(walletRes.data));
      }

      if (txnRes.success) {
        const txns = txnRes.data || [];
        setTransactions(txns);
        localStorage.setItem('vendorTransactions', JSON.stringify(txns));
      }

      if (withRes?.success) {
        setWithdrawals(withRes.data || []);
      }

      if (setRes?.success) {
        setSettlements(setRes.data || []);
      }
    } catch (error) {
      console.error('Error loading wallet:', error);
      toast.error('Failed to load wallet data');
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
  const startEntry = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endEntry = Math.min(currentPage * PAGE_SIZE, totalEntries);

  const handleFilterChange = (f) => {
    setFilter(f);
    setCurrentPage(1);
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'cash_collected':
        return <FiArrowDown className="w-5 h-5 text-red-500" />;
      case 'earnings_credit':
        return <FiArrowUp className="w-5 h-5 text-green-500" />;
      case 'settlement':
        return <FiSend className="w-5 h-5 text-blue-500" />;
      case 'withdrawal':
        return <FiDollarSign className="w-5 h-5 text-purple-500" />;
      case 'tds_deduction':
        return <FiAlertCircle className="w-5 h-5 text-amber-500" />;
      case 'commission':
        return <FiDollarSign className="w-5 h-5 text-orange-500" />;
      case 'platform_fee':
        return <FiAlertCircle className="w-5 h-5 text-rose-500" />;
      case 'worker_payment':
        return <FiArrowDown className="w-5 h-5 text-orange-500" />;
      default:
        return <FiDollarSign className="w-5 h-5 text-gray-500" />;
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

  if (loading) {
    return <LogoLoader />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Available Earnings Card (Light Blue Gradient - Compact) */}
      <div
        className="rounded-2xl p-4 border border-blue-100/70 shadow-sm relative overflow-hidden group"
        style={{ 
          background: `linear-gradient(135deg, #F0F5FF 0%, #E0EBFF 100%)` 
        }}
      >
        {/* Decorative Elements */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-100/20 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center border border-blue-200/50">
              <FiArrowUp className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-[9px] font-medium text-blue-600 capitalize tracking-widest">Net Available Assets</p>
              <p className="text-[8px] font-normal text-gray-500/80 capitalize tracking-widest mt-0.5">Real-time sync active</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-medium text-gray-950 tracking-tighter">₹{wallet.balance?.toFixed(2)}</span>
                <span className="text-[8px] font-normal text-gray-500 capitalize tracking-widest mb-1">Available for payout</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[8px] font-medium text-blue-600/70 capitalize tracking-[0.15em]">Weekly Payout Cycle</span>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/vendor/wallet/withdraw')}
              className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium text-[10px] capitalize tracking-widest shadow hover:bg-blue-700 transition-all active:scale-95"
            >
              Withdraw
            </motion.button>
          </div>
        </div>
      </div>

      {/* Pending Withdrawal Request Alert Banner */}
      {wallet.pendingWithdrawalAmount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 mt-0.5 shadow">
            <FiClock className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="font-bold text-amber-950 text-xs">Pending Withdrawal Request</p>
              <span className="text-sm font-black text-amber-950">₹{Number(wallet.pendingWithdrawalAmount).toFixed(2)}</span>
            </div>
            <p className="text-amber-800 text-[11px] mt-1 leading-relaxed">
              Awaiting Admin Approval & Payout. Your requested amount is held in reserve.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3.5">
        {/* Active Dues */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm relative overflow-hidden group flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center border border-rose-100 shrink-0">
                <FiArrowDown className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-[8px] font-medium text-gray-400 capitalize tracking-widest">Active Dues</p>
            </div>
            
            <div className="flex flex-col mb-3.5">
              <span className="text-xl font-medium text-gray-900 tracking-tighter">₹{wallet.amountDue || 0}</span>
              <span className="text-[8px] font-normal text-gray-400 capitalize mt-0.5">Current Liability</span>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/vendor/wallet/settle')}
            className="w-full py-2 bg-red-600 text-white rounded-lg font-medium text-[9px] capitalize tracking-wider shadow hover:bg-red-700 transition-all active:scale-95"
          >
            Clear Dues
          </motion.button>
        </div>

        {/* Total Settled */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm group flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100 shrink-0">
                <FiCheckCircle className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-[8px] font-medium text-gray-400 capitalize tracking-widest">Total Settled</p>
            </div>
          </div>
          
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-xl font-medium text-gray-900 tracking-tighter">₹{wallet.totalSettled || 0}</span>
            </div>

            <div className="flex items-center gap-1.5 mt-auto">
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] font-medium text-gray-500 capitalize tracking-widest">Verified Portfolio</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cash Limit Visualizer */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FiClock className="text-blue-600 w-5 h-5" />
            <p className="text-sm font-normal text-gray-800 capitalize tracking-widest">Cash Collection Limit</p>
          </div>
          <p className="text-base font-medium text-blue-600">
            ₹{(wallet.dues || 0).toLocaleString()} <span className="text-gray-300">/</span> ₹{(wallet.cashLimit || 10000).toLocaleString()}
          </p>
        </div>
        <div className="w-full h-4 bg-gray-50 rounded-full overflow-hidden p-1 border border-gray-100 shadow-inner">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (wallet.dues / (wallet.cashLimit || 10000)) * 100)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-full rounded-full transition-all duration-700 shadow-sm ${(wallet.dues / (wallet.cashLimit || 10000)) > 0.8 ? 'bg-red-500' : 'bg-blue-600'
              }`}
          />
        </div>
        <div className="mt-6 flex items-center gap-3 px-1">
          <FiAlertCircle className="text-gray-400 w-4 h-4 shrink-0" />
          <p className="text-[10px] font-normal text-gray-500 capitalize tracking-widest leading-relaxed">
            Maintain dues below 80% to ensure uninterrupted platform accessibility.
          </p>
        </div>
      </div>

      {/* Transactions Section */}
      <div className="space-y-8">
        <div className="flex items-center justify-between px-2 gap-4">
          <h3 className="text-base font-normal text-gray-800 capitalize tracking-widest shrink-0">Audit Ledger</h3>
          
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
            {(() => {
              const cashCollectedCount = transactions.filter(t => t.type === 'cash_collected').length;
              const settlementCount = settlements.length || transactions.filter(t => t.type === 'settlement').length;
              const tabs = [
                { id: 'all', label: `Consolidated (${transactions.length})` },
                { id: 'withdrawal_requests', label: `Withdrawals (${withdrawals.length})` },
                { id: 'cash_collected', label: `Cash Collected (${cashCollectedCount})` },
                { id: 'settlement', label: `Settlements (${settlementCount})` }
              ];
              return tabs.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleFilterChange(f.id)}
                  className={`text-[10px] font-bold tracking-wide px-3.5 py-2 rounded-xl transition-all border whitespace-nowrap active:scale-95 ${filter === f.id 
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 shadow-xs'
                  }`}
                >
                  {f.label}
                </button>
              ));
            })()}
          </div>
        </div>

        {filter === 'withdrawal_requests' ? (
          withdrawals.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 text-blue-600">
                <FiDollarSign className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-gray-900 mb-1">No Withdrawal Requests Found</h4>
              <p className="text-xs text-gray-500 max-w-xs mx-auto mb-6">
                You haven't requested any payouts yet. You can request payouts anytime from your available earnings.
              </p>
              <button
                onClick={() => navigate('/vendor/wallet/withdraw')}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-blue-700 transition-all"
              >
                Request Withdrawal
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {paginatedItems.map((item) => {
                const isPending = item.status === 'pending';
                const isApproved = item.status === 'approved';
                const isRejected = item.status === 'rejected';

                return (
                  <div
                    key={item._id}
                    onClick={() => setSelectedWithdrawal(item)}
                    className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:border-blue-300 hover:shadow-md active:scale-[0.99] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group relative"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-inner ${
                        isPending ? 'bg-amber-50 text-amber-600 border-amber-200' :
                        isApproved ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                        'bg-rose-50 text-rose-600 border-rose-200'
                      }`}>
                        {isPending ? <FiClock className="w-6 h-6" /> :
                         isApproved ? <FiCheckCircle className="w-6 h-6" /> :
                         <FiAlertCircle className="w-6 h-6" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-base font-black text-gray-900 group-hover:text-blue-600 transition-colors">
                            ₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            isPending ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            isApproved ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}>
                            {isPending ? '⏳ Pending Approval' : isApproved ? '✅ Approved & Paid' : '❌ Rejected'}
                          </span>
                        </div>

                        <p className="text-xs text-gray-500 font-medium">
                          {item.bankDetails?.bankName ? `${item.bankDetails.bankName} • Acc ****${item.bankDetails.accountNumber?.slice(-4)}` : item.bankDetails?.upiId || 'Bank Transfer'}
                        </p>

                        {item.transactionReference && (
                          <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                            Ref / UTR: <span className="font-mono">{item.transactionReference}</span>
                          </p>
                        )}

                        {item.rejectionReason && (
                          <p className="text-[11px] text-rose-600 font-semibold mt-1">
                            Reason: {item.rejectionReason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-gray-100">
                      <div className="text-left md:text-right">
                        <p className="text-xs text-gray-400 font-medium">Requested On</p>
                        <p className="text-xs font-bold text-gray-700 mt-0.5">
                          {formatDate(item.createdAt || item.requestDate)}
                        </p>
                        {item.netAmount && (
                          <p className="text-[11px] font-bold text-emerald-600 mt-1">
                            Net Paid: ₹{Number(item.netAmount).toFixed(2)}
                          </p>
                        )}
                      </div>
                      <FiChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : filteredTransactions.length === 0 ? (
          <div className="bg-white rounded-[40px] p-16 text-center border border-gray-100 shadow-sm">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-gray-100">
              <span className="text-2xl">🧾</span>
            </div>
            <p className="text-xs font-normal text-gray-400 capitalize tracking-widest">No activity recorded</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {paginatedItems.map((txn) => {
              const isNegative = ['cash_collected', 'tds_deduction', 'withdrawal', 'platform_fee', 'worker_payment'].includes(txn.type);

              return (
                <div
                  key={txn._id}
                  onClick={() => setSelectedTransaction(txn)}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm flex items-center justify-between gap-4 cursor-pointer group hover:border-blue-300 hover:shadow-md active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all shadow-inner ${ 
                      isNegative 
                        ? 'bg-red-50 text-red-600 border-red-100' 
                        : 'bg-blue-50 text-blue-600 border-blue-100'
                    }`}>
                      {getTransactionIcon(txn.type)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm sm:text-base font-bold text-gray-900 truncate capitalize group-hover:text-blue-600 transition-colors">
                          {getTransactionLabel(txn.type)}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 truncate capitalize font-medium">
                        {txn.description || 'System transaction'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className={`text-sm sm:text-base font-black tracking-tight ${isNegative ? 'text-red-600' : 'text-emerald-600'}`}>
                        {isNegative ? '-' : '+'}₹{Math.abs(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                      <span className="text-[10px] font-semibold text-gray-400">
                        {formatDate(txn.createdAt)}
                      </span>
                    </div>
                    <FiChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Global Proper Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-4 border-t border-gray-100 px-2">
            <p className="text-xs font-semibold text-gray-500">
              Showing <span className="font-bold text-gray-900">{startEntry}–{endEntry}</span> of <span className="font-bold text-gray-900">{totalEntries}</span> entries
            </p>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
              >
                Previous
              </button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                  .map((page, idx, arr) => {
                    const prevPage = arr[idx - 1];
                    const showEllipsis = prevPage && page - prevPage > 1;
                    return (
                      <React.Fragment key={page}>
                        {showEllipsis && <span className="px-1 text-xs text-gray-400 font-bold">…</span>}
                        <button
                          onClick={() => setCurrentPage(page)}
                          className={`w-7 h-7 rounded-xl text-xs font-bold transition-all border ${
                            currentPage === page
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl text-xs font-bold border border-blue-100 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Withdrawal Receipt Modal */}
      <AnimatePresence>
        {selectedWithdrawal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm touch-none overscroll-contain">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative border border-gray-100 flex flex-col max-h-[92vh] sm:max-h-[88vh]"
            >
              {/* Header */}
              <div className={`px-5 py-4 text-center text-white relative flex flex-col items-center ${
                selectedWithdrawal.status === 'pending' ? 'bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600' :
                selectedWithdrawal.status === 'approved' ? 'bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700' :
                'bg-gradient-to-br from-rose-600 via-red-600 to-rose-700'
              }`}>
                <button
                  onClick={() => setSelectedWithdrawal(null)}
                  className="absolute top-3.5 right-3.5 p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all border border-white/10 active:scale-90"
                >
                  <FiX className="w-4 h-4" />
                </button>

                <div className="w-10 h-10 bg-white/15 backdrop-blur-md rounded-xl border border-white/20 flex items-center justify-center shadow mx-auto mb-2 shrink-0">
                  {selectedWithdrawal.status === 'pending' ? <FiClock className="w-5 h-5" /> :
                   selectedWithdrawal.status === 'approved' ? <FiCheckCircle className="w-5 h-5" /> :
                   <FiAlertCircle className="w-5 h-5" />}
                </div>

                <h3 className="text-[10px] font-extrabold uppercase tracking-[0.2em] opacity-90 mb-0.5">
                  {selectedWithdrawal.status === 'pending' ? 'Withdrawal Under Review' :
                   selectedWithdrawal.status === 'approved' ? 'Withdrawal Payout Complete' :
                   'Withdrawal Request Rejected'}
                </h3>
                <p className="text-2xl sm:text-3xl font-black tracking-tight">
                  ₹{Number(selectedWithdrawal.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>

              {/* Modal Content Details */}
              <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto custom-scrollbar flex-1">
                {/* Status Alert Banner */}
                <div className={`p-3 rounded-xl text-[11px] font-semibold leading-snug border ${
                  selectedWithdrawal.status === 'pending' ? 'bg-amber-50 text-amber-950 border-amber-200' :
                  selectedWithdrawal.status === 'approved' ? 'bg-emerald-50 text-emerald-950 border-emerald-200' :
                  'bg-rose-50 text-rose-950 border-rose-200'
                }`}>
                  {selectedWithdrawal.status === 'pending' && '⏳ Your withdrawal request is being processed by Admin. Processing timeline: 24-48 business hours.'}
                  {selectedWithdrawal.status === 'approved' && '✅ Funds successfully transferred to your bank account.'}
                  {selectedWithdrawal.status === 'rejected' && '❌ Request rejected by Admin. Held funds have been returned to your wallet earnings.'}
                </div>

                {/* Rejection Reason Alert Card (if Rejected) */}
                {selectedWithdrawal.status === 'rejected' && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-0.5">
                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-rose-600">Rejection Reason</p>
                    <p className="text-xs font-bold text-rose-950 leading-relaxed">
                      {selectedWithdrawal.rejectionReason || selectedWithdrawal.adminNotes || 'Invalid bank account details or IFSC code. Please verify and re-submit.'}
                    </p>
                  </div>
                )}

                {/* Breakdown Table */}
                <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-medium">Requested Gross Amount</span>
                    <span className="font-bold text-gray-900">₹{Number(selectedWithdrawal.amount).toFixed(2)}</span>
                  </div>

                  {(() => {
                    const gross = Number(selectedWithdrawal.amount) || 0;
                    const tdsRate = selectedWithdrawal.status === 'approved' 
                      ? (selectedWithdrawal.tdsRate || wallet?.tdsRate || 1) 
                      : (wallet?.tdsRate || wallet?.vendor?.tdsRate || 1);

                    const platformRate = selectedWithdrawal.status === 'approved' 
                      ? (selectedWithdrawal.platformFeeRate || wallet?.platformFeeRate || 0.5) 
                      : (wallet?.platformFeeRate || wallet?.vendor?.platformFeeRate || 0.5);

                    const tdsAmt = (selectedWithdrawal.status === 'approved' && selectedWithdrawal.tdsAmount > 0)
                      ? selectedWithdrawal.tdsAmount
                      : Math.round((gross * tdsRate) / 100);

                    const platformAmt = (selectedWithdrawal.status === 'approved' && selectedWithdrawal.platformFeeAmount > 0)
                      ? selectedWithdrawal.platformFeeAmount
                      : Math.round((gross * platformRate) / 100);

                    const netAmt = (selectedWithdrawal.status === 'approved' && selectedWithdrawal.netAmount > 0)
                      ? selectedWithdrawal.netAmount
                      : Math.max(0, gross - tdsAmt - platformAmt);

                    return (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 font-medium">Statutory TDS ({tdsRate}%)</span>
                          <span className="font-bold text-rose-600">-₹{Number(tdsAmt).toFixed(2)}</span>
                        </div>

                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 font-medium">Platform Charge ({platformRate}%)</span>
                          <span className="font-bold text-rose-600">-₹{Number(platformAmt).toFixed(2)}</span>
                        </div>

                        <div className="border-t border-gray-200 pt-2 flex justify-between items-center text-xs sm:text-sm">
                          <span className="font-bold text-gray-900">
                            {selectedWithdrawal.status === 'approved' ? 'Net Transferred Amount' : 'Estimated Net Payout'}
                          </span>
                          <span className="font-black text-emerald-600">₹{Number(netAmt).toFixed(2)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Destination Bank Account */}
                {selectedWithdrawal.bankDetails && (
                  <div className="bg-white rounded-xl p-3 border border-gray-200 space-y-1">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Destination Account</p>
                    <p className="text-xs font-bold text-gray-900">{selectedWithdrawal.bankDetails.bankName || 'Bank Account'}</p>
                    <p className="text-[11px] text-gray-600">Holder: {selectedWithdrawal.bankDetails.accountHolderName || 'N/A'}</p>
                    <p className="text-[11px] text-gray-600 font-mono">Account: {selectedWithdrawal.bankDetails.accountNumber || selectedWithdrawal.bankDetails.upiId}</p>
                    {selectedWithdrawal.bankDetails.ifscCode && (
                      <p className="text-[11px] text-gray-600 font-mono">IFSC: {selectedWithdrawal.bankDetails.ifscCode}</p>
                    )}
                  </div>
                )}

                {/* Reference Numbers & Dates */}
                <div className="text-[11px] space-y-1 pt-1 text-gray-500 font-medium border-t border-gray-100">
                  <div className="flex justify-between">
                    <span>Requested Date:</span>
                    <span className="font-bold text-gray-800">{new Date(selectedWithdrawal.createdAt || selectedWithdrawal.requestDate).toLocaleString('en-IN')}</span>
                  </div>
                  {selectedWithdrawal.processedDate && (
                    <div className="flex justify-between">
                      <span>Processed Date:</span>
                      <span className="font-bold text-gray-800">{new Date(selectedWithdrawal.processedDate).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {selectedWithdrawal.transactionReference && (
                    <div className="flex justify-between">
                      <span>Ref / UTR Number:</span>
                      <span className="font-mono font-bold text-emerald-700">{selectedWithdrawal.transactionReference}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSelectedWithdrawal(null)}
                  className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl text-xs shadow hover:bg-gray-800 transition-all active:scale-95"
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
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm touch-none overscroll-contain">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative border border-gray-100 flex flex-col max-h-[90vh]"
            >
              {(() => {
                const isNegative = ['cash_collected', 'tds_deduction', 'withdrawal', 'platform_fee'].includes(selectedTransaction.type);
                return (
                  <>
                    {/* Header */}
                    <div className={`px-5 py-4 text-center text-white relative flex flex-col items-center ${
                      isNegative 
                        ? 'bg-gradient-to-br from-rose-600 via-red-600 to-rose-700' 
                        : 'bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700'
                    }`}>
                      <button
                        onClick={() => setSelectedTransaction(null)}
                        className="absolute top-3.5 right-3.5 p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all border border-white/10 active:scale-90"
                      >
                        <FiX className="w-4 h-4" />
                      </button>

                      <div className="w-10 h-10 bg-white/15 backdrop-blur-md rounded-xl border border-white/20 flex items-center justify-center shadow mx-auto mb-2 shrink-0">
                        {getTransactionIcon(selectedTransaction.type)}
                      </div>

                      <h3 className="text-[10px] font-extrabold uppercase tracking-[0.2em] opacity-90 mb-0.5">
                        {getTransactionLabel(selectedTransaction.type)}
                      </h3>
                      <p className="text-2xl sm:text-3xl font-black tracking-tight">
                        {isNegative ? '-' : '+'}₹{Math.abs(selectedTransaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-3.5 overflow-y-auto custom-scrollbar flex-1">
                      <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 font-medium">Status</span>
                          <span className="font-bold text-emerald-700 uppercase tracking-wider text-[10px] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            ✓ Completed
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-gray-500 font-medium">Transaction Type</span>
                          <span className="font-bold text-gray-900 capitalize">{getTransactionLabel(selectedTransaction.type)}</span>
                        </div>

                        {selectedTransaction.paymentMethod && (
                          <div className="flex justify-between">
                            <span className="text-gray-500 font-medium">Payment Mode</span>
                            <span className="font-bold text-gray-900 capitalize">{selectedTransaction.paymentMethod.replace('_', ' ')}</span>
                          </div>
                        )}

                        <div className="border-t border-gray-200 pt-2 flex justify-between">
                          <span className="text-gray-500 font-medium">Recorded Date</span>
                          <span className="font-bold text-gray-800">{new Date(selectedTransaction.createdAt).toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-3 border border-gray-200 space-y-1">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Description / Details</p>
                        <p className="text-xs font-semibold text-gray-800 leading-relaxed">
                          {selectedTransaction.description || 'System recorded transaction.'}
                        </p>
                        {selectedTransaction.referenceId && (
                          <p className="text-[11px] text-gray-500 font-mono mt-1 pt-1 border-t border-gray-100">
                            Ref ID: <span className="font-bold text-gray-700">{selectedTransaction.referenceId}</span>
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => setSelectedTransaction(null)}
                        className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl text-xs shadow hover:bg-gray-800 transition-all active:scale-95"
                      >
                        Close Receipt
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Wallet;
