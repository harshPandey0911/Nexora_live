import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiUser, FiCheck, FiArrowRight, FiMapPin, FiBriefcase, FiPlus } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import Header from '../../components/layout/Header';
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

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        let bData;
        if (String(id).startsWith('ORD-')) {
          const { default: vendorService } = await import('../../services/vendorService');
          const productOrdersRes = await vendorService.getVendorProductOrders();
          const allOrders = [
            ...(productOrdersRes.data?.assignedOrders || []),
            ...(productOrdersRes.data?.pendingAlerts || [])
          ];
          bData = allOrders.find(o => String(o._id) === String(id) || String(o.orderId) === String(id));
          if (bData) bData.isProductOrder = true;
        } else {
          try {
            const bookingRes = await getBookingById(id);
            bData = bookingRes.booking || bookingRes.data;
          } catch (e) {
            const { default: vendorService } = await import('../../services/vendorService');
            const productOrdersRes = await vendorService.getVendorProductOrders();
            const allOrders = [
              ...(productOrdersRes.data?.assignedOrders || []),
              ...(productOrdersRes.data?.pendingAlerts || [])
            ];
            bData = allOrders.find(o => String(o._id) === String(id) || String(o.orderId) === String(id));
            if (bData) bData.isProductOrder = true;
          }
        }

        if (bData) {
          setBooking(bData);
          const unassignableStatuses = [
            'completed', 'work_done', 'in_progress', 'visited', 'journey_started',
            'on_the_way', 'reached', 'cancelled', 'rejected', 'vendor_rejected', 'vendor rejected'
          ];
          if (unassignableStatuses.includes(bData.status?.toLowerCase())) {
            toast.error(`Worker cannot be assigned because booking is "${bData.status}"`);
            navigate(`/vendor/booking/${id}`);
            return;
          }
        } else {
          throw new Error('Booking or Product Order not found');
        }

        const workersRes = await getWorkers();
        const workersList = Array.isArray(workersRes) ? workersRes : (workersRes.workers || workersRes.data || []);

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
      toast.error('Please select an operative or choose "Do It Myself" to confirm assignment.', {
        id: 'select-operative-toast'
      });
      return;
    }

    try {
      setAssigning(true);

      const workerId = assignToSelf ? 'SELF' : selectedWorker.id || selectedWorker._id;

      let response;
      if (booking.isProductOrder || booking.items || booking.orderId?.startsWith('ORD-')) {
        const { default: vendorService } = await import('../../services/vendorService');
        response = await vendorService.assignProductOrderWorker(id, workerId);
      } else {
        response = await assignWorkerApi(id, workerId);
      }

      if (response && response.success) {
        toast.success(assignToSelf ? 'Assigned to self' : 'Operative assigned successfully');
        window.dispatchEvent(new Event('vendorJobsUpdated'));
        if (booking.isProductOrder || booking.items || booking.orderId?.startsWith('ORD-')) {
          navigate('/vendor/product-orders', { replace: true });
        } else {
          navigate(`/vendor/booking/${id}`, { replace: true });
        }
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
        <div className="flex flex-col items-center gap-2">
          <div className="w-7 h-7 border-2 border-[#00246b] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Loading Operatives...</p>
        </div>
      </div>
    );
  }

  const getAddressString = (addr) => {
    if (!addr) return 'Address not available';
    if (typeof addr === 'string') return addr;
    const line1 = addr.addressLine1 || addr.fullAddress || addr.address || '';
    const city = addr.city || '';
    const pin = addr.pincode || '';
    const result = [line1, city, pin].filter(Boolean).join(', ');
    return result || 'Address not available';
  };

  const serviceTitle = booking.serviceName || booking.serviceType || booking.items?.[0]?.title || booking.serviceId?.title || (booking.orderId ? `Product Order #${booking.orderId}` : 'Service');
  const addressVal = booking.deliveryAddress || booking.address || booking.location;
  const totalPriceVal = booking.financialBreakdown?.totalAmount || booking.financialBreakdown?.vendorEarnings || booking.totalAmount || booking.finalAmount || booking.price || 0;

  return (
    <div className="min-h-screen pb-16 bg-gray-50/50">
      <Header title="Assign Operative" onBack={() => navigate(-1)} />

      <main className="px-3.5 sm:px-4 pt-16 sm:pt-20 pb-6 max-w-xl mx-auto space-y-4">
        {/* Booking Summary Hero Card */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-wider">
              {booking.isProductOrder || booking.items || booking.orderId ? 'Product Order' : 'Service Deployment'}
            </span>
            <span className="text-xs font-bold text-[#00246b]">₹{totalPriceVal}</span>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-900 tracking-tight capitalize">{serviceTitle}</h3>
            <p className="text-xs text-gray-500 font-medium mt-1 flex items-start gap-1.5 leading-snug">
              <FiMapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
              <span>{getAddressString(addressVal)}</span>
            </p>
          </div>
        </div>

        {/* Self Assignment Card Option */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider px-0.5">Deployment Action</h3>

          <button
            onClick={() => {
              setAssignToSelf(true);
              setSelectedWorker(null);
            }}
            className={`w-full p-3.5 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between border ${
              assignToSelf
                ? 'bg-blue-50/40 border-blue-600 shadow-2xs'
                : 'bg-white border-gray-100 hover:border-gray-200 shadow-2xs'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                assignToSelf ? 'bg-blue-600 text-white shadow-2xs' : 'bg-gray-50 text-gray-400 border border-gray-100'
              }`}>
                {assignToSelf ? <FiCheck className="w-5 h-5" /> : <FiUser className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-tight">Do It Myself</h4>
                <p className="text-[10px] text-gray-500 font-medium">Assign deployment directly to your vendor profile</p>
              </div>
            </div>
            {assignToSelf && (
              <span className="text-[9px] font-bold text-blue-600 bg-blue-100/60 px-2 py-0.5 rounded border border-blue-200 uppercase tracking-wider shrink-0">
                Selected
              </span>
            )}
          </button>
        </div>

        {/* Available Workers Fleet */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Available Operatives</h3>
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-wider">
              {workers.length} Online
            </span>
          </div>

          {workers.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-dashed border-gray-200 shadow-2xs">
              <FiUser className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-gray-900 uppercase">No Available Workers</h4>
              <p className="text-[10px] text-gray-400 mt-0.5 mb-4 uppercase tracking-widest">All operatives are currently assigned or offline</p>
              <button
                onClick={() => navigate('/vendor/workers/new')}
                className="px-4 py-2 rounded-xl text-white font-bold text-xs uppercase tracking-wider bg-[#00246b] shadow-2xs active:scale-95 transition-all cursor-pointer"
              >
                + Register Worker
              </button>
            </div>
          ) : (
            <div className="space-y-2">
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
                    className={`w-full p-3.5 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between border ${
                      isSelected
                        ? 'bg-blue-50/40 border-blue-600 shadow-2xs'
                        : 'bg-white border-gray-100 hover:border-gray-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'bg-blue-600 text-white shadow-2xs' : 'bg-gray-50 text-gray-400 border border-gray-100'
                      }`}>
                        {isSelected ? <FiCheck className="w-5 h-5" /> : <FiUser className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-tight">{worker.name}</h4>
                        <p className="text-[10px] text-gray-500 font-medium mt-0.5">{worker.phone}</p>
                        {worker.skills?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {worker.skills.slice(0, 2).map((skill, index) => (
                              <span
                                key={index}
                                className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200"
                              >
                                {typeof skill === 'string' ? skill : skill.name || skill.title || 'Skill'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <span className="text-[9px] font-bold text-blue-600 bg-blue-100/60 px-2 py-0.5 rounded border border-blue-200 uppercase tracking-wider shrink-0 ml-2">
                        Selected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Complete Assignment Action Button */}
        <div className="pt-2">
          <button
            onClick={handleAssign}
            disabled={assigning}
            className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-2xs cursor-pointer ${
              !assignToSelf && !selectedWorker
                ? 'bg-slate-500 hover:bg-slate-600'
                : 'bg-[#00246b] hover:bg-[#001c54]'
            }`}
          >
            {assigning ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing Assignment...</span>
              </>
            ) : (
              <>
                <span>Confirm Assignment</span>
                <FiArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
};

export default AssignWorker;
