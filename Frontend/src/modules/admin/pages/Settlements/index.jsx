import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiDollarSign, FiCheck, FiX, FiEye, FiClock, FiUsers, FiTrendingUp, FiAlertCircle, FiDownload } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import adminSettlementService from '../../../../services/adminSettlementService';
import { getSettings } from '../../services/settingsService';
import { exportToCSV } from '../../../../utils/csvExport';
import Pagination from '../../../../components/common/Pagination';

const SettlementManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dashboard, setDashboard] = useState(null);
  const [pendingSettlements, setPendingSettlements] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [history, setHistory] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [settings, setSettings] = useState(null);

  // Modal State
  const [activeModal, setActiveModal] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalInput, setModalInput] = useState('');
  const [modalInput2, setModalInput2] = useState('');
  const [vendorLedgerData, setVendorLedgerData] = useState(null);
  const [vendorLedgerLoading, setVendorLedgerLoading] = useState(false);

  const openVendorLedger = async (vendor) => {
    try {
      setSelectedItem(vendor);
      setActiveModal('view_vendor_ledger');
      setVendorLedgerLoading(true);
      setVendorLedgerData(null);
      const res = await adminSettlementService.getVendorLedger(vendor._id);
      if (res?.success) {
        setVendorLedgerData(res);
      }
    } catch (err) {
      toast.error('Failed to load vendor ledger');
    } finally {
      setVendorLedgerLoading(false);
    }
  };

  // Determine active tab from URL
  useEffect(() => {
    const path = location.pathname.split('/').pop();
    if (['pending', 'vendors', 'history', 'withdrawals'].includes(path)) {
      setActiveTab(path);
    } else {
      setActiveTab('pending');
    }
  }, [location.pathname]);

  useEffect(() => {
    setCurrentPage(1);
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Always load dashboard
      const dashRes = await adminSettlementService.getDashboard();
      if (dashRes.success) {
        setDashboard(dashRes.data);
      }

      if (activeTab === 'pending') {
        const res = await adminSettlementService.getPendingSettlements();
        if (res.success) setPendingSettlements(res.data || []);
      } else if (activeTab === 'vendors') {
        const res = await adminSettlementService.getVendorBalances({ filterDue: 'true' });
        if (res.success) setVendors(res.data || []);
      } else if (activeTab === 'history') {
        const res = await adminSettlementService.getSettlementHistory();
        if (res.success) setHistory(res.data || []);
      } else if (activeTab === 'withdrawals') {
        const res = await adminSettlementService.getWithdrawalRequests();
        if (res.success) setWithdrawals(res.data || []);

        // Load settings for fee calculation
        const setRes = await getSettings();
        if (setRes.success) setSettings(setRes.settings);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // --- Modal Openers ---
  const openApproveSettlement = (item) => {
    setSelectedItem(item);
    setActiveModal('approve_settlement');
  };

  const openRejectSettlement = (item) => {
    setSelectedItem(item);
    setModalInput('');
    setActiveModal('reject_settlement');
  };

  const openBlockVendor = (vendor) => {
    setSelectedItem(vendor);
    setModalInput('');
    setActiveModal('block_vendor');
  };

  const openUnblockVendor = (vendor) => {
    setSelectedItem(vendor);
    setActiveModal('unblock_vendor');
  };

  const openUpdateLimit = (vendor) => {
    setSelectedItem(vendor);
    setModalInput((vendor.cashLimit || 10000).toString());
    setActiveModal('update_limit');
  };

  const openApproveWithdrawal = (item) => {
    setSelectedItem(item);
    setModalInput('');
    setActiveModal('approve_withdrawal');
  };

  const openRejectWithdrawal = (item) => {
    setSelectedItem(item);
    setModalInput('');
    setActiveModal('reject_withdrawal');
  };

  const closeModals = () => {
    setActiveModal(null);
    setSelectedItem(null);
    setModalInput('');
    setModalInput2('');
  };

  // --- Action Handlers ---
  const handleApproveSettlement = async () => {
    try {
      setActionLoading(true);
      const res = await adminSettlementService.approveSettlement(selectedItem._id);
      if (res.success) {
        toast.success('Settlement approved!');
        loadData();
        closeModals();
      } else {
        toast.error(res.message || 'Failed to approve');
      }
    } catch (error) {
      toast.error('Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSettlement = async () => {
    if (!modalInput.trim()) return toast.error('Rejection reason is required');
    try {
      setActionLoading(true);
      const res = await adminSettlementService.rejectSettlement(selectedItem._id, modalInput);
      if (res.success) {
        toast.success('Settlement rejected');
        loadData();
        closeModals();
      }
    } catch (error) {
      toast.error('Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockVendor = async () => {
    if (!modalInput.trim()) return toast.error('Blocking reason is required');
    try {
      setActionLoading(true);
      const res = await adminSettlementService.blockVendor(selectedItem._id, modalInput);
      if (res.success) {
        toast.success('Vendor blocked');
        loadData();
        closeModals();
      }
    } catch (error) {
      toast.error('Failed to block');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateLimitSubmit = async () => {
    const cleanInput = (modalInput || '').toString().trim();
    const parsedLimit = parseInt(cleanInput);
    if (isNaN(parsedLimit) || parsedLimit <= 0) return toast.error('Valid cash limit required');
    try {
      setActionLoading(true);
      const res = await adminSettlementService.updateCashLimit(selectedItem._id, parsedLimit);
      if (res.success) {
        toast.success('Cash limit updated successfully!');
        loadData();
        closeModals();
      }
    } catch (error) {
      toast.error('Failed to update limit');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblockVendorSubmit = async () => {
    try {
      setActionLoading(true);
      const res = await adminSettlementService.unblockVendor(selectedItem._id);
      if (res.success) {
        toast.success('Vendor unblocked');
        loadData();
        closeModals();
      }
    } catch (error) {
      toast.error('Failed to unblock');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveWithdrawalSubmit = async () => {
    const ref = modalInput.trim() || `MANUAL-${Date.now()}`;
    try {
      setActionLoading(true);
      const res = await adminSettlementService.approveWithdrawal(selectedItem._id, { transactionReference: ref });
      if (res.success) {
        toast.success('Withdrawal approved');
        loadData();
        closeModals();
      }
    } catch (error) {
      toast.error('Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectWithdrawalSubmit = async () => {
    if (!modalInput.trim()) return toast.error('Rejection reason required');
    try {
      setActionLoading(true);
      const res = await adminSettlementService.rejectWithdrawal(selectedItem._id, modalInput);
      if (res.success) {
        toast.success('Withdrawal rejected');
        loadData();
        closeModals();
      }
    } catch (error) {
      toast.error('Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleExport = () => {
    if (activeTab === 'history' && history.length > 0) {
      exportToCSV(history, 'settlement_history', [
        { key: 'vendorId.name', label: 'Vendor Name' },
        { key: 'vendorId.businessName', label: 'Business Name' },
        { key: 'amount', label: 'Amount', type: 'currency' },
        { key: 'paymentMethod', label: 'Payment Method' },
        { key: 'paymentReference', label: 'Reference' },
        { key: 'status', label: 'Status' },
        { key: 'createdAt', label: 'Date', type: 'datetime' }
      ]);
    } else if (activeTab === 'vendors' && vendors.length > 0) {
      exportToCSV(vendors, 'vendor_dues', [
        { key: 'name', label: 'Vendor Name' },
        { key: 'businessName', label: 'Business Name' },
        { key: 'phone', label: 'Phone', type: 'phone' },
        { key: 'amountDue', label: 'Amount Due', type: 'currency' },
        { key: 'cashLimit', label: 'Cash Limit', type: 'currency' },
        { key: 'isBlocked', label: 'Blocked' }
      ]);
    } else if (activeTab === 'withdrawals' && withdrawals.length > 0) {
      exportToCSV(withdrawals, 'withdrawal_requests', [
        { key: 'vendorId.name', label: 'Vendor Name' },
        { key: 'vendorId.businessName', label: 'Business Name' },
        { key: 'amount', label: 'Amount', type: 'currency' },
        { key: 'status', label: 'Status' },
        { key: 'requestDate', label: 'Request Date', type: 'date' }
      ]);
    } else if (activeTab === 'pending' && pendingSettlements.length > 0) {
      exportToCSV(pendingSettlements, 'pending_settlements', [
        { key: 'vendorId.name', label: 'Vendor Name' },
        { key: 'vendorId.businessName', label: 'Business Name' },
        { key: 'amount', label: 'Amount', type: 'currency' },
        { key: 'paymentMethod', label: 'Payment Method' },
        { key: 'paymentReference', label: 'Reference' },
        { key: 'createdAt', label: 'Date', type: 'datetime' }
      ]);
    } else {
      toast.error('No data to export');
    }
  };

  /* --- Dynamic Dashboard Card Renderer --- */
  const renderDashboardCards = () => {
    if (loading && !dashboard) return null;

    let cards = [];

    if (activeTab === 'withdrawals') {
      // Withdrawals specific stats
      const pendingCount = withdrawals.length;
      const pendingAmount = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

      cards = [
        {
          title: 'Total Pending Amount',
          value: `₹${pendingAmount.toLocaleString()}`,
          icon: FiDollarSign,
          color: 'text-orange-600',
          bg: 'bg-orange-50',
          border: 'border-orange-100'
        },
        {
          title: 'Pending Requests',
          value: pendingCount,
          icon: FiClock,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          border: 'border-blue-100'
        },
        // Fallback to dashboard stats if available, or static
        {
          title: 'Avg. Payout',
          value: pendingCount > 0 ? `₹${Math.round(pendingAmount / pendingCount).toLocaleString()}` : '₹0',
          icon: FiTrendingUp,
          color: 'text-green-600',
          bg: 'bg-green-50',
          border: 'border-green-100'
        },
        {
          title: 'Processing Status',
          value: 'Active',
          icon: FiCheck,
          color: 'text-purple-600',
          bg: 'bg-purple-50',
          border: 'border-purple-100'
        }
      ];
    } else if (activeTab === 'vendors') {
      // Vendor Payables stats
      const totalVendors = vendors.length;
      const totalDue = vendors.reduce((sum, v) => sum + (v.amountDue || 0), 0);
      const blockedCount = vendors.filter(v => v.isBlocked).length;
      const totalLimit = vendors.reduce((sum, v) => sum + (v.cashLimit || 0), 0);

      cards = [
        {
          title: 'Total Due from Vendors',
          value: `₹${totalDue.toLocaleString()}`,
          icon: FiDollarSign,
          color: 'text-red-600',
          bg: 'bg-red-50',
          border: 'border-red-100'
        },
        {
          title: 'Vendors with Dues',
          value: totalVendors,
          icon: FiUsers,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          border: 'border-blue-100'
        },
        {
          title: 'Blocked Vendors',
          value: blockedCount,
          icon: FiAlertCircle,
          color: 'text-orange-600',
          bg: 'bg-orange-50',
          border: 'border-orange-100'
        },
        {
          title: 'Total Cash Limit',
          value: `₹${(totalLimit / 100000).toFixed(1)}L`,
          icon: FiCheck,
          color: 'text-indigo-600',
          bg: 'bg-indigo-50',
          border: 'border-indigo-100'
        }
      ];
    } else if (activeTab === 'history') {
      // History stats
      const totalTxns = history.length;
      const totalSettled = history.reduce((sum, h) => h.status === 'approved' ? sum + (h.amount || 0) : 0, 0);
      const approvedCount = history.filter(h => h.status === 'approved').length;
      const rejectedCount = history.filter(h => h.status === 'rejected').length;

      cards = [
        {
          title: 'Total Settled Amount',
          value: `₹${totalSettled.toLocaleString()}`,
          icon: FiCheck,
          color: 'text-green-600',
          bg: 'bg-green-50',
          border: 'border-green-100'
        },
        {
          title: 'Total Transactions',
          value: totalTxns,
          icon: FiTrendingUp,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          border: 'border-blue-100'
        },
        {
          title: 'Approved Requests',
          value: approvedCount,
          icon: FiCheck,
          color: 'text-teal-600',
          bg: 'bg-teal-50',
          border: 'border-teal-100'
        },
        {
          title: 'Rejected Requests',
          value: rejectedCount,
          icon: FiX,
          color: 'text-red-600',
          bg: 'bg-red-50',
          border: 'border-red-100'
        }
      ];
    } else {
      // Default Pending Tab (use dashboard data)
      if (!dashboard) return null;
      cards = [
        {
          title: 'Total Due to Admin',
          value: `₹${dashboard.totalDueToAdmin?.toLocaleString() || 0}`,
          icon: FiDollarSign,
          color: 'text-red-600',
          bg: 'bg-red-50',
          border: 'border-red-100'
        },
        {
          title: 'Pending Settlements',
          value: dashboard.pendingSettlements?.count || 0,
          icon: FiClock,
          color: 'text-orange-600',
          bg: 'bg-orange-50',
          border: 'border-orange-100'
        },
        {
          title: "Today's Collection",
          value: `₹${dashboard.todayCashCollected?.amount?.toLocaleString() || 0}`,
          icon: FiTrendingUp,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          border: 'border-blue-100'
        },
        {
          title: 'Weekly Collection',
          value: `₹${dashboard.weeklySettlements?.amount?.toLocaleString() || 0}`,
          icon: FiCheck,
          color: 'text-green-600',
          bg: 'bg-green-50',
          border: 'border-green-100'
        }
      ];
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => (
          <div key={index} className={`bg-white rounded-xl p-4 shadow-sm border hover:shadow-md transition-all ${card.border}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{card.title}</p>
                <h3 className="text-2xl font-black text-gray-800 tracking-tight">{card.value}</h3>
              </div>
              <div className={`p-3 rounded-xl ${card.bg} ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };
  const getPageTitle = () => {
    switch (activeTab) {
      case 'pending': return 'Pending Settlements';
      case 'vendors': return 'Vendor Balances & Limits';
      case 'history': return 'Settlement History';
      case 'withdrawals': return 'Withdrawal Requests';
      default: return 'Settlements';
    }
  };

  // --- Render Helpers ---

  const renderPendingSettlements = () => (
    pendingSettlements.length === 0 ? (
      <div className="text-center py-10">
        <FiClock className="w-12 h-12 mx-auto mb-3 text-gray-200" />
        <p className="text-gray-500 text-sm font-medium">No pending settlements</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pendingSettlements.map(settlement => (
          <div key={settlement._id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4">
            <div className="flex justify-between items-start gap-4">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-sm">{settlement.vendorId?.name || 'Unknown Vendor'}</h3>
                  {settlement.vendorId?.businessName && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-md truncate max-w-[140px]">
                      {settlement.vendorId.businessName}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-2 pt-1">
                  <p className="text-2xl font-black text-gray-900 tracking-tight">₹{settlement.amount?.toLocaleString('en-IN')}</p>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase rounded-md border border-blue-100">
                    {settlement.paymentMethod?.replace('_', ' ')}
                  </span>
                </div>

                {settlement.paymentReference && (
                  <p className="text-xs text-gray-600 font-mono bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg inline-block">
                    Ref: <span className="font-bold text-gray-900">{settlement.paymentReference}</span>
                  </p>
                )}

                <p className="text-[11px] text-gray-400 font-medium pt-1">
                  Submitted: {formatDate(settlement.createdAt)}
                </p>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                {settlement.paymentProof && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItem(settlement);
                      setActiveModal('view_proof');
                    }}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-100 text-center transition-all shadow-xs"
                  >
                    View Proof
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openApproveSettlement(settlement)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 shadow-sm transition-all active:scale-95"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => openRejectSettlement(settlement)}
                  className="px-4 py-2 bg-white border border-rose-200 text-rose-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-rose-50 transition-all active:scale-95"
                >
                  Reject
                </button>
              </div>
            </div>

            {settlement.vendorNotes && (
              <div className="pt-2.5 border-t border-gray-100">
                <p className="text-xs text-gray-600 font-medium italic leading-relaxed">
                  "{settlement.vendorNotes}"
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  );

  const renderVendorsList = () => (
    vendors.length === 0 ? (
      <div className="text-center py-10">
        <FiCheck className="w-12 h-12 mx-auto mb-3 text-gray-200" />
        <p className="text-gray-500 text-sm font-medium">All vendors are settled!</p>
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Vendor Details</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Cash Limit Status</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Amount Due</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {vendors.map(vendor => (
              <tr key={vendor._id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${vendor.isBlocked ? 'bg-red-500' : 'bg-blue-600'}`}>
                      {vendor.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{vendor.name}</p>
                      <p className="text-xs text-gray-500">{vendor.businessName} • {vendor.phone}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex flex-col items-end">
                    <p className="text-xs font-semibold text-gray-700 mb-1">
                      ₹{(vendor.amountDue || 0).toLocaleString('en-IN')} <span className="text-gray-400">/</span> ₹{(vendor.cashLimit || 10000).toLocaleString('en-IN')}
                    </p>
                    <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${vendor.isBlocked ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min((vendor.amountDue / vendor.cashLimit) * 100, 100)}%` }}
                      />
                    </div>
                    {vendor.isBlocked && <span className="text-[10px] text-red-600 font-bold mt-1 uppercase tracking-wide">Blocked</span>}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="font-bold text-red-600 text-base">
                    ₹{vendor.amountDue?.toLocaleString() || 0}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openVendorLedger(vendor)}
                      className="p-2.5 text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded-xl transition-all shadow-xs active:scale-95"
                      title="View Vendor Financial Ledger & History"
                    >
                      <FiEye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openUpdateLimit(vendor)}
                      className="p-2.5 text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded-xl transition-all shadow-xs active:scale-95 flex items-center justify-center min-w-[34px]"
                      title="Update Vendor Cash Collection Limit"
                    >
                      <span className="font-black text-sm leading-none">₹</span>
                    </button>
                    {vendor.isBlocked ? (
                      <button
                        onClick={() => openUnblockVendor(vendor)}
                        className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold uppercase hover:bg-orange-200 transition-colors"
                      >
                        Unblock
                      </button>
                    ) : (
                      <button
                        onClick={() => openBlockVendor(vendor)}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold uppercase hover:bg-red-100 transition-colors"
                      >
                        Block
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  );

  const renderHistoryList = () => (
    history.length === 0 ? (
      <div className="text-center py-10">
        <FiTrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-200" />
        <p className="text-gray-500 text-sm font-medium">No settlement history found</p>
      </div>
    ) : (
      <div className="space-y-3">
        {history.map(settlement => (
          <div
            key={settlement._id}
            className={`bg-white rounded-xl p-4 border transition-all hover:shadow-md ${settlement.status === 'approved' ? 'border-l-4 border-l-green-500 border-gray-100' :
              settlement.status === 'rejected' ? 'border-l-4 border-l-red-500 border-gray-100' :
                'border-l-4 border-l-orange-500 border-gray-100'
              }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${settlement.status === 'approved' ? 'bg-green-100 text-green-600' :
                  settlement.status === 'rejected' ? 'bg-red-100 text-red-600' :
                    'bg-orange-100 text-orange-600'
                  }`}>
                  {settlement.status === 'approved' ? <FiCheck /> : settlement.status === 'rejected' ? <FiX /> : <FiClock />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">{settlement.vendorId?.name || 'Unknown'} <span className="font-normal text-gray-500">paid</span> ₹{settlement.amount?.toLocaleString()}</h4>
                  <p className="text-xs text-gray-500">{formatDate(settlement.createdAt)} • via {settlement.paymentMethod}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${settlement.status === 'approved' ? 'bg-green-50 text-green-700' :
                  settlement.status === 'rejected' ? 'bg-red-50 text-red-700' :
                    'bg-orange-50 text-orange-700'
                  }`}>
                  {settlement.status}
                </span>
                {settlement.rejectionReason && (
                  <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={settlement.rejectionReason}>{settlement.rejectionReason}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  );

  const renderWithdrawalsList = () => (
    withdrawals.length === 0 ? (
      <div className="text-center py-10">
        <FiCheck className="w-12 h-12 mx-auto mb-3 text-gray-200" />
        <p className="text-gray-500 text-sm font-medium">No pending withdrawal requests. All settled!</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {withdrawals.map(request => (
          <div key={request._id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 hover:border-green-200 transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center font-bold text-lg">
                  {request.vendorId?.name?.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{request.vendorId?.name}</h3>
                  <p className="text-xs text-gray-500">{request.vendorId?.businessName}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-green-600">₹{request.amount?.toLocaleString()}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mt-1">Requested Amount</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Available Earnings</span>
                <span className="font-bold text-gray-700">₹{request.vendorId?.wallet?.earnings?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Requested Date</span>
                <span className="font-medium text-gray-700">{formatDate(request.requestDate)}</span>
              </div>
              {request.bankDetails && (
                <div className="pt-2 border-t border-gray-200 mt-2">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Bank Details</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {Object.entries(request.bankDetails).map(([key, val]) => (
                      <div key={key}>
                        <span className="text-gray-500 capitalize">{key}:</span> <span className="text-gray-800 font-medium">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => openApproveWithdrawal(request)}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-bold text-sm shadow-sm hover:bg-green-700 hover:shadow transform active:scale-95 transition-all"
              >
                Approve & Pay
              </button>
              <button
                onClick={() => openRejectWithdrawal(request)}
                className="flex-1 py-2.5 bg-white border border-red-200 text-red-600 rounded-lg font-bold text-sm hover:bg-red-50 active:scale-95 transition-all"
              >
                Reject
              </button>
            </div>
            {request.rejectionReason && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg">
                <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wide mb-0.5">Rejection Reason</p>
                <p className="text-xs text-rose-600">{request.rejectionReason}</p>
              </div>
            )}
            {request.adminNotes && !request.rejectionReason && (
              <p className="mt-3 text-xs text-gray-500 italic text-center">"{request.adminNotes}"</p>
            )}
          </div>
        ))}
      </div>
    )
  );

  return (
    <div className="space-y-6">
      {/* Dynamic Dashboard Cards */}
      {renderDashboardCards()}

      <div className="flex justify-end gap-3">
        <button
          onClick={handleExport}
          className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2 shadow-sm transition-all"
        >
          <FiDownload className="w-4 h-4" />
          Export CSV
        </button>
        <button
          onClick={() => loadData()}
          className="px-3 py-2.5 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100 transition-colors"
        >
          <FiClock className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 mt-4 font-medium">Loading data...</p>
          </div>
        ) : (
          <div className="p-6">
            {activeTab === 'pending' && (
              pendingSettlements.length === 0 ? (
                <div className="text-center py-10">
                  <FiClock className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-500 text-sm font-medium">No pending settlements</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingSettlements.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(settlement => (
                    <div key={settlement._id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 text-sm">{settlement.vendorId?.name || 'Unknown Vendor'}</h3>
                            {settlement.vendorId?.businessName && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-md truncate max-w-[140px]">
                                {settlement.vendorId.businessName}
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline gap-2 pt-1">
                            <p className="text-2xl font-black text-gray-900 tracking-tight">₹{settlement.amount?.toLocaleString('en-IN')}</p>
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase rounded-md border border-blue-100">
                              {settlement.paymentMethod?.replace('_', ' ')}
                            </span>
                          </div>
                          {settlement.paymentReference && (
                            <p className="text-xs text-gray-600 font-mono bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg inline-block">
                              Ref: <span className="font-bold text-gray-900">{settlement.paymentReference}</span>
                            </p>
                          )}
                          <p className="text-[11px] text-gray-400 font-medium pt-1">
                            Submitted: {formatDate(settlement.createdAt)}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          {settlement.paymentProof && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedItem(settlement);
                                setActiveModal('view_proof');
                              }}
                              className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-100 text-center transition-all shadow-xs"
                            >
                              View Proof
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openApproveSettlement(settlement)}
                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 text-center transition-all shadow-sm"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => openRejectSettlement(settlement)}
                            className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 text-center transition-all shadow-xs"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
            {activeTab === 'vendors' && renderVendorsList()}
            {activeTab === 'history' && renderHistoryList()}
            {activeTab === 'withdrawals' && renderWithdrawalsList()}

            {/* Global Pagination Bar */}
            {!loading && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil((
                  activeTab === 'pending' ? pendingSettlements.length :
                  activeTab === 'vendors' ? vendors.length :
                  activeTab === 'history' ? history.length :
                  withdrawals.length
                ) / pageSize) || 1}
                totalItems={
                  activeTab === 'pending' ? pendingSettlements.length :
                  activeTab === 'vendors' ? vendors.length :
                  activeTab === 'history' ? history.length :
                  withdrawals.length
                }
                pageSize={pageSize}
                onPageChange={(p) => setCurrentPage(p)}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
                className="mt-6 border-t pt-4"
              />
            )}
          </div>
        )}
      </div>

      {/* --- Modals --- */}
      {/* View Proof Screenshot Modal */}
      <Modal
        isOpen={activeModal === 'view_proof'}
        onClose={closeModals}
        title="Settlement Payment Proof"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div>
              <p className="font-bold text-gray-900 text-sm">{selectedItem?.vendorId?.name || 'Vendor'}</p>
              <p className="text-xs text-gray-500 font-mono">Ref: {selectedItem?.paymentReference || 'N/A'}</p>
            </div>
            <p className="text-xl font-black text-emerald-600">₹{selectedItem?.amount?.toLocaleString('en-IN')}</p>
          </div>

          {selectedItem?.paymentProof ? (
            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-md bg-gray-900 flex items-center justify-center max-h-[60vh]">
              <img
                src={selectedItem.paymentProof}
                alt="Payment Proof"
                className="max-h-[55vh] w-auto object-contain"
              />
            </div>
          ) : (
            <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-100 text-gray-400">
              No proof image attached
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <a
              href={selectedItem?.paymentProof}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              Open Full Image ↗
            </a>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  closeModals();
                  openRejectSettlement(selectedItem);
                }}
                className="px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all"
              >
                Reject
              </button>
              <button
                onClick={() => {
                  closeModals();
                  openApproveSettlement(selectedItem);
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm transition-all"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Approve Settlement Modal */}
      <Modal
        isOpen={activeModal === 'approve_settlement'}
        onClose={closeModals}
        title="Approve Cash Settlement"
        size="md"
      >
        <div className="space-y-5">
          {/* Vendor Summary */}
          <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center shadow-sm">
                {selectedItem?.vendorId?.name?.charAt(0) || 'V'}
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">{selectedItem?.vendorId?.name}</p>
                <p className="text-xs text-gray-500">{selectedItem?.vendorId?.businessName || 'Verified Partner'}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 font-medium">Deposit Amount</p>
              <p className="text-2xl font-black text-emerald-700">₹{selectedItem?.amount?.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Payment Mode</span>
              <span className="font-bold text-gray-900 uppercase">{selectedItem?.paymentMethod?.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">UTR / Transaction Ref</span>
              <span className="font-mono font-bold text-gray-900">{selectedItem?.paymentReference || 'N/A'}</span>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 leading-relaxed font-medium">
            💡 <strong>Impact:</strong> Approving this settlement will deduct <strong>₹{selectedItem?.amount?.toLocaleString('en-IN')}</strong> from {selectedItem?.vendorId?.name}'s active dues balance and record it under <strong>Total Settled</strong>.
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={closeModals}>Cancel</Button>
            <Button
              onClick={handleApproveSettlement}
              isLoading={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Approve & Clear Dues
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Settlement Modal */}
      <Modal
        isOpen={activeModal === 'reject_settlement'}
        onClose={closeModals}
        title="Reject Cash Settlement"
        size="md"
      >
        <div className="space-y-5">
          {/* Vendor Summary Header */}
          <div className="p-4 bg-rose-50/70 border border-rose-100 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white font-bold flex items-center justify-center shadow-sm">
                {selectedItem?.vendorId?.name?.charAt(0) || 'V'}
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">{selectedItem?.vendorId?.name}</p>
                <p className="text-xs text-gray-500">Ref: {selectedItem?.paymentReference || 'N/A'}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 font-medium">Claimed Amount</p>
              <p className="text-xl font-black text-rose-600">₹{selectedItem?.amount?.toLocaleString('en-IN')}</p>
            </div>
          </div>

          {/* Quick Rejection Preset Chips */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Quick Rejection Presets
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Invalid UTR / Transaction Reference ID',
                'Payment Screenshot Unclear or Missing',
                'Amount Mismatch on Payment Proof',
                'Bank / UPI Transfer Not Received',
                'Duplicate Cash Settlement Submission'
              ].map((reasonChip) => (
                <button
                  key={reasonChip}
                  type="button"
                  onClick={() => setModalInput(reasonChip)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border text-left ${
                    modalInput === reasonChip
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-rose-50 hover:border-rose-300'
                  }`}
                >
                  {reasonChip}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Rejection Reason Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Detailed Rejection Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={modalInput}
              onChange={(e) => setModalInput(e.target.value)}
              placeholder="Select a quick preset above or type custom rejection reason..."
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none text-xs font-medium transition-all"
              rows={3}
            />
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed font-medium">
            ⚠️ Rejecting this settlement request will notify {selectedItem?.vendorId?.name} and keep their active dues balance unchanged.
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={closeModals}>Cancel</Button>
            <Button
              onClick={handleRejectSettlement}
              isLoading={actionLoading}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* Block Vendor Modal */}
      <Modal
        isOpen={activeModal === 'block_vendor'}
        onClose={closeModals}
        title="Block Vendor"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Blocking <span className="font-bold">{selectedItem?.name}</span> will prevent them from accepting new cash jobs.
          </p>
          <textarea
            value={modalInput}
            onChange={(e) => setModalInput(e.target.value)}
            placeholder="Reason for blocking..."
            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
            rows={3}
          />
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="ghost" onClick={closeModals}>Cancel</Button>
            <Button
              onClick={handleBlockVendor}
              isLoading={actionLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Block Vendor
            </Button>
          </div>
        </div>
      </Modal>

      {/* Unblock Vendor Modal */}
      <Modal
        isOpen={activeModal === 'unblock_vendor'}
        onClose={closeModals}
        title="Unblock Vendor"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to unblock <span className="font-bold text-gray-900">{selectedItem?.name}</span>?
            Their cash limit and blocking status will be reset.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" onClick={closeModals}>Cancel</Button>
            <Button
              onClick={handleUnblockVendorSubmit}
              isLoading={actionLoading}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Confirm Unblock
            </Button>
          </div>
        </div>
      </Modal>

      {/* Vendor Financial Ledger & History Modal */}
      <Modal
        isOpen={activeModal === 'view_vendor_ledger'}
        onClose={closeModals}
        title="Vendor Financial Ledger"
        size="lg"
      >
        <div className="space-y-5">
          {/* Vendor Summary Header */}
          <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-lg flex items-center justify-center shadow-sm">
                {selectedItem?.name?.charAt(0) || 'V'}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">{selectedItem?.name}</h3>
                <p className="text-xs text-gray-500 font-medium">{selectedItem?.businessName} • {selectedItem?.phone}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="bg-white p-2.5 rounded-xl border border-gray-200 text-center min-w-[100px]">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Active Dues</p>
                <p className="text-base font-black text-rose-600">₹{selectedItem?.amountDue?.toLocaleString('en-IN') || 0}</p>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-gray-200 text-center min-w-[100px]">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Cash Limit</p>
                <p className="text-base font-black text-gray-900">₹{selectedItem?.cashLimit?.toLocaleString('en-IN') || 10000}</p>
              </div>
            </div>
          </div>

          {/* Transaction History Ledger Table */}
          {vendorLedgerLoading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-3 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs font-medium text-gray-500">Loading vendor ledger transactions...</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Financial Activity & Audit Log
                </h4>
                <span className="text-xs text-gray-500 font-semibold">
                  {vendorLedgerData?.data?.length || 0} Transactions Found
                </span>
              </div>

              {vendorLedgerData?.data?.length > 0 ? (
                <div className="max-h-[50vh] overflow-y-auto border border-gray-100 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 sticky top-0 border-b border-gray-100 text-gray-500 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="p-3">Ref ID / Type</th>
                        <th className="p-3">Description</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {vendorLedgerData.data.map((tx) => (
                        <tr key={tx._id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="p-3">
                            <span className="font-mono font-bold text-gray-900 block">{tx.referenceId || tx.type}</span>
                            <span className="text-[10px] uppercase font-extrabold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 inline-block mt-0.5">
                              {tx.type?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-3 text-gray-600 max-w-[200px] truncate" title={tx.description}>
                            {tx.description || tx.bookingId?.serviceName || 'Ledger transaction'}
                          </td>
                          <td className="p-3 text-right font-black">
                            <span className={tx.type === 'settlement' || tx.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}>
                              {tx.type === 'settlement' ? '-' : '+'}₹{Number(tx.amount || 0).toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td className="p-3 text-right text-gray-500 font-mono text-[11px]">
                            {formatDate(tx.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-100 text-gray-400 text-xs">
                  No transaction history recorded yet for this vendor.
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Update Cash Limit Modal */}
      <Modal
        isOpen={activeModal === 'update_limit'}
        onClose={closeModals}
        title="Update Cash Collection Limit"
        size="md"
      >
        <div className="space-y-5">
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-900 text-sm">{selectedItem?.name}</p>
              <p className="text-xs text-gray-500">Current Limit: ₹{selectedItem?.cashLimit?.toLocaleString('en-IN') || 10000}</p>
            </div>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase rounded-lg border border-emerald-200">
              Active Vendor
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Quick Limit Presets
            </label>
            <div className="flex flex-wrap gap-2">
              {[5000, 10000, 25000, 50000, 100000].map((presetLimit) => (
                <button
                  key={presetLimit}
                  type="button"
                  onClick={() => setModalInput(presetLimit.toString())}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    modalInput === presetLimit.toString()
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-emerald-50 hover:border-emerald-300'
                  }`}
                >
                  ₹{presetLimit.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              New Maximum Cash Limit (₹) <span className="text-emerald-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">₹</span>
              <input
                type="number"
                value={modalInput}
                onChange={(e) => setModalInput(e.target.value)}
                placeholder="10000"
                className="w-full pl-9 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-lg font-bold text-gray-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={closeModals}>Cancel</Button>
            <Button
              onClick={handleUpdateLimitSubmit}
              isLoading={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Save New Limit
            </Button>
          </div>
        </div>
      </Modal>

      {/* Approve Withdrawal Modal */}
      <Modal
        isOpen={activeModal === 'approve_withdrawal'}
        onClose={closeModals}
        title="Approve Withdrawal"
        size="md"
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-black text-sm">
              {selectedItem?.vendorId?.name?.charAt(0) || 'V'}
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">{selectedItem?.vendorId?.name}</p>
              <p className="text-xs text-gray-500">{selectedItem?.vendorId?.businessName}</p>
            </div>
          </div>

          {/* Fee Breakdown */}
          {(() => {
            const gross = selectedItem?.amount || 0;
            const vendorLevel = selectedItem?.vendorId?.level || 1;
            const levelKey = `level${vendorLevel}`;
            const tdsRate = settings?.tdsPercentage ?? 1;
            const platformRate = settings?.platformFeeRates?.[levelKey] ?? settings?.platformFeePercentage ?? (vendorLevel === 1 ? 0.5 : vendorLevel === 2 ? 1.0 : 2.0);
            const tdsAmt = Math.round((gross * tdsRate) / 100);
            const platformAmt = Math.round((gross * platformRate) / 100);
            const netAmt = gross - tdsAmt - platformAmt;
            return (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Payout Breakdown</h4>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Gross Amount</span>
                  <span className="font-bold text-gray-900">₹{gross.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-600">TDS Deduction</span>
                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">{tdsRate}%</span>
                  </div>
                  <span className="font-bold text-red-600">-₹{tdsAmt.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-600">Platform Charge</span>
                    <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold">Level {vendorLevel} · {platformRate}%</span>
                  </div>
                  <span className="font-bold text-red-600">-₹{platformAmt.toLocaleString('en-IN')}</span>
                </div>

                <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                  <span className="font-bold text-gray-800">Final Net Payout</span>
                  <span className="text-xl font-black text-emerald-600">₹{netAmt.toLocaleString('en-IN')}</span>
                </div>
              </div>
            );
          })()}

          {/* Vendor Beneficiary Bank Details */}
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex justify-between items-center border-b border-emerald-100/60 pb-1.5">
              <span className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Beneficiary Account Details</span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">Verify & Transfer</span>
            </div>
            
            {selectedItem?.bankDetails ? (
              <div className="grid grid-cols-2 gap-2 font-medium text-gray-800">
                {selectedItem.bankDetails.upiId && (
                  <div className="col-span-2 flex justify-between items-center bg-white p-2.5 rounded-lg border border-emerald-100 shadow-2xs">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">UPI VPA</p>
                      <p className="font-mono font-bold text-gray-900">{selectedItem.bankDetails.upiId}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedItem.bankDetails.upiId);
                        toast.success('UPI ID copied!');
                      }}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 active:scale-95 transition-all shadow-2xs"
                    >
                      Copy UPI
                    </button>
                  </div>
                )}

                {selectedItem.bankDetails.accountNumber && (
                  <>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Bank Name</p>
                      <p className="font-bold text-gray-900">{selectedItem.bankDetails.bankName || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">IFSC Code</p>
                      <p className="font-mono font-bold text-gray-900">{selectedItem.bankDetails.ifscCode || 'N/A'}</p>
                    </div>
                    <div className="col-span-2 flex justify-between items-center bg-white p-2.5 rounded-lg border border-emerald-100 shadow-2xs mt-1">
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Account Number</p>
                        <p className="font-mono font-bold text-gray-900">{selectedItem.bankDetails.accountNumber}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedItem.bankDetails.accountNumber);
                          toast.success('Account number copied!');
                        }}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 active:scale-95 transition-all shadow-2xs"
                      >
                        Copy Acc No
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-gray-500 italic">No bank details attached to request</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Transaction Reference</label>
            <input
              type="text"
              value={modalInput}
              onChange={(e) => setModalInput(e.target.value)}
              placeholder="Enter Transaction ID / Ref No."
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">Reference ID for the manual bank transfer.</p>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button variant="ghost" onClick={closeModals}>Cancel</Button>
            <Button
              onClick={handleApproveWithdrawalSubmit}
              isLoading={actionLoading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Confirm Payment
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Withdrawal Modal */}
      <Modal
        isOpen={activeModal === 'reject_withdrawal'}
        onClose={closeModals}
        title="Reject Withdrawal Request"
        size="md"
      >
        <div className="space-y-4">
          {/* Vendor & Request Summary Header */}
          <div className="flex items-center justify-between p-3.5 bg-red-50/70 border border-red-100 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 font-bold flex items-center justify-center text-sm border border-red-200">
                {selectedItem?.vendorId?.name?.charAt(0) || 'V'}
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">{selectedItem?.vendorId?.name}</p>
                <p className="text-xs text-gray-500">{selectedItem?.bankDetails?.bankName ? `${selectedItem.bankDetails.bankName} • ****${selectedItem.bankDetails.accountNumber?.slice(-4)}` : selectedItem?.bankDetails?.upiId || 'Bank Transfer'}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-black text-red-600">₹{selectedItem?.amount?.toLocaleString()}</span>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Requested</p>
            </div>
          </div>

          {/* Quick Preset Rejection Reason Chips */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Quick Rejection Reasons</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Invalid Bank Account Number or IFSC Code',
                'Account Holder Name Mismatch',
                'UPI ID Inactive or Not Found',
                'Incomplete KYC Verification',
                'Active Booking Dispute / Audit Pending'
              ].map((reasonText) => (
                <button
                  key={reasonText}
                  type="button"
                  onClick={() => setModalInput(reasonText)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all text-left ${
                    modalInput === reasonText 
                      ? 'bg-red-600 text-white border-red-600 font-semibold shadow-xs' 
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-red-50 hover:border-red-200'
                  }`}
                >
                  + {reasonText}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Rejection Reason (Visible to Vendor):</label>
            <textarea
              value={modalInput}
              onChange={(e) => setModalInput(e.target.value)}
              placeholder="Select a preset above or type custom reason..."
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm"
              rows={3}
            />
          </div>

          {/* Wallet Balance Release Informational Alert */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-start gap-2 text-xs text-gray-600">
            <span className="text-blue-500 font-bold shrink-0">ℹ️</span>
            <p>Rejecting will cancel this payout request and release ₹{selectedItem?.amount?.toLocaleString()} back to the vendor's wallet earnings.</p>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button variant="ghost" onClick={closeModals}>Cancel</Button>
            <Button
              onClick={handleRejectWithdrawalSubmit}
              isLoading={actionLoading}
              disabled={!modalInput.trim()}
              className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default SettlementManagement;
