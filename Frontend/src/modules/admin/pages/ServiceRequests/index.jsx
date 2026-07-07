import React, { useState, useEffect } from 'react';
import { FiClock, FiCheck, FiX, FiFilter, FiRefreshCw, FiUser, FiTag, FiDollarSign } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import api from '../../../../services/api';

const statusColors = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-600 border-red-200'
};

const ServiceRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [pendingCount, setPendingCount] = useState(0);
  const [actionModal, setActionModal] = useState(null); // { id, action }
  const [adminNote, setAdminNote] = useState('');
  const [isActing, setIsActing] = useState(false);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const params = filterStatus !== 'all' ? `?status=${filterStatus}` : '';
      const res = await api.get(`/admin/service-requests${params}`);
      if (res.data.success) {
        setRequests(res.data.requests || []);
        setPendingCount(res.data.pendingCount || 0);
      }
    } catch {
      toast.error('Failed to load service requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRequests(); }, [filterStatus]);

  const handleAction = async () => {
    if (!actionModal) return;
    setIsActing(true);
    try {
      const res = await api.patch(`/admin/service-requests/${actionModal.id}/action`, {
        action: actionModal.action,
        adminNote: adminNote.trim()
      });
      if (res.data.success) {
        toast.success(`Request ${actionModal.action} successfully`);
        setActionModal(null);
        setAdminNote('');
        loadRequests();
      }
    } catch {
      toast.error('Failed to update request');
    } finally {
      setIsActing(false);
    }
  };

  const filtered = requests;

  return (
    <div className="p-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Service Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vendor-submitted service suggestions for review</p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-200">
              {pendingCount} Pending
            </span>
          )}
          <button onClick={loadRequests} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <FiRefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {['all', 'pending', 'approved', 'rejected'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize ${
              filterStatus === s
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
            }`}
          >
            {s === 'all' ? 'All Requests' : s}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiClock className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-gray-500 text-sm font-medium">No requests found</p>
          <p className="text-gray-400 text-xs mt-1">Vendor requests will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <div key={req._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Vendor Info */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center overflow-hidden">
                      {req.vendorId?.profilePhoto ? (
                        <img src={req.vendorId.profilePhoto} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <FiUser className="w-3.5 h-3.5 text-blue-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-700">
                        {req.vendorId?.businessName || req.vendorId?.name || 'Unknown Vendor'}
                      </p>
                      <p className="text-[9px] text-gray-400">{req.vendorId?.phone}</p>
                    </div>
                    <span className={`ml-auto text-[9px] font-bold px-2.5 py-1 rounded-full border capitalize ${statusColors[req.status]}`}>
                      {req.status}
                    </span>
                  </div>

                  {/* Request Details */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[8px] text-gray-400 uppercase tracking-widest mb-0.5">Category</p>
                      <p className="text-xs font-semibold text-gray-800 capitalize">{req.categoryName}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[8px] text-gray-400 uppercase tracking-widest mb-0.5">Service</p>
                      <p className="text-xs font-semibold text-gray-800 capitalize">{req.serviceName}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3">
                      <p className="text-[8px] text-blue-400 uppercase tracking-widest mb-0.5">Suggested Price</p>
                      <p className="text-xs font-bold text-blue-600">₹{req.suggestedPrice?.toLocaleString()}</p>
                    </div>
                  </div>

                  {req.description && (
                    <p className="text-[10px] text-gray-500 bg-gray-50 rounded-xl px-3 py-2 mb-3 border border-gray-100">
                      {req.description}
                    </p>
                  )}

                  {req.adminNote && (
                    <p className="text-[9px] text-blue-600 bg-blue-50 rounded-lg px-3 py-1.5 border border-blue-100">
                      Admin note: {req.adminNote}
                    </p>
                  )}

                  <p className="text-[9px] text-gray-300 mt-2">
                    Submitted: {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>

                {/* Actions (only for pending) */}
                {req.status === 'pending' && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => { setActionModal({ id: req._id, action: 'approved' }); setAdminNote(''); }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-50 text-green-600 border border-green-200 text-xs font-semibold hover:bg-green-100 transition-all"
                    >
                      <FiCheck className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => { setActionModal({ id: req._id, action: 'rejected' }); setAdminNote(''); }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-50 text-red-500 border border-red-200 text-xs font-semibold hover:bg-red-100 transition-all"
                    >
                      <FiX className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Confirm Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setActionModal(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-gray-900 mb-1 capitalize">
              {actionModal.action === 'approved' ? '✅ Approve' : '❌ Reject'} Request
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {actionModal.action === 'approved'
                ? 'Approving notifies the vendor. Remember to manually add the service to the catalog.'
                : 'The vendor will be notified that the request was not approved.'
              }
            </p>
            <div className="mb-4">
              <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest mb-1 block">Admin Note (optional)</label>
              <textarea
                rows={2}
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                placeholder="e.g. We already have this service / Will add soon..."
                className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 resize-none placeholder-gray-300"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActionModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={isActing}
                className={`flex-1 py-2.5 rounded-xl text-white text-xs font-semibold transition-all disabled:opacity-60 ${
                  actionModal.action === 'approved' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {isActing ? 'Processing...' : `Confirm ${actionModal.action === 'approved' ? 'Approve' : 'Reject'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceRequestsPage;
