import React, { useState, useEffect } from 'react';
import { FiMessageSquare, FiEye, FiSearch, FiFilter, FiCheckCircle } from 'react-icons/fi';
import { supportService } from '../../services/supportService';
import toast from 'react-hot-toast';

const AdminSupport = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, [filter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { status: filter } : {};
      const res = await supportService.getAllTickets(params);
      if (res.success) {
        setTickets(res.data);
      }
    } catch (error) {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleViewTicket = async (id) => {
    try {
      const res = await supportService.getTicketDetails(id);
      if (res.success) {
        setSelectedTicket(res.ticket);
      }
    } catch (error) {
      toast.error('Failed to load ticket details');
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedTicket) return;

    try {
      setSending(true);
      const res = await supportService.replyToTicket(selectedTicket._id, { message: replyMessage });
      if (res.success) {
        toast.success('Reply sent successfully');
        setSelectedTicket(res.ticket);
        setReplyMessage('');
        fetchTickets(); // Refresh list to update status if needed
      }
    } catch (error) {
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedTicket) return;
    try {
      const res = await supportService.updateTicketStatus(selectedTicket._id, newStatus);
      if (res.success) {
        toast.success(`Ticket marked as ${newStatus}`);
        setSelectedTicket(res.ticket);
        fetchTickets();
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open': return <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold uppercase">Open</span>;
      case 'in_progress': return <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-[10px] font-bold uppercase">In Progress</span>;
      case 'waiting_on_user': return <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold uppercase">Waiting</span>;
      case 'resolved': return <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-[10px] font-bold uppercase">Resolved</span>;
      case 'closed': return <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-[10px] font-bold uppercase">Closed</span>;
      default: return <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-[10px] font-bold uppercase">{status}</span>;
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Support Tickets</h1>
          <p className="text-sm text-gray-500">Manage vendor and user support queries</p>
        </div>
      </div>

      <div className="flex gap-6 h-[calc(100vh-140px)]">
        {/* Ticket List (Left Column) */}
        <div className={`w-1/3 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col ${selectedTicket ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-gray-100 flex gap-2">
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Tickets</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting_on_user">Waiting on User</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-10 text-gray-500">No tickets found</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {tickets.map(ticket => (
                  <div 
                    key={ticket._id} 
                    onClick={() => handleViewTicket(ticket._id)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedTicket?._id === ticket._id ? 'bg-blue-50/50 border-l-4 border-blue-500' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-gray-400">#{ticket.ticketNumber}</span>
                      {getStatusBadge(ticket.status)}
                    </div>
                    <h3 className="font-bold text-gray-800 text-sm mb-1 truncate">{ticket.subject}</h3>
                    <p className="text-xs text-gray-500 mb-2 truncate">From: {ticket.creator?.name || 'Unknown'} ({ticket.creatorRole})</p>
                    <p className="text-[10px] text-gray-400">
                      🗓 {new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, {new Date(ticket.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ticket Chat Details (Right Column) */}
        <div className={`flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col ${!selectedTicket ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
          {!selectedTicket ? (
            <div className="text-center text-gray-400">
              <FiMessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Select a ticket to view details</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-bold text-gray-800 text-lg">{selectedTicket.subject}</h2>
                    <span className="text-xs font-mono text-gray-500 bg-gray-200 px-2 py-0.5 rounded">#{selectedTicket.ticketNumber}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    <span className="font-semibold uppercase text-blue-600">{selectedTicket.creatorRole}</span>: {selectedTicket.creator?.name || 'Unknown'} | {selectedTicket.creator?.phone}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Raised on: {new Date(selectedTicket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} at {new Date(selectedTicket.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm uppercase"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="waiting_on_user">Waiting on User</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  <button 
                    onClick={() => setSelectedTicket(null)}
                    className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
                {selectedTicket.messages.map((msg, index) => {
                  const isAdmin = msg.sender === 'admin';
                  return (
                    <div key={index} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl p-4 shadow-sm ${
                        isAdmin 
                          ? 'bg-blue-600 text-white rounded-tr-none' 
                          : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
                      }`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${isAdmin ? 'text-blue-200' : 'text-gray-400'}`}>
                            {msg.sender}
                          </span>
                          <span className={`text-[9px] ${isAdmin ? 'text-blue-200' : 'text-gray-400'}`}>
                            {new Date(msg.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box */}
              {selectedTicket.status !== 'closed' && (
                <div className="p-4 border-t border-gray-100 bg-white rounded-b-xl">
                  <form onSubmit={handleReply} className="flex gap-3">
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type your reply to the user..."
                      className="flex-1 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-14"
                      required
                    ></textarea>
                    <button
                      type="submit"
                      disabled={sending || !replyMessage.trim()}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-xl shadow-md transition-colors flex items-center"
                    >
                      {sending ? 'Sending...' : 'Send Reply'}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSupport;
