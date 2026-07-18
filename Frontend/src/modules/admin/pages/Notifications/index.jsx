import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBell, FiRefreshCw, FiCheck, FiCheckCircle, FiTrash2, FiFilter, FiUser, FiDollarSign, FiUserCheck, FiBriefcase, FiActivity } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import api from '../../../../services/api';

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications/admin', {
        params: { limit: 50 }
      });
      if (res.data.success) {
        setNotifications(res.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
    toast.success('Notifications refreshed');
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n._id === id ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n._id !== id));
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read if unread
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }

    const type = (notification.type || '').toLowerCase();
    const relatedType = (notification.relatedType || '').toLowerCase();

    // Smart routing based on type
    if (type.includes('withdrawal') || type.includes('payout_requested')) {
      navigate('/admin/settlements/withdrawals');
    } else if (type.includes('cash_limit') || type.includes('payout_processed') || type.includes('wallet')) {
      navigate('/admin/settlements/vendors');
    } else if (type.includes('vendor') || type.includes('registration')) {
      navigate('/admin/vendors/all');
    } else if (type.includes('booking') || type.includes('job') || type.includes('worker') || type.includes('visit') || type.includes('work') || type.includes('journey')) {
      navigate('/admin/bookings/all');
    } else if (relatedType === 'booking') {
      navigate('/admin/bookings/all');
    } else if (relatedType === 'vendor') {
      navigate('/admin/vendors/all');
    } else if (relatedType === 'withdrawal') {
      navigate('/admin/settlements/withdrawals');
    }
  };

  const getIcon = (typeStr) => {
    const type = (typeStr || '').toLowerCase();
    
    if (['payment', 'payout', 'wallet', 'refund', 'withdrawal', 'cash_limit'].some(k => type.includes(k))) {
      return <FiDollarSign className="text-emerald-500" />;
    }
    if (['booking', 'job', 'worker', 'visit', 'work', 'reached', 'journey', 'scrap'].some(k => type.includes(k))) {
      return <FiBriefcase className="text-blue-500" />;
    }
    if (['approved', 'rejected', 'registration', 'review', 'general'].some(k => type.includes(k))) {
      return <FiActivity className="text-indigo-500" />;
    }
    return <FiBell className="text-gray-500" />;
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'read') return n.isRead;
    
    const type = (n.type || '').toLowerCase();
    
    if (filter === 'financial') {
      return ['payment', 'payout', 'wallet', 'refund', 'withdrawal', 'cash_limit'].some(keyword => type.includes(keyword));
    }
    
    if (filter === 'deployments') {
      return ['booking', 'job', 'worker', 'visit', 'work', 'reached', 'journey', 'scrap'].some(keyword => type.includes(keyword));
    }
    
    if (filter === 'operational') {
      return ['approved', 'rejected', 'registration', 'review', 'general'].some(keyword => type.includes(keyword));
    }
    
    return true;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <FiBell className="text-blue-600 text-lg" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Notifications</h1>
              <p className="text-xs text-gray-500">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={refreshing}
            >
              <FiRefreshCw className={`text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1"
              >
                <FiCheckCircle className="text-sm" />
                Mark All Read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={async () => {
                  if (window.confirm('Are you sure you want to delete all notifications?')) {
                    try {
                      await api.delete('/notifications/delete-all');
                      setNotifications([]);
                      toast.success('All notifications cleared');
                    } catch (error) {
                      console.error('Error clearing notifications:', error);
                      toast.error('Failed to clear notifications');
                    }
                  }
                }}
                className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
              >
                <FiTrash2 className="text-sm" />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
          {[
            { id: 'all', label: 'All' },
            { id: 'unread', label: 'Unread' },
            { id: 'read', label: 'Read' },
            { id: 'deployments', label: 'Deployments' },
            { id: 'financial', label: 'Financials' },
            { id: 'operational', label: 'Operational' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${filter === f.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-xs text-gray-500 mt-2">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-8 text-center">
            <FiBell className="text-4xl text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No notifications found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            <AnimatePresence>
              {filteredNotifications.map(notification => (
                <motion.div
                  key={notification._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 hover:bg-gray-50 transition-colors flex items-start gap-3 cursor-pointer ${!notification.isRead ? 'bg-blue-50/30' : ''
                    }`}
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {getIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm ${!notification.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                      </div>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-2">
                      {!notification.isRead && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification._id);
                          }}
                          className="text-[10px] font-semibold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <FiCheck className="text-xs" />
                          Mark as read
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification._id);
                        }}
                        className="text-[10px] font-semibold text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <FiTrash2 className="text-xs" />
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Unread indicator */}
                  {!notification.isRead && (
                    <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-2"></div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Notifications;
