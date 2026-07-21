import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiClock, FiUser, FiMapPin, FiCheckCircle, FiXCircle, FiUserCheck,
  FiRefreshCw, FiAlertCircle, FiTool, FiNavigation, FiPackage, FiChevronRight, FiSearch
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { adminBookingService } from '../../../../services/adminBookingService';
import adminVendorService from '../../../../services/adminVendorService';
import useScrollLock from '../../../../hooks/useScrollLock';
import AdminVendorProfileModal from '../../components/common/AdminVendorProfileModal';

// ─────────────────────────────────────────────
// Status config for full lifecycle display
// ─────────────────────────────────────────────
const getStatusConfig = (booking) => {
  const s = booking.status?.toLowerCase();
  const adminStatus = booking.adminAssignmentStatus;

  if (s === 'escalated' && !booking.assignedByAdmin) {
    return {
      label: 'Needs Assignment',
      sub: 'No vendor assigned yet',
      badgeClass: 'bg-orange-50 text-orange-700 border-orange-100',
      dotClass: 'bg-orange-500 animate-ping',
      icon: FiAlertCircle,
      iconColor: 'text-orange-500',
      priority: 'urgent'
    };
  }
  if (s === 'escalated' && booking.assignedByAdmin) {
    return {
      label: adminStatus === 'DECLINED' ? 'Vendor Declined' : 'Needs Reassignment',
      sub: adminStatus === 'DECLINED' ? 'Choose a different vendor' : 'Previous vendor did not respond',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-100',
      dotClass: 'bg-rose-500 animate-ping',
      icon: FiXCircle,
      iconColor: 'text-rose-500',
      priority: 'urgent'
    };
  }
  if (s === 'requested') {
    return {
      label: 'Awaiting Acceptance',
      sub: 'Vendor notified, waiting for response',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-100',
      dotClass: 'bg-blue-500 animate-ping',
      icon: FiClock,
      iconColor: 'text-blue-500',
      priority: 'waiting'
    };
  }
  if (s === 'confirmed' || s === 'awaiting_payment') {
    return {
      label: 'Vendor Accepted ✓',
      sub: adminStatus === 'ACCEPTED' ? `Accepted by ${booking.vendorId?.businessName || booking.vendorId?.name || 'Vendor'}` : 'Booking confirmed',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      dotClass: 'bg-emerald-500',
      icon: FiCheckCircle,
      iconColor: 'text-emerald-500',
      priority: 'ok'
    };
  }
  if (s === 'assigned') {
    return {
      label: 'Worker Assigned',
      sub: `Worker: ${booking.workerId?.name || 'Assigned'}`,
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      dotClass: 'bg-indigo-500',
      icon: FiUser,
      iconColor: 'text-indigo-500',
      priority: 'active'
    };
  }
  if (s === 'journey_started') {
    return {
      label: 'Worker En Route',
      sub: 'Worker heading to customer',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-100',
      dotClass: 'bg-sky-500 animate-ping',
      icon: FiNavigation,
      iconColor: 'text-sky-500',
      priority: 'active'
    };
  }
  if (s === 'visited') {
    return {
      label: 'Worker Arrived',
      sub: 'At customer location',
      badgeClass: 'bg-teal-50 text-teal-700 border-teal-100',
      dotClass: 'bg-teal-500',
      icon: FiMapPin,
      iconColor: 'text-teal-500',
      priority: 'active'
    };
  }
  if (s === 'in_progress') {
    return {
      label: 'Work In Progress',
      sub: 'Service being performed',
      badgeClass: 'bg-violet-50 text-violet-700 border-violet-100',
      dotClass: 'bg-violet-500 animate-ping',
      icon: FiTool,
      iconColor: 'text-violet-500',
      priority: 'active'
    };
  }
  if (s === 'work_done') {
    return {
      label: 'Work Completed',
      sub: 'Awaiting payment/confirmation',
      badgeClass: 'bg-green-50 text-green-700 border-green-100',
      dotClass: 'bg-green-500',
      icon: FiPackage,
      iconColor: 'text-green-500',
      priority: 'done'
    };
  }
  return {
    label: booking.status || 'Unknown',
    sub: '',
    badgeClass: 'bg-gray-50 text-gray-700 border-gray-100',
    dotClass: 'bg-gray-400',
    icon: FiClock,
    iconColor: 'text-gray-400',
    priority: 'unknown'
  };
};

// Priority order for sorting (urgent first)
const PRIORITY_ORDER = { urgent: 0, waiting: 1, active: 2, ok: 3, done: 4, unknown: 5 };

const DeclineHistoryDropdown = ({ activityLog, title = "Previously Declined By", onSelectVendor }) => {
  const [isOpen, setIsOpen] = useState(false);
  const declines = activityLog?.filter(a => a.action === 'Vendor Rejected') || [];

  if (declines.length === 0) return null;

  const latest = declines[declines.length - 1];

  const renderVendorName = (act) => {
    const vId = act.actorId?._id || act.actorId || act.details?.vendorId;
    const vName = act.details?.vendorName || act.actorId?.businessName || act.actorId?.name || 'Vendor';
    if (vId && onSelectVendor) {
      return (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSelectVendor(vId); }}
          className="font-bold underline text-rose-900 hover:text-blue-700 cursor-pointer"
        >
          {vName} ↗
        </button>
      );
    }
    return <span className="font-bold text-rose-900">{vName}</span>;
  };

  return (
    <div className="bg-rose-50/70 border border-rose-100 rounded-xl overflow-hidden text-xs transition-all mt-2">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="w-full p-2.5 flex items-center justify-between font-bold text-rose-700 hover:bg-rose-100/50 transition-colors text-[10px] uppercase tracking-wider cursor-pointer"
      >
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          {title} ({declines.length})
        </span>
        <span className="flex items-center gap-1 text-[9px] text-rose-500 font-semibold bg-rose-100/80 px-2 py-0.5 rounded-full">
          {isOpen ? 'Hide ▲' : 'View All ▼'}
        </span>
      </button>

      {!isOpen ? (
        <div className="px-2.5 pb-2 text-[11px] text-rose-900 flex items-center justify-between gap-2 border-t border-rose-100/40 pt-1.5">
          <span className="truncate">
            • {renderVendorName(latest)}: <span className="italic text-rose-700/80">"{latest.note}"</span>
          </span>
          <span className="text-[9px] text-rose-400 shrink-0 font-semibold">
            {new Date(latest.timestamp).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ) : (
        <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-rose-100/40 pt-1.5 max-h-36 overflow-y-auto">
          {declines.map((act, i) => (
            <div key={i} className="text-[11px] text-rose-900 flex items-center justify-between gap-2 border-b border-rose-100/30 last:border-0 pb-1 last:pb-0">
              <span className="truncate">
                • {renderVendorName(act)}: <span className="italic text-rose-700/80">"{act.note}"</span>
              </span>
              <span className="text-[9px] text-rose-400 shrink-0 font-semibold">
                {new Date(act.timestamp).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ManualAssignment = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 9;

  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [viewingVendorId, setViewingVendorId] = useState(null);

  // Lock background scroll when assign or vendor profile modal is active
  useScrollLock(showAssignModal || !!viewingVendorId);

  const fetchEscalatedBookings = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params = { page: 1, limit: 100, status: 'MANUAL_ASSIGNMENT' };
      const res = await adminBookingService.getAllBookings(params);
      if (res.success) {
        // Sort: urgent (escalated) → waiting (requested) → active → done
        const sorted = (res.data || []).sort((a, b) => {
          const ca = getStatusConfig(a);
          const cb = getStatusConfig(b);
          return (PRIORITY_ORDER[ca.priority] ?? 5) - (PRIORITY_ORDER[cb.priority] ?? 5);
        });
        setBookings(sorted);
        setLastRefreshed(new Date());
      }
    } catch (e) {
      console.error(e);
      if (!silent) toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEscalatedBookings();
  }, [fetchEscalatedBookings]);

  // Listen to global admin socket events (from AdminLayout)
  useEffect(() => {
    const refresh = () => fetchEscalatedBookings(true);
    window.addEventListener('adminBookingAssigned', refresh);
    window.addEventListener('adminBookingStatusChanged', refresh);
    return () => {
      window.removeEventListener('adminBookingAssigned', refresh);
      window.removeEventListener('adminBookingStatusChanged', refresh);
    };
  }, [fetchEscalatedBookings]);

  // Polling: every 8s for real-time status updates
  useEffect(() => {
    const poll = setInterval(() => fetchEscalatedBookings(true), 8000);
    return () => clearInterval(poll);
  }, [fetchEscalatedBookings]);

  const openAssignModal = async (booking) => {
    setSelectedBooking(booking);
    setShowAssignModal(true);
    setVendorsLoading(true);
    try {
      const res = await adminVendorService.getAllVendors({ status: 'approved' });
      if (res.success) setVendors(res.data || []);
    } catch (e) {
      toast.error('Failed to load vendors');
    } finally {
      setVendorsLoading(false);
    }
  };

  const handleAssignVendor = async (vendorId) => {
    try {
      const res = await adminBookingService.assignVendor(selectedBooking._id, vendorId);
      if (res.success) {
        toast.success('Vendor assigned! They have 30 minutes to accept.');
        setShowAssignModal(false);
        fetchEscalatedBookings();
      }
    } catch (e) {
      toast.error(e.message || 'Failed to assign vendor');
    }
  };

  // Filter by search query
  const filteredBookings = bookings.filter(b => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.bookingNumber?.toLowerCase().includes(q) ||
      b.userId?.name?.toLowerCase().includes(q) ||
      b.userId?.phone?.includes(q) ||
      b.serviceId?.title?.toLowerCase().includes(q)
    );
  });

  // Group filtered bookings by status priority for section headers
  const urgentBookings = filteredBookings.filter(b => getStatusConfig(b).priority === 'urgent');
  const waitingBookings = filteredBookings.filter(b => getStatusConfig(b).priority === 'waiting');
  const activeBookings = filteredBookings.filter(b => getStatusConfig(b).priority === 'active');
  const completedBookings = filteredBookings.filter(b => ['ok', 'done'].includes(getStatusConfig(b).priority));

  // Paginate all filtered bookings
  const totalPages = Math.ceil(filteredBookings.length / PAGE_SIZE);
  const paginatedBookings = filteredBookings.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Manual Booking Assignment</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Bookings requiring manual vendor allocation • Tracking full lifecycle
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search Field */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by customer, ID or service..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-60"
            />
          </div>
          {lastRefreshed && (
            <span className="text-[10px] text-gray-400">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchEscalatedBookings()}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
            title="Refresh"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {!loading && bookings.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Needs Assignment', count: urgentBookings.length, color: 'border-orange-200 bg-orange-50', textColor: 'text-orange-700' },
            { label: 'Awaiting Response', count: waitingBookings.length, color: 'border-blue-200 bg-blue-50', textColor: 'text-blue-700' },
            { label: 'Active / In Progress', count: activeBookings.length, color: 'border-violet-200 bg-violet-50', textColor: 'text-violet-700' },
            { label: 'Accepted / Done', count: completedBookings.length, color: 'border-emerald-200 bg-emerald-50', textColor: 'text-emerald-700' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-3 ${s.color}`}>
              <div className={`text-2xl font-black ${s.textColor}`}>{s.count}</div>
              <div className="text-[10px] text-gray-500 mt-0.5 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-gray-500 font-bold uppercase tracking-wider">
            <FiRefreshCw className="w-4 h-4 animate-spin" />
            Loading bookings...
          </div>
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-16 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-4 border border-green-100">
            <FiCheckCircle className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-gray-800 text-base">All Clear!</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            No bookings require manual assignment. Live notifications will trigger automatically if any vendor match fails.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {paginatedBookings.map((booking) => {
              const config = getStatusConfig(booking);
              const Icon = config.icon;
              const canAssign = ['urgent'].includes(config.priority);
              const canReassign = config.priority === 'urgent' && booking.assignedByAdmin;

              return (
                <motion.div
                  layout
                  key={booking._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col justify-between"
                >
                  <div className="p-5 space-y-4">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-xs text-gray-900">
                          #{booking.bookingNumber || booking._id.slice(-6).toUpperCase()}
                        </span>
                        <div className={`inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 border text-[9px] font-bold uppercase rounded ${config.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
                          {config.label}
                        </div>
                      </div>
                    </div>

                    {/* Status Progress Indicator */}
                    <div className="flex items-center gap-1">
                      {['escalated', 'requested', 'confirmed', 'in_progress', 'work_done'].map((step, i) => {
                        const stepStatuses = {
                          escalated: ['escalated'],
                          requested: ['requested'],
                          confirmed: ['confirmed', 'awaiting_payment', 'assigned'],
                          in_progress: ['journey_started', 'visited', 'in_progress'],
                          work_done: ['work_done', 'completed']
                        };
                        const current = booking.status?.toLowerCase();
                        const isDone = stepStatuses[step]?.includes(current);
                        const isCurrent = step === current || (step === 'confirmed' && ['confirmed','awaiting_payment','assigned'].includes(current)) || (step === 'in_progress' && ['journey_started','visited','in_progress'].includes(current));
                        const stepColors = ['bg-orange-400', 'bg-blue-400', 'bg-emerald-400', 'bg-violet-400', 'bg-green-500'];
                        
                        return (
                          <React.Fragment key={step}>
                            <div className={`h-1.5 flex-1 rounded-full transition-all ${isCurrent || isDone ? stepColors[i] : 'bg-gray-100'}`} />
                          </React.Fragment>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-gray-400 -mt-2">{config.sub}</p>

                    {/* Service Info */}
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">
                        {booking.items?.[0]?.serviceId?.title || booking.serviceName || 'Service Request'}
                      </h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {booking.items?.[0]?.categoryId?.title || booking.serviceCategory || 'General'}
                      </p>

                      {/* Declined Vendor Info Dropdown */}
                      <DeclineHistoryDropdown
                        activityLog={booking.activityLog}
                        onSelectVendor={(vId) => setViewingVendorId(vId)}
                      />

                      {/* Vendor Tag */}
                      {booking.vendorId && (
                        <div className={`text-[10px] px-2 py-1 rounded-lg font-bold flex items-center gap-1.5 mt-2 border
                          ${config.priority === 'ok' || config.priority === 'active' || config.priority === 'done'
                            ? 'text-emerald-600 bg-emerald-50/50 border-emerald-100/50'
                            : 'text-blue-600 bg-blue-50/50 border-blue-100/50'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${config.priority === 'ok' || config.priority === 'done' ? 'bg-emerald-500' : 'bg-blue-500 animate-ping'}`} />
                          {booking.adminAssignmentStatus === 'ACCEPTED' ? '✓ Accepted by: ' : 'Assigned to: '}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setViewingVendorId(booking.vendorId?._id || booking.vendorId); }}
                            className="underline hover:text-blue-800 cursor-pointer"
                          >
                            {booking.vendorId?.businessName || booking.vendorId?.name || 'Vendor'} ↗
                          </button>
                        </div>
                      )}

                      {/* Worker Tag (if assigned) */}
                      {booking.workerId && (
                        <div className="text-[10px] px-2 py-1 rounded-lg font-bold flex items-center gap-1.5 mt-1.5 text-indigo-600 bg-indigo-50/50 border border-indigo-100/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          Worker: {booking.workerId?.name || 'Assigned'}
                        </div>
                      )}
                    </div>

                    {/* Info List */}
                    <div className="space-y-1.5 text-xs text-gray-600">
                      <div className="flex items-center gap-2">
                        <FiUser className="text-gray-400 w-3.5 h-3.5 shrink-0" />
                        <span className="truncate font-semibold">
                          {booking.userId?.name || booking.customerName || 'Guest'}
                          {(booking.userId?.phone || booking.customerPhone) && (
                            <span className="text-gray-400 font-normal"> ({booking.userId?.phone || booking.customerPhone})</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <FiMapPin className="text-gray-400 w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span className="line-clamp-1 text-gray-500">{booking.location?.address || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FiClock className="text-gray-400 w-3.5 h-3.5 shrink-0" />
                        <span>
                          Deployment: <strong className="text-gray-800">{booking.timeSlot?.time || 'ASAP'}</strong>
                        </span>
                      </div>
                      {booking.createdAt && (
                        <div className="text-[10px] text-gray-400 pt-1 border-t border-gray-100/80 mt-1 font-medium flex items-center justify-between">
                          <span>Requested At:</span>
                          <span className="font-semibold text-gray-700">
                            {new Date(booking.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="px-5 py-3.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-[9px] text-gray-400 uppercase font-semibold block tracking-wider">Amount</span>
                      <span className="font-bold text-gray-900 text-base">₹{booking.finalAmount || booking.price || 0}</span>
                    </div>

                    {/* Action Button based on status */}
                    {(config.priority === 'ok' || config.priority === 'active' || config.priority === 'done') ? (
                      <span className={`text-[10px] font-bold flex items-center gap-1 px-3 py-2 rounded-lg border
                        ${config.priority === 'done'
                          ? 'text-green-700 bg-green-50 border-green-100'
                          : config.priority === 'active'
                          ? 'text-violet-700 bg-violet-50 border-violet-100'
                          : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {config.priority === 'done' ? 'Work Completed' : config.priority === 'active' ? 'In Progress' : 'Accepted'}
                      </span>
                    ) : config.priority === 'waiting' ? (
                      <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1.5 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 animate-pulse">
                        <FiClock className="w-3.5 h-3.5 shrink-0" />
                        Awaiting Vendor
                      </span>
                    ) : (
                      <button
                        onClick={() => openAssignModal(booking)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-md shadow-blue-100"
                      >
                        <FiUserCheck className="w-4 h-4" />
                        {canReassign ? 'Reassign Vendor' : 'Assign Vendor'}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && filteredBookings.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-all"
          >
            Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
            <button
              key={pg}
              onClick={() => setCurrentPage(pg)}
              className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all ${currentPage === pg ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {pg}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-all"
          >
            Next
          </button>
        </div>
      )}

      {/* Assign Vendor Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[85vh] flex flex-col"
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">
                  Assign Vendor for #{selectedBooking?.bookingNumber}
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {selectedBooking?.serviceName} • Vendor has 30 min to accept
                </p>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <FiXCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Declined history inside assign modal */}
            {selectedBooking?.activityLog?.some(a => a.action === 'Vendor Rejected') && (
              <div className="px-4 py-2 bg-rose-50/50 border-b border-rose-100">
                <DeclineHistoryDropdown
                  activityLog={selectedBooking.activityLog}
                  onSelectVendor={(vId) => setViewingVendorId(vId)}
                />
              </div>
            )}
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {vendorsLoading ? (
                <div className="py-8 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                  <FiRefreshCw className="w-4 h-4 animate-spin" /> Loading approved vendors...
                </div>
              ) : vendors.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500">No approved vendors found</div>
              ) : (() => {
                const declinedVendorIds = new Set(
                  (selectedBooking?.activityLog || [])
                    .filter(a => a.action === 'Vendor Rejected')
                    .map(a => String(a.actorId?._id || a.actorId))
                );

                const sortedVendors = [...vendors].sort((a, b) => {
                  const aDeclined = declinedVendorIds.has(String(a._id));
                  const bDeclined = declinedVendorIds.has(String(b._id));
                  if (aDeclined && !bDeclined) return 1;
                  if (!aDeclined && bDeclined) return -1;
                  return 0;
                });

                return sortedVendors.map(vendor => {
                  const hasDeclined = declinedVendorIds.has(String(vendor._id));

                  return (
                    <div
                      key={vendor._id}
                      className={`p-3 border rounded-xl flex items-center justify-between transition-colors group ${
                        hasDeclined ? 'bg-rose-50/40 border-rose-200' : 'border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setViewingVendorId(vendor._id)}
                            className="font-bold text-gray-900 text-xs hover:text-blue-600 hover:underline text-left cursor-pointer"
                          >
                            {vendor.businessName || vendor.name} ↗
                          </button>
                          {hasDeclined && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                              Declined
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">{vendor.email} • {vendor.phone}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${vendor.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className="text-[10px] text-gray-400">{vendor.isOnline ? 'Online' : 'Offline'} • {vendor.availability || 'N/A'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAssignVendor(vendor._id)}
                        className={`px-3 py-1.5 text-white text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                          hasDeclined 
                            ? 'bg-rose-600 hover:bg-rose-700' 
                            : 'bg-blue-600 group-hover:bg-blue-700'
                        }`}
                      >
                        <FiUserCheck className="w-3 h-3" /> {hasDeclined ? 'Re-Assign' : 'Assign'}
                      </button>
                    </div>
                  );
                });
              })()}
            </div>
          </motion.div>
        </div>
      )}

      {/* Vendor Profile Modal */}
      <AdminVendorProfileModal
        vendorId={viewingVendorId}
        isOpen={!!viewingVendorId}
        onClose={() => setViewingVendorId(null)}
      />
    </div>
  );
};

export default ManualAssignment;
