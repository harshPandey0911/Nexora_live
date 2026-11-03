import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const STORAGE_KEYS = {
  user: { token: 'accessToken', refresh: 'refreshToken', data: 'userData' },
  vendor: { token: 'vendorAccessToken', refresh: 'vendorRefreshToken', data: 'vendorData' },
  worker: { token: 'workerAccessToken', refresh: 'workerRefreshToken', data: 'workerData' },
  admin: { token: 'adminAccessToken', refresh: 'adminRefreshToken', data: 'adminData' },
};

const readKey = (key) => sessionStorage.getItem(key) || localStorage.getItem(key);

const clearAuthData = ({ token, refresh, data }) => {
  [token, refresh, data].forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
};

/**
 * Synchronous auth check (it only reads storage), so no loading state / spinner is needed.
 * Returns true when the user may proceed, false otherwise.
 */
const checkAuth = (userType) => {
  const keys = STORAGE_KEYS[userType] || STORAGE_KEYS.user;
  const token = readKey(keys.token);
  const refreshToken = readKey(keys.refresh);
  const userData = readKey(keys.data);

  if (!token || !userData) return false;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const payload = JSON.parse(atob(parts[1]));
    const currentTime = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp > currentTime) return true;

    // Access token expired but a refresh token exists: let the request through.
    // The axios interceptor in api.js refreshes on the first failing request and logs out if that fails.
    if (refreshToken) return true;

    // Truly expired and no way to refresh
    clearAuthData(keys);
    return false;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
};

/**
 * Protected Route Component
 * Checks if user is authenticated before allowing access
 */
const ProtectedRoute = ({ children, userType = 'user', redirectTo = null }) => {
  const location = useLocation();

  if (checkAuth(userType)) {
    return children;
  }

  const defaultRedirects = {
    user: '/user/login',
    vendor: '/vendor/login',
    worker: '/worker/login',
    admin: '/admin/login'
  };

  const redirectPath = redirectTo || defaultRedirects[userType] || '/user/login';

  return <Navigate to={redirectPath} state={{ from: location }} replace />;
};

export default ProtectedRoute;
