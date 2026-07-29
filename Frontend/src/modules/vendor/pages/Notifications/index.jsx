import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiCheck, FiX, FiTrash2, FiClock, FiArrowRight } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications
} from '../../services/notificationService';
import { assignWorker } from '../../services/bookingService';
import Pagination from '../../../../components/common/Pagination';

const Notifications = () => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [filter, setFilter] = useState('all'); // all, alerts, jobs, payments

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await getNotifications();
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const handleUpdate = () => fetchNotifications();
    window.addEventListener('vendorNotificationsUpdated', handleUpdate);

    return () => {
      window.removeEventListener('vendorNotificationsUpdated', handleUpdate);
    };
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await markAsRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      toast.success('Notification marked as read');
    } catch (error) {
      console.error('Failed to mark as read', error);
      toast.error('Failed to mark as read');
    }
  };

  const handleSelfAssign = async (bookingId) => {
    try {
      const response = await assignWorker(bookingId, 'SELF');
      if (response && response.success) {
        toast.success('Assigned to yourself successfully');
        window.dispatchEvent(new Event('vendorJobsUpdated'));
        fetchNotifications();
      } else {
        throw new Error(response?.message || 'Failed to assign worker');
      }
    } catch (error) {
      console.error('Error assigning to self:', error);
      toast.error(error.message || 'Failed to assign worker');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('All marked as read');
    } catch (error) {
      console.error('Failed to mark all as read', error);
      toast.error('Failed to mark all as read');
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notification removed');
    } catch (error) {
      console.error('Failed to delete notification', error);
      toast.error('Failed to delete');
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      try {
        await markAsRead(notif.id);
        setNotifications(prev =>
          prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
        );
      } catch (error) {
        console.error('Failed to mark as read', error);
      }
    }

    const type = (notif.type || '').toLowerCase();
    const relatedType = (notif.relatedType || '').toLowerCase();
    const bookingId = notif.relatedId || notif.bookingId;

    if (type.includes('payment') || type.includes('payout') || type.includes('wallet') || type.includes('withdrawal') || type.includes('cash_limit')) {
      navigate('/vendor/wallet');
    } else if (type.includes('product') || type.includes('order')) {
      navigate('/vendor/product-orders');
    } else if (bookingId) {
      navigate(`/vendor/booking/${bookingId}`);
    } else if (relatedType === 'booking') {
      navigate(`/vendor/booking/${notif.relatedId}`);
    } else {
      navigate('/vendor/dashboard');
    }
  };

  const handleClearAll = () => {
    setShowClearConfirm(true);
  };

  const confirmClearAll = async () => {
    try {
      await deleteAllNotifications();
      setNotifications([]);
      toast.success('All notifications cleared');
      setShowClearConfirm(false);
    } catch (error) {
      console.error('Failed to clear notifications', error);
      toast.error('Failed to clear');
      setShowClearConfirm(false);
    }
  };

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'all') return true;

    const type = (notif.type || '').toLowerCase();

    if (filter === 'payments') {
      return ['payment', 'payout', 'wallet', 'refund', 'withdrawal', 'cash_limit', 'earnings', 'credit', 'debit'].some(keyword => type.includes(keyword));
    }

    if (filter === 'jobs') {
      if (['withdrawal', 'cash_limit', 'payout', 'wallet', 'payment', 'refund'].some(keyword => type.includes(keyword))) {
        return false;
      }
      return ['booking', 'job', 'worker', 'visit', 'work', 'reached', 'journey', 'assignment', 'scrap'].some(keyword => type.includes(keyword));
    }

    if (filter === 'alerts') {
      return ['approved', 'rejected', 'registration', 'review', 'general', 'alert', 'security', 'account', 'system', 'admin', 'vendor'].some(keyword => type.includes(keyword));
    }

    return type === filter;
  });

  const getNotificationIcon = (originalType) => {
    const type = (originalType || '').toLowerCase();

    if (['payment', 'refund', 'wallet', 'payout'].some(t => type.includes(t))) return '💰';
    if (['booking', 'job', 'work', 'visit', 'journey', 'vendor'].some(t => type.includes(t))) return '📋';
    if (['alert', 'general'].some(t => type.includes(t))) return '🔔';

    return '📢';
  };

  return (
    <div className="space-y-3 sm:space-y-4 pb-16">
      {/* Header - Compact & Modern */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs flex flex-row items-center justify-between text-gray-900 border border-gray-100 gap-3">
        <div>
          <h2 className="text-base sm:text-xl font-bold text-gray-900 tracking-tight leading-tight capitalize">
            Alert Hub
          </h2>
          <p className="text-gray-500 text-[10px] sm:text-xs font-medium mt-0.5">
            Real-time status updates and operational intelligence
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {notifications.some(n => !n.read) && (
            <button 
              onClick={handleMarkAllRead}
              className="px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-700 transition-all flex items-center gap-1 cursor-pointer"
              title="Mark all as read"
            >
              <FiCheck className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Mark All Read</span>
            </button>
          )}
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <FiBell className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Bulk Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-100 shadow-2xs overflow-x-auto scrollbar-hide">
          {[
            { id: 'all', label: 'All Alerts' },
            { id: 'jobs', label: 'Deployments' },
            { id: 'payments', label: 'Financials' },
            { id: 'alerts', label: 'Operational' },
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => setFilter(option.id)}
              className={`
                px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 whitespace-nowrap cursor-pointer
                ${filter === option.id
                  ? 'bg-blue-600 text-white shadow-2xs' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              {option.label}
            </button>
          ))}
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleClearAll}
              className="px-2.5 py-1 text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-lg uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
            >
              <FiTrash2 className="w-3 h-3" />
              <span>Clear All</span>
            </button>
          </div>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl p-10 text-center border border-gray-100 shadow-2xs">
            <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Loading alerts...
            </span>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center border border-dashed border-gray-200 shadow-2xs">
            <FiBell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <h3 className="text-xs font-bold text-gray-900 uppercase">Inbox Up to Date</h3>
            <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-widest">No pending notifications in current filter</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotifications
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`bg-white rounded-xl p-3 sm:p-3.5 border transition-all relative group hover:border-gray-200 cursor-pointer shadow-2xs flex items-start gap-3 ${
                  !notif.read ? 'border-blue-200 bg-blue-50/20' : 'border-gray-100'
                }`}
              >
                {!notif.read && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 rounded-l-xl" />
                )}
                
                <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-base shrink-0">
                  {getNotificationIcon(notif.type)}
                </div>

                <div className="flex-1 min-w-0 pr-12">
                  <h4 className={`font-bold text-xs tracking-tight truncate ${!notif.read ? 'text-gray-900' : 'text-gray-600'}`}>
                    {notif.title}
                  </h4>
                  <p className="text-[11px] text-gray-500 font-medium leading-normal mt-0.5">
                    {notif.message}
                  </p>

                  {notif.type === 'job_rejected' && notif.relatedId && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/vendor/booking/${notif.relatedId}/assign-worker`);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Reassign Worker
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelfAssign(notif.relatedId);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-[9px] font-bold uppercase tracking-wider transition-all border border-gray-200 cursor-pointer"
                      >
                        Do It Myself
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-[9px] font-medium text-gray-400">
                    <span>{notif.time || (notif.createdAt && new Date(notif.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  {!notif.read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(notif.id);
                      }}
                      className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                      title="Mark as read"
                    >
                      <FiCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(e, notif.id)}
                    className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete notification"
                  >
                    <FiX className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Bar */}
        {filteredNotifications.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filteredNotifications.length / pageSize) || 1}
            totalItems={filteredNotifications.length}
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

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-[170] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClearConfirm(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-xs bg-white rounded-2xl p-6 shadow-2xl border border-gray-100 text-center z-10"
            >
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100">
                <FiTrash2 className="w-6 h-6 text-rose-500" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">Clear All Notifications?</h3>
              <p className="text-xs text-gray-500 mb-6">
                Are you sure you want to delete all alert records from your inbox?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2 rounded-xl bg-gray-100 text-xs font-bold text-gray-600 hover:bg-gray-200 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmClearAll}
                  className="flex-1 py-2 rounded-xl bg-rose-600 text-xs font-bold text-white shadow-2xs hover:bg-rose-700 transition-all cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Notifications;
