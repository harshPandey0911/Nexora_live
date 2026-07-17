import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiClock, FiCheck, FiX, FiDollarSign, FiChevronRight } from 'react-icons/fi';
import { vendorTheme as themeColors } from '../../../../theme';
import Header from '../../components/layout/Header';
import vendorWalletService from '../../../../services/vendorWalletService';
import { toast } from 'react-hot-toast';

const SettlementHistory = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState([]);
  const [filter, setFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    loadSettlements();
  }, [filter]);

  const loadSettlements = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { status: filter } : {};
      const res = await vendorWalletService.getSettlements(params);
      if (res.success) {
        setSettlements(res.data || []);
        setCurrentPage(1);
      }
    } catch (error) {
      toast.error('Failed to load settlements');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <FiClock className="w-5 h-5 text-amber-500" />;
      case 'approved':
        return <FiCheck className="w-5 h-5 text-emerald-500" />;
      case 'rejected':
        return <FiX className="w-5 h-5 text-rose-500" />;
      default:
        return <FiDollarSign className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' };
      case 'approved':
        return { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' };
      case 'rejected':
        return { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/20' };
      default:
        return { bg: 'bg-white/5', text: 'text-gray-500', border: 'border-white/5' };
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && settlements.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 relative overflow-x-hidden">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-100 px-10 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-all"
          >
            <FiClock className="w-5 h-5 rotate-180" />
          </button>
          <h1 className="text-xl font-medium text-gray-900 tracking-tight capitalize">Archive Ledger</h1>
        </div>
        <div className="w-12 h-12 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center">
          <FiDollarSign className="w-6 h-6 text-blue-600" />
        </div>
      </header>

      <main className="px-10 pt-10 relative z-10 max-w-[1600px] mx-auto">
        {/* Filter Tabs */}
        <div className="flex gap-4 mb-10 overflow-x-auto pb-4 scrollbar-hide">
          {[
            { id: 'all', label: 'All Logs' },
            { id: 'pending', label: 'Pending' },
            { id: 'approved', label: 'Approved' },
            { id: 'rejected', label: 'Rejected' },
          ].map(option => (
            <button
              key={option.id}
              onClick={() => setFilter(option.id)}
              className={`px-8 py-4 rounded-full font-medium text-[10px] capitalize tracking-widest whitespace-nowrap transition-all duration-500 border ${filter === option.id
                ? 'bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-600/20 scale-105'
                : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50 shadow-sm'
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Settlements List */}
        {settlements.length === 0 ? (
          <div className="bg-white rounded-[48px] p-20 text-center border border-gray-100 shadow-sm">
            <div className="w-24 h-24 bg-gray-50 rounded-[32px] flex items-center justify-center mx-auto mb-10 border border-gray-100">
              <span className="text-4xl opacity-40">📜</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-3 capitalize tracking-tighter">History is Empty</h3>
            <p className="text-[9px] font-medium text-gray-400 capitalize tracking-[0.3em]">
              No settlement records found for this period
            </p>
          </div>
        ) : (
          <div className="space-y-6 pb-20">
            {settlements
              .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
              .map((settlement) => {
              const statusColors = getStatusColor(settlement.status);
              return (
                <div
                  key={settlement._id}
                  className="bg-white rounded-[40px] p-8 border border-gray-100 group hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-500 shadow-sm"
                >
                  <div className="flex items-start gap-6">
                    {/* Icon Box */}
                    <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center border transition-all duration-500 ${statusColors.bg} ${statusColors.border} ${statusColors.text}`}>
                      {getStatusIcon(settlement.status)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-gray-400">₹</span>
                          <p className="text-2xl font-medium text-gray-900 tracking-tighter">
                            {settlement.amount.toLocaleString()}
                          </p>
                        </div>
                        <span className={`text-[9px] font-medium px-4 py-1.5 rounded-xl capitalize tracking-widest border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                          {settlement.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mb-5">
                        <p className="text-[10px] font-medium text-gray-400 capitalize tracking-widest">
                          {settlement.paymentMethod === 'upi' ? 'UPI PROTOCOL' : 'WIRE PROTOCOL'}
                        </p>
                        {settlement.paymentReference && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-gray-200" />
                            <p className="text-[10px] font-medium text-blue-600 capitalize tracking-widest">
                              {settlement.paymentReference}
                            </p>
                          </>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-100">
                        <p className="text-[9px] font-medium text-gray-400 capitalize tracking-[0.2em]">
                          {formatDate(settlement.createdAt)}
                        </p>
                        <FiChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600 group-hover:translate-x-2 transition-all duration-500" />
                      </div>

                      {settlement.status === 'rejected' && settlement.rejectionReason && (
                        <div className="mt-6 p-5 bg-rose-50 rounded-2xl border border-rose-100">
                          <p className="text-[10px] font-medium text-rose-600 capitalize tracking-widest leading-relaxed">
                            <span className="opacity-50">Notice:</span> {settlement.rejectionReason}
                          </p>
                        </div>
                      )}

                      {settlement.adminNotes && (
                        <div className="mt-6 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                          <p className="text-[10px] font-medium text-gray-500 capitalize tracking-widest leading-relaxed">
                            <span className="opacity-50">Audit Note:</span> {settlement.adminNotes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            {Math.ceil(settlements.length / PAGE_SIZE) > 1 && (
              <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                <p className="text-[9px] font-medium text-gray-400 capitalize tracking-widest">
                  Page {currentPage} of {Math.ceil(settlements.length / PAGE_SIZE)} &bull; {settlements.length} records
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-6 py-3 rounded-2xl text-[9px] font-medium capitalize tracking-widest border border-gray-100 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(settlements.length / PAGE_SIZE), p + 1))}
                    disabled={currentPage === Math.ceil(settlements.length / PAGE_SIZE)}
                    className="px-6 py-3 rounded-2xl text-[9px] font-medium capitalize tracking-widest border border-blue-100 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default SettlementHistory;
