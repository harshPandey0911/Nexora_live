import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSave, FiX } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import Modal from './Modal'; // Assuming Modal is in same directory
import { serviceService } from '../../../../../services/catalogService';
import { z } from 'zod';

const serviceSchema = z.object({
  title: z.string().trim().min(2, "Title is required"),
  pricingType: z.enum(["FIXED", "HOURLY"]).default("FIXED"),
  basePrice: z.number().min(0, "Price must be at least 0"),
  hourlyRate: z.number().min(0).optional(),
  minHours: z.number().min(1).default(1),
  maxHours: z.number().min(1).default(8),
  gstPercentage: z.number().min(0).max(100).default(18),
  discountPrice: z.number().optional()
});

const BrandServicesModal = ({ isOpen, onClose, brand }) => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    normalEnabled: true,
    hourlyEnabled: false,
    basePrice: '',
    hourlyRate: '',
    minHours: 1,
    maxHours: 8,
    gstPercentage: 18,
    discountPrice: ''
  });

  useEffect(() => {
    if (isOpen && brand) {
      loadServices();
    } else {
      setServices([]);
      resetForm();
    }
  }, [isOpen, brand]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const response = await serviceService.getAll({ brandId: brand.id });
      if (response.success) {
        setServices(response.services || []);
      }
    } catch (error) {
      console.error('Failed to load services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      title: '',
      normalEnabled: true,
      hourlyEnabled: false,
      basePrice: '',
      hourlyRate: '',
      minHours: 1,
      maxHours: 8,
      gstPercentage: 18,
      discountPrice: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const normalEnabled = form.normalEnabled !== false;
    const hourlyEnabled = form.hourlyEnabled === true;

    if (!normalEnabled && !hourlyEnabled) {
      toast.error('At least one booking mode must be enabled');
      return;
    }
    if (normalEnabled && (!form.basePrice || Number(form.basePrice) <= 0)) {
      toast.error('Base price must be greater than 0 for Normal Booking');
      return;
    }
    if (hourlyEnabled) {
      if (!form.hourlyRate || Number(form.hourlyRate) <= 0) {
        toast.error('Hourly rate must be greater than 0 for Hourly Booking');
        return;
      }
      if (Number(form.minHours) < 1) {
        toast.error('Minimum hours must be at least 1');
        return;
      }
      if (Number(form.maxHours) < Number(form.minHours)) {
        toast.error('Maximum hours cannot be less than minimum hours');
        return;
      }
    }

    const bookingOptions = {
      normal: { enabled: normalEnabled },
      hourly: { enabled: hourlyEnabled }
    };

    const data = {
      title: form.title,
      bookingOptions,
      basePrice: normalEnabled ? Number(form.basePrice || 0) : Number(form.hourlyRate || 0) * Number(form.minHours || 1),
      hourlyRate: hourlyEnabled ? Number(form.hourlyRate) : 0,
      minHours: hourlyEnabled ? Number(form.minHours || 1) : 1,
      maxHours: hourlyEnabled ? Number(form.maxHours || 8) : 8,
      gstPercentage: Number(form.gstPercentage || 18),
      discountPrice: form.discountPrice ? Number(form.discountPrice) : undefined
    };

    try {
      setLoading(true);
      if (editingId) {
        const response = await serviceService.update(editingId, {
          ...data,
          brandId: brand.id
        });
        if (response.success) {
          toast.success('Service updated');
          loadServices();
          resetForm();
        }
      } else {
        const response = await serviceService.create({
          ...data,
          brandId: brand.id
        });
        if (response.success) {
          toast.success('Service created');
          loadServices();
          resetForm();
        }
      }
    } catch (error) {
      console.error('Save service error:', error);
      toast.error(error.response?.data?.message || 'Failed to save service');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      await serviceService.delete(id);
      toast.success('Service deleted');
      loadServices();
    } catch (error) {
      toast.error('Failed to delete service');
    }
  };

  const handleEdit = (service) => {
    setEditingId(service.id || service._id);
    const bOpts = service.bookingOptions;
    const normalEnabled = bOpts ? (bOpts.normal?.enabled !== false) : (service.pricingType !== 'HOURLY');
    const hourlyEnabled = bOpts ? (bOpts.hourly?.enabled === true) : (service.pricingType === 'HOURLY');
    setForm({
      title: service.title,
      normalEnabled,
      hourlyEnabled,
      basePrice: service.basePrice || '',
      hourlyRate: service.hourlyRate || '',
      minHours: service.minHours || 1,
      maxHours: service.maxHours || 8,
      gstPercentage: service.gstPercentage || 18,
      discountPrice: service.discountPrice || ''
    });
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Manage Services for ${brand?.title}`} size="xl">
      <div className="space-y-6">
        {/* Form */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
            {editingId ? 'Edit Service' : 'Add New Service'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Service Title</label>
                <input
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. AC Filter Cleaning"
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Pricing Type</label>
                <select
                  value={form.pricingType}
                  onChange={e => setForm(p => ({ ...p, pricingType: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white font-bold"
                >
                  <option value="FIXED">Fixed Price</option>
                  <option value="HOURLY">Hourly Rate</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">GST %</label>
                <input
                  type="number"
                  value={form.gstPercentage}
                  onChange={e => setForm(p => ({ ...p, gstPercentage: e.target.value }))}
                  placeholder="18"
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                />
              </div>
            </div>

            {/* Booking Options — dual checkbox */}
            <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200 space-y-2">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Booking Options</p>

              {/* Normal Booking */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.normalEnabled !== false}
                  onChange={e => setForm(p => ({ ...p, normalEnabled: e.target.checked }))}
                  className="w-4 h-4 accent-blue-600"
                />
                <span className="text-sm font-semibold text-gray-800">Normal Booking</span>
              </label>
              {form.normalEnabled !== false && (
                <div className="ml-6">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Base Price (₹)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={form.basePrice}
                    onChange={e => setForm(p => ({ ...p, basePrice: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    required={form.normalEnabled !== false}
                  />
                </div>
              )}

              {/* Hourly Booking */}
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={form.hourlyEnabled === true}
                  onChange={e => setForm(p => ({ ...p, hourlyEnabled: e.target.checked }))}
                  className="w-4 h-4 accent-teal-600"
                />
                <span className="text-sm font-semibold text-gray-800">Hourly Booking</span>
              </label>
              {form.hourlyEnabled === true && (
                <div className="ml-6 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-teal-50/70 p-3 rounded-xl border border-teal-100">
                  <div>
                    <label className="block text-xs font-bold text-teal-800 mb-1">Hourly Rate (₹/hr)</label>
                    <input
                      type="number"
                      min="1"
                      value={form.hourlyRate}
                      onChange={e => setForm(p => ({ ...p, hourlyRate: e.target.value }))}
                      placeholder="299"
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white font-bold"
                      required={form.hourlyEnabled === true}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-teal-800 mb-1">Min Hours</label>
                    <input
                      type="number"
                      min="1"
                      value={form.minHours}
                      onChange={e => setForm(p => ({ ...p, minHours: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                      required={form.hourlyEnabled === true}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-teal-800 mb-1">Max Hours</label>
                    <input
                      type="number"
                      min="1"
                      value={form.maxHours}
                      onChange={e => setForm(p => ({ ...p, maxHours: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                      required={form.hourlyEnabled === true}
                    />
                  </div>
                </div>
              )}

              {!form.normalEnabled && !form.hourlyEnabled && (
                <p className="text-xs text-red-600 font-semibold">⚠ At least one booking mode must be enabled.</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-100"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 disabled:opacity-50"
              >
                {editingId ? 'Update Service' : 'Add Service'}
              </button>
            </div>
          </form>
        </div>

        {/* List */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Title</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Price</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">GST</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {services.map(service => (
                <tr key={service.id || service._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{service.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {(() => {
                      const bOpts = service.bookingOptions || {
                        normal: { enabled: service.pricingType !== 'HOURLY' },
                        hourly: { enabled: service.pricingType === 'HOURLY' }
                      };
                      const normalOn = bOpts.normal?.enabled !== false;
                      const hourlyOn = bOpts.hourly?.enabled === true;

                      if (normalOn && hourlyOn) {
                        return (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-blue-700">₹{service.basePrice}</span>
                            <span className="text-[10px] text-gray-400">+</span>
                            <span className="font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 text-xs">
                              ₹{service.hourlyRate}/hr
                            </span>
                          </div>
                        );
                      } else if (hourlyOn) {
                        return (
                          <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-xs">
                            ₹{service.hourlyRate}/hr ({service.minHours}-{service.maxHours}h)
                          </span>
                        );
                      } else {
                        return `₹${service.basePrice}`;
                      }
                    })()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{service.gstPercentage}%</td>
                  <td className="px-4 py-3 text-right flex justify-end gap-2">
                    <button
                      onClick={() => handleEdit(service)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit"
                    >
                      <FiEdit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(service.id || service._id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-4 py-8 text-center text-sm text-gray-500">
                    No services found for this brand. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};

export default BrandServicesModal;
