import React from 'react';
import { FiX, FiStar, FiUser, FiMessageSquare } from 'react-icons/fi';

const WorkerRatingsModal = ({ isOpen, onClose, rating = 0, totalReviews = 0, reviewsList = [] }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-purple-500/10 text-purple-700 flex items-center justify-center font-bold">
              <FiStar className="w-5 h-5 fill-purple-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Ratings & Customer Reviews</h3>
              <p className="text-xs text-slate-500 font-medium">Feedback received from completed service jobs</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-all active:scale-95"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Summary Score Card */}
          <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-5 text-white flex items-center justify-between shadow-lg">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-purple-200">Overall Score</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-black">{Number(rating || 0).toFixed(1)}</span>
                <span className="text-amber-400 text-2xl font-black">★</span>
                <span className="text-xs text-purple-200 font-medium">/ 5.0</span>
              </div>
              <p className="text-xs text-purple-200 font-medium mt-1">
                Based on {totalReviews} {totalReviews === 1 ? 'customer review' : 'customer reviews'}
              </p>
            </div>

            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex flex-col items-center justify-center text-center p-2">
              <FiMessageSquare className="w-6 h-6 text-amber-300" />
              <span className="text-[9px] font-bold text-white mt-1 uppercase">Feedback</span>
            </div>
          </div>

          {/* Customer Reviews List */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">Recent Customer Reviews</h4>

            {Array.isArray(reviewsList) && reviewsList.length > 0 ? (
              <div className="space-y-3">
                {reviewsList.map((rev, idx) => (
                  <div key={rev._id || idx} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                          {rev.userId?.name ? rev.userId.name.charAt(0) : <FiUser className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{rev.userId?.name || 'Customer'}</p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : 'Verified Customer'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-lg text-xs font-black">
                        <FiStar className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span>{rev.rating || 5}</span>
                      </div>
                    </div>

                    {rev.review && (
                      <p className="text-xs text-slate-600 font-medium leading-relaxed italic bg-white p-2.5 rounded-xl border border-slate-100">
                        "{rev.review}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <FiStar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No Customer Reviews Yet</p>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">
                  Complete your assigned service jobs to receive ratings and feedback from customers.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md hover:bg-slate-800 transition-all active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkerRatingsModal;
