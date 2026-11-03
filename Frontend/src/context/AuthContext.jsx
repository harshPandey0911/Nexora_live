import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(() => {
    try {
      const userData = localStorage.getItem('userData');
      const token = localStorage.getItem('accessToken');
      if (userData && token) {
        setUser(JSON.parse(userData));
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
    
    // Listen for storage changes (e.g. from other tabs or manual changes)
    const handleStorage = () => loadUser();
    window.addEventListener('storage', handleStorage);
    
    // Custom event for immediate updates within the same tab
    window.addEventListener('userAuthUpdated', handleStorage);
    
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('userAuthUpdated', handleStorage);
    };
  }, [loadUser]);

  const login = useCallback((userData, token) => {
    localStorage.setItem('userData', JSON.stringify(userData));
    localStorage.setItem('accessToken', token);
    setUser(userData);
    window.dispatchEvent(new Event('userAuthUpdated'));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('userData');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    window.dispatchEvent(new Event('userAuthUpdated'));
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser: loadUser }),
    [user, loading, login, logout, loadUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
