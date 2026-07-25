import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiSearch, FiLoader, FiCalendar, FiClock, FiUser, FiShoppingBag } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import CardShell from '../UserCategories/components/CardShell';
import { adminUserService } from '../../../../services/adminUserService';
import Modal from '../UserCategories/components/Modal';
import Pagination from '../../../../components/common/Pagination';

const UserBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const getDateRange = (filter) => {
    const today = new Date();
    const todayFormatted = today.toISOString().split('T')[0];

    if (filter === 'today') {
      return { startDate: todayFormatted, endDate: todayFormatted };
    }
    if (filter === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      return { startDate: yesterdayStr, endDate: yesterdayStr };
    }
    if (filter === 'last7') {
      const last7 = new Date(today);
      last7.setDate(last7.getDate() - 7);
      return { startDate: last7.toISOString().split('T')[0], endDate: todayFormatted };
    }
    if (filter === 'custom' && (customStartDate || customEndDate)) {
      return { startDate: customStartDate || undefined, endDate: customEndDate || undefined };
    }
    return { startDate: undefined, endDate: undefined };
  };

  const loadBookings = async (page = 1) => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDateRange(dateFilter);
      const params = {
        page,
        limit: pagination.limit,
        status: filterStatus === 'all' ? undefined : filterStatus,
        search: searchQuery || undefined,
        startDate,
        endDate,
        sortBy
      };
      const response = await adminUserService.getAllUserBookings(params);
      if (response.success) {
        setBookings(response.data);
        setPagination(response.pagination || { page, limit: 10, total: response.data.length, pages: 1 });
      }
    } catch (error) {
      console.error('Error loading user bookings:', error);
      toast.error('Failed to load user bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings(1);
  }, [filterStatus, searchQuery, dateFilter, customStartDate, customEndDate, sortBy]);

  const getStatusStyle = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      assigned: 'bg-indigo-100 text-indigo-800',
      journey_started: 'bg-orange-100 text-orange-800',
      visited: 'bg-purple-100 text-purple-800',
      in_progress: 'bg-purple-100 text-purple-800',
      work_done: 'bg-teal-100 text-teal-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return styles[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <CardShell icon={FiShoppingBag}>
        {/* Search, Status & Sort Bar */}
        <div className="flex flex-col lg:flex-row gap-3 mb-4">
          <div className="flex-1 relative">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
              <FiSearch className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by customer name, phone, email or service..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="assigned">Assigned</option>
              <option value="journey_started">On The Way</option>
              <option value="visited">Work Started</option>
              <option value="work_done">Work Done</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="price_high">Sort: Price High to Low</option>
              <option value="price_low">Sort: Price Low to High</option>
            </select>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50/70 p-3 rounded-2xl border border-gray-100 mb-6">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-bold text-gray-500 mr-1 flex items-center gap-1">
              <FiCalendar className="w-3.5 h-3.5" /> Date:
            </span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'last7', label: 'Last 7 Days' },
              { id: 'custom', label: 'Pick Date' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  dateFilter === f.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 animate-in fade-in duration-300">
              <input
                type="date"
                max={todayStr}
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
              <span className="text-xs text-gray-400 font-bold">to</span>
              <input
                type="date"
                max={todayStr}
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </div>
          )}
        </div>

        {/* Bookings List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="w-8 h-8 text-gray-400 animate-spin mr-3" />
              <span className="text-gray-600">Loading bookings...</span>
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No bookings found</div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {bookings.map((booking) => (
                <motion.div
                  key={booking._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow bg-white"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <FiShoppingBag className="text-blue-600 w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-gray-900">{booking.serviceId?.title || 'General Service'}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusStyle(booking.status)}`}>
                            {booking.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <FiUser className="w-4 h-4 text-blue-500" />
                            <span>Customer: <span className="font-medium text-gray-800">{booking.userId?.name}</span></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FiCalendar className="w-4 h-4" />
                            <span>Date: {booking.scheduledDate ? new Date(booking.scheduledDate).toLocaleDateString('en-GB') : 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FiUser className="w-4 h-4 text-green-500" />
                            <span>Worker: <span className="font-medium text-gray-800">{booking.workerId?.name || 'Pending Assignment'}</span></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FiClock className="w-4 h-4" />
                            <span>Slot: {booking.scheduledTime || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-lg font-bold text-gray-900">₹{booking.finalAmount}</div>
                      <button
                        onClick={() => {
                          setSelectedBooking(booking);
                          setIsModalOpen(true);
                        }}
                        className="text-sm text-blue-600 font-semibold hover:underline"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
        {/* Pagination Bar */}
        {!loading && bookings.length > 0 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            totalItems={pagination.total}
            pageSize={pagination.limit}
            onPageChange={(p) => loadBookings(p)}
            onPageSizeChange={(newLimit) => {
              setPagination(prev => ({ ...prev, limit: newLimit }));
            }}
            className="mt-6 border-t border-gray-100 pt-4"
          />
        )}
      </CardShell>

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
                  Date: <span className="font-semibold">{new Date(selectedBooking.createdAt).toLocaleString()}</span>
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
              {/* Left Column: Customer & Service Info */}
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
              </div>

              {/* Right Column: Worker & Vendor Info */}
              <div className="space-y-4">
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
            </div>

            {/* Financial Summary */}
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Financial Breakdown</h4>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
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
              </div>
            </div>

            {/* Modal Actions */}
            <div className="border-t border-gray-100 pt-4 flex justify-end">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedBooking(null);
                }}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-semibold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UserBookings;
