/**
 * Push Notification Service
 * Handles FCM token registration and notification handling
 */

import { messaging, getToken, onMessage } from '../firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/**
 * Check if running inside Flutter WebView
 * @returns {boolean}
 */
function isFlutterWebView() {
  return !!(window.flutter_inappwebview && window.flutter_inappwebview.callHandler);
}

/**
 * Get the current platform type
 * @returns {'web' | 'mobile'}
 */
function getPlatformType() {
  return isFlutterWebView() ? 'mobile' : 'web';
}

/**
 * Register service worker for push notifications
 * @returns {Promise<ServiceWorkerRegistration>}
 */
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      // console.log('✅ Service Worker registered:', registration.scope);
      return registration;
    } catch (error) {
      // console.error('❌ Service Worker registration failed:', error);
      throw error;
    }
  } else {
    throw new Error('Service Workers are not supported in this browser');
  }
}

/**
 * Request notification permission from user
 * @returns {Promise<boolean>}
 */
async function requestNotificationPermission() {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // console.log('✅ Notification permission granted');
      return true;
    } else {
      // console.log('❌ Notification permission denied');
      return false;
    }
  }
  // console.log('❌ Notifications not supported');
  return false;
}

/**
 * Get FCM token from Firebase
 * @returns {Promise<string|null>}
 */
async function getFCMToken() {
  try {
    if (!messaging) {
      // console.error('Firebase messaging not initialized');
      return null;
    }

    const registration = await registerServiceWorker();
    await registration.update(); // Update service worker

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (token) {
      // console.log('✅ FCM Token obtained:', token.substring(0, 20) + '...');
      return token;
    } else {
      // console.log('❌ No FCM token available');
      return null;
    }
  } catch (error) {
    // console.error('❌ Error getting FCM token:', error);
    throw error;
  }
}

/**
 * Register FCM token with backend
 * @param {string} userType - 'user', 'vendor', or 'worker'
 * @param {boolean} forceUpdate - Force token update
 * @returns {Promise<string|null>}
 */
async function registerFCMToken(userType = 'user', forceUpdate = false) {
  try {
    // Check if already registered
    const storageKey = `fcm_token_${userType}_web`;
    const savedToken = localStorage.getItem(storageKey);
    if (savedToken && !forceUpdate) {
      return savedToken;
    }

    // Request permission
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.warn('[FCM] Notification permission denied by browser settings (e.g. Incognito Mode). Web push notifications are disabled.');
      return null;
    }

    // Get token
    const token = await getFCMToken();
    if (!token) {
      throw new Error('Failed to get push token from Firebase. Check your internet connection or Firebase config.');
    }

    // Determine API endpoint based on user type
    let endpoint;
    let authTokenKey;
    switch (userType) {
      case 'vendor':
        endpoint = '/vendors/fcm-tokens/save';
        authTokenKey = 'vendorAccessToken';
        break;
      case 'worker':
        endpoint = '/workers/fcm-tokens/save';
        authTokenKey = 'workerAccessToken';
        break;
      case 'user':
        endpoint = '/users/fcm-tokens/save';
        authTokenKey = 'accessToken';
        break;
      default:
        endpoint = '/users/fcm-tokens/save';
        authTokenKey = 'accessToken';
    }

    // Get auth token
    const authToken = localStorage.getItem(authTokenKey);
    if (!authToken) {
      throw new Error('User not logged in. Please sign in and try again.');
    }

    // Save to backend
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        token: token,
        platform: 'web'
      })
    });

    if (response.ok) {
      localStorage.setItem(storageKey, token);
      return token;
    } else {
      let errMsg = 'Failed to save notification token on server';
      try {
        const error = await response.json();
        errMsg = error.error || error.message || errMsg;
      } catch (e) {}
      throw new Error(errMsg);
    }
  } catch (error) {
    console.error('[FCM] ❌ Error registering FCM token:', error);
    throw error;
  }
}

/**
 * Remove FCM token from backend (removes specific token for current device)
 * @param {string} userType - 'user', 'vendor', or 'worker'
 */
async function removeFCMToken(userType = 'user') {
  try {
    // Detect platform automatically
    const platform = getPlatformType();
    const storageKey = `fcm_token_${userType}_${platform}`;
    const tokenToRemove = localStorage.getItem(storageKey);

    if (!tokenToRemove) {
      // console.log('[FCM] No token found in localStorage to remove');
      return;
    }

    // console.log(`[FCM] Removing ${platform} token for ${userType}...`);

    // Determine API endpoint based on user type
    let endpoint;
    let authTokenKey;
    switch (userType) {
      case 'vendor':
        endpoint = '/vendors/fcm-tokens/remove';
        authTokenKey = 'vendorAccessToken';
        break;
      case 'worker':
        endpoint = '/workers/fcm-tokens/remove';
        authTokenKey = 'workerAccessToken';
        break;
      default:
        endpoint = '/users/fcm-tokens/remove';
        authTokenKey = 'accessToken';
    }

    const authToken = localStorage.getItem(authTokenKey);
    // If we have an auth token, try to remove from backend
    if (authToken) {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

      // Call remove endpoint with specific token
      await fetch(`${baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          token: tokenToRemove,
          platform: platform
        })
      });
      console.log(`[FCM] ✅ Token removed from backend`);
    }

    // Always remove from local storage
    localStorage.removeItem(storageKey);
    console.log(`[FCM] Token cleared from localStorage`);
  } catch (error) {
    console.error('[FCM] Error removing FCM token:', error);
    // Ensure local cleanup happens even on error
    const platform = getPlatformType();
    const storageKey = `fcm_token_${userType}_${platform}`;
    localStorage.removeItem(storageKey);
  }
}

/**
 * Setup foreground notification handler
 * @param {Function} handler - Custom handler function
 */
function setupForegroundNotificationHandler(handler) {
  if (!messaging) {
    // console.error('Firebase messaging not initialized');
    return;
  }

  onMessage(messaging, (payload) => {
    // console.log('📬 Foreground message received:', payload);

    const data = payload.data || {};
    const notification = payload.notification || {};

    // Use notification fields first, then data fields as fallback (for data-only messages)
    const title = notification.title || data.title || 'New Notification';
    const body = notification.body || data.body || '';
    const icon = notification.icon || data.icon || '/HomeBuddy-header-logo.png';
    const type = data.type || data.notificationType || 'default';

    // Call custom handler (e.g. for toast)
    if (handler) {
      handler(payload);
    }
  });
}

/**
 * Initialize push notifications
 * Call this on app load
 */
async function initializePushNotifications() {
  try {
    if (!('serviceWorker' in navigator)) {
      // console.log('Service workers not supported');
      return;
    }

    if (!('Notification' in window)) {
      // console.log('Notifications not supported');
      return;
    }

    await registerServiceWorker();
    // console.log('✅ Push notifications initialized');
  } catch (error) {
    // console.error('Error initializing push notifications:', error);
  }
}

/**
 * Trigger a test push notification
 * @returns {Promise<Object>}
 */
async function testPushNotification() {
  try {
    const token = await registerFCMToken('user', true);
    if (!token) {
      throw new Error('FCM token registration failed. Please allow notification permission.');
    }

    const authToken = localStorage.getItem('accessToken');
    if (!authToken) {
      throw new Error('Authentication token not found. Please log in first.');
    }

    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    const response = await fetch(`${baseUrl}/users/fcm-tokens/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Server failed to send test notification');
    }
    return data;
  } catch (error) {
    console.error('[FCM Test] Error:', error);
    throw error;
  }
}

export {
  initializePushNotifications,
  registerFCMToken,
  removeFCMToken,
  setupForegroundNotificationHandler,
  requestNotificationPermission,
  getFCMToken,
  testPushNotification
};
