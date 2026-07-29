import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiPackage, FiPlus, FiTrash2, FiSearch, 
  FiBriefcase, FiStar, FiChevronDown, FiBox, FiTool, FiInfo, FiX, FiDollarSign, FiSend, FiClock, FiCheck
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
    <div className="space-y-3 sm:space-y-4 pb-16">
      {/* Header Banner - Compact & Modern */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs flex flex-row items-center justify-between text-gray-900 border border-gray-100 gap-3">
        <div>
          <h2 className="text-base sm:text-xl font-bold text-gray-900 tracking-tight leading-tight capitalize">
            Service Portfolio
          </h2>
          <p className="text-gray-500 text-[10px] sm:text-xs font-medium mt-0.5">
            Configure your active skills and pricing for user bookings
          </p>
        </div>
        <button
          onClick={() => setShowRequestForm(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00246b] hover:bg-[#001c54] text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider shadow-2xs active:scale-95 transition-all shrink-0 cursor-pointer"
        >
          <FiPlus className="w-3.5 h-3.5" />
          <span>Request Service</span>
        </button>
      </div>

      {/* Main Categories Accordion List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl p-10 text-center border border-gray-100 shadow-2xs">
            <div className="w-7 h-7 border-2 border-[#00246b] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Syncing Expertise...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center border border-dashed border-gray-200">
             <FiBriefcase className="w-10 h-10 text-gray-300 mx-auto mb-2" />
             <h3 className="text-xs font-bold text-gray-900 uppercase">No Active Skills</h3>
             <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-widest">Awaiting skill creation or assignment</p>
          </div>
        ) : (
          categories.map(cat => (
            <div key={cat.id || cat._id} className="bg-white rounded-xl border border-gray-100 shadow-2xs overflow-hidden transition-all hover:border-gray-200">
              {/* Category Header (Clickable Accordion Trigger) */}
              <div 
                onClick={() => setExpandedCategoryId(expandedCategoryId === cat.id ? null : cat.id)}
                className="bg-gray-50/60 px-3.5 py-3 border-b border-gray-100/80 cursor-pointer flex items-center justify-between select-none hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center overflow-hidden shadow-2xs shrink-0">
                    {cat.imageUrl ? (
                      <img src={cat.imageUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <FiTool className="text-gray-400 w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-gray-900 capitalize tracking-tight truncate">{cat.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[9px] font-semibold text-blue-600">
                        {groupedServices[cat.id]?.length || 0} Specialties
                      </p>
                      <span className="text-gray-300">•</span>
                      <p className="text-[9px] font-semibold text-amber-600 flex items-center gap-0.5">
                         <FiStar className="fill-amber-400 w-2.5 h-2.5 text-amber-400" /> {cat.stats?.rating || '4.9'} Rating
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-gray-400 shrink-0 ml-2">
                  <FiChevronDown className={`w-4 h-4 transition-transform duration-250 ${expandedCategoryId === cat.id ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* Accordion Content Container */}
              <AnimatePresence initial={false}>
                {expandedCategoryId === cat.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 sm:p-4 space-y-3 border-t border-gray-100">
                      {/* Quick Add Skill Form */}
                      <form 
                        onSubmit={(e) => handleQuickAdd(e, cat.id)}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 bg-gray-50/70 p-2.5 rounded-xl border border-gray-100 w-full"
                      >
                        <div className="flex-1 w-full min-w-0">
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
                                className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <option value="">
                                  {availableServices.length === 0 ? 'All skills in category added to portfolio' : 'Select Approved Platform Skill to Add...'}
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
                          <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100 shrink-0">
                            <span className="text-[9px] text-blue-600 font-bold uppercase tracking-wider">Fixed Price:</span>
                            <span className="text-[11px] font-bold text-blue-700">
                              ₹{adminServices.find(s => (s._id || s.id) === selectedServiceId)?.basePrice || 0}
                            </span>
                          </div>
                        )}

                        <button 
                          type="submit"
                          disabled={isAdding || !selectedServiceId}
                          className="w-full sm:w-auto flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-2xs transition-all active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
                        >
                          {isAdding ? 'Adding...' : <><FiPlus className="w-3 h-3" /> Add Skill</>}
                        </button>
                      </form>

                      {/* Mobile Cards View (< 768px) */}
                      <div className="block md:hidden space-y-2">
                        {!groupedServices[cat.id] || groupedServices[cat.id].length === 0 ? (
                          <div className="p-6 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No specialized skills added</p>
                            <p className="text-[9px] text-gray-400 mt-0.5">Use the dropdown above to add skills</p>
                          </div>
                        ) : (
                          groupedServices[cat.id].map(item => (
                            <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-2xs flex items-center justify-between gap-2 hover:border-gray-200 transition-all">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                                  {item.iconUrl ? (
                                     <img src={item.iconUrl} className="w-full h-full object-cover" alt="" />
                                  ) : (
                                     <FiBriefcase className="text-gray-400 w-4 h-4" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-gray-900 truncate uppercase tracking-tight">{item.title}</h4>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-xs font-bold text-blue-600">₹{item.basePrice?.toLocaleString()}</span>
                                    <span className="text-gray-300">•</span>
                                    <span className="text-[9px] font-medium text-gray-400">SKU: {item.id.slice(-6).toUpperCase()}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => setSelectedItem(item)}
                                  className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all active:scale-95 cursor-pointer"
                                  title="View Details"
                                >
                                  <FiInfo className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => setShowConfirm(item.id)}
                                  className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all active:scale-95 cursor-pointer"
                                  title="Remove Skill"
                                >
                                  <FiTrash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Desktop Items Table (>= 768px) */}
                      <div className="hidden md:block overflow-x-auto border border-gray-100 rounded-xl">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                              <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Service Specification</th>
                              <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Pricing</th>
                              <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {!groupedServices[cat.id] || groupedServices[cat.id].length === 0 ? (
                              <tr>
                                <td colSpan="3" className="px-4 py-6 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No specialized skills added</p>
                                    <p className="text-[9px] text-gray-400">Select an approved skill above to add</p>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              groupedServices[cat.id].map(item => (
                                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden shrink-0 shadow-2xs flex items-center justify-center">
                                        {item.iconUrl ? (
                                           <img src={item.iconUrl} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                           <FiBriefcase className="text-gray-300 w-4 h-4" />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-800 capitalize truncate tracking-tight">{item.title}</p>
                                        <p className="text-[9px] font-medium text-gray-400 mt-0.5">SKU: {item.id.slice(-6).toUpperCase()}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-xs font-bold text-blue-600">₹{item.basePrice?.toLocaleString()}</span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                       <button
                                         onClick={() => setSelectedItem(item)}
                                         className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all active:scale-95 cursor-pointer"
                                         title="View Details"
                                       >
                                         <FiInfo className="w-3.5 h-3.5" />
                                       </button>
                                       <button 
                                         onClick={() => setShowConfirm(item.id)}
                                         className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all active:scale-95 cursor-pointer"
                                         title="Remove Skill"
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
        <div className="mt-5 bg-white rounded-xl border border-gray-100 shadow-2xs p-4 space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">My Service Suggestions</p>
          <div className="space-y-2">
            {myRequests.map(req => (
              <div key={req._id} className="flex items-center justify-between p-3 bg-gray-50/60 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-xs font-bold text-gray-900 capitalize">{req.serviceName}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{req.categoryName} • ₹{req.suggestedPrice?.toLocaleString()}</p>
                  {req.adminNote && (
                    <div className="mt-1.5 flex items-start gap-1 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1 text-[9px] text-blue-700">
                      <span className="font-bold shrink-0">Admin:</span>
                      <span>{req.adminNote}</span>
                    </div>
                  )}
                </div>
                <span className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                  req.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  req.status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                  'bg-amber-50 text-amber-700 border border-amber-200'
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
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-xs"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-gray-100 z-10"
            >
              <div className="flex items-center justify-between mb-3.5">
                <div>
                  <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">New Suggestion</p>
                  <h3 className="text-sm font-bold text-gray-900 mt-0.5">Request a New Service</h3>
                </div>
                <button
                  onClick={() => setShowRequestForm(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all cursor-pointer"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5">
                <p className="text-[9px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
                  ⚠️ This suggestion will be sent to the admin for review. Once approved, the admin will add it to the global catalog.
                </p>

                <div>
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Category Name *</label>
                  <input
                    value={requestForm.categoryName}
                    onChange={e => setRequestForm(f => ({ ...f, categoryName: e.target.value }))}
                    placeholder="e.g. Home Cleaning"
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-gray-300"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Service Name *</label>
                  <input
                    value={requestForm.serviceName}
                    onChange={e => setRequestForm(f => ({ ...f, serviceName: e.target.value }))}
                    placeholder="e.g. 4BHK Deep Clean"
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-gray-300"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Suggested Price (₹) *</label>
                  <input
                    type="number"
                    value={requestForm.suggestedPrice}
                    onChange={e => setRequestForm(f => ({ ...f, suggestedPrice: e.target.value }))}
                    placeholder="e.g. 3500"
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-gray-300"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Description (optional)</label>
                  <textarea
                    rows={2}
                    value={requestForm.description}
                    onChange={e => setRequestForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description of the service..."
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-gray-300 resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setShowRequestForm(false)}
                    className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitServiceRequest}
                    disabled={isSubmittingRequest}
                    className="flex-1 py-2 rounded-xl bg-[#00246b] hover:bg-[#001c54] text-white text-xs font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
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
          <div className="fixed inset-0 z-[160] flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-xs"
            />
            {/* Drawer Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative w-full max-w-sm h-full bg-white shadow-2xl overflow-y-auto flex flex-col z-10"
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
                <div>
                  <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">Service Details</p>
                  <h3 className="text-xs font-bold text-gray-900 mt-0.5 capitalize">{selectedItem.title}</h3>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all cursor-pointer"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 p-4 space-y-4">
                {/* Icon + Pricing */}
                <div className="flex items-center gap-3.5 p-3.5 bg-blue-50/60 rounded-xl border border-blue-100/60">
                  <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 overflow-hidden flex items-center justify-center shadow-2xs shrink-0">
                    {selectedItem.iconUrl ? (
                      <img src={selectedItem.iconUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <FiBriefcase className="w-5 h-5 text-gray-300" />
                    )}
                  </div>
                  <div>
                    <p className="text-[9px] text-blue-600 font-bold uppercase tracking-widest mb-0.5">Fixed Base Price</p>
                    <p className="text-lg font-bold text-blue-700">₹{(selectedItem.basePrice || 0).toLocaleString()}</p>
                    <p className="text-[9px] text-gray-400 mt-0.5 font-medium">Pricing set by platform catalog</p>
                  </div>
                </div>

                {/* Admin Note */}
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                  <span className="text-amber-500 text-xs">🔒</span>
                  <p className="text-[9px] text-amber-700 font-semibold">Managed catalog item. Details are read-only.</p>
                </div>

                {/* Description */}
                {selectedItem.description && (
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Description</p>
                    <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-2.5 rounded-xl border border-gray-100">{selectedItem.description}</p>
                  </div>
                )}

                {/* Detailed Description */}
                {selectedItem.detailedDescription && (
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Details</p>
                    <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-2.5 rounded-xl border border-gray-100">{selectedItem.detailedDescription}</p>
                  </div>
                )}

                {/* Features */}
                {selectedItem.features?.filter(f => f).length > 0 && (
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Key Features</p>
                    <div className="space-y-1">
                      {selectedItem.features.filter(f => f).map((feat, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                          <FiCheck className="text-blue-600 w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Benefits */}
                {selectedItem.benefits?.filter(b => b).length > 0 && (
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Benefits</p>
                    <div className="space-y-1">
                      {selectedItem.benefits.filter(b => b).map((ben, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                          <span className="text-amber-500 font-bold shrink-0">★</span>
                          <span>{ben}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gallery */}
                {selectedItem.images?.length > 0 && (
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Gallery</p>
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
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">Service ID</span>
                    <span className="text-[9px] font-mono font-bold text-gray-600">{(selectedItem.id || '').slice(-10).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">Status</span>
                    <span className="text-[9px] font-bold text-emerald-600 capitalize">{selectedItem.status || 'active'}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white border-t border-gray-100 p-3">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="w-full py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-all cursor-pointer"
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
          <div className="fixed inset-0 z-[170] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(null)}
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
              <h3 className="text-sm font-bold text-gray-900 mb-1">Remove Skill?</h3>
              <p className="text-xs text-gray-500 mb-6">
                Are you sure you want to remove this service skill from your portfolio?
              </p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirm(null)}
                  className="flex-1 py-2 rounded-xl bg-gray-100 text-xs font-bold text-gray-600 hover:bg-gray-200 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRemoveItem(showConfirm)}
                  disabled={isRemoving}
                  className="flex-1 py-2 rounded-xl bg-rose-600 text-xs font-bold text-white shadow-2xs hover:bg-rose-700 transition-all cursor-pointer disabled:opacity-60"
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
