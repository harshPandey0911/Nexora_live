import React from 'react';
import { FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';

const Pagination = ({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
  className = ''
}) => {
  if (totalItems === 0 && totalPages <= 1) return null;

  const safeCurrentPage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems || safeCurrentPage * pageSize);

  // Generate page numbers with smart ellipsis
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);

      if (safeCurrentPage > 3) {
        pages.push('ellipsis-start');
      }

      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(totalPages - 1, safeCurrentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (safeCurrentPage < totalPages - 2) {
        pages.push('ellipsis-end');
      }

      pages.push(totalPages);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 bg-white px-4 py-3.5 rounded-2xl border border-gray-100 shadow-sm ${className}`}>
      {/* Left Info & Page Size */}
      <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
        <span>
          Showing <span className="text-gray-900 font-extrabold">{startItem}</span>–<span className="text-gray-900 font-extrabold">{endItem}</span> of{' '}
          <span className="text-gray-900 font-extrabold">{totalItems}</span> results
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2 border-l border-gray-200 pl-3">
            <span className="text-gray-400 font-medium">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right Page Controls */}
      <div className="flex items-center gap-1.5">
        {/* First Page Button */}
        <button
          onClick={() => onPageChange(1)}
          disabled={safeCurrentPage === 1}
          title="First Page"
          className="w-8 h-8 rounded-xl flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <FiChevronsLeft className="w-4 h-4" />
        </button>

        {/* Prev Page Button */}
        <button
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
          title="Previous Page"
          className="h-8 px-2.5 rounded-xl flex items-center gap-1 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs cursor-pointer"
        >
          <FiChevronLeft className="w-4 h-4" />
          <span className="hidden md:inline">Prev</span>
        </button>

        {/* Numbered Page Buttons */}
        <div className="flex items-center gap-1 mx-1">
          {pageNumbers.map((p, idx) => {
            if (p === 'ellipsis-start' || p === 'ellipsis-end') {
              return (
                <span key={`ellipsis-${idx}`} className="w-7 text-center text-xs font-bold text-gray-400">
                  ...
                </span>
              );
            }

            const isCurrent = p === safeCurrentPage;
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20 scale-105'
                    : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Page Button */}
        <button
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= totalPages}
          title="Next Page"
          className="h-8 px-2.5 rounded-xl flex items-center gap-1 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs cursor-pointer"
        >
          <span className="hidden md:inline">Next</span>
          <FiChevronRight className="w-4 h-4" />
        </button>

        {/* Last Page Button */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={safeCurrentPage >= totalPages}
          title="Last Page"
          className="w-8 h-8 rounded-xl flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <FiChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
