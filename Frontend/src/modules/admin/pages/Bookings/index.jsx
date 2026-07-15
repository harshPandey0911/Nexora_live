import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { CustomDateInput } from '../../../../components/common';
import {
  FiSearch, FiCalendar, FiDownload, FiMoreVertical,
  FiClock, FiCheckCircle, FiBox, FiTruck, FiXCircle, FiRefreshCw, FiShoppingBag,
  FiUser
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { adminBookingService } from '../../../../services/adminBookingService';
import { getDashboardStats } from '../../../../services/adminDashboardService';
import Modal from '../UserCategories/components/Modal';

/**
 * Custom date input that always displays in dd/mm/yyyy format.
 * - Typing: accepts dd/mm/yyyy text, fires onChange when complete.
 * - Calendar icon: opens native date picker, which also fires onChange.
 * - Uses uncontrolled text input (key resets it when value changes externally).
 */


const BookingStatsCard = ({ title, count, icon: Icon, colorClass, bgClass, onClick }) => (
  <div
    onClick={onClick}
    className={`p-3 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between ${bgClass} cursor-pointer transition-all hover:scale-[1.02] active:scale-95`}
  >
    <div>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${colorClass.replace('text-', 'bg-').replace('600', '100')}`}>
        <Icon className={`w-4 h-4 ${colorClass}`} />
      </div>
      <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">{title}</h3>
      <p className="text-xl font-bold text-gray-800 mt-0.5">{count}</p>
    </div>
    <div className={`w-12 h-12 rounded-full opacity-10 -mr-3 -mb-3 ${colorClass.replace('text-', 'bg-')}`}></div>
  </div>
);

const formatDateWithTime = (dateInput) => {
  if (!dateInput) return 'N/A';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'N/A';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const timeStr = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  
  return `${day}/${month}/${year}, ${timeStr}`;
};

const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Today's date in YYYY-MM-DD format (used to block future dates)
  const todayStr = new Date().toISOString().split('T')[0];

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    confirmed: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    total: 0
  });

  const navigate = useNavigate();
  const { id } = useParams();
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Auto-open booking details modal if ID is in the URL
  useEffect(() => {
    if (id && id !== 'tracking' && id !== 'notifications') {
      const found = bookings.find(b => b._id === id);
      if (found) {
        setSelectedBooking(found);
        setIsModalOpen(true);
      } else {
        const fetchSingleBooking = async () => {
          try {
            const res = await adminBookingService.getBookingById(id);
            if (res.success && res.data) {
              setSelectedBooking(res.data);
              setIsModalOpen(true);
            } else {
              toast.error('Booking not found');
            }
          } catch (err) {
            console.error('Error fetching booking details:', err);
            toast.error('Failed to load booking details');
          }
        };
        fetchSingleBooking();
      }
    }
  }, [id, bookings]);

  // Close dropdown on click outside
  useEffect(() => {
    const closeDropdown = () => setActiveDropdownId(null);
    document.addEventListener('click', closeDropdown);
    return () => document.removeEventListener('click', closeDropdown);
  }, []);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Load Data
  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Bookings
      const params = {
        page,
        limit: 10,
        search: debouncedSearch,
        startDate,
        endDate
      };
      if (statusFilter !== 'All Status') {
        params.status = statusFilter;
      }

      const res = await adminBookingService.getAllBookings(params);
      if (res.success) {
        setBookings(res.data);
        setTotalPages(res.pagination.pages);
      }

      // 2. Fetch Stats (only if not already fetched or if total is 0)
      if (stats.total === 0) {
        const statsRes = await getDashboardStats();
        if (statsRes.success) {
          const s = statsRes.data.stats;
          setStats({
            pending: s.pendingBookings || 0,
            confirmed: 0,
            inProgress: 0,
            completed: s.completedBookings || 0,
            cancelled: s.cancelledBookings || 0,
            total: s.totalBookings || 0
          });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, debouncedSearch, statusFilter, startDate, endDate]);

  const handleExport = () => {
    const headers = ['Order ID', 'Customer', 'Service', 'Total', 'Status', 'Date'];
    const rows = bookings.map(b => [
      b.bookingNumber,
      b.userId?.name || 'Unknown',
      b.serviceId?.title || 'Service',
      b.finalAmount,
      b.status,
      new Date(b.createdAt).toLocaleDateString('en-GB')
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "bookings.csv");
    document.body.appendChild(link);
    link.click();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <BookingStatsCard title="Awaiting" count={stats.pending} icon={FiClock} bgClass="bg-yellow-50" colorClass="text-yellow-600" onClick={() => { setStatusFilter('pending'); setPage(1); }} />
        <BookingStatsCard title="Confirmed" count={stats.pending} icon={FiCheckCircle} bgClass="bg-blue-50" colorClass="text-blue-600" onClick={() => { setStatusFilter('confirmed'); setPage(1); }} />
        <BookingStatsCard title="In Progress" count={stats.inProgress} icon={FiBox} bgClass="bg-purple-50" colorClass="text-purple-600" onClick={() => { setStatusFilter('in_progress'); setPage(1); }} />
        <BookingStatsCard title="Completed" count={stats.completed} icon={FiTruck} bgClass="bg-green-50" colorClass="text-green-600" onClick={() => { setStatusFilter('completed'); setPage(1); }} />
        <BookingStatsCard title="Delivered" count={stats.completed} icon={FiCheckCircle} bgClass="bg-emerald-50" colorClass="text-emerald-600" onClick={() => { setStatusFilter('delivered'); setPage(1); }} />
        <BookingStatsCard title="Cancelled" count={stats.cancelled} icon={FiXCircle} bgClass="bg-red-50" colorClass="text-red-600" onClick={() => { setStatusFilter('cancelled'); setPage(1); }} />
        <BookingStatsCard title="Returned" count={0} icon={FiRefreshCw} bgClass="bg-orange-50" colorClass="text-orange-600" onClick={() => { setStatusFilter('All Status'); setPage(1); }} />
        <BookingStatsCard title="Total Orders" count={stats.total} icon={FiShoppingBag} bgClass="bg-gray-50" colorClass="text-gray-600" onClick={() => { setStatusFilter('All Status'); setPage(1); }} />
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-3 justify-between items-center">
        <div className="relative w-full lg:w-80">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search bookings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:border-green-500 cursor-pointer"
          >
            <option>All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_progress">In Progress</option>
            <option value="work_done">Work Done</option>
            <option value="completed">Completed</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
            <FiCalendar className="w-3.5 h-3.5 text-gray-400 mr-0.5" />
            <CustomDateInput
              value={startDate}
              max={endDate || todayStr}
              onChange={(val) => {
                setStartDate(val);
                if (endDate && val > endDate) setEndDate(val);
              }}
              placeholder="dd/mm/yyyy"
              showIcon={false}
            />
            <span className="text-gray-400 text-[10px]">to</span>
            <CustomDateInput
              value={endDate}
              min={startDate || undefined}
              max={todayStr}
              onChange={(val) => {
                setEndDate(val);
                if (startDate && val < startDate) setStartDate(val);
              }}
              placeholder="dd/mm/yyyy"
              showIcon={false}
            />
          </div>

          {(search || statusFilter !== 'All Status' || startDate || endDate) && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('All Status');
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-lg transition-colors border border-gray-200"
            >
              Clear Filters
            </button>
          )}

          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm shadow-green-200"
          >
            <FiDownload className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Order ID</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Items</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total (₹)</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Payment</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Order Date</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-xs text-gray-500">Loading bookings...</td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-xs text-gray-500">No bookings found</td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-bold text-gray-900 text-xs">#{booking.bookingNumber || booking._id.slice(-6).toUpperCase()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-bold text-gray-900 text-xs">{booking.userId?.name || 'Guest'}</p>
                        <p className="text-[10px] text-gray-400">{booking.userId?.phone || booking.customerPhone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-blue-600 text-[11px] font-bold">
                        {booking.items?.length || 1} items
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-gray-900 text-xs">₹{booking.finalAmount?.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider
                            ${booking.status === 'completed' ? 'bg-green-100 text-green-700' :
                          booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            booking.status === 'in_progress' ? 'bg-purple-100 text-purple-700' :
                              'bg-yellow-100 text-yellow-700'}`}>
                        {booking.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] text-gray-600 capitalize font-medium">{booking.paymentMethod?.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] text-gray-600 font-medium">
                        {formatDateWithTime(booking.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdownId(activeDropdownId === booking._id ? null : booking._id);
                        }}
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <FiMoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {activeDropdownId === booking._id && (
                        <div className="absolute right-4 mt-1 w-44 bg-white border border-gray-100 rounded-xl shadow-lg py-1.5 z-50 text-left">
                          <button
                            onClick={() => {
                              setSelectedBooking(booking);
                              setIsModalOpen(true);
                              setActiveDropdownId(null);
                            }}
                            className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer font-semibold"
                          >
                            <FiShoppingBag className="w-3.5 h-3.5 text-blue-500" />
                            View Details
                          </button>
                          <button
                            onClick={() => {
                              navigate(`/admin/bookings/tracking?id=${booking._id}`);
                              setActiveDropdownId(null);
                            }}
                            className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer font-semibold"
                          >
                            <FiTruck className="w-3.5 h-3.5 text-green-500" />
                            Track Booking
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!loading && bookings.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/30 flex-wrap gap-2">
            {/* Entry count */}
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
              Showing {((page - 1) * 10) + 1}–{Math.min(page * 10, stats.total)} of {stats.total} entries
            </p>

            {/* Page buttons */}
            <div className="flex items-center gap-1">
              {/* First page */}
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 disabled:opacity-40 hover:bg-white transition-all"
                title="First page"
              >
                «
              </button>

              {/* Prev */}
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 disabled:opacity-40 hover:bg-white transition-all"
              >
                Prev
              </button>

              {/* Page number buttons with ellipsis */}
              {(() => {
                const pages = [];
                const delta = 2;
                const left = Math.max(2, page - delta);
                const right = Math.min(totalPages - 1, page + delta);

                // Always show page 1
                pages.push(
                  <button
                    key={1}
                    onClick={() => setPage(1)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold border transition-all ${page === 1 ? 'bg-green-500 text-white border-green-500 shadow-sm shadow-green-200' : 'border-gray-200 text-gray-600 hover:bg-white'}`}
                  >1</button>
                );

                // Left ellipsis
                if (left > 2) {
                  pages.push(<span key="left-ellipsis" className="text-gray-400 text-xs px-0.5">…</span>);
                }

                // Middle pages
                for (let i = left; i <= right; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold border transition-all ${page === i ? 'bg-green-500 text-white border-green-500 shadow-sm shadow-green-200' : 'border-gray-200 text-gray-600 hover:bg-white'}`}
                    >{i}</button>
                  );
                }

                // Right ellipsis
                if (right < totalPages - 1) {
                  pages.push(<span key="right-ellipsis" className="text-gray-400 text-xs px-0.5">…</span>);
                }

                // Always show last page (if more than 1 page)
                if (totalPages > 1) {
                  pages.push(
                    <button
                      key={totalPages}
                      onClick={() => setPage(totalPages)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold border transition-all ${page === totalPages ? 'bg-green-500 text-white border-green-500 shadow-sm shadow-green-200' : 'border-gray-200 text-gray-600 hover:bg-white'}`}
                    >{totalPages}</button>
                  );
                }

                return pages;
              })()}

              {/* Next */}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 disabled:opacity-40 hover:bg-white transition-all"
              >
                Next
              </button>

              {/* Last page */}
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 disabled:opacity-40 hover:bg-white transition-all"
                title="Last page"
              >
                »
              </button>
            </div>
          </div>
        )}

      </div>
    </motion.div>

    {/* Booking Details Modal */}
    <Modal
      isOpen={isModalOpen}
      onClose={() => {
        setIsModalOpen(false);
        setSelectedBooking(null);
        if (id) navigate('/admin/bookings');
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
                if (id) navigate('/admin/bookings');
              }}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-semibold rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
    </>
  );
};

export default Bookings;
