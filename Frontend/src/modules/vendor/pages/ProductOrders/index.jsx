import React, { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  FiPackage, FiPlus, FiTrash2, FiEye, FiSearch, 
  FiDownload, FiFilter, FiMoreVertical, FiChevronDown, FiBox,
  FiUser, FiMapPin, FiClock, FiChevronRight, FiCheckCircle, FiTruck, FiUsers, FiPhone
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import vendorService from '../../services/vendorService';
import Pagination from '../../../../components/common/Pagination';

const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'ACCEPTED':
      return 'bg-blue-50 text-blue-700 border border-blue-200/70';
    case 'PACKING':
      return 'bg-amber-50 text-amber-700 border border-amber-200/70';
    case 'OUT_FOR_DELIVERY':
      return 'bg-purple-50 text-purple-700 border border-purple-200/70';
    case 'DELIVERED':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200/70';
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 border border-rose-200/70';
    default:
      return 'bg-gray-50 text-gray-700 border border-gray-200/70';
  }
};

const formatOrderTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  if (isToday) {
    return `Today, ${timeStr}`;
  }
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
};

const ProductOrders = memo(() => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [orders, setOrders] = useState([]);
  const [pendingAlerts, setPendingAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await vendorService.getVendorProductOrders();
      if (res.success && res.data) {
        const assigned = res.data.assignedOrders || [];
        setOrders(assigned);
        setPendingAlerts(res.data.pendingAlerts || []);
      }
    } catch (error) {
      console.error('Error loading vendor product orders:', error);
      toast.error('Failed to load product orders');
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time socket listener for incoming product orders
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/api$/, '') || 'http://localhost:5000';
    const socket = io(socketUrl, {
      auth: { token: localStorage.getItem('accessToken') },
      transports: ['websocket', 'polling']
    });

    socket.on('new_product_order_alert', (data) => {
      toast((t) => (
        <div className="flex flex-col gap-1.5 p-1">
          <p className="font-bold text-xs text-gray-900">🛍️ New Product Order Alert!</p>
          <p className="text-[11px] text-gray-600">Order #{data.customOrderId} for ₹{data.totalAmount}</p>
          <div className="flex gap-2 mt-1">
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                try {
                  const res = await vendorService.acceptProductOrder(data.orderId);
                  if (res.success) {
                    toast.success('Product Order Accepted!');
                    loadOrders();
                  }
                } catch (e) {
                  toast.error('Failed to accept order');
                }
              }}
              className="px-2.5 py-1 bg-[#00246b] text-white rounded-md text-[10px] font-bold uppercase"
            >
              Accept Order
            </button>
            <button onClick={() => toast.dismiss(t.id)} className="px-2 py-1 text-gray-500 text-[10px]">Dismiss</button>
          </div>
        </div>
      ), { duration: 10000 });

      loadOrders();
    });

    return () => {
      socket.disconnect();
    };
  }, [loadOrders]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleAcceptOrder = async (orderId) => {
    try {
      const res = await vendorService.acceptProductOrder(orderId);
      if (res.success) {
        toast.success('Product Order Accepted!');
        loadOrders();
      } else {
        toast.error(res.message || 'Failed to accept order');
      }
    } catch (e) {
      toast.error('Failed to accept order');
    }
  };

  const handleUpdateStatus = async (e, orderId, newStatus) => {
    e.stopPropagation();
    try {
      const res = await vendorService.updateProductOrderStatus(orderId, newStatus);
      if (res.success) {
        toast.success(`Order status updated to ${newStatus.replace(/_/g, ' ')}`);
        loadOrders();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Status update failed');
    }
  };

  const filteredOrders = orders.filter(o => 
    filter === 'all' ? true : o.status?.toLowerCase() === filter.toLowerCase()
  ).filter(o =>
    (o.orderId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (o.userId?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (o.contactDetails?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-3 sm:space-y-4 pb-14">
      {/* Header Banner - Compact */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs flex flex-row items-center justify-between text-gray-900 border border-gray-100 gap-3">
        <div>
          <h2 className="text-base sm:text-xl font-bold text-gray-900 tracking-tight leading-tight">
            Product Orders Hub
          </h2>
          <p className="text-gray-500 text-[10px] sm:text-xs font-medium mt-0.5">
            Fulfill product orders. <strong className="text-emerald-600">You receive 100% of the delivery charges!</strong>
          </p>
        </div>
        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 rounded-lg border border-blue-100 flex items-center justify-center text-[#00246b] shadow-inner shrink-0">
          <FiPackage className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      {/* Pending Incoming Order Alerts Banner - Ultra Compact */}
      {pendingAlerts.length > 0 && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-200/80 rounded-xl p-3 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
              <FiClock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              <span>Incoming Product Order Alerts Nearby</span>
            </h3>
            <span className="px-1.5 py-0.2 rounded-full bg-amber-200/80 text-amber-900 text-[10px] font-bold">
              {pendingAlerts.length}
            </span>
          </div>

          <div className="max-h-[260px] overflow-y-auto space-y-1.5 pr-0.5">
            {pendingAlerts.map(alert => (
              <div 
                key={alert._id} 
                className="bg-white p-2.5 rounded-lg border border-amber-100/90 shadow-2xs hover:shadow-xs transition-all flex flex-row items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-bold text-gray-900 tracking-tight">Order #{alert.orderId}</p>
                    {formatOrderTime(alert.createdAt || alert.bookingDate || alert.date) && (
                      <span className="text-[9px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 flex items-center gap-1">
                        <FiClock className="w-2.5 h-2.5" />
                        {formatOrderTime(alert.createdAt || alert.bookingDate || alert.date)}
                      </span>
                    )}
                    <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100/80">
                      Total: ₹{alert.financialBreakdown?.totalAmount} (+₹{alert.financialBreakdown?.deliveryCharge} Fee)
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-medium text-gray-500 truncate">
                    <FiUser className="w-3 h-3 text-gray-400 shrink-0" />
                    <span className="font-semibold text-gray-800 truncate">{alert.contactDetails?.name || 'Customer'}</span>
                    <span>•</span>
                    <FiMapPin className="w-3 h-3 text-gray-400 shrink-0" />
                    <span className="truncate">{alert.deliveryAddress?.city || 'Location'}</span>
                  </div>
                </div>
                
                <button
                  onClick={() => handleAcceptOrder(alert._id || alert.orderId)}
                  className="px-3.5 py-1.5 bg-[#00246b] hover:bg-[#001c54] text-white rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-2xs active:scale-95 transition-all text-center shrink-0 cursor-pointer"
                >
                  Accept
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats & Filters Row - Compact */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-100 shadow-2xs overflow-x-auto scrollbar-none max-w-full">
          {['all', 'accepted', 'packing', 'out_for_delivery', 'delivered'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                px-2.5 py-1 rounded-lg text-[9px] font-bold capitalize tracking-wider transition-all duration-200 whitespace-nowrap cursor-pointer
                ${filter === f 
                  ? 'bg-[#00246b] text-white shadow-2xs' 
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              {f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-56">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
            <input 
              type="text"
              placeholder="Search order ID or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg py-1.5 pl-8 pr-2.5 text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-blue-500/20 shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Mobile Card List View (visible on screens < 768px) - Compact */}
      <div className="block md:hidden space-y-2">
        {loading ? (
          <div className="bg-white rounded-xl p-8 text-center border border-gray-100 shadow-2xs">
            <div className="w-6 h-6 border-2 border-[#00246b] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Loading Orders...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-gray-100 shadow-2xs">
            <FiBox className="w-8 h-8 text-gray-300 mx-auto mb-1.5" />
            <h3 className="text-xs font-bold text-gray-900 uppercase">No Product Orders Found</h3>
            <p className="text-[9px] text-gray-400 mt-0.5 uppercase tracking-widest">Awaiting customer purchases</p>
          </div>
        ) : (
          filteredOrders
            .slice((currentPage - 1) * pageSize, currentPage * pageSize)
            .map((order) => (
            <div key={order._id} className="bg-white rounded-xl border border-gray-100 shadow-2xs p-3 space-y-2 hover:border-gray-200 transition-all">
              {/* Card Header: Order ID + Payment + Status */}
              <div className="flex items-center justify-between border-b border-gray-100/80 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-blue-600">#{order.orderId}</span>
                  <span className="text-[9px] text-gray-400 font-medium uppercase">
                    • {order.paymentMethod?.toUpperCase() || 'ONLINE'}
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${getStatusBadgeClass(order.status)}`}>
                  {order.status?.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Items & Earnings */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-gray-900 truncate uppercase">
                    {order.items?.[0]?.title || 'Product Order'}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-gray-400">
                      {order.items?.length || 1} item{(order.items?.length || 1) > 1 ? 's' : ''}
                    </span>
                    {formatOrderTime(order.createdAt || order.bookingDate || order.date) && (
                      <>
                        <span className="text-gray-300">•</span>
                        <span className="text-[9px] text-gray-500 font-medium flex items-center gap-1">
                          <FiClock className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                          {formatOrderTime(order.createdAt || order.bookingDate || order.date)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-emerald-600">₹{order.financialBreakdown?.vendorEarnings || 0}</span>
                  <span className="text-[9px] text-gray-400 block font-medium">(+₹{order.financialBreakdown?.deliveryCharge || 0} Fee)</span>
                </div>
              </div>

              {/* Customer Info Bar */}
              <div className="flex items-center justify-between text-[10px] text-gray-600 bg-gray-50/70 px-2 py-1.5 rounded-lg border border-gray-100/70">
                <div className="flex items-center gap-1 truncate">
                  <FiUser className="w-3 h-3 text-gray-400 shrink-0" />
                  <span className="font-semibold text-gray-800 truncate">{order.contactDetails?.name || order.userId?.name || 'Customer'}</span>
                  <span className="text-gray-300">•</span>
                  <span className="text-gray-500 truncate">{order.deliveryAddress?.city || 'Location'}</span>
                </div>
                {order.contactDetails?.phone && (
                  <a 
                    href={`tel:${order.contactDetails.phone}`} 
                    className="flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-blue-100 shrink-0 transition-colors"
                  >
                    <FiPhone className="w-2.5 h-2.5" />
                    Call
                  </a>
                )}
              </div>

              {/* Card Footer: Status Select & Actions */}
              <div className="pt-1 flex items-center justify-between gap-1.5 border-t border-gray-100/80">
                <select 
                  value={order.status}
                  onChange={(e) => handleUpdateStatus(e, order._id, e.target.value)}
                  className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-gray-800 cursor-pointer focus:outline-none"
                >
                  <option value="ACCEPTED">Accepted</option>
                  <option value="PACKING">Packing</option>
                  <option value="OUT_FOR_DELIVERY">Out For Delivery</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>

                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => navigate(`/vendor/booking/${order._id}/assign-worker`)}
                    className="px-2 py-1 bg-gray-800 hover:bg-gray-900 text-white text-[9px] font-bold rounded-lg uppercase shadow-2xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                  >
                    <FiUsers className="w-2.5 h-2.5" />
                    {order.workerId ? 'Reassign' : 'Forward'}
                  </button>

                  {order.status === 'ACCEPTED' && (
                    <button 
                      onClick={(e) => handleUpdateStatus(e, order._id, 'PACKING')}
                      className="px-2 py-1 bg-[#00246b] text-white text-[9px] font-bold rounded-lg uppercase shadow-2xs active:scale-95 transition-all cursor-pointer"
                    >
                      Pack
                    </button>
                  )}
                  {order.status === 'PACKING' && (
                    <button 
                      onClick={(e) => handleUpdateStatus(e, order._id, 'OUT_FOR_DELIVERY')}
                      className="px-2 py-1 bg-indigo-600 text-white text-[9px] font-bold rounded-lg uppercase shadow-2xs active:scale-95 transition-all cursor-pointer"
                    >
                      Dispatch
                    </button>
                  )}
                  {order.status === 'OUT_FOR_DELIVERY' && (
                    <button 
                      onClick={(e) => handleUpdateStatus(e, order._id, 'DELIVERED')}
                      className="px-2 py-1 bg-emerald-600 text-white text-[9px] font-bold rounded-lg uppercase shadow-2xs active:scale-95 transition-all cursor-pointer"
                    >
                      Delivered
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View (visible on screens >= 768px) */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-5 py-3.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Order Details</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Customer</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Earnings Breakdown</th>
                <th className="px-4 py-3.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest w-[140px]">Status</th>
                <th className="px-4 py-3.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-[#00246b] border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Loading Orders...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center">
                    <div className="max-w-xs mx-auto flex flex-col items-center">
                      <FiBox className="w-8 h-8 text-gray-300 mb-1.5" />
                      <h3 className="text-xs font-bold text-gray-900 uppercase">No Product Orders Found</h3>
                      <p className="text-[9px] text-gray-400 mt-0.5 uppercase tracking-widest">Awaiting customer purchases</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((order) => (
                  <tr key={order._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-blue-600">#{order.orderId}</span>
                          <span className="text-[9px] text-gray-400 font-medium uppercase">
                            • {order.paymentMethod?.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-gray-900 uppercase mt-0.5">{order.items?.[0]?.title || 'Product Order'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-gray-400 font-semibold uppercase">
                            {order.items?.length} {order.items?.length === 1 ? 'item' : 'items'}
                          </span>
                          {formatOrderTime(order.createdAt || order.bookingDate || order.date) && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="text-[9px] text-gray-500 font-medium flex items-center gap-1">
                                <FiClock className="w-2.5 h-2.5 text-gray-400" />
                                {formatOrderTime(order.createdAt || order.bookingDate || order.date)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-800">{order.contactDetails?.name || order.userId?.name}</span>
                        <span className="text-[9px] text-gray-400 font-semibold">{order.deliveryAddress?.city}</span>
                        <span className="text-[9px] text-gray-500">{order.contactDetails?.phone}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-emerald-600">₹{order.financialBreakdown?.vendorEarnings} Earned</span>
                        <span className="text-[9px] text-gray-400">
                          (Includes ₹{order.financialBreakdown?.deliveryCharge} 100% Delivery Fee)
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select 
                        value={order.status}
                        onChange={(e) => handleUpdateStatus(e, order._id, e.target.value)}
                        className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg cursor-pointer focus:outline-none ${getStatusBadgeClass(order.status)}`}
                      >
                        <option value="ACCEPTED">Accepted</option>
                        <option value="PACKING">Packing</option>
                        <option value="OUT_FOR_DELIVERY">Out For Delivery</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => navigate(`/vendor/booking/${order._id}/assign-worker`)}
                          className="px-2 py-1 bg-gray-800 hover:bg-gray-900 text-white text-[9px] font-bold rounded-lg uppercase shadow-2xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          title="Forward to Delivery Boy"
                        >
                          <FiUsers className="w-2.5 h-2.5" />
                          {order.workerId ? 'Reassign' : 'Forward'}
                        </button>
                        {order.status === 'ACCEPTED' && (
                          <button 
                            onClick={(e) => handleUpdateStatus(e, order._id, 'PACKING')}
                            className="px-2 py-1 bg-[#00246b] hover:bg-[#001c54] text-white text-[9px] font-bold rounded-lg uppercase shadow-2xs cursor-pointer transition-all active:scale-95"
                          >
                            Start Packing
                          </button>
                        )}
                        {order.status === 'PACKING' && (
                          <button 
                            onClick={(e) => handleUpdateStatus(e, order._id, 'OUT_FOR_DELIVERY')}
                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-bold rounded-lg uppercase shadow-2xs cursor-pointer transition-all active:scale-95"
                          >
                            Dispatch
                          </button>
                        )}
                        {order.status === 'OUT_FOR_DELIVERY' && (
                          <button 
                            onClick={(e) => handleUpdateStatus(e, order._id, 'DELIVERED')}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold rounded-lg uppercase shadow-2xs cursor-pointer transition-all active:scale-95"
                          >
                            Mark Delivered
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && filteredOrders.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(filteredOrders.length / pageSize) || 1}
          totalItems={filteredOrders.length}
          pageSize={pageSize}
          onPageChange={(p) => setCurrentPage(p)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          className="mt-3"
        />
      )}
    </div>
  );
});

export default ProductOrders;
