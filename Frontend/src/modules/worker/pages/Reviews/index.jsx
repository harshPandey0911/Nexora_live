import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiStar, FiUser, FiCalendar, FiSmile, FiChevronLeft, FiChevronRight, FiFilter } from 'react-icons/fi';
import Header from '../../components/layout/Header';
import workerService from '../../../../services/workerService';
import LogoLoader from '../../../../components/common/LogoLoader';

const Reviews = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [ratingStats, setRatingStats] = useState({
    avgRating: 0,
    totalReviews: 0,
    ratingCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  });
  const [reviews, setReviews] = useState([]);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalFilteredCount: 0,
    hasNextPage: false,
    hasPrevPage: false
  });

  const fetchReviews = useCallback(async (page = 1, filter = activeFilter, isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setFetching(true);

      const params = {
        page,
        limit: 6,
      };

      if (filter !== 'ALL') {
        params.rating = filter;
      }

      const res = await workerService.getReviews(params);

      if (res.success && res.data) {
        setReviews(res.data.reviews || []);
        if (res.data.stats) {
          setRatingStats(res.data.stats);
        }
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (error) {
      console.error('Error fetching worker reviews:', error);
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [activeFilter]);

  // Initial Load
  useEffect(() => {
    fetchReviews(1, 'ALL', true);
  }, []);

  // Filter change handler
  const handleFilterChange = (filterId) => {
    setActiveFilter(filterId);
    fetchReviews(1, filterId, false);
  };

  // Page change handler
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchReviews(newPage, activeFilter, false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading) {
    return <LogoLoader />;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header title="Customer Reviews" showBack={true} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ── LEFT COLUMN: RATING SCORE & FILTERS (lg:col-span-5) ── */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            
            {/* TOP SCORE SUMMARY BANNER */}
            <div className="rounded-3xl bg-gradient-to-br from-purple-950 via-slate-900 to-teal-950 p-6 sm:p-7 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 space-y-6">
                {/* Average Rating Block */}
                <div className="border-b border-white/10 pb-5">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-300">Overall Rating</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-5xl font-black tracking-tight">{ratingStats.avgRating > 0 ? ratingStats.avgRating.toFixed(1) : '0.0'}</span>
                    <span className="text-amber-400 text-3xl font-black">★</span>
                    <span className="text-sm text-purple-200 font-semibold">/ 5.0</span>
                  </div>
                  <p className="text-xs text-purple-200 mt-1.5 font-medium">
                    Based on {ratingStats.totalReviews} verified {ratingStats.totalReviews === 1 ? 'review' : 'reviews'}
                  </p>
                </div>

                {/* Star Distribution Breakdown */}
                <div className="space-y-2.5">
                  {[5, 4, 3, 2, 1].map(stars => {
                    const count = ratingStats.ratingCounts[stars] || 0;
                    const percentage = ratingStats.totalReviews > 0 
                      ? Math.round((count / ratingStats.totalReviews) * 100) 
                      : 0;

                    return (
                      <div key={stars} className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 w-12 text-purple-200 font-bold shrink-0">
                          <span>{stars}</span>
                          <FiStar className="w-3 h-3 fill-amber-400 text-amber-400" />
                        </div>

                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>

                        <span className="w-10 text-right text-purple-200 font-semibold text-[11px] shrink-0">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* FILTER TABS CARD */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                <FiFilter className="w-4 h-4 text-teal-600" />
                <span>Filter Reviews</span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { id: 'ALL', label: 'All Reviews' },
                  { id: '5', label: '5 Stars ★' },
                  { id: '4', label: '4 Stars ★' },
                  { id: '3', label: '3 Stars ★' },
                  { id: '2', label: '2 Stars ★' },
                  { id: '1', label: '1 Star ★' },
                ].map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => handleFilterChange(filter.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      activeFilter === filter.id
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* ── RIGHT COLUMN: REVIEWS FEED & PAGINATION (lg:col-span-7) ── */}
          <div className="lg:col-span-7 space-y-4">
            
            <div className="flex items-center justify-between px-1">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Customer Feedback</h3>
              {pagination.totalFilteredCount > 0 && (
                <span className="text-xs font-semibold text-slate-500">
                  Showing {reviews.length} of {pagination.totalFilteredCount}
                </span>
              )}
            </div>

            {fetching ? (
              <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm">
                <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-600">Loading reviews...</p>
              </div>
            ) : reviews.length > 0 ? (
              <div className="space-y-4">
                <div className="space-y-3.5">
                  {reviews.map((rev, index) => (
                    <div
                      key={rev._id || index}
                      className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-teal-500/10 border border-teal-200 flex items-center justify-center text-teal-800 font-bold text-sm shrink-0">
                            {rev.userId?.name ? rev.userId.name.charAt(0) : <FiUser className="w-5 h-5" />}
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{rev.userId?.name || 'Verified Customer'}</h4>
                            <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                              <FiCalendar className="w-3 h-3 text-slate-400" />
                              {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent Service'}
                              {rev.serviceId?.title && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="text-teal-700 font-semibold">{rev.serviceId.title}</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Rating Stars Pill */}
                        <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl text-amber-800 text-xs font-black shrink-0">
                          <FiStar className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          <span>{rev.rating || 5}.0</span>
                        </div>
                      </div>

                      {/* Review Text */}
                      {rev.review ? (
                        <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100 italic">
                          "{rev.review}"
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 italic font-medium">Customer rated without written feedback.</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* ── PAGINATION CONTROLS ── */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between bg-white px-5 py-4 rounded-3xl border border-slate-200/80 shadow-sm mt-6">
                    <button
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      disabled={!pagination.hasPrevPage}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-100 transition-all active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <FiChevronLeft className="w-4 h-4" />
                      <span>Previous</span>
                    </button>

                    <div className="text-xs font-extrabold text-slate-700">
                      Page <span className="text-teal-700">{pagination.currentPage}</span> of {pagination.totalPages}
                    </div>

                    <button
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      disabled={!pagination.hasNextPage}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-100 transition-all active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <span>Next</span>
                      <FiChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200 shadow-sm space-y-3">
                <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center mx-auto">
                  <FiSmile className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-slate-900">No Reviews Found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                  {activeFilter === 'ALL'
                    ? 'You do not have any customer reviews yet. Complete service jobs to earn ratings!'
                    : `No reviews found with ${activeFilter} stars.`}
                </p>
                <button
                  onClick={() => navigate('/worker/jobs')}
                  className="mt-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md hover:bg-slate-800 transition-all active:scale-95"
                >
                  Go to Assigned Jobs
                </button>
              </div>
            )}

          </div>

        </div>
      </main>
    </div>
  );
};

export default Reviews;
