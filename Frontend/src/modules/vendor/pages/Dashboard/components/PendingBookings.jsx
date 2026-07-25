import React, { memo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { vendorTheme as themeColors } from '../../../../../theme';
import { toast } from 'react-hot-toast';
import { acceptBooking, rejectBooking } from '../../../services/bookingService';
import PendingJobCard from '../../../components/bookings/PendingJobCard';
import { RejectionReasonModal } from '../../../components/common';
import Pagination from '../../../../../components/common/Pagination';

const PendingBookings = memo(({ bookings, setPendingBookings, setActiveAlertBooking, maxSearchTimeMins = 5 }) => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [loadingAction, setLoadingAction] = useState({ id: null, type: null });
  const [declineTargetBooking, setDeclineTargetBooking] = useState(null);

  if (bookings.length === 0) {
    return null;
  }

  const handleAcceptBooking = async (e, booking) => {
    e.stopPropagation();
    const bId = booking.id || booking._id;
    if (loadingAction.id) return;
    setLoadingAction({ id: bId, type: 'accept' });
    try {
      const response = await acceptBooking(bId);

      if (response.success) {
        setPendingBookings(prev => prev.filter(b => String(b.id || b._id) !== String(bId)));

        const pendingJobs = JSON.parse(localStorage.getItem('vendorPendingJobs') || '[]');
        const updated = pendingJobs.filter(b => String(b.id || b._id) !== String(bId));
        localStorage.setItem('vendorPendingJobs', JSON.stringify(updated));

        window.dispatchEvent(new CustomEvent('removeVendorBooking', { detail: { id: bId } }));
        window.dispatchEvent(new Event('vendorStatsUpdated'));
        toast.success('Booking accepted successfully!');
      }
    } catch (error) {
      console.error('Error accepting:', error);
      toast.error('Failed to accept booking');
    } finally {
      setLoadingAction({ id: null, type: null });
    }
  };

  const handleOpenRejectModal = (e, booking) => {
    e.stopPropagation();
    setDeclineTargetBooking(booking);
  };

  const handleConfirmReject = async (reason) => {
    if (!declineTargetBooking) return;
    const bId = declineTargetBooking.id || declineTargetBooking._id;
    setDeclineTargetBooking(null);

    setLoadingAction({ id: bId, type: 'reject' });
    try {
      const response = await rejectBooking(bId, reason);

      if (response.success) {
        setPendingBookings(prev => prev.filter(b => String(b.id || b._id) !== String(bId)));

        const pendingJobs = JSON.parse(localStorage.getItem('vendorPendingJobs') || '[]');
        const updated = pendingJobs.filter(b => String(b.id || b._id) !== String(bId));
        localStorage.setItem('vendorPendingJobs', JSON.stringify(updated));

        window.dispatchEvent(new CustomEvent('removeVendorBooking', { detail: { id: bId } }));
        toast.success('Booking rejected');
      }
    } catch (error) {
      console.error('Error rejecting:', error);
      toast.error('Failed to reject booking');
    } finally {
      setLoadingAction({ id: null, type: null });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 px-4">
        <h2 className="text-xs font-medium text-gray-500 capitalize tracking-[0.4em]">Pending Intelligence Alerts</h2>
        <button
          onClick={() => navigate('/vendor/booking-alerts')}
          className="text-[10px] font-medium text-blue-600 capitalize tracking-[0.2em] hover:text-blue-500 transition-colors"
        >
          Access All Signals
        </button>
      </div>
      <div className="space-y-3">
        {bookings
          .slice((currentPage - 1) * pageSize, currentPage * pageSize)
          .map((booking) => (
          <PendingJobCard
            key={booking.id || booking._id}
            booking={booking}
            onAccept={handleAcceptBooking}
            onReject={handleOpenRejectModal}
            onClick={() => setActiveAlertBooking(booking)}
            loadingAction={loadingAction.id === (booking.id || booking._id) ? loadingAction.type : null}
            showTimer={true}
            maxSearchTimeMins={maxSearchTimeMins}
          />
        ))}
      </div>

      {/* Pagination */}
      {bookings.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(bookings.length / pageSize) || 1}
          totalItems={bookings.length}
          pageSize={pageSize}
          onPageChange={(p) => setCurrentPage(p)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          className="mt-3"
        />
      )}

      <RejectionReasonModal
        isOpen={!!declineTargetBooking}
        onClose={() => setDeclineTargetBooking(null)}
        onConfirm={handleConfirmReject}
      />
    </div>
  );
});

PendingBookings.displayName = 'VendorPendingBookings';

export default PendingBookings;
