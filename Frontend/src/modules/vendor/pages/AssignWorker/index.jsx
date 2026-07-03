import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiUser, FiCheck, FiArrowRight } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { vendorTheme as themeColors } from '../../../../theme';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import { getBookingById, assignWorker as assignWorkerApi } from '../../services/bookingService';
import { getWorkers } from '../../services/workerService';

const AssignWorker = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [assignToSelf, setAssignToSelf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

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

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Load booking details
        const bookingRes = await getBookingById(id);
        if (bookingRes.booking || bookingRes.data) {
          setBooking(bookingRes.booking || bookingRes.data);
        } else {
          throw new Error('Booking not found');
        }

        // Load workers
        const workersRes = await getWorkers();
        // Handle potentially different response structures
        const workersList = Array.isArray(workersRes) ? workersRes : (workersRes.workers || workersRes.data || []);

        // Filter available workers
        const available = workersList.filter(w => {
          const status = (w.status || w.availability || '').toUpperCase();
          return status === 'ONLINE' && !w.currentJob;
        });
        setWorkers(available);
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load booking or workers');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadData();
    }
  }, [id]);

  const handleAssign = async () => {
    if (!assignToSelf && !selectedWorker) {
      toast.error('Please select a worker or assign to yourself');
      return;
    }

    try {
      setAssigning(true);

      const workerId = assignToSelf ? 'SELF' : selectedWorker.id || selectedWorker._id;

      const response = await assignWorkerApi(id, workerId);

      if (response && response.success) {
        toast.success('Worker assigned successfully');
        // Notify other components
        window.dispatchEvent(new Event('vendorJobsUpdated'));
        navigate(`/vendor/booking/${id}`);
      } else {
        throw new Error(response?.message || 'Failed to assign worker');
      }
    } catch (error) {
      console.error('Error assigning worker:', error);
      toast.error(error.message || 'Failed to assign worker. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  if (loading || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black"></div>
          <p className="text-gray-400 font-medium text-[10px] capitalize tracking-widest">Loading workers...</p>
        </div>
      </div>
    );
  }

  // Helper for address display
  const getAddressString = (addr) => {
    if (!addr) return 'Address not available';
    if (typeof addr === 'string') return addr;
    return `${addr.addressLine1 || ''}, ${addr.city || ''} ${addr.pincode || ''}`;
  };

  return (
    <div className="min-h-screen pb-20 bg-white">
      <Header title="Assign Worker" />

      <main className="px-4 pt-24 pb-6">
        {/* Booking Summary (Black Theme) */}
        <div className="bg-white rounded-[32px] p-6 mb-6 shadow-sm border border-gray-100">
          <p className="text-[10px] font-medium capitalize tracking-widest text-gray-400 mb-1">Active Booking</p>
          <h3 className="text-xl font-medium text-gray-900 mb-2">{booking.serviceName || booking.serviceId?.title || 'Service'}</h3>
          <p className="text-xs font-medium text-gray-500 leading-relaxed">{getAddressString(booking.address || booking.location)}</p>
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
            <span className="text-[10px] font-medium capitalize tracking-widest text-gray-400">Total Value</span>
            <span className="text-lg font-medium text-black">
              ₹{booking.finalAmount || booking.price || 0}
            </span>
          </div>
        </div>

        {/* Self Assignment Option */}
        <div className="mb-6">
          <button
            onClick={() => {
              setAssignToSelf(true);
              setSelectedWorker(null);
            }}
            className={`w-full p-4 rounded-xl text-left transition-all ${assignToSelf
              ? 'border-2'
              : 'bg-white border border-gray-200'
              }`}
            style={
              assignToSelf
                ? {
                  borderColor: '#000000',
                  background: 'rgba(0,0,0,0.02)',
                }
                : {
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                }
            }
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center ${assignToSelf ? 'bg-black text-white shadow-lg shadow-gray-200' : 'bg-gray-50 text-gray-300 border border-gray-100'
                  }`}
              >
                {assignToSelf ? (
                  <FiCheck className="w-7 h-7" />
                ) : (
                  <FiUser className="w-7 h-7" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 capitalize tracking-widest">Do it Myself</h3>
                <p className="text-[10px] font-normal text-gray-400 capitalize tracking-tighter mt-1">Assign booking to your personal profile</p>
              </div>
            </div>
          </button>
        </div>

        {/* Available Workers (Black Theme) */}
        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-sm font-medium text-gray-900 capitalize tracking-widest">Available Workers</h3>
            <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{workers.length} Online</span>
          </div>

          {workers.length === 0 ? (
            <div className="bg-white rounded-[32px] p-10 text-center border border-gray-100 shadow-sm">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
                <FiUser className="w-8 h-8 text-gray-200" />
              </div>
              <p className="text-sm font-medium text-gray-900 capitalize tracking-widest mb-1">No Available Workers</p>
              <p className="text-[10px] font-normal text-gray-400 capitalize tracking-tighter mb-6">All workers are currently assigned or offline</p>
              <button
                onClick={() => navigate('/vendor/workers/add')}
                className="px-6 py-3 rounded-xl font-medium text-white text-[10px] capitalize tracking-widest bg-black shadow-lg shadow-gray-200 active:scale-95 transition-all"
              >
                Add New Worker
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {workers.map((worker) => {
                const workerId = worker._id || worker.id;
                const isSelected = (selectedWorker?._id || selectedWorker?.id) === workerId;

                return (
                  <button
                    key={workerId}
                    onClick={() => {
                      setSelectedWorker(worker);
                      setAssignToSelf(false);
                    }}
                    className={`w-full p-4 rounded-[28px] text-left transition-all ${isSelected
                      ? 'border-2'
                      : 'bg-white border border-gray-100'
                      }`}
                    style={
                      isSelected
                        ? {
                          borderColor: '#000000',
                          background: 'rgba(0,0,0,0.02)',
                        }
                        : {
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                        }
                    }
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isSelected ? 'bg-black text-white shadow-lg shadow-gray-200' : 'bg-gray-50 text-gray-300 border border-gray-100'
                          }`}
                      >
                        {isSelected ? (
                          <FiCheck className="w-7 h-7" />
                        ) : (
                          <FiUser className="w-7 h-7" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900 capitalize tracking-widest">{worker.name}</h3>
                        <p className="text-[10px] font-normal text-gray-400 capitalize tracking-tighter mt-1">{worker.phone}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {worker.skills?.slice(0, 2).map((skill, index) => (
                            <span
                              key={index}
                              className="px-2 py-0.5 rounded-md text-[8px] font-medium capitalize tracking-tighter bg-gray-100 text-gray-600 border border-gray-200"
                            >
                              {typeof skill === 'string' ? skill : skill.name || skill.title || 'Skill'}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Assign Button (Black Theme) */}
        <div className="mt-10">
          <button
            onClick={handleAssign}
            disabled={(!assignToSelf && !selectedWorker) || assigning}
            className="w-full py-5 rounded-[24px] font-medium text-xs capitalize tracking-widest text-white bg-black flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-20 disabled:grayscale shadow-xl shadow-gray-200"
          >
            {assigning ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>Complete Assignment</span>
                <FiArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
};

export default AssignWorker;

