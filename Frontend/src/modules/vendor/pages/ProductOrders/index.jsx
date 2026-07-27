import React, { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  FiPackage, FiPlus, FiTrash2, FiEye, FiSearch, 
  FiDownload, FiFilter, FiMoreVertical, FiChevronDown, FiBox,
  FiUser, FiMapPin, FiClock, FiChevronRight, FiCheckCircle, FiTruck
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import vendorService from '../../services/vendorService';
import Pagination from '../../../../components/common/Pagination';

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
        <div className="flex flex-col gap-2 p-1">
          <p className="font-bold text-sm text-gray-900">🛍️ New Product Order Alert!</p>
          <p className="text-xs text-gray-600">Order #{data.customOrderId} for ₹{data.totalAmount}</p>
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
              className="px-3 py-1.5 bg-[#00246b] text-white rounded-lg text-xs font-bold uppercase"
            >
              Accept Order
            </button>
            <button onClick={() => toast.dismiss(t.id)} className="px-2 py-1.5 text-gray-500 text-xs">Dismiss</button>
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
    (o.userId?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm flex flex-row items-center justify-between text-gray-900 border border-gray-100 gap-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight leading-none">
            Product Orders Hub
          </h2>
          <p className="text-gray-500 text-xs font-semibold mt-2">
            Fulfill product orders. <strong className="text-emerald-600">You receive 100% of the delivery charges!</strong>
          </p>
        </div>
        <div className="w-12 h-12 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-center text-[#00246b] shadow-inner shrink-0">
          <FiPackage className="w-6 h-6" />
        </div>
      </div>

      {/* Pending Incoming Order Alerts Banner */}
      {pendingAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
            <FiClock className="w-4 h-4 text-amber-600 animate-spin" />
            {pendingAlerts.length} Incoming Product Order Alerts Nearby
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingAlerts.map(alert => (
              <div key={alert._id} className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-900">Order #{alert.orderId}</p>
                  <p className="text-[10px] font-semibold text-emerald-600">
                    Total: ₹{alert.financialBreakdown?.totalAmount} (+₹{alert.financialBreakdown?.deliveryCharge} Delivery Fee)
                  </p>
                  <p className="text-[10px] text-gray-400">{alert.contactDetails?.name} • {alert.deliveryAddress?.city}</p>
                </div>
                <button
                  onClick={() => handleAcceptOrder(alert._id)}
                  className="px-4 py-2 bg-[#00246b] text-white rounded-xl text-xs font-bold uppercase shadow-md active:scale-95 transition-all"
                >
                  Accept
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats & Filters Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          {['all', 'accepted', 'packing', 'out_for_delivery', 'delivered'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                px-3.5 py-1.5 rounded-lg text-[10px] font-bold capitalize tracking-wider transition-all duration-300 whitespace-nowrap
                ${filter === f 
                  ? 'bg-[#00246b] text-white shadow-md' 
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              {f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="flex-1 max-w-md flex flex-col gap-1">
          <div className="relative group">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text"
              placeholder="Search order ID or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-2xl py-2 pl-10 pr-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-5 text-[11px] font-bold text-gray-500 uppercase tracking-widest">Order Details</th>
                <th className="px-6 py-5 text-[11px] font-bold text-gray-500 uppercase tracking-widest">Customer</th>
                <th className="px-6 py-5 text-[11px] font-bold text-gray-500 uppercase tracking-widest">Earnings Breakdown</th>
                <th className="px-4 py-5 text-[11px] font-bold text-gray-500 uppercase tracking-widest w-[160px]">Status</th>
                <th className="px-4 py-5 text-[11px] font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-[#00246b] border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Loading Orders...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-24 text-center">
                    <div className="max-w-xs mx-auto flex flex-col items-center">
                      <FiBox className="w-12 h-12 text-gray-300 mb-2" />
                      <h3 className="text-sm font-bold text-gray-900 uppercase">No Product Orders Found</h3>
                      <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest">Awaiting customer purchases</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((order) => (
                  <tr key={order._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-blue-600 mb-0.5">#{order.orderId}</span>
                        <p className="text-sm font-bold text-gray-900 uppercase">{order.items?.[0]?.title || 'Product Order'}</p>
                        <span className="text-[10px] text-gray-400 font-semibold mt-0.5 uppercase">
                          {order.items?.length} {order.items?.length === 1 ? 'item' : 'items'} • {order.paymentMethod?.toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-800">{order.contactDetails?.name || order.userId?.name}</span>
                        <span className="text-[10px] text-gray-400 font-semibold">{order.deliveryAddress?.city}</span>
                        <span className="text-[10px] text-gray-500">{order.contactDetails?.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-emerald-600">₹{order.financialBreakdown?.vendorEarnings} Earned</span>
                        <span className="text-[10px] text-gray-500">
                          (Includes ₹{order.financialBreakdown?.deliveryCharge} 100% Delivery Fee)
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <select 
                        value={order.status}
                        onChange={(e) => handleUpdateStatus(e, order._id, e.target.value)}
                        className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-xl border border-gray-200 bg-white cursor-pointer"
                      >
                        <option value="ACCEPTED">Accepted</option>
                        <option value="PACKING">Packing</option>
                        <option value="OUT_FOR_DELIVERY">Out For Delivery</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-4 py-5 text-right">
                      {order.status === 'ACCEPTED' && (
                        <button 
                          onClick={(e) => handleUpdateStatus(e, order._id, 'PACKING')}
                          className="px-3 py-1.5 bg-[#00246b] text-white text-[10px] font-bold rounded-xl uppercase shadow-sm"
                        >
                          Start Packing
                        </button>
                      )}
                      {order.status === 'PACKING' && (
                        <button 
                          onClick={(e) => handleUpdateStatus(e, order._id, 'OUT_FOR_DELIVERY')}
                          className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-xl uppercase shadow-sm"
                        >
                          Dispatch
                        </button>
                      )}
                      {order.status === 'OUT_FOR_DELIVERY' && (
                        <button 
                          onClick={(e) => handleUpdateStatus(e, order._id, 'DELIVERED')}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-xl uppercase shadow-sm"
                        >
                          Mark Delivered
                        </button>
                      )}
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
          className="mt-4"
        />
      )}
    </div>
  );
});

export default ProductOrders;
