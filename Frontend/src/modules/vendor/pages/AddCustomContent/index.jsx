import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiPlus, FiBox, FiGrid, FiArrowLeft, FiSave, FiImage, FiType, FiDollarSign, FiTrash2, FiChevronDown } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { vendorTheme as themeColors } from '../../../../theme';
import Header from '../../components/layout/Header';
import vendorService from '../../services/vendorService';
import { serviceService, publicCatalogService } from '../../../../services/catalogService';
import { toast } from 'react-hot-toast';
import { toAssetUrl } from '../../../../modules/admin/pages/UserCategories/utils';

const AddCustomContent = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // Get ID for editing
  const isEditMode = !!id;
  const query = new URLSearchParams(window.location.search);
  const initialType = query.get('type') || 'SERVICE';

  const [activeTab, setActiveTab] = useState(isEditMode ? 'product' : 'category');
  const [offeringType, setOfferingType] = useState(initialType);
  const [loading, setLoading] = useState(false);
  const [myCategories, setMyCategories] = useState([]);
  const [myServices, setMyServices] = useState([]);
  
  // Form States
  const [categoryForm, setCategoryForm] = useState({
    title: '',
    description: '',
    imageUrl: '',
    homeIconUrl: ''
  });
  const [uploading, setUploading] = useState(false);

  const [productForm, setProductForm] = useState({
    title: '',
    description: '',
    detailedDescription: '',
    basePrice: '',
    categoryId: '',
    iconUrl: '',
    features: [''],
    benefits: [''],
    images: []
  });

  useEffect(() => {
    fetchMyContent();
    if (isEditMode) {
      fetchItemDetails();
    }
  }, [id]);

  const fetchItemDetails = async () => {
    try {
      setLoading(true);
      const res = await vendorService.getServiceById(id);
      if (res.success) {
        const item = res.data;
        setProductForm({
          title: item.title,
          description: item.description || '',
          detailedDescription: item.detailedDescription || '',
          basePrice: item.basePrice,
          categoryId: item.categoryId?._id || item.categoryId || '',
          iconUrl: item.iconUrl || '',
          features: item.features?.length ? item.features : [''],
          benefits: item.benefits?.length ? item.benefits : [''],
          images: item.images || []
        });
        setOfferingType(item.offeringType);
      }
    } catch (error) {
      toast.error('Failed to load item details');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyContent = async () => {
    try {
      const res = await vendorService.getMyCustomContent();
      const allPublicRes = await publicCatalogService.getCategories(); // Fetch all platform categories

      if (res.success) {
        setMyServices(res.data.services || []);
        
        // Merge vendor's custom categories with platform categories
        const vendorCats = res.data.categories || [];
        const platformCats = allPublicRes.success ? allPublicRes.categories : [];
        
        // Remove duplicates by title
        const combined = [...vendorCats];
        platformCats.forEach(pc => {
          if (!combined.find(vc => vc.title.toLowerCase() === pc.title.toLowerCase())) {
            combined.push(pc);
          }
        });

        setMyCategories(combined);
      }
    } catch (error) {
      console.error('Error fetching content:', error);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await vendorService.addVendorCategory({
        ...categoryForm,
        offeringType // Pass current offeringType (SERVICE or PRODUCT)
      });
      if (res.success) {
        toast.success('Category added successfully!');
        setCategoryForm({ title: '', description: '', imageUrl: '', homeIconUrl: '' });
        fetchMyContent();
        // Pre-select this category for the product form
        setProductForm(prev => ({ ...prev, categoryId: res.data._id }));
        setActiveTab('product'); // Switch to product to add items under this category
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add category');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      const folder = 'vendor-custom-content';
      const res = await serviceService.uploadImage(file, folder);
      if (res.success) {
        setCategoryForm(prev => ({ ...prev, imageUrl: res.imageUrl, homeIconUrl: res.imageUrl }));
        toast.success('Image uploaded successfully!');
      }
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      setUploading(true);
      const folder = 'vendor-product-gallery';
      for (const file of files) {
        const res = await serviceService.uploadImage(file, folder);
        if (res.success) {
          setProductForm(prev => ({ 
            ...prev, 
            images: [...prev.images, res.imageUrl] 
          }));
        }
      }
      toast.success('Gallery updated!');
    } catch (error) {
      toast.error('Failed to upload gallery images');
    } finally {
      setUploading(false);
    }
  };

  const handleListChange = (type, index, value) => {
    const newList = [...productForm[type]];
    newList[index] = value;
    setProductForm(prev => ({ ...prev, [type]: newList }));
  };

  const addListItem = (type) => {
    setProductForm(prev => ({ ...prev, [type]: [...prev[type], ''] }));
  };

  const removeListItem = (type, index) => {
    const newList = productForm[type].filter((_, i) => i !== index);
    setProductForm(prev => ({ ...prev, [type]: newList }));
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Are you sure you want to delete this category? All services under it will also be hidden.')) return;
    
    try {
      setLoading(true);
      const res = await vendorService.removeService(categoryId);
      if (res.success) {
        toast.success(res.message);
        fetchMyContent();
      }
    } catch (error) {
      toast.error('Failed to delete category');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      const payload = {
        ...productForm,
        offeringType
      };

      if (isEditMode) {
        const res = await vendorService.updateService(id, payload);
        if (res.success) {
          toast.success('Updated successfully!');
          navigate(-1);
        }
      } else {
        const res = await vendorService.addVendorService(payload);
        if (res.success) {
          toast.success(`${offeringType === 'PRODUCT' ? 'Product' : 'Service'} added!`);
          
          // Reset form for next entry
          setProductForm({ 
            title: '', 
            description: '',
            detailedDescription: '',
            basePrice: '',
            categoryId: payload.categoryId, // Keep category for convenience
            iconUrl: '',
            features: [''],
            benefits: [''],
            images: []
          });
          
          fetchMyContent();
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8 pb-12"
    >
      {/* Header - White Style */}
      <div className="bg-white p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between text-gray-900 border border-gray-100 gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-all active:scale-95"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-medium text-gray-900 tracking-tight leading-none capitalize">
              {isEditMode ? 'Edit' : 'Add New'} {offeringType === 'PRODUCT' ? 'Product' : 'Service'}
            </h2>
            <p className="text-gray-500 text-[11px] font-medium mt-2">
              Define your unique expertise and catalog expansion protocols
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-[1200px] mx-auto">
        {/* Tab Switcher */}
        <div className="flex bg-white p-1 rounded-2xl mb-8 border border-gray-100 shadow-sm max-w-sm mx-auto">
          {!isEditMode && (
          <button
            onClick={() => setActiveTab('category')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-medium capitalize tracking-wider transition-all duration-300 ${
              activeTab === 'category' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <FiGrid className="w-3.5 h-3.5" />
            Category
          </button>
          )}
          <button
            onClick={() => setActiveTab('product')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-medium capitalize tracking-wider transition-all duration-300 ${
              activeTab === 'product' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <FiBox className="w-3.5 h-3.5" />
            {offeringType === 'PRODUCT' ? 'Product' : 'Service'}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'category' && !isEditMode ? (
            <motion.div
              key="category-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm max-w-2xl mx-auto"
            >
              <div className="mb-8">
                <h2 className="text-xl font-normal text-gray-800 tracking-tight">Create Category</h2>
                <p className="text-[10px] font-normal text-gray-400 capitalize tracking-widest mt-1">Structure your expertise for deployment</p>
                <div className="mt-4 flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-medium capitalize tracking-widest border ${offeringType === 'PRODUCT' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                    Type: {offeringType}
                  </span>
                </div>
              </div>

              <form onSubmit={handleAddCategory} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-medium text-gray-400 capitalize tracking-widest mb-2 px-1">Category Title</label>
                  <div className="relative">
                    <FiType className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="e.g. Home Decor, Special Repair"
                      value={categoryForm.title}
                      onChange={(e) => setCategoryForm({ ...categoryForm, title: e.target.value })}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-normal text-gray-700 placeholder:text-gray-300 focus:bg-white focus:border-blue-500/50 transition-all outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-gray-400 capitalize tracking-widest mb-2 px-1">Description</label>
                  <textarea
                    placeholder="Describe what this category covers..."
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-normal text-gray-700 placeholder:text-gray-300 focus:bg-white focus:border-blue-500/50 transition-all outline-none min-h-[100px] resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-gray-400 capitalize tracking-widest mb-2 px-1">Visual Protocol (Image)</label>
                  <div className="space-y-4">
                    <div className="relative group">
                      <div className="flex items-center gap-4 p-5 bg-gray-50 rounded-xl border border-dashed border-gray-200 group-hover:border-blue-500/50 transition-all cursor-pointer relative overflow-hidden">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploading}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        />
                        <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 shadow-sm">
                          {uploading ? (
                            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <FiImage className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium text-gray-700 capitalize tracking-widest">
                            {categoryForm.imageUrl ? 'Update Protocol' : 'Upload Image'}
                          </p>
                          <p className="text-[9px] font-normal text-gray-400 capitalize mt-0.5 tracking-tight">JPG, PNG UP TO 5MB</p>
                        </div>
                      </div>
                    </div>

                    {categoryForm.imageUrl && (
                      <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                        <img 
                          src={toAssetUrl(categoryForm.imageUrl)} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setCategoryForm(prev => ({ ...prev, imageUrl: '', homeIconUrl: '' }))}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-lg active:scale-90 transition-all"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-xl bg-blue-600 text-white font-medium capitalize tracking-widest text-[11px] shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  {loading ? 'Processing...' : (
                    <>
                      <FiSave className="w-4 h-4" />
                      Save Category
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="product-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm max-w-2xl mx-auto"
            >
              <div className="mb-8">
                <h2 className="text-xl font-normal text-gray-800 tracking-tight">{isEditMode ? 'Edit' : 'Create'} {offeringType === 'PRODUCT' ? 'Product' : 'Service'}</h2>
                <p className="text-[10px] font-normal text-gray-400 capitalize tracking-widest mt-1">
                  {isEditMode ? 'Update details for this item' : 'Add individual bookable items'}
                </p>
              </div>

              <form onSubmit={handleAddProduct} className="space-y-6">
                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 mb-6">
                  <label className="block text-[10px] font-medium text-blue-600 capitalize tracking-widest mb-2 px-1">Where should this appear to users?</label>
                  <div className="relative">
                    <select
                      value={productForm.categoryId}
                      onChange={(e) => {
                        if (e.target.value === 'NEW_CAT') {
                          setActiveTab('category');
                        } else {
                          setProductForm({ ...productForm, categoryId: e.target.value });
                        }
                      }}
                      className="w-full px-4 py-3 bg-white border border-blue-100 rounded-xl text-sm font-normal text-gray-700 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none appearance-none cursor-pointer"
                      required
                    >
                      <option value="">Select Platform Section (Where should this show?)...</option>
                      <option value="NEW_CAT" className="text-blue-600 font-medium">+ ADD NEW CATEGORY NAME</option>
                      <optgroup label="PLATFORM SECTIONS">
                        <option value="Needs">Daily Needs (Grocery, Milk, etc.)</option>
                        <option value="Delivery">Delivery Services (Parcel, Food Delivery)</option>
                        <option value="Home">Home Services (AC Repair, Cleaning)</option>
                        <option value="Health">Health & Care (Medicines, Doctor)</option>
                        <option value="More">More Services (Other Categories)</option>
                      </optgroup>
                      {myCategories.length > 0 && (
                        <optgroup label="YOUR CUSTOM SECTIONS">
                          {myCategories.map(cat => (
                            <option key={cat.id || cat._id} value={cat.id || cat._id}>
                              {cat.title}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
                  </div>
                  <p className="text-[9px] font-normal text-blue-400 capitalize mt-2 px-1">Selecting a category determines which tab the user finds this item in</p>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-gray-400 capitalize tracking-widest mb-2 px-1">{offeringType === 'PRODUCT' ? 'Product' : 'Service'} Title</label>
                  <div className="relative">
                    <FiType className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="e.g. Full House Painting"
                      value={productForm.title}
                      onChange={(e) => setProductForm({ ...productForm, title: e.target.value })}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-normal text-gray-700 placeholder:text-gray-300 focus:bg-white focus:border-blue-500/50 transition-all outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-gray-400 capitalize tracking-widest mb-2 px-1">Base Valuation (₹)</label>
                  <div className="relative">
                    <FiDollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      placeholder="0.00"
                      value={productForm.basePrice}
                      onChange={(e) => setProductForm({ ...productForm, basePrice: e.target.value })}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-normal text-gray-700 placeholder:text-gray-300 focus:bg-white focus:border-blue-500/50 transition-all outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-gray-400 capitalize tracking-widest mb-2 px-1">Short Description</label>
                  <textarea
                    placeholder="Brief summary (shows on card)..."
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-normal text-gray-700 placeholder:text-gray-300 focus:bg-white focus:border-blue-500/50 transition-all outline-none min-h-[80px] resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-gray-400 capitalize tracking-widest mb-2 px-1">Detailed Narrative</label>
                  <textarea
                    placeholder="Deep dive into this offering..."
                    value={productForm.detailedDescription}
                    onChange={(e) => setProductForm({ ...productForm, detailedDescription: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-normal text-gray-700 placeholder:text-gray-300 focus:bg-white focus:border-blue-500/50 transition-all outline-none min-h-[140px] resize-none"
                  />
                </div>

                {/* Features & Benefits */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="block text-[10px] font-medium text-gray-400 capitalize tracking-widest px-1">Features</label>
                    {productForm.features.map((feature, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text"
                          value={feature}
                          onChange={(e) => handleListChange('features', idx, e.target.value)}
                          placeholder={`Feature ${idx + 1}`}
                          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-normal text-gray-700 outline-none focus:border-blue-500/50"
                        />
                        <button type="button" onClick={() => removeListItem('features', idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">×</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => addListItem('features')} className="w-full py-2 border border-dashed border-gray-200 rounded-lg text-[9px] font-medium capitalize text-gray-400 hover:text-blue-600 hover:border-blue-200">+ Add Feature</button>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-[10px] font-medium text-gray-400 capitalize tracking-widest px-1">Benefits</label>
                    {productForm.benefits.map((benefit, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text"
                          value={benefit}
                          onChange={(e) => handleListChange('benefits', idx, e.target.value)}
                          placeholder={`Benefit ${idx + 1}`}
                          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-normal text-gray-700 outline-none focus:border-blue-500/50"
                        />
                        <button type="button" onClick={() => removeListItem('benefits', idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">×</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => addListItem('benefits')} className="w-full py-2 border border-dashed border-gray-200 rounded-lg text-[9px] font-medium capitalize text-gray-400 hover:text-blue-600 hover:border-blue-200">+ Add Benefit</button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-gray-400 capitalize tracking-widest mb-2 px-1">Product Gallery</label>
                  <div className="space-y-4">
                    <div className="relative group">
                      <div className="flex items-center gap-4 p-5 bg-gray-50 rounded-xl border border-dashed border-gray-200 group-hover:border-blue-500/50 transition-all cursor-pointer relative overflow-hidden">
                        <input type="file" multiple accept="image/*" onChange={handleGalleryUpload} disabled={uploading} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                        <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 shadow-sm">
                          <FiImage className="w-6 h-6 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium text-gray-700 capitalize tracking-widest">Upload Gallery Images</p>
                          <p className="text-[9px] font-normal text-gray-400 capitalize mt-0.5">Select multiple files</p>
                        </div>
                      </div>
                    </div>

                    {productForm.images.length > 0 && (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {productForm.images.map((img, idx) => (
                          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-100 group">
                            <img src={toAssetUrl(img)} alt="" className="w-full h-full object-cover" />
                            <button 
                              type="button" 
                              onClick={() => setProductForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }))} 
                              className="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs shadow-md transition-all active:scale-90"
                              title="Delete Image"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-xl bg-blue-600 text-white font-medium capitalize tracking-widest text-[11px] shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  {loading ? 'Processing...' : (
                    <>
                      <FiSave className="w-4 h-4" />
                      Save {offeringType === 'PRODUCT' ? 'Product' : 'Service'}
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Existing Content Preview */}
        <div className="mt-16">
          <div className="flex items-center gap-3 mb-8 px-1">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-sm"></div>
            <h2 className="text-[10px] font-medium capitalize tracking-widest text-gray-400">Live Infrastructure</h2>
          </div>
          
          {myCategories.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
              <p className="text-[10px] font-medium text-gray-400 capitalize tracking-widest">No active protocols detected</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myCategories.filter(c => c.offeringType === offeringType).map(cat => (
                <div key={cat._id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-medium text-gray-800 truncate tracking-tight capitalize">{cat.title}</h4>
                      <p className="text-[9px] text-gray-400 mt-0.5 line-clamp-1 font-normal capitalize tracking-wider">{cat.description}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      {cat.imageUrl && (
                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-100 shrink-0">
                          <img src={toAssetUrl(cat.imageUrl)} className="w-full h-full object-cover" alt="" />
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat._id); }}
                        className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-90"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mt-6 border-t border-gray-50 pt-6">
                    <div className="flex items-center justify-between px-1 mb-2">
                      <p className="text-[9px] font-medium text-blue-500 capitalize tracking-widest">Items</p>
                      <span className="text-[9px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                        {myServices.filter(s => s.categoryId === cat._id).length} Active
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      {myServices.filter(s => s.categoryId === cat._id).map(service => (
                        <div key={service._id} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100 hover:bg-white hover:border-blue-100 transition-all">
                          <div className="flex items-center gap-3">
                            {service.iconUrl && (
                              <img src={toAssetUrl(service.iconUrl)} className="w-8 h-8 rounded-lg object-cover border border-gray-200" alt="" />
                            )}
                            <div>
                              <p className="text-[11px] font-normal text-gray-800 tracking-tight">{service.title}</p>
                              <p className="text-[9px] font-normal text-blue-500">₹{service.basePrice.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setProductForm(prev => ({ ...prev, categoryId: cat._id }));
                        setActiveTab('product');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-50 text-[9px] font-medium text-gray-400 capitalize tracking-widest hover:bg-blue-600 hover:text-white transition-all active:scale-95 border border-gray-100"
                    >
                      <FiPlus className="w-3.5 h-3.5" />
                      Add Item
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </motion.div>
  );
};

export default AddCustomContent;
