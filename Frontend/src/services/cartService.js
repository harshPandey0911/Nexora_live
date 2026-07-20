import api from './api';

/**
 * Cart Service - Backend API Based
 * All cart data stored in database
 */

export const cartService = {
  // Get user's cart
  getCart: async () => {
    const response = await api.get('/users/cart');
    return response.data;
  },

  // Add item to cart
  addToCart: async (itemData) => {
    const response = await api.post('/users/cart', itemData);
    console.log("cartService.addToCart RETURN VALUE:", response.data);
    return response.data;
  },

  // Update cart item quantity
  updateItem: async (itemId, serviceCount) => {
    console.log("URL:", `/users/cart/${itemId}`);
    const response = await api.put(`/users/cart/${itemId}`, { serviceCount });
    console.log("cartService.updateItem RETURN VALUE:", response.data);
    return response.data;
  },

  // Remove item from cart
  removeItem: async (itemId) => {
    console.log("URL:", `/users/cart/${itemId}`);
    const response = await api.delete(`/users/cart/${itemId}`);
    console.log("cartService.removeItem RETURN VALUE:", response.data);
    return response.data;
  },

  // Remove all items from a category
  removeCategoryItems: async (category) => {
    const response = await api.delete(`/users/cart/category/${encodeURIComponent(category)}`);
    return response.data;
  },

  // Clear entire cart
  clearCart: async () => {
    const response = await api.delete('/users/cart');
    return response.data;
  }
};

export default cartService;
