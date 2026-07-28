import api from '../../../services/api';

/**
 * Vendor Services Portfolio Service
 */
const vendorService = {
  /**
   * Get all services/categories assigned to the vendor
   */
  getMyServices: async () => {
    try {
      const response = await api.get('/vendors/my-services');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  addVendorCategory: async (data) => {
    try {
      const response = await api.post('/vendors/add-category', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  addVendorService: async (data) => {
    try {
      const response = await api.post('/vendors/add-service', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getMyCustomContent: async () => {
    try {
      const response = await api.get('/vendors/my-custom-content');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  removeService: async (categoryId) => {
    try {
      const response = await api.delete(`/vendors/services/${categoryId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  updateCategory: async (categoryId, data) => {
    try {
      const response = await api.put(`/vendors/update-category/${categoryId}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getServiceById: async (id) => {
    try {
      const response = await api.get(`/vendors/services/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  updateService: async (id, data) => {
    try {
      const response = await api.put(`/vendors/services/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // --- Service Requests ---
  submitServiceRequest: async (data) => {
    try {
      const response = await api.post('/vendors/service-requests', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getMyServiceRequests: async () => {
    try {
      const response = await api.get('/vendors/service-requests');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // --- Product Orders & Delivery Settings ---
  getDeliverySettings: async () => {
    try {
      const response = await api.get('/vendors/delivery-settings');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  updateDeliverySettings: async (data) => {
    try {
      const response = await api.put('/vendors/delivery-settings', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getVendorProductOrders: async () => {
    try {
      const response = await api.get('/vendors/product-orders');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  acceptProductOrder: async (orderId) => {
    try {
      const response = await api.post(`/vendors/product-orders/${orderId}/accept`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  assignProductOrderWorker: async (orderId, workerId) => {
    try {
      const response = await api.post(`/vendors/product-orders/${orderId}/assign-worker`, { workerId });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  updateProductOrderStatus: async (orderId, status) => {
    try {
      const response = await api.put(`/vendors/product-orders/${orderId}/status`, { status });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default vendorService;
