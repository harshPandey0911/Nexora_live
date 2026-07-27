import api from './api';

export const productOrderService = {
  create: async (orderData) => {
    try {
      const response = await api.post('/users/product-orders', orderData);
      return response.data;
    } catch (error) {
      console.error('Error creating product order:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to place product order'
      };
    }
  },

  verifyPayment: async (paymentData) => {
    try {
      const response = await api.post('/users/product-orders/verify-payment', paymentData);
      return response.data;
    } catch (error) {
      console.error('Error verifying payment:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Payment verification failed'
      };
    }
  },

  getDetails: async (orderId) => {
    try {
      const response = await api.get(`/users/product-orders/${orderId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching product order details:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch order details'
      };
    }
  },

  getMyOrders: async () => {
    try {
      const response = await api.get('/users/product-orders/my-orders');
      return response.data;
    } catch (error) {
      console.error('Error fetching my product orders:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch orders'
      };
    }
  },

  cancel: async (orderId, reason) => {
    try {
      const response = await api.post(`/users/product-orders/${orderId}/cancel`, { reason });
      return response.data;
    } catch (error) {
      console.error('Error cancelling product order:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to cancel order'
      };
    }
  }
};
