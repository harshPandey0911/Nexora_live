import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMessageSquare, FiPlus, FiClock, FiCheckCircle, FiAlertCircle, FiX, FiSend } from 'react-icons/fi';
import { supportService } from '../../services/supportService';
import toast from 'react-hot-toast';
import Pagination from '../../../../components/common/Pagination';
import { motion, AnimatePresence } from 'framer-motion';

const SupportList = () => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({ subject: '', category: 'general', message: '' });

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await supportService.getTickets();
      if (res.success) {
        setTickets(res.data);
      }
    } catch (error) {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.subject.trim()) {
      toast.error('Please enter a subject for your ticket');
      return;
    }
    if (!formData.message.trim()) {
      toast.error('Please describe your issue in the message field');
      return;
    }
    try {
      const res = await supportService.createTicket(formData);
      if (res.success) {
        toast.success('Ticket created successfully!');
        setShowCreateModal(false);
        setFormData({ subject: '', category: 'general', message: '' });
        fetchTickets();
      }
    } catch (error) {
      toast.error('Failed to create ticket');
    }
  };

  const getStatusStyles = (status) => {
    switch (status) {
      case 'open': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'in_progress': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'waiting_on_user': return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'resolved':
      case 'closed': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return <FiMessageSquare className="w-3 h-3 mr-1" />;
      case 'in_progress': return <FiClock className="w-3 h-3 mr-1" />;
      case 'waiting_on_user': return <FiAlertCircle className="w-3 h-3 mr-1" />;
      case 'resolved':
      case 'closed': return <FiCheckCircle className="w-3 h-3 mr-1" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 pb-16">
      {/* Header - Compact & Modern */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs flex flex-row items-center justify-between text-gray-900 border border-gray-100 gap-3">
        <div>
          <h2 className="text-base sm:text-xl font-bold text-gray-900 tracking-tight leading-tight capitalize">
            Support Center
          </h2>
          <p className="text-gray-500 text-[10px] sm:text-xs font-medium mt-0.5">
            Technical assistance, order helpdesk and operational queries
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00246b] hover:bg-[#001c54] text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider shadow-2xs active:scale-95 transition-all shrink-0 cursor-pointer"
        >
          <FiPlus className="w-3.5 h-3.5" />
          <span>Raise Ticket</span>
        </button>
      </div>

      {/* Ticket List Section */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl p-10 text-center border border-gray-100 shadow-2xs">
            <div className="w-7 h-7 border-2 border-[#00246b] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Syncing Support Desk...</span>
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center border border-dashed border-gray-200 shadow-2xs">
            <FiMessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <h3 className="text-xs font-bold text-gray-900 uppercase">No Active Tickets</h3>
            <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-widest mb-4">Our helpdesk controllers are on standby</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-xl bg-gray-900 text-white text-[10px] font-bold uppercase tracking-wider shadow-2xs cursor-pointer"
            >
              Raise New Ticket
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tickets
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map(ticket => (
              <div
                key={ticket._id}
                onClick={() => navigate(`/vendor/support/${ticket._id}`)}
                className="bg-white rounded-xl p-3.5 border border-gray-100 hover:border-gray-200 active:scale-[0.99] transition-all cursor-pointer group shadow-2xs flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-wider">
                      #{ticket.ticketNumber}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${getStatusStyles(ticket.status)}`}>
                      {getStatusIcon(ticket.status)}
                      {ticket.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-tight mb-1 truncate">
                    {ticket.subject}
                  </h3>
                  <p className="text-[11px] font-medium text-gray-500 line-clamp-2 leading-relaxed">
                    {ticket.messages[0]?.message}
                  </p>
                </div>

                <div className="flex justify-between items-center pt-2.5 border-t border-gray-50 text-[9px] font-medium text-gray-400">
                  <span className="font-bold text-gray-700 uppercase tracking-wider">{ticket.category}</span>
                  <div className="flex items-center gap-1">
                    <FiClock className="w-3 h-3 text-gray-400" />
                    <span>
                      {new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && tickets.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(tickets.length / pageSize) || 1}
            totalItems={tickets.length}
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

      {/* Initialize Ticket Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-gray-100 z-10"
            >
              <div className="flex items-center justify-between mb-3.5">
                <div>
                  <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">Helpdesk Support</p>
                  <h3 className="text-sm font-bold text-gray-900 mt-0.5">Initialize Support Ticket</h3>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all cursor-pointer"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Classification *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    required
                  >
                    <option value="general">General Inquiry</option>
                    <option value="payout">Asset Settlement / Payout</option>
                    <option value="booking">Deployment Conflict</option>
                    <option value="account">Profile & Verification</option>
                    <option value="technical">System Anomaly</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Ticket Subject *</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Brief description of your query..."
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-gray-300"
                    required
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Message Payload *</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Describe your issue or request in detail..."
                    rows="3"
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-gray-300 resize-none"
                    required
                  ></textarea>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-[#00246b] hover:bg-[#001c54] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <FiSend className="w-3 h-3" />
                    <span>Submit</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SupportList;
