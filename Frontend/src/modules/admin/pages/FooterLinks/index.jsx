import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiExternalLink, FiMove } from 'react-icons/fi';
import footerLinkService from '../../services/footerLinkService';
import { toast } from 'react-hot-toast';

const FooterLinks = () => {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    section: 'QUICK LINKS',
    order: 0,
    isActive: true
  });

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const response = await footerLinkService.getAllLinks();
      if (response.success) {
        setLinks(response.data);
      }
    } catch (error) {
      toast.error('Failed to fetch footer links');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleOpenModal = (link = null) => {
    if (link) {
      setEditingLink(link);
      setFormData({
        title: link.title,
        url: link.url,
        section: link.section,
        order: link.order,
        isActive: link.isActive
      });
    } else {
      setEditingLink(null);
      setFormData({
        title: '',
        url: '',
        section: 'QUICK LINKS',
        order: links.length,
        isActive: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingLink) {
        await footerLinkService.updateLink(editingLink._id, formData);
        toast.success('Link updated successfully');
      } else {
        await footerLinkService.addLink(formData);
        toast.success('Link added successfully');
      }
      setIsModalOpen(false);
      fetchLinks();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this link?')) {
      try {
        await footerLinkService.deleteLink(id);
        toast.success('Link deleted successfully');
        fetchLinks();
      } catch (error) {
        toast.error('Failed to delete link');
      }
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Footer Management</h1>
          <p className="text-sm text-gray-500">Manage Quick Links and Footer Sections for User App</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
        >
          <FiPlus /> Add New Link
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Order</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">URL</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Section</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-gray-400">Loading links...</td>
                </tr>
              ) : links.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-gray-400">No links added yet.</td>
                </tr>
              ) : (
                links.map((link) => (
                  <tr key={link._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-600">{link.order}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-800">{link.title}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-primary-600 font-medium max-w-xs truncate">
                        <FiExternalLink className="shrink-0" />
                        {link.url}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        link.section === 'USER BOTTOM' ? 'bg-purple-50 text-purple-600' :
                        link.section === 'COMPANY' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                      }`}>
                        {link.section}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                        link.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {link.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(link)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <FiEdit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(link._id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <FiTrash2 size={16} />
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">
                {editingLink ? 'Edit Link' : 'Add New Footer Link'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="e.g. My Bookings"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">URL / Path</label>
                <input
                  type="text"
                  required
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="e.g. /user/my-bookings"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Section</label>
                  <select
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none"
                  >
                    <option value="COMPANY">COMPANY</option>
                    <option value="QUICK LINKS">QUICK LINKS</option>
                    <option value="USER BOTTOM">USER BOTTOM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Order</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.order}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setFormData({ ...formData, order: isNaN(val) || val < 0 ? 0 : val });
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Visible to users
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg bg-primary-600 text-white font-bold hover:bg-primary-700 transition-colors"
                >
                  {editingLink ? 'Save Changes' : 'Add Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FooterLinks;
