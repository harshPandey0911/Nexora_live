import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiMapPin, FiClock, FiDollarSign, FiUser, FiPhone, FiNavigation, FiArrowRight, FiEdit, FiCheckCircle, FiCreditCard, FiX, FiCheck, FiTool, FiXCircle, FiAward, FiPackage, FiAlertCircle, FiBriefcase, FiUsers, FiActivity } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { vendorTheme as themeColors } from '../../../../theme';
import Header from '../../components/layout/Header';
import LogoLoader from '../../../../components/common/LogoLoader';
import {
  getBookingById,
  updateBookingStatus,
  acceptBooking,
  rejectBooking,
  assignWorker as assignWorkerApi,
  startSelfJob,
  vendorReached,
  verifySelfVisit,
  completeSelfJob
} from '../../services/bookingService';
import vendorBillService from '../../../../services/vendorBillService';
import { CashCollectionModal, ConfirmDialog, WorkerPaymentModal, OtpVerificationModal } from '../../components/common';
import VisitVerificationModal from '../../components/common/VisitVerificationModal';
// Import shared WorkCompletionModal from worker directory or move to shared
import { WorkCompletionModal } from '../../../worker/components/common';
// import BillingModal from '../../components/bookings/BillingModal'; // Consumed by page now
import vendorWalletService from '../../../../services/vendorWalletService';
import { toast } from 'react-hot-toast';
import { useAppNotifications } from '../../../../hooks/useAppNotifications';
import { useLocationTracking } from '../../../../hooks/useLocationTracking';

export default function BookingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPayWorkerModalOpen, setIsPayWorkerModalOpen] = useState(false);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [isWorkDoneModalOpen, setIsWorkDoneModalOpen] = useState(false);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);


  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    type: 'warning'
  });


  const loadBooking = async () => {
    try {
      setLoading(true);
      let billData = null;

      const [bookingRes, billRes] = await Promise.all([
        getBookingById(id),
        vendorBillService.getBill(id).catch(() => ({ success: false }))
      ]);

      const apiData = bookingRes.data || bookingRes;
      if (billRes && billRes.success) {
        billData = billRes.bill;
      }

      // Map API response to Component State structure
      const mappedBooking = {
        ...apiData,
        bill: billData || apiData.bill, // Prioritize fetched bill
        id: apiData._id || apiData.id,
        user: apiData.userId || apiData.user || { name: apiData.customerName || 'Customer', phone: apiData.customerPhone || 'Hidden' },
        customerName: apiData.userId?.name || apiData.customerName || 'Customer',
        customerPhone: apiData.userId?.phone || apiData.customerPhone || 'Hidden',
        serviceType: apiData.serviceId?.title || apiData.serviceName || apiData.serviceType || 'Service',
        items: apiData.bookedItems || [],
        location: {
          address: (() => {
            const a = apiData.address;
            if (!a) return 'Address not available';
            if (typeof a === 'string') return a;
            return `${a.addressLine2 ? a.addressLine2 + ', ' : ''}${a.addressLine1 || ''}, ${a.city || ''}`;
          })(),
          lat: apiData.address?.lat || 0,
          lng: apiData.address?.lng || 0,
          distance: apiData.distance ? `${apiData.distance.toFixed(1)} km` : 'N/A'
        },
        // Price Breakdown
        basePrice: parseFloat(apiData.basePrice || 0),
        tax: parseFloat(apiData.tax || (apiData.paymentMethod === 'plan_benefit' ? (apiData.basePrice || 0) * 0.18 : 0)),
        visitingCharges: parseFloat(apiData.visitingCharges || apiData.visitationFee || 0),
        discount: parseFloat(apiData.discount || 0),
        platformCommission: parseFloat(apiData.adminCommission || apiData.platformFee || apiData.commission || 0),
        finalAmount: parseFloat(apiData.finalAmount || 0),
        vendorEarnings: parseFloat(
          billData?.vendorTotalEarning ||
          apiData.vendorEarnings ||
          (apiData.paymentMethod === 'plan_benefit'
            ? (Number(apiData.basePrice || 0) * 0.7) // Fallback: 70% share from base
            : (apiData.finalAmount ? apiData.finalAmount - (apiData.commission || 0) : 0)
          )
        ),

        // Display Price (Vendor Earnings by default as requested)
        price: (apiData.vendorEarnings || (apiData.finalAmount ? apiData.finalAmount - (apiData.commission || 0) : 0)).toFixed(2),

        timeSlot: {
          date: apiData.scheduledDate ? new Date(apiData.scheduledDate).toLocaleDateString() : 'Today',
          time: apiData.scheduledTime || apiData.timeSlot?.start ? `${apiData.timeSlot.start} - ${apiData.timeSlot.end}` : 'Flexible'
        },
        status: apiData.status,
        description: apiData.description || apiData.notes || 'No description provided',
        assignedTo: apiData.workerId ? { name: apiData.workerId.name } : (apiData.assignedAt ? { name: 'You (Self)' } : null),
        workerResponse: apiData.workerResponse,
        workerResponseAt: apiData.workerResponseAt,
        paymentMethod: apiData.paymentMethod,
        paymentStatus: apiData.paymentStatus,
        cashCollected: apiData.cashCollected || false,
        workerPaymentStatus: apiData.workerPaymentStatus,
        finalSettlementStatus: apiData.finalSettlementStatus
      };

      setBooking(mappedBooking);
    } catch (error) {
      // Error loading booking
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooking();
    window.addEventListener('vendorJobsUpdated', loadBooking);

    return () => {
      window.removeEventListener('vendorJobsUpdated', loadBooking);
    };
  }, [id]);


  // ADDED: Socket for Live Location Tracking in Details Page
  const socket = useAppNotifications('vendor'); // Get socket

  // Optimized Live Location Tracking with distance filter and heading
  const isTrackingActive = booking?.status === 'journey_started' || booking?.status === 'visited';
  useLocationTracking(socket, id, isTrackingActive, {
    distanceFilter: 10, // Only emit when moved 10+ meters
    interval: 3000,     // Minimum 3s between emissions
    enableHighAccuracy: true
  });

  // Listen for Real-Time Booking Updates (e.g. Online Payment)
  useEffect(() => {
    if (socket && id) {
      const handleBookingUpdate = (data) => {
        // Check if update is for this booking
        if (data.bookingId === id || data.relatedId === id || data._id === id) {

          // Update local state to trigger effects immediately
          setBooking(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              ...data, // Merge updates
              status: data.status || prev.status,
              paymentStatus: data.paymentStatus || prev.paymentStatus
            };
          });

          // Also trigger a full reload to be safe/sync
          window.dispatchEvent(new Event('vendorJobsUpdated'));

          // Check if this update is a payment success, if so, trigger reload for fresh state
          const isPaymentSuccess =
            data.paymentStatus === 'SUCCESS' ||
            data.paymentStatus === 'paid' ||
            data.type === 'payment_success';

          if (isPaymentSuccess) {
            toast.success('Online Payment Received!');
            setTimeout(() => window.location.reload(), 1500);
          }
        }
      };

      socket.on('booking_updated', handleBookingUpdate);
      socket.on('payment_success', handleBookingUpdate);

      return () => {
        socket.off('booking_updated', handleBookingUpdate);
        socket.off('payment_success', handleBookingUpdate);
      };
    }
  }, [socket, id]);

  const handleArrived = async () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Arrival',
      message: 'Are you sure you have reached the location? This will start the job.',
      type: 'info',
      onConfirm: async () => {
        setLoading(true);
        try {
          await updateBookingStatus(id, 'visited');
          toast.success('Arrival Confirmed! Job Started.');
          window.dispatchEvent(new Event('vendorJobsUpdated'));
          loadBooking();
        } catch (error) {
          console.error('Error confirming arrival:', error);
          toast.error('Failed to confirm arrival');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleVerifySuccess = () => {
    loadBooking();
    window.dispatchEvent(new Event('vendorJobsUpdated'));
  };
  const handleCancelJob = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Cancel Payment',
      message: 'Are you sure you want to cancel this booking? This action cannot be undone and may affect your rating.',
      type: 'warning',
      onConfirm: async () => {
        setLoading(true);
        try {
          await updateBookingStatus(id, 'cancelled');
          toast.success('Booking Cancelled Successfully');
          window.dispatchEvent(new Event('vendorJobsUpdated'));
          navigate('/vendor/active-jobs');
        } catch (error) {
          console.error('Error cancelling job:', error);
          toast.error('Failed to cancel booking');
        } finally {
          setLoading(false);
        }
      }
    });
  };
  const getAvailableStatuses = (currentStatus, booking) => {
    const isProduct = booking?.offeringType === 'PRODUCT';

    if (isProduct) {
      const productFlow = {
        'requested': ['confirmed'],
        'pending': ['confirmed'],
        'confirmed': ['packed'],
        'packed': ['shipped'],
        'shipped': ['out_for_delivery'],
        'out_for_delivery': ['delivered'],
        'delivered': [],
        'completed': []
      };
      return productFlow[currentStatus] || [];
    }

    const statusFlow = {
      'requested': ['confirmed'],
      'searching': ['confirmed'],
      'confirmed': ['completed', 'work_done'],
      'assigned': ['work_done', 'completed'],
      'journey_started': ['work_done', 'completed'],
      'visited': ['work_done', 'completed'],
      'in_progress': ['work_done', 'completed'],
      'work_done': ['completed'],
      'completed': [],
    };
    return statusFlow[currentStatus] || [];
  };

  const canPayWorker = (booking) => {
    // If assigned to self, no worker payment needed
    if (booking?.assignedTo?.name === 'You (Self)') return false;

    // Allow payment ONLY if booking is completed (Vendor Approved)
    const validStatus = booking?.status === 'completed';
    return validStatus && booking?.workerPaymentStatus !== 'PAID';
  };

  const canDoFinalSettlement = (booking) => {
    // Check if payment is already done (Online SUCCESS or Cash COLLECTED)
    const pStatus = booking?.paymentStatus?.toLowerCase() || '';
    const isPaid = pStatus === 'success' || pStatus === 'paid' || booking?.cashCollected;

    const status = booking?.status?.toLowerCase() || '';
    const isWorkDone = status === 'work_done' || status === 'completed' || status === 'worker_paid';

    // Check worker payment (enforce worker is paid before vendor can finalize unless doing job self)
    const isSelfJob = booking?.assignedTo?.name === 'You (Self)';
    const handleWorkerCheck = isSelfJob || booking?.workerPaymentStatus === 'PAID';

    return isWorkDone && isPaid && handleWorkerCheck && booking?.finalSettlementStatus !== 'DONE';
  };

  const handleStatusChange = async (newStatus) => {
    if (!booking) return;

    const availableStatuses = getAvailableStatuses(booking.status, booking);
    if (!availableStatuses.includes(newStatus)) {
      toast.error(`Cannot change status from ${booking.status} to ${newStatus}. Please follow the proper flow.`);
      return;
    }

    const isAccepting = (newStatus === 'confirmed' || newStatus === 'accepted') && (booking.status === 'requested' || booking.status === 'searching');

    setConfirmDialog({
      isOpen: true,
      title: isAccepting ? 'Accept Booking' : 'Update Status',
      message: isAccepting 
        ? 'Are you sure you want to accept this booking request?'
        : `Are you sure you want to change status to ${newStatus.replace('_', ' ')}?`,
      type: 'info',
      onConfirm: async () => {
        setLoading(true);
        try {
          if (isAccepting) {
            await acceptBooking(id);
          } else {
            await updateBookingStatus(id, newStatus);
          }
          window.dispatchEvent(new Event('vendorJobsUpdated'));
          toast.success(isAccepting ? 'Booking Accepted Successfully!' : `Status updated to ${newStatus.replace('_', ' ')} successfully!`);
          loadBooking();
        } catch (error) {
          console.error('Error updating status:', error);
          toast.error(error.response?.data?.message || 'Failed to update status. Please try again.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handlePayWorkerClick = () => {
    setIsPayWorkerModalOpen(true);
  };

  const handlePayWorkerSubmit = async (payoutData) => {
    const { amount, notes, transactionId, screenshot, paymentMethod } = payoutData;

    try {
      setPaySubmitting(true);
      const res = await vendorWalletService.payWorker(
        booking.id || booking._id,
        amount,
        notes,
        transactionId,
        screenshot,
        paymentMethod
      );

      if (res.success) {
        toast.success(res.message || 'Payment recorded successfully');
        setIsPayWorkerModalOpen(false);
        loadBooking();
      } else {
        toast.error(res.message || 'Failed to record payment');
      }
    } catch (error) {
      toast.error('Failed to process payment');
    } finally {
      setPaySubmitting(false);
    }
  };

  const handleFinalSettlement = async () => {
    if (!booking) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Final Settlement',
      message: 'Mark final settlement as done? This will allow you to complete the booking.',
      type: 'warning',
      onConfirm: async () => {
        setLoading(true);
        try {
          await updateBookingStatus(id, booking.status, {
            finalSettlementStatus: 'DONE'
          });
          window.dispatchEvent(new Event('vendorJobsUpdated'));
          toast.success('Final settlement marked as done!');
          loadBooking();
        } catch (error) {
          console.error('Error updating settlement:', error);
          toast.error('Failed to update settlement. Please try again.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleCollectCashClick = () => {
    // Navigate directly to billing or open cash modal without OTP
    navigate(`/vendor/booking/${booking.id || id}/billing`);
  };

  const handleCashCollectionConfirm = async (amount, extras, code) => {
    try {
      const res = await vendorWalletService.confirmCashCollection(id, amount, code, extras);
      if (res.success) {
        toast.success('Payment verified successfully!');
        window.location.reload();
      }
      return res;
    } catch (error) {
      console.error('Verify OTP error:', error);
      toast.error('Verification failed');
      throw error;
    }
  };

  const canCollectCash = (booking) => {
    if (booking?.cashCollected || booking?.paymentStatus === 'collected_by_vendor') {
      return false;
    }

    const isSelfJob = booking?.assignedTo?.name === 'You (Self)';
    const validStatus = isSelfJob
      ? (booking?.status === 'work_done' || booking?.status === 'completed')
      : booking?.status === 'completed';

    if (!validStatus) return false;

    if (booking?.paymentMethod === 'plan_benefit') {
      return true;
    }

    if (booking?.paymentStatus === 'SUCCESS' || booking?.paymentStatus === 'paid') {
      return false;
    }

    return (
      booking?.paymentMethod === 'cash' ||
      booking?.paymentMethod === 'pay_at_home' ||
      booking?.paymentMethod === 'online'
    );
  };

  const handleCallUser = () => {
    const phone = booking.user?.phone || booking.customerPhone;
    if (phone) {
      window.location.href = `tel:${phone}`;
    } else {
      alert('Phone number not available');
    }
  };

  const handleViewTimeline = () => {
    navigate(`/vendor/booking/${booking.id}/timeline`);
  };

  const handleAssignWorker = () => {
    navigate(`/vendor/booking/${booking.id}/assign-worker`);
  };

  const handleAssignToSelf = async () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Assign to Self',
      message: 'Are you sure you want to do this job yourself?',
      type: 'info',
      onConfirm: async () => {
        setLoading(true);
        try {
          const response = await assignWorkerApi(id, 'SELF');
          if (response && response.success) {
            toast.success('Assigned to yourself successfully');
            window.dispatchEvent(new Event('vendorJobsUpdated'));
            window.location.reload();
          } else {
            throw new Error(response?.message || 'Failed to assign');
          }
        } catch (error) {
          console.error('Error assigning to self:', error);
          toast.error(error.message || 'Failed to assign to yourself');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleStartJourney = async () => {
    // If self-job, call the start API first
    if (booking.assignedTo?.name === 'You (Self)') {
      try {
        setLoading(true);
        await startSelfJob(id);
        toast.success('Journey Started');
        // Refresh to update status
        const response = await getBookingById(id);
        const apiData = response.data || response;
        setBooking(prev => ({ ...prev, status: apiData.status }));
      } catch (error) {
        console.error('Error starting self journey:', error);
        toast.error('Failed to start journey');
        return;
      } finally {
        setLoading(false);
      }
    }

    navigate(`/vendor/booking/${booking.id || id}/map`);
  };

  const handleCompleteWork = async (photos) => {
    try {
      setActionLoading(true);
      await completeSelfJob(id, { workPhotos: photos || [] });
      toast.success('Work marked done');
      setIsWorkDoneModalOpen(false);
      window.location.reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveWork = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Approve Work',
      message: 'Approve the work done by the worker? This will mark the job as completed and enable payout.',
      type: 'success',
      onConfirm: async () => {
        setLoading(true);
        try {
          await updateBookingStatus(id, 'completed');
          window.dispatchEvent(new Event('vendorJobsUpdated'));
          toast.success('Work Approved! You can now pay the worker.');
          window.location.reload();
        } catch (error) {
          console.error('Error approving work:', error);
          toast.error('Failed to approve work');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // --- Payment Breakdown Calculations ---
  // Default values from booking (fallback)
  const isPlanBenefit = booking?.paymentMethod === 'plan_benefit';
  const bill = booking?.bill;

  // Base Logic (Services)
  const originalBase = bill ? (bill.originalServiceBase || 0) : (parseFloat(booking?.basePrice) || 0);

  // Extra Services & Parts from vendor bill (if available)
  const allBillServices = bill?.services || [];
  const services = allBillServices.filter(s => !s.isOriginal);
  const originalServiceFromBill = allBillServices.find(s => s.isOriginal);
  const parts = bill?.parts || [];
  const customItems = bill?.customItems || [];

  let extraServiceBase = 0;
  let extraServiceGST = 0;
  services.forEach(s => {
    const qty = parseFloat(s.quantity) || 1;
    const base = (parseFloat(s.price) || 0) * qty;
    const gst = parseFloat(s.gstAmount) || 0;
    extraServiceBase += base;
    extraServiceGST += gst;
  });

  let partsBase = 0;
  let partsGST = 0;
  parts.forEach(p => {
    const qty = parseFloat(p.quantity) || 1;
    partsBase += ((parseFloat(p.price) || 0) * qty);
    partsGST += (parseFloat(p.gstAmount) || 0);
  });
  customItems.forEach(c => {
    const qty = parseFloat(c.quantity) || 1;
    partsBase += ((parseFloat(c.price) || 0) * qty);
    partsGST += (parseFloat(c.gstAmount) || 0);
  });

  // Tax Logic
  const originalGST = bill ? (bill.originalGST || 0) : (originalBase * 0.18);
  const totalGST = originalGST + extraServiceGST + partsGST;

  // Final Total from bill or booking
  const finalTotal = bill?.grandTotal || (booking?.finalAmount || 0);
  const hasBill = !!bill;

  return (

    <AnimatePresence mode="wait">
      {!booking ? (
        <LogoLoader key="loader" fullScreen overlay />
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="min-h-screen pb-20 relative bg-gray-50"
        >
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-600" />
          </motion.button>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-gray-900 tracking-tight leading-none">Job Intel</h1>
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1.5">Deployment ID: {id?.slice(-6).toUpperCase()}</span>
          </div>
        </div>
        <div className="w-10 h-10 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-center">
          <FiBriefcase className="w-5 h-5 text-blue-600" />
        </div>
      </header>

      <main className="px-6 pt-8 pb-20 relative z-10 max-w-7xl mx-auto">
        {/* Service Archetype Card */}
        <div className="bg-white rounded-3xl p-6 mb-6 border border-gray-100 shadow-sm">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Service Specialization</p>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight leading-tight uppercase">
                {booking.serviceType}
              </h2>
            </div>
            <div className="flex flex-col items-end gap-3 shrink-0">
              <div className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white shadow-lg shadow-blue-500/20">
                {booking.status.replace('_', ' ')}
              </div>
              {booking.assignedTo?.name === 'You (Self)' && (
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 uppercase tracking-widest">
                  Internal Ops
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Identity Matrix Card */}
        <div className="bg-white rounded-3xl p-6 mb-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                <FiUser className="w-8 h-8 text-gray-300" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Target Client</p>
                <p className="text-xl font-black text-gray-900 leading-tight tracking-tight uppercase">{booking.user?.name || booking.customerName || 'Client'}</p>
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">Verified Network</p>
              </div>
            </div>
            {(() => {
              const phone = booking.user?.phone || booking.customerPhone;
              if (phone) {
                return (
                  <motion.a
                    whileTap={{ scale: 0.9 }}
                    href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                    className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all cursor-pointer"
                  >
                    <FiPhone className="w-6 h-6 text-white" />
                  </motion.a>
                );
              }
              return (
                <button
                  onClick={() => alert('Phone number not available')}
                  className="w-14 h-14 rounded-2xl bg-gray-200 cursor-not-allowed flex items-center justify-center"
                  title="Phone number not available"
                >
                  <FiPhone className="w-6 h-6 text-gray-400" />
                </button>
              );
            })()}
          </div>
        </div>

        {/* Geospatial Deployment Base */}
        <div className="bg-white rounded-3xl p-6 mb-6 border border-gray-100 shadow-sm">
          <div className="flex items-start gap-5 mb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
              <FiMapPin className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Service Base Coordinates</p>
              <p className="text-base font-bold text-gray-800 leading-relaxed tracking-tight uppercase">{booking?.location?.address || 'Location not specified'}</p>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 uppercase tracking-widest">
                  {booking?.location?.distance || 'N/A'} Proximal
                </span>
              </div>
            </div>
          </div>

          <div className="w-full h-64 rounded-[32px] overflow-hidden mb-8 border border-white/5 relative group cursor-pointer shadow-2xl" onClick={() => navigate(`/vendor/booking/${booking.id}/map`)}>
            {(() => {
              const hasCoordinates = booking.location.lat && booking.location.lng && booking.location.lat !== 0 && booking.location.lng !== 0;
              const mapQuery = hasCoordinates ? `${booking.location.lat},${booking.location.lng}` : encodeURIComponent(booking.location.address);
              return (
                <>
                  <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    style={{ border: 0, pointerEvents: 'none' }}
                    src={`https://maps.google.com/maps?q=${mapQuery}&z=15&output=embed`}
                    allowFullScreen
                  />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                    <motion.span 
                      whileHover={{ scale: 1.05 }}
                      className="bg-blue-600 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-2xl"
                    >
                      Maximize Analytics
                    </motion.span>
                  </div>
                </>
              );
            })()}
          </div>

          <div className="flex gap-4">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(`/vendor/booking/${booking.id || id}/map`)}
              className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-gray-200 flex items-center justify-center gap-3 bg-white text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
            >
              <FiMapPin className="w-4 h-4 text-blue-600" />
              Base View
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const hasCoords = booking.location.lat && booking.location.lng;
                const dest = hasCoords ? `${booking.location.lat},${booking.location.lng}` : encodeURIComponent(booking.location.address);
                window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
              }}
              className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white flex items-center justify-center gap-3 bg-blue-600 shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all"
            >
              <FiNavigation className="w-4 h-4 text-blue-200" />
              Navigate
            </motion.button>
          </div>
        </div>

        {/* Schedule Intel */}
        <div className="bg-white rounded-3xl p-6 mb-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
              <FiClock className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Temporal Slot</p>
              <p className="text-base font-bold text-gray-800 tracking-tight">{booking?.timeSlot?.date || 'Date not set'}</p>
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-1">{booking?.timeSlot?.time || 'Time not set'}</p>
            </div>
          </div>
        </div>

        {/* Core Financial Invoice Module */}
        <div className="bg-white rounded-[32px] overflow-hidden border border-gray-100 mb-8 shadow-sm">
          <div className="bg-blue-600 px-8 py-10 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-[40px]" />
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-100 mb-3">Contractual Settlement</p>
            <h2 className="text-4xl font-black tracking-tighter">₹{finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${booking.paymentStatus === 'SUCCESS' || booking.paymentStatus === 'paid' ? 'bg-white/20 text-white' : 'bg-amber-400 text-black'}`}>
                {booking.paymentMethod?.replace('_', ' ') || 'UNPAID'} • {booking.paymentStatus || 'PENDING'}
              </div>
            </div>
            {isPlanBenefit && (
              <div className="inline-flex mt-4 bg-teal-500/20 text-teal-100 border border-teal-500/30 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">
                Internal Membership Applied
              </div>
            )}
          </div>
          <div className="p-8 space-y-8">
            {/* Core Provision Analytics */}
            <div>
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-3 mb-6">
                <span className="w-8 h-8 rounded-xl bg-gray-50 text-blue-600 flex items-center justify-center border border-gray-100"><FiActivity className="w-4 h-4" /></span>
                Core Provision Analytics
              </h4>
              <div className="space-y-4 pl-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-500 uppercase tracking-tight text-xs">Service Provision Base</span>
                  {isPlanBenefit ? (
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-gray-900 text-sm">₹0.00</span>
                      <span className="text-blue-600 font-black text-[8px] bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-widest mt-1">FREE</span>
                    </div>
                  ) : (
                    <span className="font-bold text-gray-900 text-sm">₹{originalBase.toFixed(2)}</span>
                  )}
                </div>

                {services.map((s, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="font-bold text-gray-500 uppercase tracking-tight text-xs">{s.name} × {s.quantity}</span>
                    <span className="font-bold text-gray-900 text-sm">₹{((parseFloat(s.price) || 0) * (parseFloat(s.quantity) || 1)).toFixed(2)}</span>
                  </div>
                ))}

                <div className="flex justify-between text-[10px] text-gray-400 font-black uppercase tracking-widest pt-4 border-t border-dashed border-gray-100">
                  <span>Operational Tax (18%)</span>
                  <span className="text-gray-900">₹{(originalGST + extraServiceGST).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Asset Logistics */}
            {(parts.length > 0 || customItems.length > 0) && (
              <div className="pt-8 border-t border-gray-100">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-3 mb-6">
                  <span className="w-8 h-8 rounded-xl bg-gray-50 text-amber-500 flex items-center justify-center border border-gray-100"><FiPackage className="w-4 h-4" /></span>
                  Component Logistics
                </h4>
                <div className="space-y-4 pl-1">
                  {parts.map((p, i) => (
                    <div key={`p-${i}`} className="flex justify-between items-center">
                      <span className="font-bold text-gray-500 uppercase tracking-tight text-xs">{p.name} × {p.quantity}</span>
                      <span className="font-bold text-gray-900 text-sm">₹{(p.price * p.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  {customItems.map((c, i) => (
                    <div key={`c-${i}`} className="flex justify-between items-center">
                      <span className="font-bold text-gray-500 uppercase tracking-tight text-xs">{c.name} × {c.quantity}</span>
                      <span className="font-bold text-gray-900 text-sm">₹{(c.price * c.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-[10px] text-gray-400 font-black uppercase tracking-widest pt-4 border-t border-dashed border-gray-100">
                    <span>Asset Tax (18%)</span>
                    <span className="text-gray-900">₹{partsGST.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Master Net Earnings Analytics */}
          {(booking.status === 'completed' || booking.status === 'work_done' || booking.cashCollected) ? (
            <div className="bg-blue-50 px-8 py-8 border-t border-gray-100">
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Core Provision Split ({bill?.payoutConfig?.serviceSplitPercentage || 70}%)</span>
                  <span className="font-bold text-blue-900 text-sm">₹{(bill?.vendorServiceEarning || (booking.vendorEarnings || 0)).toFixed(2)}</span>
                </div>
                {(parts.length > 0 || customItems.length > 0 || bill?.vendorPartsEarning > 0) && (
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Asset Logistics Split ({bill?.payoutConfig?.partsSplitPercentage || 10}%)</span>
                    <span className="font-bold text-blue-900 text-sm">₹{(bill?.vendorPartsEarning || 0).toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-end pt-6 border-t border-blue-100">
                <div className="flex flex-col">
                  <span className="text-gray-900 font-black text-[10px] uppercase tracking-widest">
                    Net Operational Intel
                  </span>
                  <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1">
                    {(booking?.paymentStatus === 'SUCCESS' || booking?.paymentStatus === 'paid' || booking?.cashCollected) ? 'Settled Value' : 'Projected Value'}
                  </span>
                </div>
                <span className="text-blue-600 font-black text-3xl tracking-tighter">
                  ₹{(bill?.vendorTotalEarning || booking.vendorEarnings || 0).toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 px-8 py-6 border-t border-gray-100 text-center">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center justify-center gap-3">
                <FiAlertCircle className="w-4 h-4 opacity-40" />
                Earnings data locked until completion
              </p>
            </div>
          )}
        </div>

        {/* Deployment Status & Action Hub */}
        <div className="space-y-6 pb-20">
          {/* Worker Context Card */}
          {booking.assignedTo && booking.assignedTo?.name !== 'You (Self)' && (
            <div className="bg-white rounded-3xl p-6 border border-gray-100 mb-6 shadow-sm">
              <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-100">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                    <FiUser className="w-8 h-8 text-gray-300" />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-lg tracking-tight uppercase">{booking?.assignedTo?.name || 'Assigned Agent'}</h3>
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">Operational Field Agent</p>
                  </div>
                </div>
                {booking?.assignedTo?.phone && (
                  <motion.a 
                    whileTap={{ scale: 0.9 }}
                    href={`tel:${booking.assignedTo.phone}`} 
                    className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all"
                  >
                    <FiPhone className="w-5 h-5 text-white" />
                  </motion.a>
                )}
              </div>

              {/* Status Visualization */}
              {!booking.workerResponse || booking.workerResponse === 'PENDING' ? (
                <div className="flex items-center gap-5 text-amber-600 bg-amber-50 p-6 rounded-2xl border border-amber-100">
                  <div className="w-12 h-12 rounded-xl bg-white border border-amber-100 flex items-center justify-center shrink-0">
                    <FiClock className="w-6 h-6 animate-pulse text-amber-500" />
                  </div>
                  <div>
                    <p className="font-black text-base text-gray-900 tracking-tight">Signal Pending</p>
                    <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mt-1">Awaiting Agent Acknowledgement</p>
                  </div>
                </div>
              ) : booking.workerResponse === 'ACCEPTED' ? (
                <div className="space-y-8">
                  {/* Deployment Pipeline Visual */}
                  <div className="relative px-2">
                    <div className="absolute left-8 right-8 top-[18px] h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ 
                          width: booking.status === 'completed' || booking.status === 'work_done' ? '100%' :
                                 booking.status === 'in_progress' || booking.status === 'visited' ? '66%' :
                                 booking.status === 'journey_started' ? '33%' : '0%' 
                        }}
                        className="h-full bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                      />
                    </div>

                    <div className="flex justify-between items-start relative z-10">
                      {[
                        { icon: FiCheck, label: 'Accepted', active: true },
                        { icon: FiNavigation, label: 'Deploy', active: ['journey_started', 'visited', 'in_progress', 'work_done', 'completed'].includes(booking.status) },
                        { icon: FiTool, label: 'Ops', active: ['visited', 'in_progress', 'work_done', 'completed'].includes(booking.status) },
                        { icon: FiCheckCircle, label: 'Done', active: ['work_done', 'completed'].includes(booking.status) }
                      ].map((step, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-700 shadow-lg ring-6 ring-white ${step.active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                            <step.icon className="w-5 h-5" />
                          </div>
                          <span className={`text-[8px] font-black uppercase tracking-widest transition-colors ${step.active ? 'text-blue-600' : 'text-gray-400'}`}>{step.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Primary Status Readout */}
                  <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center bg-white border border-gray-200 ${
                      booking.status === 'journey_started' ? 'text-blue-600' :
                      booking.status === 'in_progress' ? 'text-amber-600' :
                      ['work_done', 'completed'].includes(booking.status) ? 'text-green-600' :
                      'text-gray-400'
                    }`}>
                      <FiActivity className="w-7 h-7 opacity-80" />
                    </div>
                    <div>
                      <p className="font-black text-gray-900 text-lg tracking-tight mb-1 uppercase">
                        {booking.status === 'journey_started' ? 'In Transit' :
                         booking.status === 'visited' ? 'On Site' :
                         booking.status === 'in_progress' ? 'Ops Active' :
                         ['work_done', 'completed'].includes(booking.status) ? 'Ops Complete' :
                         'Agent Ready'}
                      </p>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {booking.status === 'journey_started' ? 'Live Geospatial Tracking Active' :
                         booking.status === 'visited' ? 'Awaiting Access Verification' :
                         booking.status === 'in_progress' ? 'Service Deployment in Progress' :
                         ['work_done', 'completed'].includes(booking.status) ? 'Awaiting Final Validation' :
                         'Standing by for Deployment'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-5 text-rose-600 bg-rose-50 p-6 rounded-2xl border border-rose-100">
                  <FiXCircle className="w-8 h-8 opacity-60" />
                  <div className="flex-1">
                    <p className="font-black text-base text-gray-900 tracking-tight uppercase">Signal Rejected</p>
                    <p className="text-[10px] text-rose-600 font-bold uppercase tracking-widest mt-1">Agent Declined Deployment</p>
                  </div>
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAssignWorker} 
                    className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
                  >
                    Recalibrate
                  </motion.button>
                </div>
              )}
            </div>
          )}

          {/* Service Deployment Protocol (Simplified Flow) */}
          {booking.offeringType !== 'PRODUCT' && !['completed', 'cancelled', 'rejected'].includes(booking.status) && (
            <div className="bg-white rounded-3xl p-8 border border-gray-100 mb-6 shadow-sm">
              <div className="text-center mb-8">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border shadow-md ${
                  ['requested', 'searching'].includes(booking.status) ? 'bg-blue-50 border-blue-100' : 'bg-emerald-50 border-emerald-100'
                }`}>
                  {['requested', 'searching'].includes(booking.status) ? (
                    <FiNavigation className="w-8 h-8 text-blue-600" />
                  ) : (
                    <FiTool className="w-8 h-8 text-emerald-600" />
                  )}
                </div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">
                  {['requested', 'searching'].includes(booking.status) ? 'New Request' : 'Active Operation'}
                </h3>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">
                  {['requested', 'searching'].includes(booking.status) ? 'Awaiting Your Acceptance' : 'Perform work and mark as completed'}
                </p>
              </div>

              <div className="flex flex-col items-center gap-3">
                {['requested', 'searching'].includes(booking.status) ? (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleStatusChange('confirmed')}
                    className="w-full max-w-sm py-5 rounded-2xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3"
                  >
                    <FiCheck className="w-5 h-5" />
                    Accept Booking Request
                  </motion.button>
                ) : !['work_done', 'completed'].includes(booking.status) ? (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsWorkDoneModalOpen(true)}
                    className="w-full max-w-sm py-5 rounded-2xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
                  >
                    <FiCheckCircle className="w-5 h-5" />
                    Work Done
                  </motion.button>
                ) : booking.status === 'work_done' ? (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCollectCashClick}
                    className="w-full max-w-sm py-5 rounded-2xl bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:bg-amber-700 transition-all flex items-center justify-center gap-3"
                  >
                    <FiDollarSign className="w-5 h-5" />
                    Finalize Billing
                  </motion.button>
                ) : null}
              </div>
            </div>
          )}

          {/* Product Fulfillment Hub */}
          {booking.offeringType === 'PRODUCT' && (
            <div className="bg-white rounded-3xl p-8 border border-gray-100 mb-6 shadow-sm">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-md">
                  <FiPackage className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">Fulfillment Hub</h3>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">Current Status: {booking.status.replace('_', ' ')}</p>
              </div>

              <div className="flex flex-col items-center gap-3">
                {getAvailableStatuses(booking.status, booking).map((nextStatus) => (
                  <motion.button
                    key={nextStatus}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleStatusChange(nextStatus)}
                    className="w-full max-w-sm py-5 rounded-2xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
                  >
                    <FiActivity className="w-5 h-5" />
                    {(nextStatus === 'confirmed' || nextStatus === 'accepted') && 'Accept & Confirm Order'}
                    {nextStatus === 'packed' && 'Pack Product'}
                    {nextStatus === 'shipped' && 'Ship Order'}
                    {nextStatus === 'out_for_delivery' && 'Mark Out for Delivery'}
                    {nextStatus === 'delivered' && 'Mark Delivered'}
                  </motion.button>
                ))}
                
                {booking.status === 'delivered' && (
                  <div className="flex items-center gap-3 text-emerald-600 bg-emerald-50 px-6 py-3 rounded-xl border border-emerald-100">
                    <FiCheckCircle className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Order Delivered Successfully</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cancellation Protocol */}
          {booking.offeringType !== 'PRODUCT' && !['completed', 'cancelled', 'rejected'].includes(booking.status) && (
            <div className="px-1">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleCancelJob}
                className="w-full py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center gap-4 mt-2"
              >
                <FiXCircle className="w-5 h-5" />
                Cancel Payment
              </motion.button>
            </div>
          )}
        </div>
      </main>

      {/* Persistence Layers (Modals) */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        type={confirmDialog.type}
      />

      <WorkerPaymentModal
        isOpen={isPayWorkerModalOpen}
        onClose={() => setIsPayWorkerModalOpen(false)}
        onSubmit={handlePayWorkerSubmit}
        booking={booking}
        loading={paySubmitting}
      />

      <VisitVerificationModal
        isOpen={isVisitModalOpen}
        onClose={() => setIsVisitModalOpen(false)}
        bookingId={id}
        onSuccess={handleVerifySuccess}
      />

      <WorkCompletionModal
        isOpen={isWorkDoneModalOpen}
        onClose={() => setIsWorkDoneModalOpen(false)}
        onComplete={handleCompleteWork}
        job={booking}
        loading={actionLoading}
      />

      <OtpVerificationModal
        isOpen={isOtpModalOpen}
        onClose={() => setIsOtpModalOpen(false)}
        onVerify={handleCashCollectionConfirm}
        booking={booking}
      />

        </motion.div>
      )}
    </AnimatePresence>
  );
}
