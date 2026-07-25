import React from 'react';
import { FiClock, FiMapPin, FiBell } from 'react-icons/fi';

// Internal Timer Component for unification
// Internal Timer Component for unification
const CountdownTimer = ({ durationSeconds, createdAt, expiresAt, onExpire }) => {
  const calculateTimeLeft = () => {
    try {
      if (expiresAt) {
        const end = new Date(expiresAt).getTime();
        if (!isNaN(end)) {
          const left = Math.floor((end - Date.now()) / 1000);
          return Math.max(0, left);
        }
      }
      if (!createdAt) return Number(durationSeconds) || 300;
      const start = new Date(createdAt).getTime();
      if (!isNaN(start)) {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        return Math.max(0, (Number(durationSeconds) || 300) - elapsed);
      }
      return Number(durationSeconds) || 300;
    } catch (err) {
      return 0;
    }
  };

  const [timeLeft, setTimeLeft] = React.useState(calculateTimeLeft());

  React.useEffect(() => {
    // Recalculate once on mount to handle refresh correctly
    const initial = calculateTimeLeft();
    setTimeLeft(initial);
    if (initial <= 0 && onExpire) onExpire();
  }, [createdAt, expiresAt]);

  React.useEffect(() => {
    if (timeLeft <= 0) {
      if (onExpire) onExpire();
      return;
    }
    const interval = setInterval(() => {
      const current = calculateTimeLeft();
      setTimeLeft(current);
      if (current <= 0) {
        clearInterval(interval);
        if (onExpire) onExpire();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, createdAt, expiresAt]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  return (
    <div className={`text-[10px] font-mono font-medium flex items-center gap-1.5 ${timeLeft < 30 ? 'text-red-500 animate-pulse' : 'text-amber-400'}`}>
      <FiClock className="w-3 h-3" />
      <span className="tracking-widest">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
    </div>
  );
};

const PendingJobCard = ({ booking, onAccept, onReject, onClick, loadingAction, showTimer = false, maxSearchTimeMins = 5 }) => {
  const bookingId = booking.id || booking._id;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-[32px] cursor-pointer active:scale-98 transition-all duration-500 border border-gray-100 overflow-hidden group hover:shadow-xl hover:shadow-gray-200/50 shadow-sm"
    >
      {/* Urgency header */}
      {showTimer && (
        <div className="px-6 py-3 bg-gray-50/50 border-b border-gray-50 flex justify-between items-center">
          <span className={`text-[9px] font-medium capitalize tracking-[0.2em] flex items-center gap-2 ${booking.assignedByAdmin ? 'text-amber-600' : booking.bookingType === 'instant' ? 'text-blue-600' : 'text-gray-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${booking.assignedByAdmin ? 'bg-amber-500 animate-pulse' : booking.bookingType === 'instant' ? 'bg-blue-600 animate-ping' : 'bg-gray-300'}`} />
            {booking.assignedByAdmin ? '🛡️ ADMIN ASSIGNED' : booking.bookingType === 'instant' ? '⚡ CRITICAL INSTANT' : 'NEW SIGNAL'}
          </span>
          <CountdownTimer
            durationSeconds={maxSearchTimeMins * 60}
            createdAt={booking.createdAt}
            expiresAt={booking.expiresAt}
            onExpire={() => {
              window.dispatchEvent(new CustomEvent('removeVendorBooking', { detail: { id: bookingId } }));
            }}
          />
        </div>
      )}

      <div className="p-6">
        <div className="flex items-start justify-between mb-5 gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[8px] font-medium px-2 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 capitalize tracking-[0.2em]">
                {booking.serviceCategory || 'OPERATIONAL'}
              </span>
              <span className="text-[9px] font-medium text-gray-400 capitalize tracking-widest">
                {booking.customerName || 'AUTHORIZED CLIENT'}
              </span>
            </div>
            
            <h3 className="font-medium text-gray-900 text-lg leading-tight mb-2 line-clamp-1 capitalize tracking-tight">
              {booking.serviceName || 'SYSTEM REQUEST'}
            </h3>

            <div className="flex items-center gap-2 text-[10px] font-normal text-gray-400 capitalize tracking-widest">
              <FiMapPin className="w-3.5 h-3.5 text-blue-500" />
              <span className="truncate">{booking.location?.address || 'COORDINATES N/A'}</span>
            </div>
          </div>

          <div className="w-14 h-14 rounded-[1.2rem] bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100 relative shadow-inner group-hover:scale-105 transition-transform duration-500">
            <FiBell className="w-6 h-6 text-gray-400" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-lg border-2 border-white shadow-lg animate-pulse" />
          </div>
        </div>

        <div className="flex items-center justify-between mb-8 px-1">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center border border-blue-100">
              <FiClock className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-medium text-gray-400 capitalize tracking-widest leading-none mb-1">Booked Slot</span>
              <span className="text-xs font-medium text-gray-900 capitalize tracking-[0.1em]">
                {(() => {
                  const dateVal = booking.timeSlot?.date || booking.scheduledDate;
                  let formattedDate = '';
                  if (dateVal && dateVal !== 'Invalid Date') {
                    const d = new Date(dateVal);
                    if (!isNaN(d.getTime())) {
                      formattedDate = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                    } else if (typeof dateVal === 'string' && dateVal.trim()) {
                      formattedDate = dateVal;
                    }
                  }
                  const timeVal = booking.timeSlot?.time || (booking.timeSlot?.start && booking.timeSlot?.end ? `${booking.timeSlot.start} - ${booking.timeSlot.end}` : booking.scheduledTime) || 'ASAP';
                  return formattedDate ? `${formattedDate} • ${timeVal}` : timeVal;
                })()}
              </span>
            </div>
          </div>
          
          <div className="text-right">
            <span className="text-[10px] font-medium text-gray-400 capitalize tracking-widest leading-none mb-1 block">Expected Yield</span>
            <div className="text-2xl font-medium text-blue-600 tracking-tighter">
              ₹{booking.price || 0}
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            disabled={!!loadingAction}
            onClick={(e) => onAccept(e, booking)}
            className="flex-[2] bg-blue-600 text-white py-4.5 px-6 rounded-2xl text-[10px] font-medium capitalize tracking-[0.3em] shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-20"
          >
            {loadingAction === 'accept' ? 'AUTHORIZING...' : (booking.offeringType === 'PRODUCT' ? 'ACCEPT ORDER' : 'ACCEPT MISSION')}
          </button>
          <button
            disabled={!!loadingAction}
            onClick={(e) => onReject(e, booking)}
            className="flex-1 bg-gray-50 text-gray-400 py-4.5 px-6 rounded-2xl text-[10px] font-medium capitalize tracking-[0.2em] hover:bg-gray-100 hover:text-gray-600 transition-all active:scale-95 disabled:opacity-20 border border-gray-100"
          >
            {loadingAction === 'reject' ? '...' : 'SKIP'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PendingJobCard;
