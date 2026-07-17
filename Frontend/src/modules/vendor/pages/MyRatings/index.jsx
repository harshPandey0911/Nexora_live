import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiStar, FiUser, FiMessageSquare, FiFilter, FiLoader, FiChevronLeft, FiChevronRight, FiArrowUp, FiArrowDown, FiClock, FiTrendingUp } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { getRatings } from '../../services/bookingService';

const SORT_OPTIONS = [
  { value: 'newest',  label: 'Newest First',  icon: FiClock },
  { value: 'oldest',  label: 'Oldest First',  icon: FiClock },
  { value: 'highest', label: 'Highest Rated', icon: FiArrowUp },
  { value: 'lowest',  label: 'Lowest Rated',  icon: FiArrowDown },
];

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Reviews' },
  { value: '5',   label: '5 Stars ⭐' },
  { value: '4',   label: '4 Stars ⭐' },
  { value: '3',   label: '3 Stars ⭐' },
  { value: '2',   label: '2 Stars ⭐' },
  { value: '1',   label: '1 Star ⭐'  },
];

const LIMIT = 6;

const MyRatings = () => {
  const navigate = useNavigate();
  const [ratings, setRatings]     = useState([]);
  const [stats, setStats]         = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: LIMIT, total: 0, pages: 1 });
  const [currentPage, setCurrentPage] = useState(1);

  const [filterRating, setFilterRating] = useState('all');
  const [sortBy, setSortBy]             = useState('newest');

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen,   setIsSortOpen]   = useState(false);

  const fetchRatings = useCallback(async (page, rating, sort) => {
    try {
      setIsLoading(true);
      const response = await getRatings({
        page,
        limit: LIMIT,
        rating: rating === 'all' ? undefined : rating,
        sort,
      });
      if (response.success) {
        setRatings(response.data);
        setStats(response.stats);
        setPagination(response.pagination);
      } else {
        toast.error(response.message || 'Failed to fetch ratings');
      }
    } catch (error) {
      console.error('Error fetching ratings:', error);
      toast.error('Failed to load ratings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRatings(currentPage, filterRating, sortBy);
  }, [currentPage, filterRating, sortBy, fetchRatings]);

  const handleFilterChange = (value) => {
    setFilterRating(value);
    setCurrentPage(1);
    setIsFilterOpen(false);
  };

  const handleSortChange = (value) => {
    setSortBy(value);
    setCurrentPage(1);
    setIsSortOpen(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const RatingBar = ({ star, count, total }) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 w-8">
          <span className="text-xs font-semibold text-gray-600">{star}</span>
          <FiStar className="w-3 h-3 text-amber-400 fill-amber-400" />
        </div>
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs font-bold text-gray-500 w-6 text-right">{count}</span>
      </div>
    );
  };

  // ── Pagination helpers ──────────────────────────────────────────────────
  const { page, pages, total } = pagination;

  const buildPageNumbers = () => {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    const arr = [];
    if (page <= 4) {
      arr.push(1, 2, 3, 4, 5, '…', pages);
    } else if (page >= pages - 3) {
      arr.push(1, '…', pages - 4, pages - 3, pages - 2, pages - 1, pages);
    } else {
      arr.push(1, '…', page - 1, page, page + 1, '…', pages);
    }
    return arr;
  };

  const activeSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Sort';
  const activeFilterLabel = filterRating === 'all' ? 'All Reviews' : `${filterRating} Stars`;

  if (isLoading && currentPage === 1 && !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FiLoader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-6" />
          <p className="text-gray-400 font-bold text-[10px] capitalize tracking-[0.3em]">
            Analyzing Feedback Ecosystem...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12">
      {/* Page Header */}
      <div className="hidden md:flex bg-white p-5 rounded-2xl shadow-sm flex-row items-center justify-between text-gray-900 border border-gray-100 gap-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight leading-none">
            Reputation Hub
          </h2>
          <p className="text-gray-500 text-[11px] font-semibold mt-2">
            Monitor service quality and operational feedback scores
          </p>
        </div>
        <div className="w-12 h-12 bg-amber-50 rounded-xl border border-amber-100 flex items-center justify-center shadow-inner">
          <FiStar className="w-6 h-6 text-amber-400 fill-amber-400" />
        </div>
      </div>

      {/* Overall Rating Stats */}
      {stats && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/5 rounded-full blur-[80px] -mr-32 -mt-32" />
          <div className="flex flex-col md:grid md:grid-cols-5 gap-4 relative z-10">
            <div className="md:col-span-2 flex flex-col items-center justify-center md:border-r border-gray-100 py-1">
              <h2 className="text-4xl font-black text-gray-900 mb-1 tracking-tighter">
                {stats.averageRating?.toFixed(1) || '0.0'}
              </h2>
              <div className="flex gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <FiStar
                    key={s}
                    className={`w-4 h-4 ${s <= Math.round(stats.averageRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-100'}`}
                  />
                ))}
              </div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                {stats.totalReviews} Reviews
              </p>
            </div>
            <div className="md:col-span-3 space-y-2 py-1">
              <RatingBar star={5} count={stats.star5} total={stats.totalReviews} />
              <RatingBar star={4} count={stats.star4} total={stats.totalReviews} />
              <RatingBar star={3} count={stats.star3} total={stats.totalReviews} />
              <RatingBar star={2} count={stats.star2} total={stats.totalReviews} />
              <RatingBar star={1} count={stats.star1} total={stats.totalReviews} />
            </div>
          </div>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">

        {/* Toolbar: title + sort + filter */}
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <h3 className="text-sm font-bold text-gray-900 tracking-tight">Customer Feedback</h3>
            <p className="text-[10px] font-semibold text-gray-400 mt-0.5">
              {total > 0 ? `${total} review${total !== 1 ? 's' : ''}` : 'No reviews yet'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => { setIsSortOpen(!isSortOpen); setIsFilterOpen(false); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all shadow-sm ${
                  isSortOpen || sortBy !== 'newest'
                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                    : 'bg-white text-gray-500 border-gray-200 hover:text-blue-600'
                }`}
              >
                <FiTrendingUp className="w-3 h-3" />
                {activeSortLabel}
              </button>
              {isSortOpen && (
                <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1.5 min-w-[160px]">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleSortChange(opt.value)}
                      className={`w-full text-left px-4 py-2.5 text-xs font-bold flex items-center gap-2 transition-colors ${
                        sortBy === opt.value ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <opt.icon className="w-3.5 h-3.5 flex-shrink-0" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter dropdown */}
            <div className="relative">
              <button
                onClick={() => { setIsFilterOpen(!isFilterOpen); setIsSortOpen(false); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all shadow-sm ${
                  isFilterOpen || filterRating !== 'all'
                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                    : 'bg-white text-gray-500 border-gray-200 hover:text-blue-600'
                }`}
              >
                <FiFilter className="w-3 h-3" />
                {activeFilterLabel}
              </button>
              {isFilterOpen && (
                <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1.5 min-w-[150px]">
                  {FILTER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleFilterChange(opt.value)}
                      className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors ${
                        filterRating === opt.value ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Backdrop to close dropdowns */}
        {(isFilterOpen || isSortOpen) && (
          <div
            className="fixed inset-0 z-20"
            onClick={() => { setIsFilterOpen(false); setIsSortOpen(false); }}
          />
        )}

        {/* Review Cards */}
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <FiLoader className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Loading reviews...
            </span>
          </div>
        ) : ratings.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {ratings.map((rating, idx) => (
              <div
                key={rating._id || idx}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100 shrink-0 shadow-inner">
                      {rating.userId?.profilePhoto ? (
                        <img src={rating.userId.profilePhoto} alt={rating.userId.name} className="w-full h-full object-cover" />
                      ) : (
                        <FiUser className="w-5 h-5 text-gray-300" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm tracking-tight capitalize">
                        {rating.userId?.name || 'Authorized Client'}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <FiStar
                              key={s}
                              className={`w-3 h-3 ${s <= rating.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-semibold text-gray-400">
                          {formatDate(rating.reviewedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 shrink-0">
                    <span className="text-[10px] font-bold text-blue-600 capitalize">
                      {rating.serviceId?.title || rating.serviceName || '—'}
                    </span>
                  </div>
                </div>

                {rating.review && (
                  <p className="text-gray-600 text-xs leading-relaxed font-medium mt-4 pl-3 border-l-2 border-blue-500/30 italic">
                    "{rating.review}"
                  </p>
                )}

                {rating.reviewImages?.length > 0 && (
                  <div className="flex gap-2.5 overflow-x-auto mt-4 pb-1 scrollbar-hide">
                    {rating.reviewImages.map((img, i) => (
                      <img key={i} src={img} className="w-20 h-20 rounded-xl object-cover shrink-0 border border-gray-100 shadow-sm" alt="Review" />
                    ))}
                  </div>
                )}

                {rating.workerId && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">By:</span>
                      <span className="text-[11px] font-bold text-gray-700 capitalize">{rating.workerId.name}</span>
                    </div>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                      #{rating.bookingNumber}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
              <FiMessageSquare className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-400 font-bold capitalize tracking-widest text-[10px]">
              {filterRating !== 'all' ? `No ${filterRating}-star reviews found` : 'No reviews yet'}
            </p>
          </div>
        )}

        {/* ── Pagination Controls ─────────────────────────────────────────── */}
        {pages > 1 && (
          <div className="flex items-center justify-between gap-2 pt-2">
            {/* Info */}
            <p className="text-[11px] font-bold text-gray-400 hidden sm:block">
              Page {page} of {pages} · {total} review{total !== 1 ? 's' : ''}
            </p>

            {/* Controls */}
            <div className="flex items-center gap-1 mx-auto sm:mx-0">
              {/* Prev */}
              <button
                disabled={page <= 1 || isLoading}
                onClick={() => setCurrentPage(p => p - 1)}
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <FiChevronLeft className="w-4 h-4" />
              </button>

              {/* Page numbers */}
              {buildPageNumbers().map((p, i) =>
                p === '…' ? (
                  <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm font-bold">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    disabled={isLoading}
                    onClick={() => setCurrentPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border ${
                      currentPage === p
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

              {/* Next */}
              <button
                disabled={page >= pages || isLoading}
                onClick={() => setCurrentPage(p => p + 1)}
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <FiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyRatings;
