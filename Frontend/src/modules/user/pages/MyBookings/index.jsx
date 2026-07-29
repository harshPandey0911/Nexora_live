import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiClock, FiMapPin, FiCheckCircle, FiXCircle, FiLoader, FiCalendar, FiChevronRight, FiBox } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import NotificationBell from '../../components/common/NotificationBell';
import { motion } from 'framer-motion';
import { bookingService } from '../../../../services/bookingService';

const MyBookings = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const loadBookings = async () => {
      try {
        setLoading(true);
        const params = {};
        if (filter !== 'all') {
          params.status = filter;
        }
        const response = await bookingService.getUserBookings(params);
        if (response.success) {
          setBookings(response.data || []);
        } else {
          toast.error(response.message || 'Failed to load bookings');
          setBookings([]);
        }
      } catch (error) {
        toast.error('Failed to load bookings. Please try again.');
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };

    loadBookings();

    window.addEventListener('userBookingsUpdated', loadBookings);

    return () => {
      window.removeEventListener('userBookingsUpdated', loadBookings);
    };
  }, [filter]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed':
        return <FiCheckCircle className="w-3 h-3" />;
      case 'in_progress':
      case 'in-progress':
        return <FiLoader className="w-3 h-3 animate-spin" />;
      case 'journey_started':
      case 'visited':
        return <FiMapPin className="w-3 h-3 text-indigo-600" />;
      case 'completed':
        return <FiCheckCircle className="w-3 h-3" />;
      case 'cancelled':
      case 'rejected':
        return <FiXCircle className="w-3 h-3" />;
      case 'awaiting_payment':
      default:
        return <FiClock className="w-3 h-3" />;
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-50 text-blue-700 border border-blue-200/80';
      case 'in_progress':
      case 'in-progress':
      case 'journey_started':
      case 'visited':
        return 'bg-indigo-50 text-indigo-700 border border-indigo-200/80';
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80';
      case 'cancelled':
      case 'rejected':
        return 'bg-rose-50 text-rose-700 border border-rose-200/80';
      case 'awaiting_payment':
        return 'bg-amber-50 text-amber-700 border border-amber-200/80';
      default:
        return 'bg-gray-50 text-gray-700 border border-gray-200/80';
    }
  };

  const getStatusTopAccent = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-500';
      case 'in_progress':
      case 'in-progress':
      case 'journey_started':
      case 'visited': return 'bg-indigo-600';
      case 'completed': return 'bg-emerald-500';
      case 'cancelled':
      case 'rejected': return 'bg-rose-500';
      case 'awaiting_payment': return 'bg-amber-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusLabel = (status) => {
    if (!status) return 'Unknown';
    switch (status) {
      case 'in_progress':
      case 'in-progress':
        return 'In Progress';
      case 'journey_started': return 'On The Way';
      case 'visited': return 'Arrived';
      case 'awaiting_payment': return 'Request Accepted';
      case 'work_done': return 'Work Completed';
      default: return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
    }
  };

  const handleBookingClick = (booking) => {
    if (booking.offeringType === 'PRODUCT' || booking.orderId || booking.isProductOrder) {
      navigate(`/user/product-order/${booking._id || booking.id}`);
    } else {
      navigate(`/user/booking/${booking._id || booking.id}`);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getAddressString = (address) => {
    if (typeof address === 'string') return address;
    if (address && typeof address === 'object') {
      const parts = [
        address.addressLine1,
        address.addressLine2,
        address.city
      ].filter(Boolean);
      return parts.join(', ');
    }
    return 'Detailed Address';
  };

  return (
    <div className="min-h-screen pb-24 bg-gray-50/50 space-y-3 sm:space-y-4">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-3.5 sm:px-4 py-3 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/user')}
            className="w-8 h-8 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
          >
            <FiArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight leading-tight">My Bookings</h1>
            <p className="text-[10px] text-gray-500 font-medium hidden sm:block">Track and manage your service requests & product orders</p>
          </div>
        </div>
        <div className="relative">
          <NotificationBell />
        </div>
      </header>

      {/* Filter Tabs Bar */}
      <div className="bg-white border-b border-gray-100 sticky top-[53px] sm:top-[57px] z-20 shadow-2xs">
        <div className="flex overflow-x-auto px-3 sm:px-4 py-2 gap-1.5 scrollbar-none">
          {[
            { id: 'all', label: 'All Bookings' },
            { id: 'confirmed', label: 'Confirmed' },
            { id: 'in-progress', label: 'In Progress' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-200 cursor-pointer ${
                filter === tab.id
                  ? 'bg-[#00246b] text-white shadow-2xs'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List */}
      <main className="px-3.5 sm:px-4 max-w-lg mx-auto w-full space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-2xs animate-pulse space-y-3">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                  <div className="h-5 w-20 bg-gray-200 rounded-full" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-4 w-40 bg-gray-200 rounded" />
                  <div className="h-3 w-56 bg-gray-100 rounded" />
                </div>
                <div className="h-12 bg-gray-50 rounded-lg" />
              </div>
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-gray-100 shadow-2xs space-y-2 mt-4">
            <FiBox className="w-8 h-8 text-gray-300 mx-auto" />
            <h3 className="text-xs font-bold text-gray-900 uppercase">No Bookings Found</h3>
            <p className="text-[10px] text-gray-400 max-w-xs mx-auto uppercase tracking-wider">
              {filter === 'all'
                ? "You haven't placed any bookings yet."
                : `No ${filter.replace('-', ' ')} bookings found.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => {
              const bookingIdStr = booking.bookingNumber || (booking._id || booking.id).substring(0, 8);

              return (
                <div
                  key={booking._id || booking.id}
                  onClick={() => handleBookingClick(booking)}
                  className="bg-white rounded-xl border border-gray-100 shadow-2xs hover:shadow-xs hover:border-gray-200 transition-all p-3.5 space-y-2.5 relative overflow-hidden cursor-pointer group"
                >
                  {/* Top Status Accent Bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${getStatusTopAccent(booking.status)}`} />

                  {/* Header Row: ID + Service Category + Status Badge */}
                  <div className="flex items-center justify-between border-b border-gray-100/80 pb-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className="text-xs font-bold text-blue-600 truncate">
                        #{bookingIdStr}
                      </span>
                      {booking.serviceCategory && (
                        <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          {booking.serviceCategory}
                        </span>
                      )}
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 ${getStatusBadgeClass(booking.status)}`}>
                      {getStatusIcon(booking.status)}
                      <span>{getStatusLabel(booking.status)}</span>
                    </span>
                  </div>

                  {/* Service Title & Items Preview */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight leading-tight">
                      {booking.serviceName || booking.items?.[0]?.title || 'Service Request'}
                    </h3>

                    {booking.bookedItems && booking.bookedItems.length > 0 && (
                      <p className="text-[10px] text-gray-400 font-medium truncate mt-0.5">
                        {booking.bookedItems.map(item => item.card?.title || item.title).join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Schedule & Location Details Box */}
                  <div className="bg-gray-50/70 p-2.5 rounded-lg border border-gray-100 space-y-1 text-[10px] font-medium text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <FiCalendar className="w-3 h-3 text-blue-600 shrink-0" />
                      <span className="font-bold text-gray-800">{formatDate(booking.scheduledDate)}</span>
                      <span className="text-gray-300">•</span>
                      <span>{booking.scheduledTime || booking.timeSlot?.start || 'ASAP'}</span>
                    </div>

                    <div className="flex items-center gap-1.5 truncate">
                      <FiMapPin className="w-3 h-3 text-gray-400 shrink-0" />
                      <span className="truncate">{getAddressString(booking.address)}</span>
                    </div>
                  </div>

                  {/* Card Footer: Amount + View Details Action Button */}
                  <div className="pt-1 flex items-center justify-between border-t border-gray-100/80">
                    <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Total Amount</span>
                      <span className="text-xs font-bold text-emerald-600">
                        ₹{(booking.finalAmount || booking.totalAmount || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <button className="px-2.5 py-1 bg-gray-50 group-hover:bg-[#00246b] text-gray-700 group-hover:text-white text-[10px] font-bold rounded-lg uppercase tracking-wider border border-gray-200 group-hover:border-transparent flex items-center gap-1 transition-all shadow-2xs active:scale-95 cursor-pointer">
                      <span>View Details</span>
                      <FiChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyBookings;
