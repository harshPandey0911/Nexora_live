import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { cartService } from '../services/cartService';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import CategoryConflictModal from '../components/common/CategoryConflictModal';

/**
 * Cart Context
 * Provides global cart state management with event-driven updates
 * No polling - cart count updates instantly on add/remove actions
 */

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [platformFeeRate, setPlatformFeeRate] = useState(49);
  const [maxCartItemQuantity, setMaxCartItemQuantity] = useState(100);

  // Category Conflict Modal State
  const [conflictModal, setConflictModal] = useState({
    isOpen: false,
    pendingItemData: null,
    resolvePromise: null,
  });

  // Category comparison helper
  const getCategoryKey = (item) => {
    if (!item) return '';
    if (item.categoryId) {
      if (typeof item.categoryId === 'object') {
        if (item.categoryId._id) return String(item.categoryId._id);
        if (item.categoryId.id) return String(item.categoryId.id);
        if (item.categoryId.title) return item.categoryId.title.trim().toLowerCase();
      }
      return String(item.categoryId).trim().toLowerCase();
    }
    const title = item.category || item.categoryTitle || item.serviceCategory;
    if (title && typeof title === 'string') {
      return title.trim().toLowerCase();
    }
    return '';
  };

  const isCategoryMatch = (itemA, itemB) => {
    const keyA = getCategoryKey(itemA);
    const keyB = getCategoryKey(itemB);
    if (keyA && keyB) {
      return keyA === keyB;
    }
    return true;
  };

  // Initialize config on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await api.get('/public/config');
        const charges = res.data?.settings?.visitedCharges;
        if (res.data?.success && charges !== undefined && charges !== null && !isNaN(Number(charges))) {
          setPlatformFeeRate(Number(charges));
        }
        const limit = res.data?.settings?.maxCartItemQuantity;
        if (res.data?.success && limit !== undefined && limit !== null && !isNaN(Number(limit))) {
          setMaxCartItemQuantity(Number(limit));
        }
      } catch (error) {
        console.error('Failed to fetch public config in CartProvider', error);
      }
    };
    fetchConfig();
  }, []);

  // Fetch cart from server (only on initial load)
  const fetchCart = useCallback(async () => {
    try {
      // Prevention: Do not fetch user cart if we are in vendor/admin/worker apps
      const path = window.location.pathname;
      if (path.startsWith('/vendor') || path.startsWith('/admin') || path.startsWith('/worker')) {
        return;
      }

      const token = localStorage.getItem('accessToken');
      if (!token) {
        setCartItems([]);
        setCartCount(0);
        setIsInitialized(true);
        return;
      }

      setIsLoading(true);
      const response = await cartService.getCart();
      if (response.success) {
        const items = response.data || [];
        setCartItems(items);
        setCartCount(items.length);
      }
    } catch (error) {
      // Silently handle auth errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        setCartItems([]);
        setCartCount(0);
      }
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, []);

  // Initialize cart on mount
  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Add item to cart - instant update + server sync
  const addToCart = useCallback(async (itemData, options = {}) => {
    // Guest access check
    const token = localStorage.getItem('accessToken');
    if (!token) {
      const confirmLogin = window.confirm('Please login first to book services. Would you like to login now?');
      if (confirmLogin) {
        window.location.href = '/user/login';
      }
      return { success: false, message: 'Authentication required' };
    }

    // ── CATEGORY VALIDATION ──
    // A customer can add multiple services to the cart only if all services belong to the same service category.
    if (!options?.skipCategoryCheck && cartItems.length > 0) {
      const isConflict = cartItems.some(existing => !isCategoryMatch(existing, itemData));
      if (isConflict) {
        return new Promise((resolve) => {
          setConflictModal({
            isOpen: true,
            pendingItemData: itemData,
            resolvePromise: resolve,
          });
        });
      }
    }

    // Check if the item already exists in the cart to avoid duplicate items
    const existingItem = cartItems.find(item => {
      const sId1 = typeof item.serviceId === 'object' ? (item.serviceId?._id || item.serviceId?.id) : item.serviceId;
      const sId2 = typeof itemData.serviceId === 'object' ? (itemData.serviceId?._id || itemData.serviceId?.id) : itemData.serviceId;
      if (sId1 && sId2) {
        return String(sId1) === String(sId2);
      }
      return item.title && itemData.title && item.title.trim().toLowerCase() === itemData.title.trim().toLowerCase();
    });

    const addedCount = itemData.serviceCount || 1;
    if (existingItem) {
      const existingId = existingItem._id || existingItem.id;
      const currentCount = existingItem.serviceCount || 1;
      if (currentCount + addedCount > maxCartItemQuantity) {
        toast.error(`Maximum quantity limit of ${maxCartItemQuantity} reached for this item.`);
        return { success: false, message: 'Quantity limit reached' };
      }

      // Optimistic update of the existing item
      setCartItems(prev => prev.map(item => {
        if (item._id === existingId || item.id === existingId) {
          const newCount = currentCount + addedCount;
          const unitPrice = item.unitPrice || (item.price / currentCount);
          return {
            ...item,
            serviceCount: newCount,
            price: unitPrice * newCount
          };
        }
        return item;
      }));

      // Lock check: if the existing item is still being created, wait for the real MongoDB ObjectId
      let targetId = existingId;
      if (typeof existingId === 'string' && existingId.startsWith('temp-')) {
        const idPromise = pendingCreations.current[existingId];
        if (idPromise) {
          const realId = await idPromise;
          if (realId) {
            targetId = realId;
          }
        }
      }

      // Mutation Queue: serialize requests on this item to prevent concurrent race conditions
      const previousOp = pendingOperations.current[targetId] || Promise.resolve();
      const currentOp = (async () => {
        try {
          await previousOp;
        } catch (e) {
          // Ignore
        }
        return cartService.addToCart(itemData);
      })();

      pendingOperations.current[targetId] = currentOp;

      try {
        const response = await currentOp;
        if (response.success && response.data) {
          const serverItem = Array.isArray(response.data)
            ? response.data.find(i => i._id === targetId || i.id === targetId || i.title === itemData.title)
            : response.data;
          
          if (serverItem) {
            setCartItems(prev => prev.map(item => 
              (item._id === targetId || item.id === targetId || item._id === existingId || item.id === existingId)
                ? { ...item, ...serverItem }
                : item
            ));
          } else {
            fetchCart();
          }
        } else {
          fetchCart();
        }
        return response;
      } catch (error) {
        fetchCart();
        throw error;
      }
    }

    // Item does not exist - proceed with optimistic addition
    if (addedCount > maxCartItemQuantity) {
      toast.error(`Maximum quantity limit is ${maxCartItemQuantity}`);
      return { success: false, message: 'Quantity limit reached' };
    }

    const tempId = `temp-${Date.now()}`;
    const tempItem = { 
      ...itemData, 
      _id: tempId, 
      id: tempId,
      serviceCount: addedCount,
      unitPrice: itemData.unitPrice || itemData.price,
      price: (itemData.unitPrice || itemData.price) * (itemData.serviceCount || 1)
    };

    setCartItems(prev => [...prev, tempItem]);
    setCartCount(prev => prev + 1);

    // Create a promise lock to track the real ObjectId once returned by the backend
    let resolveId;
    const idPromise = new Promise((resolve) => {
      resolveId = resolve;
    });
    pendingCreations.current[tempId] = idPromise;

    try {
      const response = await cartService.addToCart(itemData);

      if (response.success && response.data) {
        // Find the newly added item from the server response (which returns the full array of items)
        const serverItem = Array.isArray(response.data)
          ? response.data.find(i => i.title === itemData.title || (itemData.serviceId && (i.serviceId === itemData.serviceId || i.serviceId?._id === itemData.serviceId)))
          : response.data;

        const realId = serverItem?._id || serverItem?.id;

        // Replace temp item with real item from server, but preserve local fields (like category) just in case
        setCartItems(prev => prev.map(item =>
          item._id === tempId ? { ...item, ...(serverItem || {}) } : item
        ));
        
        resolveId(realId);
      } else {
        // Revert on failure (if success false but no throw)
        setCartItems(prev => prev.filter(item => item._id !== tempId));
        setCartCount(prev => Math.max(0, prev - 1));
        resolveId(null);
      }
      delete pendingCreations.current[tempId];
      console.log("CartContext.addToCart RETURN VALUE:", response);
      return response;
    } catch (error) {
      // Revert on error
      setCartItems(prev => prev.filter(item => item._id !== tempId));
      setCartCount(prev => Math.max(0, prev - 1));
      resolveId(null);
      delete pendingCreations.current[tempId];
      throw error;
    }
  }, [cartItems, fetchCart]);

  // Update item quantity
  const updateItem = useCallback(async (itemId, serviceCount) => {
    if (serviceCount > maxCartItemQuantity) {
      toast.error(`Maximum quantity limit is ${maxCartItemQuantity}`, { id: 'cart-limit' });
      return { success: false, message: 'Quantity limit reached' };
    }

    // Optimistic update
    setCartItems(prev =>
      prev.map(item => {
        if (item._id === itemId || item.id === itemId) {
          const unitPrice = item.unitPrice || (item.serviceCount ? item.price / item.serviceCount : item.price);
          return {
            ...item,
            serviceCount,
            price: unitPrice * serviceCount
          };
        }
        return item;
      })
    );

    // Resolve immediately for local changes to keep UI responsive, but debounce the actual backend sync
    // to prevent server spamming and race conditions
    return new Promise((resolve) => {
      const runSync = async () => {
        // Promise lock check: if this is a temporary item, wait for the backend to assign the real MongoDB ObjectId
        let targetId = itemId;
        if (typeof itemId === 'string' && itemId.startsWith('temp-')) {
          const idPromise = pendingCreations.current[itemId];
          if (idPromise) {
            const realId = await idPromise;
            if (!realId) {
              resolve({ success: false, message: 'Item creation failed' });
              return;
            }
            targetId = realId;
          }
        }

        console.log("Sending itemId:", targetId);
        console.log("typeof itemId:", typeof targetId);

        // Mutation Queue: serialize operations on this item to prevent concurrent race conditions
        const previousOp = pendingOperations.current[targetId] || Promise.resolve();
        const currentOp = (async () => {
          try {
            await previousOp;
          } catch (e) {
            // Ignore previous errors so they don't block subsequent actions
          }
          return cartService.updateItem(targetId, serviceCount);
        })();

        pendingOperations.current[targetId] = currentOp;

        try {
          const response = await currentOp;
          console.log("API Response:", response);
          if (response.success && response.data) {
            // Find the updated item from the server response (which returns the full array of items)
            const serverItem = Array.isArray(response.data)
              ? response.data.find(i => i._id === targetId || i.id === targetId)
              : response.data;

            if (serverItem) {
              setCartItems(prev =>
                prev.map(item => (item._id === targetId || item.id === targetId || item._id === itemId || item.id === itemId)
                  ? { ...item, ...serverItem }
                  : item
                )
              );
            } else {
              fetchCart();
            }
          } else {
            fetchCart();
          }
          resolve(response);
        } catch (error) {
          console.log("Caught Error:", error);
          console.log("Axios Response:", error?.response);
          console.log("Axios Data:", error?.response?.data);
          fetchCart();
          resolve({ success: false, error });
        }
      };

      if (debounceTimers.current[itemId]) {
        clearTimeout(debounceTimers.current[itemId]);
      }

      debounceTimers.current[itemId] = setTimeout(runSync, 400);

      // Resolve early to prevent blocking the UI, but let the backend sync finish in the background
      resolve({ success: true });
    });
  }, [fetchCart, maxCartItemQuantity]);

  // Remove item from cart - instant update
  const removeItem = useCallback(async (itemId) => {
    // Optimistic update
    setCartItems(prev => prev.filter(item => item._id !== itemId && item.id !== itemId));
    setCartCount(prev => Math.max(0, prev - 1));

    // Promise lock check: if this is a temporary item, wait for the backend to assign the real MongoDB ObjectId
    let targetId = itemId;
    if (typeof itemId === 'string' && itemId.startsWith('temp-')) {
      const idPromise = pendingCreations.current[itemId];
      if (idPromise) {
        const realId = await idPromise;
        if (!realId) {
          return { success: true, message: 'Item already removed' };
        }
        targetId = realId;
      }
    }

    console.log("Sending itemId:", targetId);
    console.log("typeof itemId:", typeof targetId);

    // Mutation Queue: serialize operations on this item to prevent concurrent race conditions
    const previousOp = pendingOperations.current[targetId] || Promise.resolve();
    const currentOp = (async () => {
      try {
        await previousOp;
      } catch (e) {
        // Ignore previous errors so they don't block subsequent actions
      }
      return cartService.removeItem(targetId);
    })();

    pendingOperations.current[targetId] = currentOp;

    try {
      const response = await currentOp;
      console.log("API Response:", response);
      if (!response.success) {
        // Re-fetch on failure to ensure correct state
        fetchCart();
      }
      return response;
    } catch (error) {
      console.log("Caught Error:", error);
      console.log("Axios Response:", error?.response);
      console.log("Axios Data:", error?.response?.data);
      fetchCart();
      throw error;
    }
  }, [fetchCart]);

  // Remove all items from a category
  const removeCategoryItems = useCallback(async (category) => {
    // Optimistic update
    setCartItems(prev => {
      const filtered = prev.filter(item => item.category !== category);
      setCartCount(filtered.length);
      return filtered;
    });

    try {
      const response = await cartService.removeCategoryItems(category);
      if (!response.success) {
        fetchCart();
      }
      return response;
    } catch (error) {
      fetchCart();
      throw error;
    }
  }, [fetchCart]);

  // Clear entire cart
  const clearCart = useCallback(async () => {
    try {
      const response = await cartService.clearCart();
      if (response.success) {
        setCartItems([]);
        setCartCount(0);
      }
      return response;
    } catch (error) {
      throw error;
    }
  }, []);

  // Reset cart (for logout)
  const flushCartUpdates = useCallback(async () => {
    Object.keys(debounceTimers.current).forEach(itemId => {
      if (debounceTimers.current[itemId]) {
        clearTimeout(debounceTimers.current[itemId]);
        delete debounceTimers.current[itemId];
      }
    });

    const pendingOps = Object.values(pendingOperations.current);
    if (pendingOps.length > 0) {
      await Promise.allSettled(pendingOps);
    }
  }, []);

  const resetCart = useCallback(() => {
    setCartItems([]);
    setCartCount(0);
    setIsInitialized(false);
  }, []);

  // Modal Action Handlers for Category Conflict
  const handleReplaceCart = async () => {
    const itemToAdd = conflictModal.pendingItemData;
    const resolve = conflictModal.resolvePromise;

    setConflictModal({ isOpen: false, pendingItemData: null, resolvePromise: null });

    if (!itemToAdd) return;

    try {
      // 1. Remove all existing cart items
      await clearCart();

      // 2. Add the newly selected service
      const res = await addToCart(itemToAdd, { skipCategoryCheck: true });

      // 3. Show success message
      toast.success("Cart updated successfully.");

      if (resolve) {
        resolve({ success: true, replaced: true, data: res?.data });
      }
    } catch (error) {
      toast.error("Failed to update cart");
      if (resolve) {
        resolve({ success: false, error });
      }
    }
  };

  const handleCancelConflict = () => {
    const resolve = conflictModal.resolvePromise;

    setConflictModal({ isOpen: false, pendingItemData: null, resolvePromise: null });

    if (resolve) {
      resolve({ success: false, cancelled: true, message: 'Cart unchanged' });
    }
  };

  const value = {
    cartItems,
    cartCount,
    isLoading,
    isInitialized,
    platformFeeRate,
    maxCartItemQuantity,
    fetchCart,
    addToCart,
    updateItem,
    removeItem,
    removeCategoryItems,
    clearCart,
    resetCart,
    flushCartUpdates,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
      <CategoryConflictModal
        isOpen={conflictModal.isOpen}
        onReplace={handleReplaceCart}
        onCancel={handleCancelConflict}
      />
    </CartContext.Provider>
  );
};

// Custom hook to use cart context
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export default CartContext;
