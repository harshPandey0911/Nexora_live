import React, { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiPackage, FiPlus, FiTrash2, FiEye, FiSearch, 
  FiDownload, FiFilter, FiMoreVertical, FiChevronDown, FiBox,
  FiUser, FiMapPin, FiClock, FiChevronRight
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { getBookings, updateBookingStatus } from '../../services/bookingService';

const ProductOrders = memo(() => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadOrders = useCallback(async (currentFilter, currentSearch) => {
    try {
      setLoading(true);
      const response = await getBookings({
        status: currentFilter === 'all' ? undefined : currentFilter,
        q: currentSearch,
        limit: 50
      });
      
      const ordersData = (response.data || [])
        .filter(order => order.offeringType === 'PRODUCT')
        .map(order => ({
          id: order._id || order.id,
          productName: order.serviceName || 'Product',
          user: { name: order.userId?.name || 'Customer' },
          location: { address: order.address?.addressLine1 || 'Address' },
          price: order.finalAmount || 0,
          status: order.status,
          date: order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString() : 'Date',
          time: order.scheduledTime || 'Time'
        }));
        
      setOrders(ordersData);
    } catch (error) {
      console.error('Error loading product orders:', error);
      toast.error('Failed to load product orders');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpdateStatus = async (e, orderId, newStatus) => {
    e.stopPropagation();
    try {
      const res = await updateBookingStatus(orderId, newStatus);
      if (res.success) {
        toast.success(`Order marked as ${newStatus}`);
        loadOrders(filter, searchQuery);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Status update failed');
    }
  };

  useEffect(() => {
    loadOrders(filter, searchQuery);
  }, [filter, searchQuery, loadOrders]);

  const filteredOrders = orders.filter(o => 
    o.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Header - White Style */}
      <div className="bg-white p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between text-gray-900 border border-gray-100 gap-6">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight leading-none">
            Product Orders
          </h2>
          <p className="text-gray-500 text-[11px] font-medium mt-2">
            Fulfillment Intelligence Hub • Manage shipments and delivery protocols
          </p>
        </div>
        <div className="w-12 h-12 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center shadow-inner">
          <FiPackage className="w-6 h-6 text-blue-600" />
        </div>
      </div>

      {/* Stats & Filters Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-1 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto scrollbar-hide">
          {['all', 'confirmed', 'packed', 'shipped', 'delivered'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                px-6 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300 whitespace-nowrap
                ${filter === f 
                  ? 'bg-[#2874F0] text-white shadow-lg shadow-blue-200' 
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="relative group flex-1 max-w-md">
          <label htmlFor="vendor-product-orders-search" className="sr-only">Search order ID or customer</label>
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-blue-500 transition-colors" />
          <input 
            id="vendor-product-orders-search"
            type="text"
            placeholder="Search order ID or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search order ID or customer"
            className="w-full bg-white border border-gray-200 rounded-2xl py-3 pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Order Details</th>
                <th className="px-6 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Customer</th>
                <th className="pl-6 pr-2 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Amount</th>
                <th className="px-2 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest w-[160px]">Protocol Status</th>
                <th className="px-4 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right w-[140px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Syncing Orders...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-24 text-center">
                    <div className="max-w-xs mx-auto flex flex-col items-center">
                      <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                        <FiBox className="w-8 h-8 text-gray-300" />
                      </div>
                      <h3 className="text-sm font-bold text-gray-800 uppercase">No Shipments Found</h3>
                      <p className="text-[10px] text-gray-500 mt-1 font-bold uppercase tracking-widest">Awaiting new order protocols</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50/50 transition-colors group cursor-pointer" onClick={() => navigate(`/vendor/booking/${order.id}`)}>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-blue-600 mb-0.5">#{order.id.slice(-8).toUpperCase()}</span>
                        <p className="text-sm font-bold text-gray-800 uppercase truncate">{order.productName}</p>
                        <span className="text-[10px] text-gray-400 font-bold mt-0.5 uppercase tracking-wider">{order.date}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-700">{order.user.name}</span>
                        <span className="text-[10px] text-gray-400 font-medium truncate max-w-[150px]">{order.location.address}</span>
                      </div>
                    </td>
                    <td className="pl-6 pr-2 py-5">
                      <span className="text-sm font-black text-gray-900">₹{order.price}</span>
                    </td>
                    <td className="px-2 py-5">
                      <select 
                        value={order.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleUpdateStatus(e, order.id, e.target.value)}
                        className={`w-full text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border border-gray-100 shadow-sm focus:ring-2 focus:ring-blue-500/10 cursor-pointer appearance-none ${
                          order.status === 'delivered' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          order.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100' :
                          'bg-blue-50 text-blue-600 border-blue-100'
                        }`}
                      >
                        <option value="confirmed">Confirmed</option>
                        <option value="packed">Packed</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-4 py-5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {order.status === 'confirmed' && (
                          <button 
                            onClick={(e) => handleUpdateStatus(e, order.id, 'packed')}
                            className="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                          >
                            Pack
                          </button>
                        )}
                        {order.status === 'packed' && (
                          <button 
                            onClick={(e) => handleUpdateStatus(e, order.id, 'shipped')}
                            className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                          >
                            Ship
                          </button>
                        )}
                        {order.status === 'shipped' && (
                          <button 
                            onClick={(e) => handleUpdateStatus(e, order.id, 'delivered')}
                            className="px-4 py-1.5 bg-emerald-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                          >
                            Deliver
                          </button>
                        )}
                        <button 
                          className="p-2 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        >
                          <FiChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export default ProductOrders;
