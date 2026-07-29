import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiStar, FiUser, FiMessageSquare, FiFilter, 
  FiLoader, FiArrowUp, FiArrowDown, FiClock, FiTrendingUp 
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { getRatings } from '../../services/bookingService';
import Pagination from '../../../../components/common/Pagination';

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
      <div className="flex items-center gap-2 text-xs">
        <div className="flex items-center gap-1 w-7 shrink-0">
          <span className="font-bold text-gray-700">{star}</span>
          <FiStar className="w-3 h-3 text-amber-400 fill-amber-400" />
        </div>
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-[10px] font-bold text-gray-400 w-5 text-right shrink-0">{count}</span>
      </div>
    );
  };

  const { pages, total } = pagination;

  const activeSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Sort';
  const activeFilterLabel = filterRating === 'all' ? 'All Reviews' : `${filterRating} Stars`;

  if (isLoading && currentPage === 1 && !stats) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <FiLoader className="w-8 h-8 text-[#00246b] animate-spin mx-auto mb-2" />
          <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">
            Loading Ratings & Reviews...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 pb-16">
      {/* Page Header */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs flex flex-row items-center justify-between text-gray-900 border border-gray-100 gap-3">
        <div>
          <h2 className="text-base sm:text-xl font-bold text-gray-900 tracking-tight leading-tight capitalize">
            Reputation Hub
          </h2>
          <p className="text-gray-500 text-[10px] sm:text-xs font-medium mt-0.5">
            Monitor customer satisfaction ratings and service feedback
          </p>
        </div>
        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-amber-50 rounded-xl border border-amber-100 flex items-center justify-center text-amber-500 shrink-0">
          <FiStar className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-400" />
        </div>
      </div>

      {/* Overall Rating Stats Card */}
      {stats && (
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-gray-100 shadow-2xs relative overflow-hidden">
          <div className="flex flex-col sm:grid sm:grid-cols-5 gap-3 relative z-10">
            <div className="sm:col-span-2 flex flex-col items-center justify-center sm:border-r border-gray-100 py-1">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                {stats.averageRating?.toFixed(1) || '0.0'}
              </h2>
              <div className="flex gap-0.5 my-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <FiStar
                    key={s}
                    className={`w-3.5 h-3.5 ${s <= Math.round(stats.averageRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-100'}`}
                  />
                ))}
              </div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                {stats.totalReviews} Total Reviews
              </p>
            </div>
            <div className="sm:col-span-3 space-y-1.5 py-1">
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
      <div className="space-y-3">
        {/* Toolbar: title + sort + filter */}
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div>
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Customer Feedback</h3>
            <p className="text-[9px] font-medium text-gray-400">
              {total > 0 ? `${total} review${total !== 1 ? 's' : ''}` : 'No reviews yet'}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => { setIsSortOpen(!isSortOpen); setIsFilterOpen(false); }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  isSortOpen || sortBy !== 'newest'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <FiTrendingUp className="w-3 h-3" />
                <span>{activeSortLabel}</span>
              </button>
              {isSortOpen && (
                <div className="absolute right-0 top-9 bg-white border border-gray-100 rounded-xl shadow-xl z-30 py-1 min-w-[150px]">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleSortChange(opt.value)}
                      className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                        sortBy === opt.value ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <opt.icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter dropdown */}
            <div className="relative">
              <button
                onClick={() => { setIsFilterOpen(!isFilterOpen); setIsSortOpen(false); }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  isFilterOpen || filterRating !== 'all'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <FiFilter className="w-3 h-3" />
                <span>{activeFilterLabel}</span>
              </button>
              {isFilterOpen && (
                <div className="absolute right-0 top-9 bg-white border border-gray-100 rounded-xl shadow-xl z-30 py-1 min-w-[140px]">
                  {FILTER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleFilterChange(opt.value)}
                      className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
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
          <div className="bg-white rounded-xl p-10 text-center border border-gray-100 shadow-2xs">
            <FiLoader className="w-7 h-7 text-blue-600 animate-spin mx-auto mb-2" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Loading reviews...
            </span>
          </div>
        ) : ratings.length > 0 ? (
          <div className="space-y-2.5">
            {ratings.map((rating, idx) => (
              <div
                key={rating._id || idx}
                className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-2xs hover:border-gray-200 transition-all space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100 shrink-0">
                      {rating.userId?.profilePhoto ? (
                        <img src={rating.userId.profilePhoto} alt={rating.userId.name} className="w-full h-full object-cover" />
                      ) : (
                        <FiUser className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-900 text-xs truncate capitalize">
                        {rating.userId?.name || 'Customer'}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <FiStar
                              key={s}
                              className={`w-3 h-3 ${s <= rating.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
                            />
                          ))}
                        </div>
                        <span className="text-[9px] font-medium text-gray-400">
                          {formatDate(rating.reviewedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0 uppercase tracking-wider">
                    {rating.serviceId?.title || rating.serviceName || 'Service'}
                  </span>
                </div>

                {rating.review && (
                  <p className="text-gray-700 text-xs leading-relaxed font-medium pl-2.5 border-l-2 border-amber-400 italic">
                    "{rating.review}"
                  </p>
                )}

                {rating.reviewImages?.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pt-1 scrollbar-hide">
                    {rating.reviewImages.map((img, i) => (
                      <img key={i} src={img} className="w-16 h-16 rounded-lg object-cover shrink-0 border border-gray-100 shadow-2xs" alt="Review" />
                    ))}
                  </div>
                )}

                {rating.workerId && (
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[9px] font-semibold text-gray-400">
                    <div>
                      <span>Assigned Operative: </span>
                      <span className="font-bold text-gray-800 capitalize">{rating.workerId.name}</span>
                    </div>
                    <span className="font-bold text-gray-500">#{rating.bookingNumber}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-10 text-center border border-dashed border-gray-200 shadow-2xs">
            <FiMessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 font-bold capitalize tracking-widest text-[10px]">
              {filterRating !== 'all' ? `No ${filterRating}-star reviews found` : 'No customer reviews recorded yet'}
            </p>
          </div>
        )}

        {/* Pagination Controls */}
        {!isLoading && total > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={pages}
            totalItems={total}
            pageSize={LIMIT}
            onPageChange={(p) => setCurrentPage(p)}
            className="mt-3"
          />
        )}
      </div>
    </div>
  );
};

export default MyRatings;
