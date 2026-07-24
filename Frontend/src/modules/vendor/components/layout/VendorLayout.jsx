import React, { useState, useEffect } from 'react';
import VendorSidebar from './VendorSidebar';
import VendorBottomNav from './VendorBottomNav';
import { useLocation } from 'react-router-dom';
import Header from './Header';

const VendorLayout = ({ children }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isAuthRoute = location.pathname === '/vendor/login' || 
                     location.pathname === '/vendor/signup' || 
                     location.pathname === '/vendor/training' ||
                     location.pathname === '/vendor/forgot-password' ||
                     location.pathname.includes('/vendor/reset-password');

  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isAuthRoute) {
    return children;
  }

  // Dynamic Title Logic
  const getPageInfo = (pathname) => {
    const mappings = [
      { path: '/vendor/dashboard', title: 'Dashboard' },
      { path: '/vendor/jobs', title: 'Service Bookings' },
      { path: '/vendor/product-orders', title: 'Product Orders' },
      { path: '/vendor/my-services', title: 'Manage Services' },
      { path: '/vendor/my-products', title: 'Manage Products' },
      { path: '/vendor/earnings', title: 'Revenue Analytics' },
      { path: '/vendor/wallet', title: 'Financial Ledger' },
      { path: '/vendor/my-ratings', title: 'Performance Ratings' },
      { path: '/vendor/notifications', title: 'Alert Hub' },
      { path: '/vendor/settings', title: 'Store Settings' },
      { path: '/vendor/profile', title: 'Profile Settings' },
      { path: '/vendor/support', title: 'Support Center' },
    ];

    const match = mappings.find(m => pathname === m.path || pathname.startsWith(m.path + '/'));
    return match?.title || 'Vendor Hub';
  };

  const currentTitle = getPageInfo(location.pathname);

  // Check if current page is a detail/sub page (they have their own dedicated headers)
  const isDetailPage = location.pathname.includes('/vendor/booking/') || 
                       location.pathname.includes('/vendor/profile') ||
                       location.pathname.includes('/vendor/address-management') ||
                       location.pathname.includes('/vendor/support/ticket/') ||
                       location.pathname.includes('/vendor/wallet/') ||
                       location.pathname.includes('/vendor/billing') ||
                       location.pathname.includes('/vendor/withdrawal') ||
                       location.pathname.includes('/vendor/privacy-policy') ||
                       location.pathname.includes('/vendor/terms-conditions');

  // Permission Check
  const checkPermission = () => {
    try {
      const data = localStorage.getItem('vendorData');
      const vendor = data ? JSON.parse(data) : null;
      // If no permissions array (old user), allow all
      if (!vendor?.permissions || vendor.permissions.length === 0) return true;
      
      const routeToPerm = {
        '/vendor/dashboard': 'dashboard',
        '/vendor/jobs': 'orders',
        '/vendor/product-orders': 'product-orders',
        '/vendor/my-services': 'services',
        '/vendor/my-products': 'manage-products',
        '/vendor/earnings': 'earnings',
        '/vendor/wallet': 'wallet',
        '/vendor/my-ratings': 'reviews',
        '/vendor/notifications': 'notifications',
        '/vendor/settings': 'store-settings',
        '/vendor/profile': 'profile-settings',
        '/vendor/support': 'support'
      };

      const matchedRoute = Object.keys(routeToPerm).find(route => location.pathname.startsWith(route));
      if (matchedRoute) {
        return vendor.permissions.includes(routeToPerm[matchedRoute]);
      }
      return true;
    } catch (e) {
      return true;
    }
  };

  const hasPermission = checkPermission();

  return (
    <div className="h-screen bg-gray-50 flex text-gray-900 overflow-hidden">
      <VendorSidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col ml-0 lg:ml-[278px] min-w-0 max-w-full transition-all duration-300 relative pb-16 lg:pb-0">
        {!isDetailPage && (
          <Header 
            title={currentTitle} 
            showBack={false} 
            showNotifications={true} 
            showOnlineToggle={true}
            onMenuClick={() => setSidebarOpen(true)}
          />
        )}
        
        <main className={`flex-1 overflow-y-auto overflow-x-hidden scrollbar-admin w-full min-w-0 ${!isDetailPage ? 'pt-24' : ''}`}>
          <div className={`min-w-0 w-full ${location.pathname.includes('/vendor/booking/') ? '' : 'p-3 lg:p-6'}`}>
            {hasPermission ? children : (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
                <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-6">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-8l-2-2m0 0L10 7m2-2v2m6 4H6a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2v-6a2 2 0 00-2-2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-medium text-gray-900 mb-2 tracking-tight">Restricted Access</h3>
                <p className="text-gray-500 max-w-md mx-auto text-sm leading-relaxed mb-8">
                  You do not have permission to access the <span className="font-normal text-gray-800">{currentTitle}</span> module. 
                  Please contact the administrator to request access.
                </p>
                <button 
                  onClick={() => window.location.href = '/vendor/dashboard'}
                  className="px-8 py-3 bg-[#0D9488] text-white rounded-xl font-normal hover:shadow-lg transition-all text-sm"
                >
                  Return to Dashboard
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
      <VendorBottomNav onMenuClick={() => setSidebarOpen(true)} />
    </div>
  );
};

export default VendorLayout;
