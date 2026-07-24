import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiPackage, FiPlus, FiTrash2, FiSearch, 
  FiBriefcase, FiStar, FiChevronDown, FiBox, FiTool, FiInfo, FiX, FiDollarSign, FiSend, FiClock
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import vendorService from '../../services/vendorService';
import { publicCatalogService } from '../../../../services/catalogService';
import { toast } from 'react-hot-toast';

const MyServices = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [groupedServices, setGroupedServices] = useState({});
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  
  const [quickAdd, setQuickAdd] = useState({ title: '', basePrice: '', categoryId: '' });
  const [adminServices, setAdminServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const [editingCategory, setEditingCategory] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  // --- Service Request States ---
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState({ categoryName: '', serviceName: '', suggestedPrice: '', description: '' });
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [myRequests, setMyRequests] = useState([]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const res = await vendorService.getMyCustomContent();
      const resStats = await vendorService.getMyServices(); // For category stats
      const publicCatsRes = await publicCatalogService.getCategories(); // Fetch all platform categories
      const publicServicesRes = await publicCatalogService.getServices({ offeringType: 'SERVICE' });

      if (publicServicesRes.success) {
        const globalServices = (publicServicesRes.services || []).filter(s => !s.vendorId);
        setAdminServices(globalServices);
      }

      if (res.success) {
        const myCats = (res.data?.categories || []).map(c => ({ ...c, id: c._id || c.id }));
        const platformCats = (publicCatsRes.success ? (publicCatsRes.categories || publicCatsRes.data || []) : []).map(c => ({ ...c, id: c._id || c.id }));
        
        // Filter by SERVICE type and merge (Prioritize myCats)
        const combined = [...myCats];
        platformCats.forEach(pc => {
          if (!combined.find(vc => vc.title.toLowerCase() === pc.title.toLowerCase())) {
            combined.push(pc);
          }
        });

        const serviceCats = combined.filter(c => !c.offeringType || c.offeringType === 'SERVICE');
        
        console.log('[loadServices] Final categories with IDs:', serviceCats.map(c => ({ title: c.title, id: c.id })));

        // Add stats from getMyServices to categories
        const statsMap = {};
        if (resStats.success) {
           resStats.data.forEach(s => {
             statsMap[s.id || s._id] = s.stats;
           });
        }

        const catsWithStats = serviceCats.map(cat => ({
          ...cat,
          stats: statsMap[cat.id] || { totalJobs: 0, completedJobs: 0, rating: 0 }
        }));

        setCategories(catsWithStats);
        
        // Group by categoryId
        const grouped = {};
        const allItems = (res.data?.services || []).map(s => ({ ...s, id: s._id || s.id }));
        const servicesOnly = allItems.filter(item => !item.offeringType || item.offeringType === 'SERVICE');

        servicesOnly.forEach(p => {
          const catId = p.categoryId?._id || p.categoryId || 'uncategorized';
          if (!grouped[catId]) grouped[catId] = [];
          grouped[catId].push(p);
        });
        setGroupedServices(grouped);
      }
    } catch (error) {
      console.error('Error loading services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
    loadServiceRequests();
  }, []);

  const loadServiceRequests = async () => {
    try {
      const res = await vendorService.getMyServiceRequests();
      if (res.success) {
        const serviceRequests = (res.requests || []).filter(r => !r.requestType || r.requestType === 'SERVICE');
        setMyRequests(serviceRequests);
      }
    } catch {}
  };

  const handleSubmitServiceRequest = async () => {
    const { categoryName, serviceName, suggestedPrice } = requestForm;
    if (!categoryName.trim() || !serviceName.trim() || !suggestedPrice) {
      toast.error('Category name, service name and price are required');
      return;
    }
    setIsSubmittingRequest(true);
    try {
      const res = await vendorService.submitServiceRequest({
        categoryName: categoryName.trim(),
        serviceName: serviceName.trim(),
        suggestedPrice: Number(suggestedPrice),
        description: requestForm.description.trim(),
        requestType: 'SERVICE'
      });
      if (res.success) {
        toast.success('Request submitted! Admin will review it.');
        setRequestForm({ categoryName: '', serviceName: '', suggestedPrice: '', description: '' });
        setShowRequestForm(false);
        loadServiceRequests();
      }
    } catch {
      toast.error('Failed to submit request');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleUpdateCategory = async (categoryId) => {
    if (!editTitle.trim()) return setEditingCategory(null);
    try {
      setLoading(true);
      const res = await vendorService.updateCategory(categoryId, { title: editTitle });
      if (res.success) {
        toast.success('Category updated');
        setEditingCategory(null);
        loadServices();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update category');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Are you sure you want to remove this category from your portfolio?')) return;
    try {
      setLoading(true);
      const res = await vendorService.removeService(categoryId);
      if (res.success) {
        toast.success(res.message);
        loadServices();
      }
    } catch (error) {
      toast.error('Failed to remove category');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      setIsRemoving(true);
      const res = await vendorService.removeService(itemId);
      if (res.success) {
        toast.success('Service item removed');
        loadServices();
        setShowConfirm(null);
      }
    } catch (error) {
      console.error('Remove item error:', error);
      toast.error('Failed to remove item');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleQuickAdd = async (e, catId) => {
    e.preventDefault();
    if (!selectedServiceId) return toast.error('Please select an approved service');
    
    try {
      setIsAdding(true);
      const res = await vendorService.addVendorService({
        serviceId: selectedServiceId,
        categoryId: catId,
        offeringType: 'SERVICE'
      });
      if (res.success) {
        toast.success('Service added successfully!');
        setSelectedServiceId('');
        loadServices();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add service');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Header - White Style - Visible on mobile and desktop */}
      <div className="bg-white p-5 rounded-2xl shadow-sm flex flex-row items-center justify-between text-gray-900 border border-gray-100 gap-4">
        <div>
          <h2 className="text-xl md:text-3xl font-semibold text-gray-900 tracking-tight leading-none capitalize">
            Service Portfolio
          </h2>
          <p className="hidden md:block text-gray-500 font-medium mt-2 text-sm">
            Configure your expertise and pricing for user bookings
          </p>
        </div>
        <button
          onClick={() => setShowRequestForm(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 active:scale-95 transition-all shadow-md shadow-blue-100/50 shrink-0"
        >
          <FiPlus className="w-3.5 h-3.5" />
          Request Service
        </button>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-medium text-gray-400 capitalize tracking-widest">Syncing Expertise...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-white rounded-3xl p-20 text-center border border-dashed border-gray-200">
             <FiBriefcase className="w-16 h-16 text-gray-100 mx-auto mb-4" />
             <h3 className="text-xl font-medium text-gray-800 capitalize">No Active Skills</h3>
             <p className="text-sm text-gray-400 mt-2">Awaiting administrative assignment or custom skill creation</p>
          </div>
        ) : (
          categories.map(cat => (
            <div key={cat.id || cat._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
              {/* Category Header (Clickable Accordion Trigger) */}
              <div 
                onClick={() => setExpandedCategoryId(expandedCategoryId === cat.id ? null : cat.id)}
                className="bg-gray-50/50 px-4 py-4 border-b border-gray-100 cursor-pointer flex items-center justify-between select-none hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white border border-gray-100 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                    {cat.imageUrl ? (
                      <img src={cat.imageUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <FiTool className="text-gray-400 w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-semibold text-gray-900 capitalize tracking-tight">{cat.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[8px] font-normal text-blue-500 capitalize tracking-widest">
                        {groupedServices[cat.id]?.length || 0} Specialties
                      </p>
                      <div className="w-1 h-1 bg-gray-300 rounded-full" />
                      <p className="text-[8px] font-normal text-amber-500 capitalize tracking-widest flex items-center gap-0.5">
                         <FiStar className="fill-amber-500" /> {cat.stats?.rating || '0.0'} Rating
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-gray-400">
                  <FiChevronDown className={`w-5 h-5 transition-transform duration-300 ${expandedCategoryId === cat.id ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* Accordion Content Container */}
              <AnimatePresence initial={false}>
                {expandedCategoryId === cat.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 space-y-4 border-t border-gray-100">
                      {/* Quick Add Form */}
                      <form 
                        onSubmit={(e) => handleQuickAdd(e, cat.id)}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm w-full mt-2"
                      >
                        <div className="flex-1 w-full">
                          {(() => {
                            const availableServices = adminServices.filter(s => {
                              const sCatId = s.categoryId?._id || s.categoryId || '';
                              const activeCatId = cat.id || cat._id || '';
                              const matchesCat = sCatId.toString() === activeCatId.toString();
                              const isAlreadyAdded = (groupedServices[cat.id] || []).some(
                                existing => existing.title?.toLowerCase().trim() === s.title?.toLowerCase().trim()
                              );
                              return matchesCat && !isAlreadyAdded;
                            });

                            return (
                              <select
                                value={selectedServiceId}
                                onChange={(e) => setSelectedServiceId(e.target.value)}
                                disabled={availableServices.length === 0}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-normal text-gray-700 focus:bg-white focus:border-blue-500/30 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <option value="">
                                  {availableServices.length === 0 ? 'All available skills added to portfolio' : 'Select Service...'}
                                </option>
                                {availableServices.map(s => (
                                  <option key={s._id || s.id} value={s._id || s.id}>
                                    {s.title}
                                  </option>
                                ))}
                              </select>
                            );
                          })()}
                        </div>

                        {selectedServiceId && (
                          <div className="flex items-center justify-between sm:justify-start gap-2 bg-blue-50/50 px-3 py-2 rounded-lg border border-blue-100/30 w-full sm:w-auto shrink-0">
                            <span className="text-[10px] text-blue-500 font-semibold uppercase tracking-wider">Fixed Price:</span>
                            <span className="text-xs font-bold text-blue-600">
                              ₹{adminServices.find(s => (s._id || s.id) === selectedServiceId)?.basePrice || 0}
                            </span>
                          </div>
                        )}

                        <button 
                          type="submit"
                          disabled={isAdding || !selectedServiceId}
                          className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all shadow active:scale-95 disabled:opacity-50 shrink-0"
                        >
                          {isAdding ? '...' : <><FiPlus className="w-3.5 h-3.5" /> Add Skill</>}
                        </button>
                      </form>

                      {/* Items Table */}
                      <div className="overflow-x-auto border border-gray-100 rounded-xl">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-gray-50 bg-gray-50/50">
                              <th className="px-4 py-3 text-[9px] font-semibold text-gray-400 capitalize tracking-wider">Service Specification</th>
                              <th className="px-4 py-3 text-[9px] font-semibold text-gray-400 capitalize tracking-wider">Pricing</th>
                              <th className="px-4 py-3 text-[9px] font-semibold text-gray-400 capitalize tracking-wider text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 px-1">
                            {!groupedServices[cat.id] || groupedServices[cat.id].length === 0 ? (
                              <tr>
                                <td colSpan="3" className="px-4 py-8 text-center">
                                  <div className="flex flex-col items-center gap-1.5">
                                    <p className="text-[9px] font-medium text-gray-300 capitalize tracking-widest">No specialized skills added</p>
                                    <p className="text-[8px] font-normal text-gray-400 capitalize">Define your service rates above</p>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              groupedServices[cat.id].map(item => (
                                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                                        {item.iconUrl ? (
                                           <img src={item.iconUrl} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                           <FiBriefcase className="text-gray-300 w-4 h-4" />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-normal text-gray-800 capitalize truncate tracking-tight">{item.title}</p>
                                        <p className="text-[8px] font-normal text-gray-400 capitalize tracking-wider mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">SKU: {item.id.slice(-6).toUpperCase()}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-xs font-medium text-blue-600">₹{item.basePrice.toLocaleString()}</span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                       <button
                                         onClick={() => setSelectedItem(item)}
                                         className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all active:scale-90"
                                         title="View Details"
                                       >
                                         <FiInfo className="w-3.5 h-3.5" />
                                       </button>
                                       <button 
                                         onClick={() => setShowConfirm(item.id)}
                                         className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90"
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>

      {/* Past Requests List */}
      {myRequests.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">My Service Requests</p>
          <div className="space-y-3">
            {myRequests.map(req => (
              <div key={req._id} className="flex items-center justify-between py-3 px-4 bg-gray-50/50 rounded-xl border border-gray-100/60 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-xs font-semibold text-gray-800 capitalize">{req.serviceName}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{req.categoryName} • ₹{req.suggestedPrice?.toLocaleString()}</p>
                  {req.adminNote && (
                    <div className="mt-1.5 flex items-start gap-1 bg-blue-50/50 border border-blue-100/50 rounded-lg px-2 py-1 text-[9px] text-blue-600">
                      <span className="font-semibold shrink-0">Admin:</span>
                      <span>{req.adminNote}</span>
                    </div>
                  )}
                </div>
                <span className={`text-[8px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${
                  req.status === 'approved' ? 'bg-green-100 text-green-600 border border-green-200' :
                  req.status === 'rejected' ? 'bg-red-100 text-red-500 border border-red-200' :
                  'bg-amber-100 text-amber-600 border border-amber-200'
                }`}>
                  {req.status === 'pending' ? <span className="flex items-center gap-1"><FiClock className="w-2.5 h-2.5 animate-pulse" /> Pending</span> : req.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Request Service Modal ── */}
      <AnimatePresence>
        {showRequestForm && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center px-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRequestForm(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-gray-100 z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[9px] font-semibold text-blue-500 uppercase tracking-widest">New Suggestion</p>
                  <h3 className="text-sm font-semibold text-gray-900 mt-0.5">Request a New Service</h3>
                </div>
                <button
                  onClick={() => setShowRequestForm(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-[9px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
                  ⚠️ This suggestion will be sent to the admin for review. Once approved, the admin will manually add it to the global catalog.
                </p>

                <div>
                  <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest mb-1 block">Category Name *</label>
                  <input
                    value={requestForm.categoryName}
                    onChange={e => setRequestForm(f => ({ ...f, categoryName: e.target.value }))}
                    placeholder="e.g. Home Cleaning"
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 placeholder-gray-300"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest mb-1 block">Service Name *</label>
                  <input
                    value={requestForm.serviceName}
                    onChange={e => setRequestForm(f => ({ ...f, serviceName: e.target.value }))}
                    placeholder="e.g. 4BHK Deep Clean"
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 placeholder-gray-300"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest mb-1 block">Suggested Price (₹) *</label>
                  <input
                    type="number"
                    value={requestForm.suggestedPrice}
                    onChange={e => setRequestForm(f => ({ ...f, suggestedPrice: e.target.value }))}
                    placeholder="e.g. 3500"
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 placeholder-gray-300"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest mb-1 block">Description (optional)</label>
                  <textarea
                    rows={2}
                    value={requestForm.description}
                    onChange={e => setRequestForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description of the service..."
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 placeholder-gray-300 resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowRequestForm(false)}
                    className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitServiceRequest}
                    disabled={isSubmittingRequest}
                    className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-1.5 shadow-md shadow-blue-100"
                  >
                    <FiSend className="w-3 h-3" />
                    {isSubmittingRequest ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Read-Only Service Details Drawer ── */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            {/* Drawer Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative w-full max-w-sm h-full bg-white shadow-2xl overflow-y-auto flex flex-col"
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
                <div>
                  <p className="text-[9px] font-semibold text-blue-500 uppercase tracking-widest">Service Details</p>
                  <h3 className="text-sm font-semibold text-gray-900 mt-0.5 capitalize">{selectedItem.title}</h3>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 p-5 space-y-5">
                {/* Icon + Pricing */}
                <div className="flex items-center gap-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100/50">
                  <div className="w-14 h-14 rounded-xl bg-white border border-gray-100 overflow-hidden flex items-center justify-center shadow-sm shrink-0">
                    {selectedItem.iconUrl ? (
                      <img src={selectedItem.iconUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <FiBriefcase className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  <div>
                    <p className="text-[9px] text-blue-500 font-semibold uppercase tracking-widest mb-1">Fixed Price (Admin)</p>
                    <p className="text-xl font-bold text-blue-600">₹{(selectedItem.basePrice || 0).toLocaleString()}</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">Pricing set by admin · Not editable</p>
                  </div>
                </div>

                {/* Admin Note */}
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                  <span className="text-amber-500 text-xs">🔒</span>
                  <p className="text-[9px] text-amber-600 font-medium">This service is managed by admin. Details are read-only.</p>
                </div>

                {/* Description */}
                {selectedItem.description && (
                  <div>
                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Description</p>
                    <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">{selectedItem.description}</p>
                  </div>
                )}

                {/* Detailed Description */}
                {selectedItem.detailedDescription && (
                  <div>
                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Details</p>
                    <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">{selectedItem.detailedDescription}</p>
                  </div>
                )}

                {/* Features */}
                {selectedItem.features?.filter(f => f).length > 0 && (
                  <div>
                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Features</p>
                    <div className="space-y-1.5">
                      {selectedItem.features.filter(f => f).map((feat, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                          <span className="text-blue-500 mt-0.5 shrink-0">✓</span>
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Benefits */}
                {selectedItem.benefits?.filter(b => b).length > 0 && (
                  <div>
                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Benefits</p>
                    <div className="space-y-1.5">
                      {selectedItem.benefits.filter(b => b).map((ben, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                          <span className="text-green-500 mt-0.5 shrink-0">★</span>
                          <span>{ben}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gallery */}
                {selectedItem.images?.length > 0 && (
                  <div>
                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Gallery</p>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedItem.images.map((img, i) => (
                        <div key={i} className="aspect-square rounded-xl overflow-hidden border border-gray-100">
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meta */}
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-gray-400 uppercase tracking-wider">Service ID</span>
                    <span className="text-[9px] font-mono text-gray-500">{(selectedItem.id || '').slice(-10).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-gray-400 uppercase tracking-wider">Status</span>
                    <span className="text-[9px] font-semibold text-green-600 capitalize">{selectedItem.status || 'active'}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modern Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(null)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white rounded-2xl p-8 shadow-2xl border border-gray-100 text-center"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FiTrash2 className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-lg font-normal text-gray-900 mb-2">Remove Skill?</h3>
              <p className="text-sm text-gray-500 mb-8">
                Are you sure you want to remove this service expertise?
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(null)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-sm font-normal text-gray-600 hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRemoveItem(showConfirm)}
                  disabled={isRemoving}
                  className="flex-1 py-3 rounded-xl bg-rose-600 text-sm font-normal text-white shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all"
                >
                  {isRemoving ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyServices;
