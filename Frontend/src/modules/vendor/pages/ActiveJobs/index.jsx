import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBriefcase, FiMapPin, FiClock, FiUser, FiSearch, FiChevronRight, FiCheck, FiX, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { getBookings, acceptBooking, rejectBooking } from '../../services/bookingService';
import { ConfirmDialog, RejectionReasonModal } from '../../components/common';
import Pagination from '../../../../components/common/Pagination';

const ActiveJobs = memo(() => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [jobs, setJobs] = useState(() => {
    const cached = localStorage.getItem('vendorJobsList');
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [rejectingJobId, setRejectingJobId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { }
  });

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const loadJobs = useCallback(async (currentFilter, currentSearch) => {
    try {
      if (isInitialLoad) setLoading(true);
      const response = await getBookings({
        status: currentFilter,
        q: currentSearch,
        limit: 50
      });
      const jobsData = response.data || [];
      const mappedJobs = jobsData
        .filter(job => !job.offeringType || job.offeringType === 'SERVICE')
        .map(job => ({
        id: job._id || job.id,
        serviceType: job.serviceName || 'Service',
        user: {
          name: job.userId?.name || 'Customer'
        },
        location: {
          address: job.address?.addressLine1 || 'Address not available'
        },
        price: (job.finalAmount || job.totalAmount || job.amount || 0).toFixed(2),
        status: job.status,
        assignedTo: job.workerId ? { name: job.workerId.name } : (job.assignedAt ? { name: 'You (Self)' } : null),
        timeSlot: {
          date: job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString() : 'Scheduled',
          time: job.scheduledTime || 'ASAP'
        },
        scheduledDate: job.scheduledDate,
        scheduledTime: job.scheduledTime,
        bookingId: job.bookingId,
        workerResponse: job.workerResponse,
        rejectedWorker: job.rejectedWorker
      }));

      setJobs(mappedJobs);
      localStorage.setItem('vendorJobsList', JSON.stringify(mappedJobs));
    } catch (error) {
      console.error('Error loading jobs:', error);
      toast.error('Failed to load service bookings');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, [isInitialLoad]);

  useEffect(() => {
    setCurrentPage(1);
    loadJobs(filter, searchQuery);

    const handleUpdate = () => loadJobs(filter, searchQuery);
    window.addEventListener('vendorJobsUpdated', handleUpdate);

    return () => {
      window.removeEventListener('vendorJobsUpdated', handleUpdate);
    };
  }, [filter, searchQuery, loadJobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const status = job.status?.toLowerCase();
      let matchesFilter = true;

      if (filter === 'pending') {
        matchesFilter = status === 'pending' || status === 'requested';
      } else if (filter === 'assigned') {
        matchesFilter = status === 'assigned';
      } else if (filter === 'in_progress') {
        matchesFilter = ['on_the_way', 'work_started', 'work_done'].includes(status);
      } else if (filter === 'completed') {
        matchesFilter = status === 'completed';
      }

      const matchesSearch = !searchQuery ||
        job.serviceType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.location.address.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [jobs, filter, searchQuery]);

  const handleAcceptJob = async (jobId) => {
    try {
      const response = await acceptBooking(jobId);
      if (response.success) {
        toast.success("Job accepted successfully");
        loadJobs(filter, searchQuery);
        window.dispatchEvent(new Event('vendorJobsUpdated'));
      }
    } catch (error) {
      console.error("Error accepting job:", error);
      toast.error("Failed to accept job");
    }
  };

  const handleRejectJob = (jobId) => {
    setRejectingJobId(jobId);
  };

  const handleConfirmReject = async (reason) => {
    if (!rejectingJobId) return;
    try {
      const response = await rejectBooking(rejectingJobId, reason);
      if (response.success) {
        toast.success("Job skipped");
        loadJobs(filter, searchQuery);
        window.dispatchEvent(new Event('vendorJobsUpdated'));
      }
    } catch (error) {
      console.error("Error rejecting job:", error);
      toast.error("Failed to skip job");
    } finally {
      setRejectingJobId(null);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 pb-16">
      {/* Header - Compact & Modern */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs flex flex-row items-center justify-between text-gray-900 border border-gray-100 gap-3">
        <div>
          <h2 className="text-base sm:text-xl font-bold text-gray-900 tracking-tight leading-tight capitalize">
            Service Bookings
          </h2>
          <p className="text-gray-500 text-[10px] sm:text-xs font-medium mt-0.5">
            Monitor and manage active service deployments and customer requests
          </p>
        </div>
        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
          <FiBriefcase className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      {/* Navigation Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-100 shadow-2xs overflow-x-auto scrollbar-hide">
          {[
            { id: 'all', label: 'All Bookings' },
            { id: 'pending', label: 'New Requests' },
            { id: 'assigned', label: 'Assigned' },
            { id: 'in_progress', label: 'Active' },
            { id: 'completed', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`
                px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold tracking-wider uppercase transition-all duration-200 whitespace-nowrap cursor-pointer
                ${filter === tab.id
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative group flex-1 max-w-xs">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5 group-focus-within:text-blue-600 transition-colors" />
          <input
            type="text"
            placeholder="Search booking, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl py-1.5 pl-9 pr-3 text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all shadow-2xs placeholder-gray-300"
          />
        </div>
      </div>

      {/* Jobs Grid */}
      {loading ? (
        <div className="bg-white rounded-xl p-10 text-center border border-gray-100 shadow-2xs">
          <div className="w-7 h-7 border-2 border-[#00246b] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Loading Service Bookings...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center border border-dashed border-gray-200 shadow-2xs">
          <FiBriefcase className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <h3 className="text-xs font-bold text-gray-900 uppercase">No Bookings Found</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {searchQuery ? "Your search query didn't match any records." : 'No active bookings in this stream.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredJobs
            .slice((currentPage - 1) * pageSize, currentPage * pageSize)
            .map((job) => {
              const isCompleted = job.status?.toLowerCase() === 'completed';
              const isPending = job.status?.toLowerCase() === 'pending' || job.status?.toLowerCase() === 'requested';

              return (
                <div 
                  key={job.id} 
                  className="bg-white border border-gray-100 hover:border-gray-200 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all group cursor-pointer flex flex-col justify-between relative overflow-hidden"
                  onClick={() => navigate(`/vendor/booking/${job.id}`)}
                >
                  {/* Top Status Border Accent */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${isPending ? 'bg-amber-400' : isCompleted ? 'bg-emerald-500' : 'bg-blue-600'}`} />

                  <div>
                    {/* Top Header Row: Icon + Price + Status Pill */}
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-2xs">
                        <FiBriefcase className="w-4 h-4" />
                      </div>
                      <div className="text-right min-w-0">
                        <p className="text-sm font-bold text-gray-900">₹{job.price}</p>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-0.5 inline-block ${
                          job.workerResponse === 'REJECTED' && !job.assignedTo ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          isPending ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
                          isCompleted ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                          'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {job.workerResponse === 'REJECTED' && !job.assignedTo ? 'Worker Declined' : job.status}
                        </span>
                      </div>
                    </div>

                    {/* Service Title */}
                    <h3 className="text-xs font-bold text-gray-900 capitalize truncate mb-2 group-hover:text-blue-600 transition-colors tracking-tight">
                      {job.serviceType}
                    </h3>
                    
                    {/* Meta Info Rows */}
                    <div className="space-y-1.5 text-[11px] text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <FiUser className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                        <span className="font-semibold text-gray-800 truncate">{job.user.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FiMapPin className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                        <span className="font-medium text-gray-600 truncate">{job.location.address}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FiClock className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                        <span className="font-semibold text-blue-700 capitalize">{job.timeSlot.date} • {job.timeSlot.time}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                    {isPending ? (
                      <div className="flex items-center gap-2 w-full">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAcceptJob(job.id); }}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider py-1.5 rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                        >
                          <FiCheck className="w-3 h-3" />
                          Accept
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRejectJob(job.id); }}
                          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold uppercase tracking-wider py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                        >
                          <FiX className="w-3 h-3" />
                          Skip
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            job.workerResponse === 'REJECTED' && !job.assignedTo ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'
                          }`} />
                          <p className="text-[10px] font-bold text-gray-600 truncate">
                            {job.workerResponse === 'REJECTED' && !job.assignedTo 
                              ? `Declined: ${job.rejectedWorker?.name || 'Worker'}` 
                              : job.assignedTo ? `Assigned: ${job.assignedTo.name}` : 'Unassigned'}
                          </p>
                        </div>
                        
                        {job.workerResponse === 'REJECTED' && !job.assignedTo && !['completed', 'cancelled', 'rejected', 'work_done'].includes(job.status?.toLowerCase()) ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/vendor/booking/${job.id}/assign-worker`);
                            }}
                            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                          >
                            <FiRefreshCw className="w-2.5 h-2.5" />
                            Reassign
                          </button>
                        ) : (
                          <div className="w-6 h-6 rounded-lg bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center transition-colors text-gray-400 group-hover:text-blue-600 shrink-0 ml-1">
                            <FiChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Pagination Bar */}
      {!loading && filteredJobs.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(filteredJobs.length / pageSize) || 1}
          totalItems={filteredJobs.length}
          pageSize={pageSize}
          onPageChange={(p) => setCurrentPage(p)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          className="mt-3"
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

      <RejectionReasonModal
        isOpen={!!rejectingJobId}
        onClose={() => setRejectingJobId(null)}
        onConfirm={handleConfirmReject}
      />
    </div>
  );
});

ActiveJobs.displayName = 'VendorActiveJobs';

export default ActiveJobs;
