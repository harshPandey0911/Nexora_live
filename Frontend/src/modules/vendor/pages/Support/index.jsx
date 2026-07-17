import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMessageSquare, FiPlus, FiClock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { supportService } from '../../services/supportService';
import Header from '../../components/layout/Header';
import { vendorTheme } from '../../../../theme';
import toast from 'react-hot-toast';

const SupportList = () => {
  const navigate = useNavigate();
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
      case 'open': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'in_progress': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'waiting_on_user': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'resolved':
      case 'closed': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      default: return 'bg-gray-50 text-gray-500 border-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return <FiMessageSquare className="w-3.5 h-3.5 mr-1.5" />;
      case 'in_progress': return <FiClock className="w-3.5 h-3.5 mr-1.5" />;
      case 'waiting_on_user': return <FiAlertCircle className="w-3.5 h-3.5 mr-1.5" />;
      case 'resolved':
      case 'closed': return <FiCheckCircle className="w-3.5 h-3.5 mr-1.5" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 pb-20 bg-gray-50 min-h-screen">
      {/* Header - Modern Light Style - Hidden on Mobile */}
      <div className="hidden md:flex bg-white p-4.5 rounded-2xl shadow-sm flex-row items-center justify-between text-gray-900 border border-gray-100 gap-6">
        <div>
          <h1 className="text-xl font-medium text-gray-900 tracking-tight leading-none">Support Center</h1>
          <p className="text-gray-500 text-[10px] font-medium mt-2">Technical assistance and operational query protocols</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 rounded-xl bg-blue-600 text-white text-[9px] font-medium capitalize tracking-widest shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-95"
          >
            <FiPlus className="mr-2 w-3 h-3" /> Initialize Ticket
          </button>
        </div>
      </div>

      {/* Mobile Add Ticket Button */}
      <div className="flex md:hidden px-1 pb-1">
        <button 
          onClick={() => setShowCreateModal(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#2874F0] text-white rounded-xl text-xs font-normal capitalize tracking-wider shadow-md active:scale-95 transition-all"
        >
          <FiPlus className="w-4 h-4" />
          Initialize Ticket
        </button>
      </div>

      <div className="relative z-10">
        {/* Ticket List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
            <span className="text-[9px] font-medium text-gray-400 capitalize tracking-widest">Syncing Helpdesk...</span>
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-gray-100 shadow-inner">
              <FiMessageSquare className="w-6 h-6 text-gray-300" />
            </div>
            <h3 className="text-sm font-normal text-gray-800 capitalize mb-2">No Active Protocols</h3>
            <p className="text-[9px] font-medium text-gray-400 capitalize tracking-[0.2em] mb-6 leading-relaxed px-2">Our support controllers are on standby. Raise a ticket for immediate assistance.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2.5 rounded-xl bg-gray-900 text-white text-[9px] font-medium capitalize tracking-widest shadow active:scale-95 transition-all"
            >
              Raise Protocol
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {tickets.map(ticket => (
              <div
                key={ticket._id}
                onClick={() => navigate(`/vendor/support/${ticket._id}`)}
                className="bg-white rounded-2xl p-4 border border-gray-100 active:scale-[0.98] transition-all cursor-pointer group hover:shadow-md hover:border-blue-200 shadow-sm"
              >
                <div className="flex justify-between items-start mb-3.5">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-medium text-gray-400 capitalize tracking-widest">Protocol ID</span>
                    <span className="text-[10px] font-medium text-blue-600 capitalize tracking-tight">#{ticket.ticketNumber}</span>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[8px] font-medium capitalize tracking-[0.15em] border ${getStatusStyles(ticket.status)}`}>
                    {getStatusIcon(ticket.status)}
                    {ticket.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <h3 className="text-sm font-normal text-gray-900 group-hover:text-blue-600 transition-colors leading-tight mb-1.5 capitalize tracking-tight">{ticket.subject}</h3>
                <p className="text-xs font-medium text-gray-500 line-clamp-2 mb-3.5 leading-relaxed">
                  {ticket.messages[0]?.message}
                </p>
                <div className="flex justify-between items-center pt-3.5 border-t border-gray-50">
                  <span className="text-[8px] font-medium capitalize tracking-[0.15em] text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">{ticket.category}</span>
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <FiClock className="w-3 h-3" />
                    <span className="text-[8px] font-medium capitalize tracking-widest">
                      {new Date(ticket.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 lg:p-10 bg-gray-900/40 backdrop-blur-md">
          <div className="bg-white rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xs font-medium text-gray-900 capitalize tracking-[0.4em]">Initialize Support Protocol</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors border border-gray-100 shadow-sm"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-gray-400 capitalize tracking-[0.3em] ml-2">Classification</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs font-medium capitalize tracking-widest text-gray-900 focus:border-blue-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                    required
                  >
                    <option value="general">General Inquiry</option>
                    <option value="payout">Asset Settlement</option>
                    <option value="booking">Deployment Conflict</option>
                    <option value="account">Identity Protocol</option>
                    <option value="technical">System Anomalies</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-gray-400 capitalize tracking-[0.3em] ml-2">Transmission Subject</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="PROTOCOL OVERVIEW"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs font-medium capitalize tracking-widest text-gray-900 focus:border-blue-500 focus:bg-white outline-none transition-all placeholder:text-gray-300"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-gray-400 capitalize tracking-[0.3em] ml-2">Transmission Payload</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="DESCRIBE THE CORE ISSUE..."
                    rows="4"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs font-medium capitalize tracking-widest text-gray-900 focus:border-blue-500 focus:bg-white outline-none transition-all resize-none placeholder:text-gray-300"
                    required
                  ></textarea>
                </div>
              </div>
              <div className="mt-8">
                <button
                  type="submit"
                  className="w-full py-5 rounded-2xl bg-blue-600 text-white text-[12px] font-medium capitalize tracking-[0.4em] shadow-xl shadow-blue-500/30 active:scale-95 transition-all hover:bg-blue-700"
                >
                  Authorize Transmission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportList;
