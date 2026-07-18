import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Modal from '../UserCategories/components/Modal';
import { adminBookingService } from '../../../../services/adminBookingService';
import {
  FiSearch,
  FiFilter,
  FiDownload,
  FiDollarSign,
  FiTrendingUp,
  FiTrendingDown,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiXCircle,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';
import { adminTransactionService } from '../../../../services/adminTransactionService';
import toast from 'react-hot-toast';
import { exportToCSV } from '../../../../utils/csvExport';

const PaymentOverview = () => {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalRefunds: 0,
    netRevenue: 0
  });

  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fetchingBooking, setFetchingBooking] = useState(false);

  const handleBookingClick = async (bookingId) => {
    try {
      setFetchingBooking(true);
      const toastId = toast.loading('Fetching booking details...');
      const res = await adminBookingService.getBookingById(bookingId);
      toast.dismiss(toastId);
      if (res.success && res.data) {
        setSelectedBooking(res.data);
        setIsModalOpen(true);
      } else {
        toast.error('Booking details not found');
      }
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error('Failed to load booking details');
    } finally {
      setFetchingBooking(false);
    }
  };

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    type: 'all'
  });

  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 500);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    fetchData();
  }, [pagination.page, pagination.limit, debouncedSearch, filters.status, filters.type]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch stats and transactions in parallel
      const [statsRes, transactionsRes] = await Promise.all([
        adminTransactionService.getTransactionStats(),
        adminTransactionService.getAllTransactions({
          page: pagination.page,
          limit: pagination.limit,
          search: debouncedSearch,
          status: filters.status,
          type: filters.type
        })
      ]);

      if (statsRes.success) {
        setStats(statsRes.data);
      }

      if (transactionsRes.success) {
        setTransactions(transactionsRes.data);
        setPagination(prev => ({
          ...prev,
          total: transactionsRes.pagination.total,
          pages: transactionsRes.pagination.pages
        }));
      }
    } catch (error) {
      console.error('Error fetching payment data:', error);
      toast.error('Failed to load payment data');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'failed': return 'bg-red-100 text-red-700';
      case 'refunded': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <FiCheckCircle className="w-3.5 h-3.5 mr-1" />;
      case 'pending': return <FiClock className="w-3.5 h-3.5 mr-1" />;
      case 'failed': return <FiXCircle className="w-3.5 h-3.5 mr-1" />;
      case 'refunded': return <FiAlertCircle className="w-3.5 h-3.5 mr-1" />;
      default: return null;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'credit': 
      case 'earnings_credit': 
        return 'text-green-600 bg-green-50 border-green-100';
      case 'payment': return 'text-blue-600 bg-blue-50 border-blue-100'; // Online Payment
      case 'cash_collected': return 'text-amber-600 bg-amber-50 border-amber-100'; // Cash
      case 'debit': return 'text-orange-600 bg-orange-50 border-orange-100';
      case 'refund': return 'text-purple-600 bg-purple-50 border-purple-100';
      default: return 'text-gray-600 bg-gray-50 border-gray-100';
    }
  };

  // Export transactions to CSV
  const handleExport = () => {
    if (!transactions || transactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }
    exportToCSV(transactions, 'payment_transactions', [
      { key: '_id', label: 'Transaction ID' },
      { key: 'userId.name', label: 'User Name' },
      { key: 'userId.phone', label: 'Phone' },
      { key: 'userId.email', label: 'Email' },
      { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Amount', type: 'currency' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Date', type: 'datetime' },
      { key: 'razorpayOrderId', label: 'Razorpay Order ID' },
      { key: 'referenceId', label: 'Reference ID' },
      { key: 'description', label: 'Description' }
    ]);
  };

  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    
    if (pagination.pages <= maxVisiblePages) {
      for (let i = 1; i <= pagination.pages; i++) {
        pageNumbers.push(i);
      }
    } else {
      let startPage = Math.max(1, pagination.page - 2);
      let endPage = Math.min(pagination.pages, pagination.page + 2);
      
      if (startPage === 1) {
        endPage = maxVisiblePages;
      } else if (endPage === pagination.pages) {
        startPage = pagination.pages - maxVisiblePages + 1;
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
    }
    return pageNumbers;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Revenue</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(stats.totalRevenue)}</h3>
          </div>
          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
            <FiDollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Refunds</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(stats.totalRefunds)}</h3>
          </div>
          <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
            <FiTrendingDown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Net Revenue</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(stats.netRevenue)}</h3>
          </div>
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <FiTrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-64">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>

          <select
            value={filters.type}
            onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Types</option>
            <option value="credit">Credit (Platform)</option>
            <option value="debit">Debit (Wallet)</option>
            <option value="payment">Online Payment</option>
            <option value="cash_collected">Cash Collected</option>
          </select>

          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 flex items-center gap-2 transition-colors"
          >
            <FiDownload className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaction ID</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User / Entity</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ref ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                      <p className="text-sm">Loading transactions...</p>
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-gray-500">
                    <p className="text-sm">No transactions found</p>
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const bookingIdVal = tx.bookingId?._id || tx.bookingId;
                  const isClickable = !!tx.bookingId;
                  const idStr = isClickable && (typeof bookingIdVal === 'object' ? bookingIdVal._id : bookingIdVal);

                  return (
                    <tr 
                      key={tx._id} 
                      onClick={() => {
                        if (isClickable && idStr) {
                          handleBookingClick(idStr);
                        }
                      }}
                      className={`transition-colors ${isClickable ? 'cursor-pointer hover:bg-gray-50/80' : ''}`}
                    >
                    <td className="py-3 px-4">
                      <span className="text-xs font-mono text-gray-500">#{tx._id.slice(-6).toUpperCase()}</span>
                    </td>
                    <td className="py-3 px-4">
                      {(() => {
                        const isVendorType = ['cash_collected', 'earnings_credit', 'withdrawal', 'settlement', 'tds_deduction', 'penalty'].includes(tx.type);
                        
                        let primaryEntity = null;
                        let secondaryEntity = null;
                        let badge = null;
                        
                        if (isVendorType) {
                          if (tx.vendorId) {
                            primaryEntity = tx.vendorId;
                            badge = <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-medium">Vendor</span>;
                            secondaryEntity = tx.userId || tx.bookingId?.userId;
                          } else if (tx.workerId) {
                            primaryEntity = tx.workerId;
                            badge = <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded font-medium">Worker</span>;
                            secondaryEntity = tx.userId || tx.bookingId?.userId;
                          } else if (tx.userId) {
                            primaryEntity = tx.userId;
                            badge = <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-medium">User</span>;
                          }
                        } else {
                          if (tx.userId) {
                            primaryEntity = tx.userId;
                            badge = <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-medium">User</span>;
                            secondaryEntity = tx.vendorId || tx.workerId;
                          } else if (tx.vendorId) {
                            primaryEntity = tx.vendorId;
                            badge = <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-medium">Vendor</span>;
                          } else if (tx.workerId) {
                            primaryEntity = tx.workerId;
                            badge = <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded font-medium">Worker</span>;
                          }
                        }

                        const name = primaryEntity?.businessName || primaryEntity?.name || 'Unknown';
                        const email = primaryEntity?.email || '';

                        // Determine secondary role and name if present
                        let secondaryText = '';
                        if (secondaryEntity) {
                          const secondaryName = secondaryEntity.businessName || secondaryEntity.name;
                          if (secondaryName) {
                            const label = isVendorType ? 'Customer' : 'Vendor';
                            secondaryText = `${label}: ${secondaryName}`;
                          }
                        }

                        return (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-800">{name}</span>
                              {badge}
                            </div>
                            <span className="text-xs text-gray-400">{email}</span>
                            {secondaryText && (
                              <span className="text-[10px] text-gray-500 font-medium mt-0.5 bg-gray-100 px-1.5 py-0.5 rounded w-max">
                                {secondaryText}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getTypeColor(tx.type)}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-sm font-semibold ${['credit', 'payment', 'cash_collected', 'earnings_credit'].includes(tx.type) ? 'text-green-600' : 'text-gray-800'}`}>
                        {['credit', 'payment', 'cash_collected', 'earnings_credit'].includes(tx.type) ? '+' : '-'}{formatCurrency(tx.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(tx.status)}`}>
                        {getStatusIcon(tx.status)}
                        <span className="capitalize">{tx.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-500">{formatDate(tx.createdAt)}</span>
                    </td>
                    <td className="py-3 px-4">
                      {(() => {
                        const ref = tx.referenceId || tx.bookingId?.bookingNumber || tx.razorpayOrderId;
                        if (!ref) return <span className="text-gray-300">-</span>;
                        
                        if (isClickable) {
                          return (
                            <span 
                              className="text-xs text-blue-600 font-mono hover:underline font-semibold"
                              title={`View Booking Details: ${ref}`}
                            >
                              {ref.length > 12 ? `${ref.slice(0, 10)}...` : ref}
                            </span>
                          );
                        }

                        return (
                          <span className="text-xs text-gray-500 font-mono" title={ref}>
                            {ref.length > 12 ? `${ref.slice(0, 10)}...` : ref}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && transactions.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 flex flex-col sm:flex-row gap-3 items-center justify-between bg-gray-50 rounded-b-xl">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="text-xs text-gray-500">
                Showing <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> to <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-medium">{pagination.total}</span> results
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span>Show</span>
                <select
                  value={pagination.limit}
                  onChange={(e) => {
                    setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }));
                  }}
                  className="border border-gray-200 rounded-lg px-2 py-0.5 bg-white font-medium text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>entries</span>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-1.5 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Previous Page"
              >
                <FiChevronLeft className="w-4 h-4" />
              </button>
              
              {getPageNumbers().map((num) => (
                <button
                  key={num}
                  onClick={() => handlePageChange(num)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    pagination.page === num
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {num}
                </button>
              ))}

              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="p-1.5 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Next Page"
              >
                <FiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Booking Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedBooking(null);
        }}
        title="Booking Details"
        size="md"
      >
        {selectedBooking && (
          <div className="space-y-6">
            {/* Booking Header Info */}
            <div className="flex justify-between items-start border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedBooking.serviceId?.title || 'General Service'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Booking ID: <span className="font-mono font-semibold">{selectedBooking.bookingNumber || selectedBooking._id}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Date: <span className="font-semibold">{selectedBooking.scheduledDate ? new Date(selectedBooking.scheduledDate).toLocaleDateString('en-GB') : 'N/A'}</span>
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                ${selectedBooking.status === 'completed' ? 'bg-green-100 text-green-700' :
                  selectedBooking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                  selectedBooking.status === 'in_progress' ? 'bg-purple-100 text-purple-700' :
                  'bg-yellow-100 text-yellow-700'}`}
              >
                {selectedBooking.status?.toUpperCase()}
              </span>
            </div>

            {/* Core Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Customer, Schedule & Payment Info */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Customer Details</h4>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
                    <p className="font-semibold text-gray-800">{selectedBooking.userId?.name || 'Verified Customer'}</p>
                    <p className="text-gray-600">{selectedBooking.userId?.phone || selectedBooking.customerPhone || 'No Phone'}</p>
                    <p className="text-gray-600 truncate">{selectedBooking.userId?.email || 'No Email'}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Schedule Details</h4>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
                    <p className="text-gray-600">
                      Service Date: <span className="font-semibold text-gray-800">{selectedBooking.scheduledDate ? new Date(selectedBooking.scheduledDate).toLocaleDateString('en-GB') : 'N/A'}</span>
                    </p>
                    <p className="text-gray-600">
                      Time Slot: <span className="font-semibold text-gray-800">{selectedBooking.scheduledTime || 'N/A'}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Payment Info</h4>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
                    <p className="text-gray-600">
                      Method: <span className="font-semibold text-gray-800 capitalize">{selectedBooking.paymentMethod?.replace('_', ' ') || 'COD'}</span>
                    </p>
                    <p className="text-gray-600">
                      Status: <span className={`font-semibold capitalize ${selectedBooking.paymentStatus === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>{selectedBooking.paymentStatus || 'Pending'}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Vendor & Worker Info */}
              <div className="space-y-4">
                {selectedBooking.vendorId && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Vendor Details</h4>
                    <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
                      <p className="font-semibold text-gray-800">{selectedBooking.vendorId.businessName || selectedBooking.vendorId.name || 'Verified Vendor'}</p>
                      <p className="text-gray-600">{selectedBooking.vendorId.phone || 'No Phone'}</p>
                      <p className="text-gray-600 truncate">{selectedBooking.vendorId.email || 'No Email'}</p>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Service Execution</h4>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
                    <p className="text-gray-600">
                      Assigned Worker: <span className="font-semibold text-gray-800">{selectedBooking.workerId?.name || 'Pending Assignment'}</span>
                    </p>
                    {selectedBooking.workerId?.phone && (
                      <p className="text-gray-600">
                        Worker Phone: <span className="font-semibold text-gray-800">{selectedBooking.workerId.phone}</span>
                      </p>
                    )}
                    <p className="text-gray-600 mt-1 border-t border-gray-200/60 pt-1.5">
                      Assigned Vendor: <span className="font-semibold text-gray-800">{selectedBooking.vendorId?.businessName || selectedBooking.vendorId?.name || 'Unassigned'}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Financial Breakdown</h4>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                {selectedBooking.vendorBillId ? (
                  // Display details from the VendorBill (Single Source of Truth)
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>Service Base</span>
                      <span>₹{selectedBooking.vendorBillId.totalServiceBase}</span>
                    </div>
                    {selectedBooking.vendorBillId.totalPartsBase > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Parts Base</span>
                        <span>₹{selectedBooking.vendorBillId.totalPartsBase}</span>
                      </div>
                    )}
                    {selectedBooking.vendorBillId.totalGST > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>GST (Tax)</span>
                        <span>₹{selectedBooking.vendorBillId.totalGST}</span>
                      </div>
                    )}
                    {selectedBooking.vendorBillId.transportCharges !== 0 && (
                      <div className={`flex justify-between ${selectedBooking.vendorBillId.transportCharges < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                        <span>Transport / Discounts</span>
                        <span>{selectedBooking.vendorBillId.transportCharges < 0 ? '-' : '+'}₹{Math.abs(selectedBooking.vendorBillId.transportCharges)}</span>
                      </div>
                    )}
                    {selectedBooking.vendorBillId.visitingCharges > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Visiting Charges</span>
                        <span>₹{selectedBooking.vendorBillId.visitingCharges}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
                      <span>Final Amount</span>
                      <span>₹{selectedBooking.vendorBillId.grandTotal}</span>
                    </div>

                    {/* Split Details (Admin vs Vendor) */}
                    <div className="border-t border-gray-200 pt-2 mt-2 space-y-1.5 text-xs">
                      <div className="flex justify-between text-blue-600 font-medium">
                        <span>Vendor Earnings (Split)</span>
                        <span>₹{selectedBooking.vendorBillId.vendorTotalEarning?.toFixed(2)}</span>
                      </div>
                      
                      <div className="border-t border-gray-100 my-1 pt-1 space-y-1 text-gray-500">
                        <div className="flex justify-between">
                          <span>Platform Commission (Fee)</span>
                          <span>₹{(selectedBooking.vendorBillId.companyRevenue - selectedBooking.vendorBillId.totalGST).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>GST (Collected for Filing)</span>
                          <span>₹{selectedBooking.vendorBillId.totalGST?.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="flex justify-between text-indigo-700 font-bold border-t border-gray-100 pt-1">
                        <span>Total Admin/Platform Share</span>
                        <span>₹{selectedBooking.vendorBillId.companyRevenue?.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Cash Collected details */}
                    {['cash', 'cash collected', 'hand_to_hand'].includes(selectedBooking.paymentMethod?.toLowerCase()) && (
                      <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between text-amber-700 font-semibold text-xs bg-amber-50/50 p-2 rounded-lg">
                        <span>Actual Cash Collected</span>
                        <span>₹{selectedBooking.vendorBillId.grandTotal}</span>
                      </div>
                    )}
                  </>
                ) : (
                  // Fallback to standard booking values if no VendorBill exists
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>₹{selectedBooking.subTotal || selectedBooking.finalAmount}</span>
                    </div>
                    {selectedBooking.gstAmount > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>GST</span>
                        <span>₹{selectedBooking.gstAmount}</span>
                      </div>
                    )}
                    {selectedBooking.discountAmount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Coupon Discount</span>
                        <span>-₹{selectedBooking.discountAmount}</span>
                      </div>
                    )}
                    {selectedBooking.penaltyAmount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Cancellation / Delay Penalty</span>
                        <span>+₹{selectedBooking.penaltyAmount}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
                      <span>Final Amount</span>
                      <span>₹{selectedBooking.finalAmount}</span>
                    </div>
                  </>
                )}
              </div>
            </div>


          </div>
        )}
      </Modal>
    </motion.div>
  );
};

export default PaymentOverview;