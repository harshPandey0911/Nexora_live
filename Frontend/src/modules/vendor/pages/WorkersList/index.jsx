import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiPlus, FiSearch, FiUser, FiBriefcase, FiChevronRight, FiStar } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { vendorTheme as themeColors } from '../../../../theme';
import { getWorkers, deleteWorker } from '../../services/workerService';

const WorkersList = () => {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWorkers = async () => {
      try {
        if (workers.length === 0) setLoading(true);
        const response = await getWorkers();
        const mapped = (response.data || response).map(w => ({
          ...w,
          id: w._id || w.id
        }));
        setWorkers(mapped || []);
      } catch (error) {
        console.error('Error loading workers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWorkers();
    window.addEventListener('vendorWorkersUpdated', loadWorkers);

    return () => {
      window.removeEventListener('vendorWorkersUpdated', loadWorkers);
    };
  }, [workers.length]);

  const handleDelete = async (workerId) => {
    if (window.confirm('Are you sure you want to delete this worker?')) {
      try {
        await deleteWorker(workerId);
        setWorkers(workers.filter(w => w.id !== workerId));
        window.dispatchEvent(new Event('vendorWorkersUpdated'));
      } catch (error) {
        console.error('Error deleting worker:', error);
        alert('Failed to delete worker');
      }
    }
  };

  const filteredWorkers = workers.filter(worker => {
    const workerStatus = (worker.status || 'OFFLINE').toUpperCase();
    const isOnline = workerStatus === 'ONLINE';
    const isOffline = workerStatus !== 'ONLINE';

    const matchesFilter = filter === 'all' ||
      (filter === 'online' && isOnline) ||
      (filter === 'offline' && isOffline);

    const matchesSearch = searchQuery === '' ||
      worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      worker.phone.includes(searchQuery);

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header - White Style */}
      <div className="bg-white p-6 rounded-3xl shadow-sm flex flex-col md:flex-row items-center justify-between text-gray-900 border border-gray-100 gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-none">
            Team Management
          </h2>
          <p className="text-gray-500 font-medium mt-2">
            Monitor and coordinate your field operatives and deployment fleet
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/vendor/workers/add')}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2"
        >
          <FiPlus className="w-5 h-5" />
          Add Operative
        </motion.button>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-1 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto scrollbar-hide">
          {[
            { id: 'all', label: 'All Fleet' },
            { id: 'online', label: 'Active' },
            { id: 'offline', label: 'Standby' },
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => setFilter(option.id)}
              className={`
                px-6 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300 whitespace-nowrap
                ${filter === option.id
                  ? 'bg-[#2874F0] text-white shadow-lg shadow-blue-200 translate-y-[-1px]'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="relative group flex-1 max-w-md">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Search operative name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-2xl py-3 pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Workers Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-[32px] p-8 border border-gray-100 animate-pulse h-48 shadow-sm" />
          ))}
        </div>
      ) : filteredWorkers.length === 0 ? (
        <div className="bg-white rounded-[48px] p-20 text-center border border-gray-100 shadow-sm">
          <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-gray-100">
            <FiUsers className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2 uppercase tracking-tight">Empty Fleet</h3>
          <p className="text-sm text-gray-400 font-medium max-w-xs mx-auto mb-8">
            You haven't authorized any team members for field deployments yet.
          </p>
          <button
            onClick={() => navigate('/vendor/workers/add')}
            className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all hover:bg-blue-700"
          >
            Register Operative
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 pb-12">
          {filteredWorkers.map((worker) => {
            const statusRaw = (worker.status || 'OFFLINE').toUpperCase();
            const isOnline = statusRaw === 'ONLINE';

            return (
              <motion.div
                key={worker.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/vendor/workers/${worker.id}/edit`)}
                className="bg-white border border-gray-100 rounded-[32px] p-6 flex flex-col gap-6 relative group hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden shadow-sm"
              >
                {/* Status indicator bar */}
                <div className={`absolute top-0 left-0 w-full h-1 ${isOnline ? 'bg-emerald-500' : 'bg-gray-200'}`} />

                <div className="flex items-center gap-5">
                  {/* Photo */}
                  <div className="relative shrink-0">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 border border-gray-100 group-hover:border-blue-500/50 transition-all duration-300 shadow-sm">
                      {worker.profilePhoto ? (
                        <img src={worker.profilePhoto} alt={worker.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-300">
                          <FiUser className="w-10 h-10" />
                        </div>
                      )}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-white ${isOnline ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-gray-400'}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-lg font-bold text-gray-800 truncate tracking-tight">{worker.name}</h3>
                      <div className="flex items-center gap-1.5 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                        <FiStar className="w-3 h-3 text-amber-500 fill-amber-500" />
                        <span className="text-[11px] font-bold text-amber-600">
                          {worker.rating > 0 ? worker.rating.toFixed(1) : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{worker.phone}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-5 border-t border-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100">
                      <FiBriefcase className="w-3.5 h-3.5" />
                      <span>{worker.completedJobs || 0} Jobs</span>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isOnline ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {isOnline ? 'Active' : 'Standby'}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                    <FiChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WorkersList;
