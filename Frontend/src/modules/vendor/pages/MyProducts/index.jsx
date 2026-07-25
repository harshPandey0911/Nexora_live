import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiPackage, FiPlus, FiTrash2, FiEye, FiSearch, 
  FiDownload, FiFilter, FiMoreVertical, FiChevronDown, FiBox,
  FiX, FiSend, FiClock 
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import vendorService from '../../services/vendorService';
import { publicCatalogService } from '../../../../services/catalogService';
import { toast } from 'react-hot-toast';
import Pagination from '../../../../components/common/Pagination';

const MyProducts = () => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [categories, setCategories] = useState([]);
  const [groupedProducts, setGroupedProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  
  const [adminProducts, setAdminProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  const [editingCategory, setEditingCategory] = useState(null); // ID of category being edited
  const [editTitle, setEditTitle] = useState('');
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);

  // --- Request States ---
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState({ categoryName: '', serviceName: '', suggestedPrice: '', description: '' });
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [myRequests, setMyRequests] = useState([]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await vendorService.getMyCustomContent();
      const allPublicRes = await vendorService.getMyServices(); // For performance stats
      const publicCatsRes = await publicCatalogService.getCategories(); // Fetch all platform categories
      const publicProductsRes = await publicCatalogService.getServices({ offeringType: 'PRODUCT' });

      if (publicProductsRes.success) {
        const globalProducts = (publicProductsRes.services || []).filter(p => !p.vendorId);
        setAdminProducts(globalProducts);
      }

      if (res.success) {
        const myCats = (res.data?.categories || []).map(c => ({ ...c, id: c._id || c.id }));
        const platformCats = (publicCatsRes.success ? (publicCatsRes.categories || publicCatsRes.data || []) : []).map(c => ({ ...c, id: c._id || c.id }));
        
        // Filter by PRODUCT type and merge (Prioritize myCats)
        const combined = [...myCats];
        platformCats.forEach(pc => {
          if (!combined.find(vc => vc.title.toLowerCase() === pc.title.toLowerCase())) {
            combined.push(pc);
          }
        });

        const productCats = combined.filter(c => c.offeringType === 'PRODUCT');
        console.log('[loadProducts] Final categories with IDs:', productCats.map(c => ({ title: c.title, id: c.id })));

        const allItems = (res.data?.services || []).map(s => ({ ...s, id: s._id || s.id }));
        const productsOnly = allItems.filter(item => item.offeringType === 'PRODUCT');

        setCategories(productCats);
        
        // Group by categoryId or title (since platform categories might have different IDs but same names)
        const grouped = {};
        productsOnly.forEach(p => {
          const catId = p.categoryId?._id || p.categoryId || 'uncategorized';
          if (!grouped[catId]) grouped[catId] = [];
          grouped[catId].push(p);
        });
        setGroupedProducts(grouped);
      }
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadServiceRequests = async () => {
    try {
      const res = await vendorService.getMyServiceRequests();
      if (res.success) {
        const productRequests = (res.requests || []).filter(r => r.requestType === 'PRODUCT');
        setMyRequests(productRequests);
      }
    } catch {}
  };

  const handleSubmitServiceRequest = async () => {
    const { categoryName, serviceName, suggestedPrice } = requestForm;
    if (!categoryName.trim() || !serviceName.trim() || !suggestedPrice) {
      toast.error('Category name, product name and price are required');
      return;
    }
    setIsSubmittingRequest(true);
    try {
      const res = await vendorService.submitServiceRequest({
        categoryName: categoryName.trim(),
        serviceName: serviceName.trim(),
        suggestedPrice: Number(suggestedPrice),
        description: requestForm.description.trim(),
        requestType: 'PRODUCT'
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

  useEffect(() => {
    loadProducts();
    loadServiceRequests();
  }, []);

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Are you sure you want to delete this category? All products under it will also be hidden.')) return;
    try {
      setLoading(true);
      const res = await vendorService.removeService(categoryId);
      if (res.success) {
        toast.success(res.message);
        loadProducts();
      }
    } catch (error) {
      toast.error('Failed to delete category');
    } finally {
      setLoading(false);
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
        loadProducts();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update category');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveProduct = async (productId) => {
    try {
      setIsRemoving(true);
      const res = await vendorService.removeService(productId);
      if (res.success) {
        toast.success('Product removed successfully');
        loadProducts();
        setShowConfirm(null);
      }
    } catch (error) {
      console.error('Remove product error:', error);
      toast.error('Failed to remove product');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleQuickAdd = async (e, catId) => {
    e.preventDefault();
    if (!selectedProductId) return toast.error('Please select an approved product');
    
    try {
      setIsAdding(true);
      const res = await vendorService.addVendorService({
        serviceId: selectedProductId,
        categoryId: catId,
        offeringType: 'PRODUCT'
      });
      if (res.success) {
        toast.success('Product added successfully!');
        setSelectedProductId('');
        loadProducts();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add product');
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
            Product Portfolio
          </h2>
          <p className="hidden md:block text-gray-500 font-medium mt-2 text-sm">
            Configure your products and inventory for user orders
          </p>
        </div>
        <button
          onClick={() => setShowRequestForm(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 active:scale-95 transition-all shadow-md shadow-blue-100/50 shrink-0"
        >
          <FiPlus className="w-3.5 h-3.5" />
          Request Product
        </button>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-medium text-gray-400 capitalize tracking-widest">Syncing Inventory...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200">
             <FiBox className="w-12 h-12 text-gray-200 mx-auto mb-4 animate-bounce" />
             <h3 className="text-sm font-normal text-gray-800 capitalize">Empty Catalog</h3>
             <p className="text-xs text-gray-400 mt-1 capitalize tracking-wider font-medium">Create a category to start adding products</p>
          </div>
        ) : (
          categories
            .slice((currentPage - 1) * pageSize, currentPage * pageSize)
            .map(cat => (
            <div key={cat.id || cat._id || cat.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
              {/* Category Header (Clickable Accordion Trigger) */}
              <div 
                onClick={() => setExpandedCategoryId(expandedCategoryId === (cat.id || cat._id) ? null : (cat.id || cat._id))}
                className="bg-gray-50/50 px-4 py-4 border-b border-gray-100 cursor-pointer flex items-center justify-between select-none hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white border border-gray-100 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                    {cat.imageUrl ? (
                      <img src={cat.imageUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <FiPackage className="text-gray-400 w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-semibold text-gray-900 capitalize tracking-tight">{cat.title}</h3>
                    </div>
                    <p className="text-[8px] font-normal text-blue-500 capitalize tracking-widest mt-0.5">
                      {groupedProducts[cat.id || cat._id]?.length || 0} Products Active
                    </p>
                  </div>
                </div>

                <div className="text-gray-400">
                  <FiChevronDown className={`w-5 h-5 transition-transform duration-300 ${expandedCategoryId === (cat.id || cat._id) ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* Accordion Content Container */}
              <AnimatePresence initial={false}>
                {expandedCategoryId === (cat.id || cat._id) && (
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
                        onSubmit={(e) => handleQuickAdd(e, cat.id || cat._id)}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm w-full mt-2 mb-4"
                      >
                        <div className="flex-1 w-full">
                          {(() => {
                            const availableProducts = adminProducts.filter(s => {
                              const sCatId = s.categoryId?._id || s.categoryId || '';
                              const activeCatId = cat.id || cat._id || '';
                              const matchesCat = sCatId.toString() === activeCatId.toString();
                              const isAlreadyAdded = (groupedProducts[cat.id] || []).some(
                                existing => existing.title?.toLowerCase().trim() === s.title?.toLowerCase().trim()
                              );
                              return matchesCat && !isAlreadyAdded;
                            });

                            return (
                              <select
                                value={selectedProductId}
                                onChange={(e) => setSelectedProductId(e.target.value)}
                                disabled={availableProducts.length === 0}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-normal text-gray-700 focus:bg-white focus:border-blue-500/30 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <option value="">Select Platform Product to Add...</option>
                                {availableProducts.map(s => (
                                  <option key={s._id} value={s._id}>
                                    {s.title} (Price: ₹{s.basePrice || 0})
                                  </option>
                                ))}
                              </select>
                            );
                          })()}
                        </div>

                        <button 
                          type="submit"
                          disabled={isAdding || !selectedProductId}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shrink-0"
                        >
                          <FiPlus className="w-4 h-4" />
                          <span>Add to Category</span>
                        </button>
                      </form>

                      {/* Items Table */}
                      <div className="overflow-x-auto border border-gray-100 rounded-xl">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-gray-50 bg-gray-50/50">
                              <th className="px-4 py-3 text-[9px] font-semibold text-gray-400 capitalize tracking-wider">Product Specification</th>
                              <th className="px-4 py-3 text-[9px] font-semibold text-gray-400 capitalize tracking-wider">Market Value</th>
                              <th className="px-4 py-3 text-[9px] font-semibold text-gray-400 capitalize tracking-wider text-right">Operations</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 px-1">
                            {!groupedProducts[cat.id || cat._id] || groupedProducts[cat.id || cat._id].length === 0 ? (
                              <tr>
                                <td colSpan="3" className="px-4 py-8 text-center">
                                  <div className="flex flex-col items-center gap-1.5">
                                    <p className="text-[9px] font-medium text-gray-300 capitalize tracking-widest">No items found in this category</p>
                                    <p className="text-[8px] font-normal text-gray-400 capitalize">Use the form above to add items instantly</p>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              groupedProducts[cat.id || cat._id].map(item => (
                                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                                        <img src={item.iconUrl || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" alt="" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-normal text-gray-800 capitalize truncate tracking-tight">{item.title}</p>
                                        <p className="text-[8px] font-normal text-gray-400 capitalize tracking-wider mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">ID: {item.id.slice(-6).toUpperCase()}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-xs font-medium text-emerald-600">₹{item.basePrice.toLocaleString()}</span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                       <button 
                                         onClick={() => navigate(`/vendor/product/edit/${item.id}`)}
                                         className="px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[8px] font-medium capitalize tracking-widest hover:bg-blue-600 hover:text-white transition-all border border-blue-100 shadow-sm active:scale-95"
                                       >
                                         Manage
                                       </button>
                                       <button 
                                         onClick={() => setShowConfirm(item.id)}
                                         className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90"
                                       >
                                         <FiTrash2 className="w-4 h-4" />
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

        {/* Pagination Bar */}
        {!loading && categories.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(categories.length / pageSize) || 1}
            totalItems={categories.length}
            pageSize={pageSize}
            onPageChange={(p) => setCurrentPage(p)}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            className="mt-4"
          />
        )}
      </div>

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
              <h3 className="text-lg font-normal text-gray-900 mb-2">Delete Product?</h3>
              <p className="text-sm text-gray-500 mb-8">
                Are you sure you want to remove this product? This action cannot be undone.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(null)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-sm font-normal text-gray-600 hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRemoveProduct(showConfirm)}
                  disabled={isRemoving}
                  className="flex-1 py-3 rounded-xl bg-rose-600 text-sm font-normal text-white shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all"
                >
                  {isRemoving ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Past Requests List */}
      {myRequests.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">My Product Requests</p>
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

      {/* ── Request Product Modal ── */}
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
                  <h3 className="text-sm font-semibold text-gray-900 mt-0.5">Request a New Product</h3>
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
                    placeholder="e.g. Electrical Products"
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 placeholder-gray-300"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest mb-1 block">Product Name *</label>
                  <input
                    value={requestForm.serviceName}
                    onChange={e => setRequestForm(f => ({ ...f, serviceName: e.target.value }))}
                    placeholder="e.g. Copper Wire 10m"
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 placeholder-gray-300"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest mb-1 block">Suggested Price (₹) *</label>
                  <input
                    type="number"
                    value={requestForm.suggestedPrice}
                    onChange={e => setRequestForm(f => ({ ...f, suggestedPrice: e.target.value }))}
                    placeholder="e.g. 750"
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 placeholder-gray-300"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest mb-1 block">Description (optional)</label>
                  <textarea
                    rows={2}
                    value={requestForm.description}
                    onChange={e => setRequestForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description of the product..."
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
    </div>
  );
};

export default MyProducts;
