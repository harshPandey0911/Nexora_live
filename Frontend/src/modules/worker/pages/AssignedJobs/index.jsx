import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBriefcase, FiClock, FiMapPin, FiUser, FiSearch, FiChevronRight } from 'react-icons/fi';
import { workerTheme as themeColors } from '../../../../theme';
import Header from '../../components/layout/Header';
import workerService from '../../../../services/workerService';
import { SkeletonList } from '../../../../components/common/SkeletonLoaders';

const AssignedJobs = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, confirmed, in_progress, completed
  const [searchQuery, setSearchQuery] = useState('');

  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const bgStyle = themeColors.backgroundGradient;

    if (html) html.style.background = bgStyle;
    if (body) body.style.background = bgStyle;
    if (root) root.style.background = bgStyle;

    return () => {
      if (html) html.style.background = '';
      if (body) body.style.background = '';
      if (root) root.style.background = '';
    };
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await workerService.getAssignedJobs();
      if (response.success) {
        setJobs(response.data);
      }
      setLoading(false);
    } catch (err) {
      console.error('Fetch jobs error:', err);
      setError('Failed to load assigned jobs');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();

    const handleUpdate = () => {
      fetchJobs();
    };
    window.addEventListener('workerJobsUpdated', handleUpdate);

    return () => {
      window.removeEventListener('workerJobsUpdated', handleUpdate);
    };
  }, []);

  const getStatusColor = (status) => {
    const colors = {
      'pending': '#D97706', // Amber
      'confirmed': '#0D9488', // Premium Teal
      'assigned': '#0D9488',
      'in_progress': '#0284C7', // Sky Blue
      'completed': '#059669', // Emerald Green
      'cancelled': '#DC2626', // Red
      'rejected': '#991B1B', // Dark Red
    };
    return colors[status] || '#6B7280';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'pending': 'Pending',
      'confirmed': 'Assigned',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'rejected': 'Rejected',
    };
    return labels[status] || status;
  };

  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const filteredJobs = jobs.filter(job => {
    const status = (job.status || '').toLowerCase();

    let matchesFilter = false;
    if (filter === 'all') {
      matchesFilter = true;
    } else if (filter === 'confirmed') {
      matchesFilter = ['confirmed', 'assigned', 'pending'].includes(status);
    } else if (filter === 'in_progress') {
      matchesFilter = ['in_progress', 'started', 'reached', 'visited', 'work_done', 'on_the_way', 'packing', 'out_for_delivery'].includes(status);
    } else if (filter === 'completed') {
      matchesFilter = ['completed', 'worker_paid', 'paid', 'delivered'].includes(status);
    }

    const customerName = job.userId?.name || job.contactDetails?.name || '';
    const matchesSearch = searchQuery === '' ||
      job.serviceName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.orderId || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return (
    <div className="min-h-screen pb-24" style={{ background: themeColors.backgroundGradient }}>
      <Header title="My Jobs" showSearch={false} showBack={true} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Search & Filter Header Container */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-sm space-y-4 md:space-y-0 md:flex md:items-center md:justify-between gap-4">
          
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer or service..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            {[
              { id: 'all', label: 'All Jobs' },
              { id: 'confirmed', label: 'Pending' },
              { id: 'in_progress', label: 'Active' },
              { id: 'completed', label: 'Completed' },
            ].map((filterOption) => (
              <button
                key={filterOption.id}
                onClick={() => setFilter(filterOption.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  filter === filterOption.id
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
                }`}
              >
                {filterOption.label}
              </button>
            ))}
          </div>

        </div>

        {/* Jobs Grid */}
        {loading ? (
          <div className="py-2">
            <SkeletonList count={6} cardHeight="140px" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200 shadow-sm space-y-3">
            <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto text-slate-400">
              <FiBriefcase className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-900">No Jobs Found</h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto font-medium">
              {searchQuery ? 'Try adjusting your search criteria.' : 'No assigned jobs under this category.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.map((job) => {
              const statusColor = getStatusColor(job.status);
              const isProductOrder = job.isProductOrder;
              const customerName = job.userId?.name || job.contactDetails?.name || 'Customer';
              const addressLine = job.address?.addressLine1 || job.deliveryAddress?.addressLine1 || 'Address unavailable';

              return (
                <div
                  key={job._id}
                  onClick={() => isProductOrder ? navigate(`/worker/product-order/${job._id}`) : navigate(`/worker/job/${job._id}`)}
                  className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-teal-300 transition-all duration-300 cursor-pointer active:scale-98 relative overflow-hidden flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-bold group-hover:scale-105 transition-transform text-lg"
                          style={{
                            background: isProductOrder ? '#e0f2fe' : `${statusColor}15`,
                            color: isProductOrder ? '#0284c7' : statusColor,
                          }}
                        >
                          {isProductOrder ? '📦' : <FiBriefcase className="w-5 h-5" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-slate-900 text-sm truncate tracking-tight">{job.serviceName}</h3>
                            {isProductOrder && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg bg-blue-100 text-blue-700 border border-blue-200 shrink-0">Delivery</span>
                            )}
                          </div>
                          {isProductOrder && job.orderId && (
                            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">#{job.orderId}</p>
                          )}
                          <span
                            className="inline-block text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-lg mt-1"
                            style={{
                              background: `${statusColor}15`,
                              color: statusColor,
                              border: `1px solid ${statusColor}30`
                            }}
                          >
                            {getStatusLabel(job.status)}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base font-black text-slate-900">
                          ₹{job.finalAmount || job.financialBreakdown?.totalAmount || 0}
                        </span>
                      </div>
                    </div>

                    {/* Customer & Location Details */}
                    <div className="bg-slate-50/70 rounded-2xl p-3 space-y-2 border border-slate-100 text-xs">
                      <div className="flex items-center gap-2 text-slate-700 font-medium">
                        <FiUser className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{customerName}</span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-600 font-medium">
                        <FiMapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{addressLine}</span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-500 font-medium">
                        <FiClock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {isProductOrder
                            ? 'Immediate Delivery'
                            : `${job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'N/A'} • ${job.scheduledTime || 'N/A'}`
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Arrow Action */}
                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 text-xs font-bold text-teal-700 group-hover:text-teal-800">
                    <span>{isProductOrder ? 'Delivery Task' : 'View Details'}</span>
                    <FiChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default AssignedJobs;
