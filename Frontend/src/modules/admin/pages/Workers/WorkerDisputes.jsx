import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiAlertTriangle,
  FiStar,
  FiCheckCircle,
  FiXCircle,
  FiRefreshCw,
  FiUser,
  FiBriefcase,
  FiMessageSquare,
  FiClock,
  FiX,
  FiShield,
  FiFileText
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import workerService from '../../services/workerService';
import Pagination from '../../../../components/common/Pagination';

const WorkerDisputes = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('disputes'); // 'disputes' | 'ratings'
  const [disputesData, setDisputesData] = useState({
    lowRatingReviews: [],
    disputedBookings: []
  });
  const [stats, setStats] = useState({
    flaggedReviewsCount: 0,
    disputedBookingsCount: 0
  });

  // Pagination for Disputes
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Resolve Dispute Modal State
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [resolutionAction, setResolutionAction] = useState('dismiss');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  // Moderate Rating Modal State
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [ratingAction, setRatingAction] = useState('dismiss');
  const [ratingReason, setRatingReason] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  useEffect(() => {
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      const res = await workerService.getWorkerDisputes();
      if (res.success) {
        setDisputesData(res.data || { lowRatingReviews: [], disputedBookings: [] });
        if (res.stats) {
          setStats(res.stats);
        }
      }
    } catch (error) {
      console.error('Error fetching worker disputes:', error);
      toast.error('Failed to load worker disputes');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenResolveModal = (dispute) => {
    setSelectedDispute(dispute);
    setResolutionAction('dismiss');
    setResolutionNotes('');
    setResolveModalOpen(true);
  };

  const handleConfirmResolve = async (e) => {
    e.preventDefault();
    if (!selectedDispute?._id) return;

    try {
      setResolving(true);
      const res = await workerService.resolveWorkerDispute(selectedDispute._id, {
        resolutionAction,
        resolutionNotes
      });

      if (res.success) {
        toast.success('Dispute resolved successfully');
        setResolveModalOpen(false);
        fetchDisputes();
      }
    } catch (error) {
      console.error('Error resolving dispute:', error);
      toast.error(error.response?.data?.message || 'Failed to resolve dispute');
    } finally {
      setResolving(false);
    }
  };

  const handleOpenRatingModal = (review) => {
    setSelectedReview(review);
    setRatingAction('dismiss');
    setRatingReason('');
    setRatingModalOpen(true);
  };

  const handleConfirmRatingModeration = async (e) => {
    e.preventDefault();
    if (!selectedReview?._id) return;

    try {
      setRatingSubmitting(true);
      const res = await workerService.moderateWorkerRating(selectedReview._id, {
        action: ratingAction,
        reason: ratingReason
      });

      if (res.success) {
        toast.success(res.message || 'Worker review moderated successfully');
        setRatingModalOpen(false);
        fetchDisputes();
      }
    } catch (error) {
      console.error('Error moderating review:', error);
      toast.error(error.response?.data?.message || 'Failed to moderate review');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const listItems = activeTab === 'disputes' ? disputesData.disputedBookings : disputesData.lowRatingReviews;
  const paginatedItems = listItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(listItems.length / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Top Header Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-gradient-to-br from-rose-600 to-red-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-rose-100 mb-1">Disputed Booking & Salary Claims</p>
              <h3 className="text-3xl font-black tracking-tight">{stats.disputedBookingsCount || 0} Active Claims</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
              <FiAlertTriangle className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-rose-100/90 font-medium">Pending admin arbitration and fund release</p>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-purple-100 mb-1">Low Rating Reviews Flagged</p>
              <h3 className="text-3xl font-black tracking-tight">{stats.flaggedReviewsCount || 0} Reviews</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
              <FiStar className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-purple-100/90 font-medium">Ratings $\le 2$ stars flagged for admin moderation</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-2xl p-2 border border-gray-100 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab('disputes');
              setCurrentPage(1);
            }}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
              activeTab === 'disputes'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FiAlertTriangle className="w-4 h-4" />
            Booking & Salary Disputes ({disputesData.disputedBookings.length})
          </button>

          <button
            onClick={() => {
              setActiveTab('ratings');
              setCurrentPage(1);
            }}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
              activeTab === 'ratings'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FiStar className="w-4 h-4" />
            Rating Moderation Queue ({disputesData.lowRatingReviews.length})
          </button>
        </div>

        <button
          onClick={() => fetchDisputes()}
          className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-all"
          title="Refresh Queue"
        >
          <FiRefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400 space-y-3">
            <div className="w-10 h-10 border-4 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-gray-600">Loading worker moderation queue...</p>
          </div>
        ) : paginatedItems.length === 0 ? (
          <div className="py-20 text-center text-gray-400 space-y-3">
            <FiCheckCircle className="w-12 h-12 mx-auto text-emerald-400" />
            <p className="font-bold text-gray-700 text-base">No Active Disputes or Flagged Reviews</p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">All worker disputes and low ratings are fully resolved!</p>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {activeTab === 'disputes' ? (
              paginatedItems.map((booking) => (
                <div
                  key={booking._id}
                  className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black uppercase rounded-lg border border-rose-200">
                        {booking.status}
                      </span>
                      <p className="font-mono text-xs font-bold text-gray-900">ID: #{booking.bookingId || booking._id?.slice(-6)}</p>
                    </div>

                    <p className="font-bold text-gray-900 text-sm">{booking.serviceName || 'Service Booking'}</p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 font-medium">
                      <span>Worker: <strong>{booking.workerId?.name || 'Assigned Worker'}</strong> ({booking.workerId?.phone})</span>
                      <span>Vendor: <strong>{booking.vendorId?.name || 'Vendor Boss'}</strong></span>
                      <span>Customer: <strong>{booking.userId?.name || 'Customer'}</strong></span>
                    </div>

                    {booking.adminResolution && (
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs text-slate-700 mt-2">
                        <span className="font-bold text-slate-900">Resolution Action:</span> {booking.adminResolution.action} — "{booking.adminResolution.notes}"
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0 space-y-2">
                    <p className="text-xl font-black text-rose-600">₹{Number(booking.totalAmount || 0).toLocaleString('en-IN')}</p>
                    <button
                      type="button"
                      onClick={() => handleOpenResolveModal(booking)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-500/20 transition-all flex items-center gap-1.5"
                    >
                      <FiShield className="w-3.5 h-3.5" />
                      Arbitrate & Resolve
                    </button>
                  </div>
                </div>
              ))
            ) : (
              paginatedItems.map((review) => (
                <div
                  key={review._id}
                  className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-amber-500 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 text-xs font-black">
                        <FiStar className="w-3.5 h-3.5 fill-amber-400" />
                        {review.rating} / 5 Stars
                      </div>
                      <span className="text-xs text-gray-400 font-medium">
                        By {review.userId?.name || 'Customer'}
                      </span>
                    </div>

                    <p className="text-xs text-gray-800 italic bg-purple-50/50 p-3 rounded-xl border border-purple-100">
                      "{review.comment || 'No written comment provided.'}"
                    </p>

                    <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                      <span>Worker Rated: <strong>{review.workerId?.name || 'Worker'}</strong> ({review.workerId?.phone})</span>
                    </div>
                  </div>

                  <div className="shrink-0 space-y-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenRatingModal(review)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-500/20 transition-all flex items-center gap-1.5"
                    >
                      <FiShield className="w-3.5 h-3.5" />
                      Moderate Rating
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Global Standard Pagination Bar */}
        {!loading && listItems.length > 0 && (
          <div className="p-4 border-t border-gray-100">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={listItems.length}
              pageSize={pageSize}
              onPageChange={(p) => setCurrentPage(p)}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              className="my-0"
            />
          </div>
        )}
      </div>

      {/* Resolve Dispute Modal */}
      {resolveModalOpen && selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100 text-gray-900"
          >
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                  <FiAlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Arbitrate Dispute</h3>
                  <p className="text-xs text-gray-500">Booking #{selectedDispute.bookingId || selectedDispute._id?.slice(-6)}</p>
                </div>
              </div>
              <button
                onClick={() => setResolveModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmResolve} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Resolution Action</label>
                <select
                  value={resolutionAction}
                  onChange={(e) => setResolutionAction(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="dismiss">Dismiss Dispute Ticket</option>
                  <option value="issue_warning">Issue Warning Notice to Worker</option>
                  <option value="adjust_payout">Approve Worker Payout</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Resolution Notes</label>
                <textarea
                  required
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Enter official arbitration findings..."
                  className="w-full p-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setResolveModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-500/25 transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {resolving ? 'Processing...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Moderate Rating Modal */}
      {ratingModalOpen && selectedReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100 text-gray-900"
          >
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                  <FiStar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Moderate Rating</h3>
                  <p className="text-xs text-gray-500">Worker: {selectedReview.workerId?.name || 'Worker'}</p>
                </div>
              </div>
              <button
                onClick={() => setRatingModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRatingModeration} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Moderation Action</label>
                <select
                  value={ratingAction}
                  onChange={(e) => setRatingAction(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="dismiss">Dismiss & Remove Unfair Review</option>
                  <option value="hide">Hide Review from Public</option>
                  <option value="keep">Confirm & Keep Review</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reason / Notes</label>
                <textarea
                  required
                  rows={3}
                  value={ratingReason}
                  onChange={(e) => setRatingReason(e.target.value)}
                  placeholder="State reason for rating moderation..."
                  className="w-full p-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setRatingModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ratingSubmitting}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {ratingSubmitting ? 'Processing...' : 'Apply Moderation'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default WorkerDisputes;
