import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiSearch, FiLoader, FiCalendar, FiClock, FiUser, FiShoppingBag } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import CardShell from '../UserCategories/components/CardShell';
import { adminUserService } from '../../../../services/adminUserService';
import Modal from '../UserCategories/components/Modal';

const UserBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadBookings = async (page = 1) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: pagination.limit,
        status: filterStatus === 'all' ? undefined : filterStatus,
        search: searchQuery || undefined
      };
      // Note: We'll need to implement getAllUserBookings in adminUserService
      const response = await adminUserService.getAllUserBookings(params);
      if (response.success) {
        setBookings(response.data);
        setPagination(response.pagination);
      }
    } catch (error) {
      console.error('Error loading user bookings:', error);
      toast.error('Failed to load user bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, [filterStatus, searchQuery]);

  const getStatusStyle = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      ongoing: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <CardShell
        icon={FiShoppingBag}
      >
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
              <FiSearch className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by user name, phone or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
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

        {/* Pagination */}
        {!loading && pagination.pages > 1 && (
          <div className="flex justify-center items-center mt-8 gap-2">
            <button
              onClick={() => loadBookings(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-4 h-10 rounded-lg font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
            >
              Prev
            </button>
            {[...Array(pagination.pages)].map((_, i) => (
              <button
                key={i}
                onClick={() => loadBookings(i + 1)}
                className={`w-10 h-10 rounded-lg font-semibold transition-all ${pagination.page === i + 1
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => loadBookings(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
              className="px-4 h-10 rounded-lg font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
            >
              Next
            </button>
          </div>
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
