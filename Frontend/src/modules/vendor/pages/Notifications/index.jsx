import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiCheck, FiX, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { vendorTheme as themeColors } from '../../../../theme';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications
} from '../../services/notificationService';
import { assignWorker } from '../../services/bookingService';

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [filter, setFilter] = useState('all'); // all, alerts, jobs, payments

  // Removed legacy layout effect background injection

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

    // Listen for real-time updates (if implemented via window event)
    const handleUpdate = () => fetchNotifications();
    window.addEventListener('vendorNotificationsUpdated', handleUpdate);

    return () => {
      window.removeEventListener('vendorNotificationsUpdated', handleUpdate);
    };
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await markAsRead(id);
      // Update local state to reflect change immediately
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
    // 1. Mark as read if unread
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

    // 2. Redirect to specific page based on notification context
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
      return ['payment', 'payout', 'wallet', 'refund', 'withdrawal', 'cash_limit'].some(keyword => type.includes(keyword));
    }

    if (filter === 'jobs') {
      // Exclude financial requests that happen to have 'vendor' prefix
      if (['withdrawal', 'cash_limit'].some(keyword => type.includes(keyword))) {
        return false;
      }
      return ['booking', 'job', 'worker', 'visit', 'work', 'reached', 'journey', 'vendor', 'scrap'].some(keyword => type.includes(keyword));
    }

    if (filter === 'alerts') {
      return ['approved', 'rejected', 'registration', 'review', 'general', 'alert', 'security', 'account'].some(keyword => type.includes(keyword));
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

  const getNotificationColor = (originalType) => {
    const type = (originalType || '').toLowerCase();

    if (['payment', 'refund', 'wallet', 'payout'].some(t => type.includes(t))) return '#10B981'; // Green
    if (['booking', 'job', 'work', 'visit', 'journey', 'vendor'].some(t => type.includes(t))) return '#3B82F6'; // Blue
    if (['alert', 'general'].some(t => type.includes(t))) return themeColors.button;

    return '#6B7280'; // Gray
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header - Admin Style - Hidden on Mobile */}
      <div className="hidden md:flex bg-white p-5 rounded-3xl shadow-sm flex-row items-center justify-between text-gray-900 border border-gray-100 gap-6">
        <div>
          <h2 className="text-2xl font-medium text-gray-900 tracking-tight leading-none">
            Alert Hub
          </h2>
          <p className="text-gray-500 text-[11px] font-medium mt-2">
            Consolidated intelligence and operational status updates
          </p>
        </div>
        <div className="flex items-center gap-4">
          {notifications.some(n => !n.read) && (
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={handleMarkAllRead}
              className="px-4 py-2 rounded-xl bg-gray-50 border border-gray-100 text-[9px] font-normal capitalize tracking-widest text-gray-600 hover:bg-gray-100 transition-all"
              title="Mark all as read"
            >
              Clear All
            </motion.button>
          )}
          <div className="w-12 h-12 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center shadow-inner">
            <FiBell className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto scrollbar-hide">
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
                px-3.5 py-1.5 rounded-lg text-[10px] font-normal capitalize tracking-wider transition-all duration-300 whitespace-nowrap
                ${filter === option.id
                  ? 'bg-[#2874F0] text-white shadow-lg shadow-blue-200' 
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              {option.label}
            </button>
          ))}
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center gap-3.5">
            {notifications.some(n => !n.read) && (
              <button
                onClick={handleMarkAllRead}
                className="md:hidden px-3 py-1.5 text-[9px] font-normal text-gray-600 bg-gray-50 border border-gray-100 rounded-lg capitalize tracking-widest hover:bg-gray-100 transition-all"
              >
                Clear All
              </button>
            )}
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 text-[9px] font-normal text-rose-600 bg-rose-50 border border-rose-100 rounded-lg capitalize tracking-widest hover:bg-rose-100 transition-all flex items-center gap-1.5"
            >
              <FiTrash2 className="w-3.5 h-3.5" />
              Wipe Ledger
            </button>
          </div>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-[48px] p-24 text-center border border-gray-100 shadow-sm">
            <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-gray-100">
              <FiBell className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-normal text-gray-800 mb-2 capitalize tracking-tight">Sync Complete</h3>
            <p className="text-[10px] text-gray-400 font-normal capitalize tracking-widest">No pending alerts in the current matrix.</p>
          </div>
        ) : (
          <div className="space-y-3.5 pb-12">
            {filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`bg-white rounded-2xl p-4 border transition-all relative group hover:shadow-md cursor-pointer ${
                  !notif.read ? 'border-blue-200 bg-blue-50/10 shadow-sm' : 'border-gray-100'
                }`}
              >
                {!notif.read && (
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600 rounded-l-2xl" />
                )}
                
                <div className="flex items-start gap-3.5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: `${getNotificationColor(notif.type)}10` }}
                  >
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div className="flex-1 pr-12 min-w-0">
                    <div className="flex items-start justify-between mb-0.5">
                      <h4 className={`font-normal text-gray-800 text-sm tracking-tight truncate ${!notif.read ? 'text-blue-700' : 'opacity-70'}`}>
                        {notif.title}
                      </h4>
                    </div>
                    <p className="text-xs text-gray-500 font-medium leading-relaxed">
                      {notif.message}
                    </p>

                    {notif.type === 'job_rejected' && notif.relatedId && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/vendor/booking/${notif.relatedId}/assign-worker`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[9px] font-bold uppercase tracking-wider hover:bg-blue-500 transition-all"
                        >
                          Reassign Worker
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelfAssign(notif.relatedId);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-800 text-[9px] font-bold uppercase tracking-wider hover:bg-gray-200 transition-all border border-gray-200"
                        >
                          Do It Myself
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-3.5 mt-2.5">
                       <p className="text-[8px] font-normal text-gray-400 capitalize tracking-widest">
                        {notif.time || (notif.createdAt && new Date(notif.createdAt).toLocaleString())}
                      </p>
                      
                      {(notif.action || notif.relatedType === 'booking' || notif.type === 'payout_requested') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNotificationClick(notif);
                          }}
                          className="text-[8px] font-medium text-blue-600 flex items-center gap-1 capitalize tracking-widest hover:underline"
                        >
                          Execute Review
                          <FiCheck className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="absolute top-4 right-4 flex gap-1.5 transition-all">
                  {!notif.read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(notif.id);
                      }}
                      className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all border border-blue-100"
                    >
                      <FiCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(e, notif.id)}
                    className="p-2.5 rounded-xl bg-gray-50 text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-all border border-gray-100"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-10 shadow-2xl border border-gray-100 text-center">
            <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-rose-100">
              <FiTrash2 className="w-10 h-10 text-rose-500" />
            </div>
            <h3 className="text-2xl font-normal text-gray-900 mb-3 capitalize tracking-tight">Purge Records?</h3>
            <p className="text-sm text-gray-500 font-medium mb-10 leading-relaxed px-4">
              Permanent de-authorization of all operational alerts. This sequence cannot be aborted.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="py-4 rounded-2xl bg-gray-50 text-[10px] font-normal capitalize tracking-widest text-gray-500 hover:bg-gray-100 transition-all"
              >
                Abort
              </button>
              <button
                onClick={confirmClearAll}
                className="py-4 rounded-2xl bg-rose-600 text-[10px] font-normal capitalize tracking-widest text-white shadow-xl shadow-rose-100 active:scale-95 transition-all"
              >
                Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
