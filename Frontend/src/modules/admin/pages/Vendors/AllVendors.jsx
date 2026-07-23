import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiX, FiEye, FiSearch, FiFilter, FiDownload, FiLoader, FiPower, FiTrash2, FiShield } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import CardShell from '../UserCategories/components/CardShell';
import Modal from '../UserCategories/components/Modal';
import adminVendorService from '../../../../services/adminVendorService';

const AllVendors = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'pending', 'approved', 'rejected'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [updatingPermissions, setUpdatingPermissions] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  const AVAILABLE_PERMISSIONS = [
    { id: 'dashboard', label: 'Dashboard Overview', description: 'Main analytics and quick stats' },
    { id: 'orders', label: 'Service Bookings', description: 'Manage service requests and bookings' },
    { id: 'product-orders', label: 'Product Orders', description: 'Manage e-commerce product orders' },
    { id: 'services', label: 'Manage Services', description: 'Configure service offerings and pricing' },
    { id: 'manage-products', label: 'Manage Products', description: 'Inventory and product management' },
    { id: 'earnings', label: 'Revenue Analytics', description: 'Detailed financial reports' },
    { id: 'wallet', label: 'Wallet & Payouts', description: 'Transaction history and withdrawals' },
    { id: 'reviews', label: 'Ratings & Reviews', description: 'Customer feedback management' },
    { id: 'notifications', label: 'Alert Hub', description: 'System and booking notifications' },
    { id: 'store-settings', label: 'Store Settings', description: 'Business information and preferences' },
    { id: 'profile-settings', label: 'Profile Settings', description: 'Personal account details' },
    { id: 'support', label: 'Support Center', description: 'Help desk and ticket management' },
  ];

  const handleDownloadDocument = async (url, defaultFilename) => {
    if (!url) return;
    try {
      if (url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = defaultFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      toast.loading('Preparing download...', { id: 'doc-download' });
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch file');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = defaultFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success('Download started!', { id: 'doc-download' });
    } catch (error) {
      console.error('Download error:', error);
      toast.dismiss('doc-download');
      window.open(url, '_blank');
    }
  };

  // Load vendors from backend
  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const response = await adminVendorService.getAllVendors();
      if (response.success) {
        // Transform backend data to frontend format
        const transformedVendors = response.data.map(vendor => ({
          id: vendor._id,
          name: vendor.name,
          email: vendor.email,
          phone: vendor.phone,
          businessName: vendor.businessName,
          service: vendor.service,
          approvalStatus: vendor.approvalStatus,
          aadhar: vendor.aadhar?.number,
          pan: vendor.pan?.number,
          documents: {
            aadhar: vendor.aadhar?.document,
            aadharBack: vendor.aadhar?.backDocument,
            pan: vendor.pan?.document,
            other: vendor.otherDocuments?.[0]
          },
          createdAt: vendor.createdAt,
          isActive: vendor.isActive,
          subscription: vendor.subscription,
          permissions: vendor.permissions || AVAILABLE_PERMISSIONS.map(p => p.id),
          trainingScore: vendor.trainingScore || 0,
          rating: vendor.rating || 0,
          completedJobs: vendor.completedJobs || 0,
          totalJobs: vendor.totalJobs || 0,
          cancelledJobs: vendor.cancelledJobs || 0,
          performance: (() => {
            // Prioritize database stored score and level if they exist
            if (vendor.performanceScore !== undefined && vendor.level !== undefined) {
              const compRate = vendor.totalJobs > 0 ? (vendor.completedJobs / vendor.totalJobs) * 100 : 0;
              const cancRate = vendor.totalJobs > 0 ? (vendor.cancelledJobs / vendor.totalJobs) * 100 : 0;
              return { 
                score: vendor.performanceScore, 
                level: vendor.level, 
                completionRate: compRate, 
                cancellationRate: cancRate 
              };
            }

            const total = vendor.totalJobs || 0;
            const completed = vendor.completedJobs || 0;
            const cancelled = vendor.cancelledJobs || 0;
            const rating = vendor.rating || 0;
            
            const completionRate = total > 0 ? (completed / total) * 100 : 0;
            const cancellationRate = total > 0 ? (cancelled / total) * 100 : 0;
            const ratingScore = (rating / 5) * 100;
            
            const score = Math.round(
              (ratingScore * 0.6) + 
              (completionRate * 0.3) + 
              ((100 - cancellationRate) * 0.1)
            );
            
            let level = 3;
            if (score >= 80) level = 1;
            else if (score >= 50) level = 2;
            
            return { score, level, completionRate, cancellationRate };
          })()
        }));
        setVendors(transformedVendors);
      } else {
        toast.error(response.message || 'Failed to load vendors');
      }
    } catch (error) {
      console.error('Error loading vendors:', error);
      toast.error('Failed to load vendors. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredVendors = useMemo(() => {
    return vendors.filter(vendor => {
      const serviceString = Array.isArray(vendor.service)
        ? vendor.service.join(' ')
        : (vendor.service || '');

      const matchesStatus = filterStatus === 'all' || vendor.approvalStatus === filterStatus;

      const matchesSearch =
        vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor.phone.includes(searchQuery) ||
        serviceString.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (vendor.businessName && vendor.businessName.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  }, [vendors, filterStatus, searchQuery]);

  const handleApprove = async (vendorId) => {
    try {
      const response = await adminVendorService.approveVendor(vendorId);
      if (response.success) {
        setVendors(prev => prev.map(v =>
          v.id === vendorId ? { ...v, approvalStatus: 'approved' } : v
        ));
        toast.success('Vendor approved successfully!');
      } else {
        toast.error(response.message || 'Failed to approve vendor');
      }
    } catch (error) {
      console.error('Error approving vendor:', error);
      toast.error('Failed to approve vendor. Please try again.');
    }
  };

  const handleReject = async (vendorId) => {
    try {
      const response = await adminVendorService.rejectVendor(vendorId);
      if (response.success) {
        setVendors(prev => prev.map(v =>
          v.id === vendorId ? { ...v, approvalStatus: 'rejected' } : v
        ));
        toast.success('Vendor rejected successfully.');
      } else {
        toast.error(response.message || 'Failed to reject vendor');
      }
    } catch (error) {
      console.error('Error rejecting vendor:', error);
      toast.error('Failed to reject vendor. Please try again.');
    }
  };

  const handleToggleStatus = async (vendorId, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      const response = await adminVendorService.toggleStatus(vendorId, newStatus);
      if (response.success) {
        setVendors(prev => prev.map(v =>
          v.id === vendorId ? { ...v, isActive: newStatus } : v
        ));
        toast.success(`Vendor ${newStatus ? 'activated' : 'deactivated'} successfully`);
      } else {
        toast.error(response.message || 'Failed to update vendor status');
      }
    } catch (error) {
      console.error('Error toggling vendor status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (vendorId) => {
    if (!window.confirm('Are you sure you want to delete this vendor? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await adminVendorService.deleteVendor(vendorId);
      if (response.success) {
        setVendors(prev => prev.filter(v => v.id !== vendorId));
        toast.success('Vendor deleted successfully');
      } else {
        toast.error(response.message || 'Failed to delete vendor');
      }
    } catch (error) {
      console.error('Error deleting vendor:', error);
      toast.error('Failed to delete vendor');
    }
  };

  const handleViewDetails = (vendor) => {
    setSelectedVendor(vendor);
    setIsViewModalOpen(true);
  };

  const handleOpenPermissions = (vendor) => {
    setSelectedVendor(vendor);
    setIsPermissionsModalOpen(true);
  };

  const handleUpdatePermissions = async (vendorId, newPermissions) => {
    try {
      setUpdatingPermissions(true);
      const response = await adminVendorService.updatePermissions(vendorId, newPermissions);
      if (response.success) {
        setVendors(prev => prev.map(v => 
          v.id === vendorId ? { ...v, permissions: newPermissions } : v
        ));
        toast.success('Permissions updated successfully');
        setIsPermissionsModalOpen(false);
      } else {
        toast.error(response.message || 'Failed to update permissions');
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('Failed to update permissions');
    } finally {
      setUpdatingPermissions(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300'
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const pendingCount = vendors.filter(v => v.approvalStatus === 'pending').length;
  const approvedCount = vendors.filter(v => v.approvalStatus === 'approved').length;
  const rejectedCount = vendors.filter(v => v.approvalStatus === 'rejected').length;

  return (
    <div className="space-y-4">
      <CardShell
        icon={FiFilter}
        title="Vendor Management"
        subtitle="Manage and verify platform vendors"
      >
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
            <div className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider mb-1">Pending</div>
            <div className="text-xl font-bold text-yellow-900">{pendingCount}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
            <div className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-1">Approved</div>
            <div className="text-xl font-bold text-green-900">{approvedCount}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1">Rejected</div>
            <div className="text-xl font-bold text-red-900">{rejectedCount}</div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search vendors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all text-xs"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {['all', 'pending', 'approved', 'rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-2 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap ${filterStatus === status
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Vendor Details</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Business Info</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Onboarding</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Performance</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="px-4 py-8 text-center text-xs text-gray-500">Loading vendors...</td>
                  </tr>
                ) : filteredVendors.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-4 py-8 text-center text-xs text-gray-500">No vendors found</td>
                  </tr>
                ) : (
                  filteredVendors.map((vendor) => (
                    <tr key={vendor.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <p className="font-bold text-gray-900 text-xs">{vendor.name}</p>
                          <p className="text-[10px] text-gray-500">{vendor.phone}</p>
                          <p className="text-[10px] text-gray-400">{vendor.email}</p>
                          {vendor.subscription && vendor.subscription.status === 'active' ? (
                            <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-50 text-green-700 text-[9px] font-bold border border-green-100 w-fit">
                              Plan: {vendor.subscription.planId?.name || 'Active Plan'} ({vendor.subscription.planId?.duration || '1'} Month)
                            </span>
                          ) : (
                            <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-50 text-gray-400 text-[9px] font-bold border border-gray-200 w-fit">
                              No Active Plan
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-bold text-gray-800 text-xs">{vendor.businessName || 'N/A'}</p>
                          <p className="text-[10px] text-blue-600 font-medium">
                            {Array.isArray(vendor.service) ? vendor.service.join(', ') : (vendor.service || 'No service')}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100 w-fit">
                            Score: {vendor.trainingScore}
                          </span>
                          <span className="text-[9px] text-gray-400 font-medium italic">Passed MCQ Test</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                            vendor.performance.level === 1 ? 'bg-teal-50 text-teal-700 border border-teal-100' :
                            vendor.performance.level === 2 ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                            'bg-orange-50 text-orange-700 border border-orange-100'
                          }`}>
                            {vendor.performance.level === 1 ? '🏆 Level 1' : `L${vendor.performance.level} Vendor`}
                          </span>
                          <span className="text-[10px] text-gray-500 font-semibold">
                            Score: <span className={vendor.performance.score >= 70 ? 'text-green-600' : 'text-orange-500'}>{vendor.performance.score}%</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${vendor.approvalStatus === 'approved' ? 'bg-green-50 text-green-700 border-green-100' :
                          vendor.approvalStatus === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                            'bg-yellow-50 text-yellow-700 border-yellow-100'
                          }`}>
                          {vendor.approvalStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {/* View Details */}
                          <button
                            onClick={() => handleViewDetails(vendor)}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <FiEye className="w-3.5 h-3.5" />
                          </button>

                          {/* Manage Permissions */}
                          <button
                            onClick={() => handleOpenPermissions(vendor)}
                            className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                            title="Manage Permissions"
                          >
                            <FiShield className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active Status */}
                          <button
                            onClick={() => handleToggleStatus(vendor.id, vendor.isActive)}
                            className={`p-1.5 rounded-lg transition-colors ${vendor.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                            title={vendor.isActive ? "Disable Login" : "Enable Login"}
                          >
                            <FiPower className={`w-3.5 h-3.5 ${vendor.isActive ? 'fill-current' : ''}`} />
                          </button>

                          {/* Approve/Reject (Only for pending) */}
                          {vendor.approvalStatus === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(vendor.id)}
                                className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                                title="Approve"
                              >
                                <FiCheck className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleReject(vendor.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Reject"
                              >
                                <FiX className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {/* Delete Vendor */}
                          <button
                            onClick={() => handleDelete(vendor.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Vendor"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
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
      </CardShell >

      {/* View Vendor Details Modal */}
      < Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedVendor(null);
        }}
        title="Vendor Details"
        size="lg"
      >
        {selectedVendor && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Business Name</label>
                <div className="text-gray-900">{selectedVendor.businessName || 'N/A'}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Owner Name</label>
                <div className="text-gray-900">{selectedVendor.name}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <div className="text-gray-900">{selectedVendor.email}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                <div className="text-gray-900">{selectedVendor.phone}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Service Category</label>
                <div className="text-gray-900">
                  {Array.isArray(selectedVendor.service) ? selectedVendor.service.join(', ') : (selectedVendor.service || 'N/A')}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Aadhar Number</label>
                <div className="text-gray-900 font-medium">{selectedVendor.aadhar || 'N/A'}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">PAN Card Number</label>
                <div className="text-gray-900 font-medium">{selectedVendor.pan || 'N/A'}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                <div>{getStatusBadge(selectedVendor.approvalStatus)}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Registered On</label>
                <div className="text-gray-900">
                  {new Date(selectedVendor.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Active</label>
                <div className={`text-sm font-semibold ${selectedVendor.isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedVendor.isActive ? 'Active' : 'Inactive'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Training Score</label>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm font-bold">
                    {selectedVendor.trainingScore} points
                  </span>
                  <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                    <FiCheck /> PASSED
                  </span>
                </div>
              </div>
              {selectedVendor.subscription && selectedVendor.subscription.status === 'active' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Active Plan</label>
                    <div className="text-sm font-bold text-green-600">
                      {selectedVendor.subscription.planId?.name || 'Active Plan'} ({selectedVendor.subscription.planId?.duration || '1'} Month)
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Expires On</label>
                    <div className="text-sm text-gray-900">
                      {selectedVendor.subscription.expiryDate ? new Date(selectedVendor.subscription.expiryDate).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Performance Analytics */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Performance Analytics</h3>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    selectedVendor.performance.level === 1 ? 'bg-teal-100 text-teal-800' :
                    selectedVendor.performance.level === 2 ? 'bg-blue-100 text-blue-800' :
                    'bg-orange-100 text-orange-800'
                  }`}>
                    Level {selectedVendor.performance.level} {selectedVendor.performance.level === 1 && '(Top)'}
                  </span>
                  <span className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700">
                    Score: {selectedVendor.performance.score}/100
                  </span>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-gray-700">Rating ({selectedVendor.rating.toFixed(1)}/5.0)</span>
                  </div>
                  <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400" style={{ width: `${(selectedVendor.rating / 5) * 100}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-gray-700">Job Completion ({selectedVendor.completedJobs}/{selectedVendor.totalJobs})</span>
                    <span className="font-bold text-green-600">{Math.round(selectedVendor.performance.completionRate)}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: `${selectedVendor.performance.completionRate}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-gray-700">Cancellation Rate</span>
                    <span className="font-bold text-red-600">{Math.round(selectedVendor.performance.cancellationRate)}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500" style={{ width: `${selectedVendor.performance.cancellationRate}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Verification Documents</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedVendor.documents.aadhar && (
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <label className="block text-xs font-semibold text-gray-700 mb-2">Aadhar Front</label>
                    <div 
                      onClick={() => setPreviewDoc({ url: selectedVendor.documents.aadhar, title: `Aadhar Front - ${selectedVendor.name}`, filename: `aadhar_front_${selectedVendor.name || 'vendor'}.png` })}
                      className="relative group cursor-pointer overflow-hidden rounded-lg border border-gray-200"
                    >
                      <img
                        src={selectedVendor.documents.aadhar}
                        alt="Aadhar Front"
                        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium text-xs gap-1.5">
                        <FiEye className="w-4 h-4" /> Click to Enlarge
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc({ url: selectedVendor.documents.aadhar, title: `Aadhar Front - ${selectedVendor.name}`, filename: `aadhar_front_${selectedVendor.name || 'vendor'}.png` })}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <FiEye className="w-3.5 h-3.5" /> View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadDocument(selectedVendor.documents.aadhar, `aadhar_front_${selectedVendor.name || 'vendor'}.png`)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <FiDownload className="w-3.5 h-3.5" /> Download
                      </button>
                    </div>
                  </div>
                )}
                {selectedVendor.documents.aadharBack && (
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <label className="block text-xs font-semibold text-gray-700 mb-2">Aadhar Back</label>
                    <div 
                      onClick={() => setPreviewDoc({ url: selectedVendor.documents.aadharBack, title: `Aadhar Back - ${selectedVendor.name}`, filename: `aadhar_back_${selectedVendor.name || 'vendor'}.png` })}
                      className="relative group cursor-pointer overflow-hidden rounded-lg border border-gray-200"
                    >
                      <img
                        src={selectedVendor.documents.aadharBack}
                        alt="Aadhar Back"
                        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium text-xs gap-1.5">
                        <FiEye className="w-4 h-4" /> Click to Enlarge
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc({ url: selectedVendor.documents.aadharBack, title: `Aadhar Back - ${selectedVendor.name}`, filename: `aadhar_back_${selectedVendor.name || 'vendor'}.png` })}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <FiEye className="w-3.5 h-3.5" /> View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadDocument(selectedVendor.documents.aadharBack, `aadhar_back_${selectedVendor.name || 'vendor'}.png`)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <FiDownload className="w-3.5 h-3.5" /> Download
                      </button>
                    </div>
                  </div>
                )}
                {selectedVendor.documents.pan && (
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <label className="block text-xs font-semibold text-gray-700 mb-2">PAN Card</label>
                    <div 
                      onClick={() => setPreviewDoc({ url: selectedVendor.documents.pan, title: `PAN Card - ${selectedVendor.name}`, filename: `pan_${selectedVendor.name || 'vendor'}.png` })}
                      className="relative group cursor-pointer overflow-hidden rounded-lg border border-gray-200"
                    >
                      <img
                        src={selectedVendor.documents.pan}
                        alt="PAN"
                        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium text-xs gap-1.5">
                        <FiEye className="w-4 h-4" /> Click to Enlarge
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc({ url: selectedVendor.documents.pan, title: `PAN Card - ${selectedVendor.name}`, filename: `pan_${selectedVendor.name || 'vendor'}.png` })}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <FiEye className="w-3.5 h-3.5" /> View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadDocument(selectedVendor.documents.pan, `pan_${selectedVendor.name || 'vendor'}.png`)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <FiDownload className="w-3.5 h-3.5" /> Download
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {selectedVendor.approvalStatus === 'pending' && (
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={async () => {
                    await handleApprove(selectedVendor.id);
                    setIsViewModalOpen(false);
                    setSelectedVendor(null);
                  }}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <FiCheck className="w-5 h-5" />
                  Approve Vendor
                </button>
                <button
                  onClick={async () => {
                    await handleReject(selectedVendor.id);
                    setIsViewModalOpen(false);
                    setSelectedVendor(null);
                  }}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <FiX className="w-5 h-5" />
                  Reject Vendor
                </button>
              </div>
            )}
          </div>
        )}
      </Modal >

      {/* Manage Permissions Modal */}
      <Modal
        isOpen={isPermissionsModalOpen}
        onClose={() => {
          setIsPermissionsModalOpen(false);
          setSelectedVendor(null);
        }}
        title={`Manage Permissions: ${selectedVendor?.name}`}
        size="md"
      >
        {selectedVendor && (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
              <p className="text-xs text-blue-800 font-medium leading-relaxed">
                <FiShield className="inline-block mr-1 w-3.5 h-3.5" />
                Select the modules this vendor is allowed to access. Changes will take effect immediately upon the next refresh.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-admin">
              {AVAILABLE_PERMISSIONS.map((perm) => {
                const isGranted = selectedVendor.permissions?.includes(perm.id);
                return (
                  <div 
                    key={perm.id}
                    onClick={() => {
                      const newPerms = isGranted 
                        ? selectedVendor.permissions.filter(p => p !== perm.id)
                        : [...(selectedVendor.permissions || []), perm.id];
                      setSelectedVendor({ ...selectedVendor, permissions: newPerms });
                    }}
                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3 ${
                      isGranted 
                        ? 'border-teal-500 bg-teal-50/30' 
                        : 'border-gray-100 bg-white hover:border-gray-200'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all ${
                      isGranted ? 'bg-teal-500 border-teal-500 text-white' : 'border-gray-200 bg-white'
                    }`}>
                      {isGranted && <FiCheck className="w-3.5 h-3.5 font-bold" />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-xs font-bold ${isGranted ? 'text-teal-900' : 'text-gray-700'}`}>
                        {perm.label}
                      </p>
                      <p className="text-[10px] text-gray-500 font-medium">
                        {perm.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setIsPermissionsModalOpen(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdatePermissions(selectedVendor.id, selectedVendor.permissions)}
                disabled={updatingPermissions}
                className="flex-1 px-4 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-all text-xs shadow-lg shadow-teal-900/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {updatingPermissions ? (
                  <>
                    <FiLoader className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FiCheck />
                    Save Permissions
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Document Lightbox Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewDoc(null)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <FiEye className="text-teal-600" /> {previewDoc.title}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadDocument(previewDoc.url, previewDoc.filename)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FiDownload className="w-3.5 h-3.5" /> Download
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 flex items-center justify-center bg-gray-50 overflow-auto max-h-[calc(90vh-70px)]">
              <img
                src={previewDoc.url}
                alt={previewDoc.title}
                className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-lg border border-gray-200"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllVendors;
