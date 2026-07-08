import React, { useEffect } from 'react'; // Updated index to .jsx
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import AppRoutes from './routes';
import { SocketProvider } from './context/SocketContext';
import { CartProvider } from './context/CartContext';
import { CityProvider } from './context/CityContext';
import { AuthProvider } from './context/AuthContext';
import { initializePushNotifications, setupForegroundNotificationHandler } from './services/pushNotificationService';
import { LocationPermissionChecker } from './components/common';

function App() {
  // Initialize push notifications on app load
  useEffect(() => {
    initializePushNotifications();

    // Setup foreground notification handler
    setupForegroundNotificationHandler((payload) => {
      // console.log('📬 Notification received:', payload);

      // Dispatch update events for listening components to refresh UI
      window.dispatchEvent(new Event('vendorJobsUpdated'));
      window.dispatchEvent(new Event('vendorStatsUpdated'));
      window.dispatchEvent(new Event('workerJobsUpdated'));
      window.dispatchEvent(new Event('userBookingsUpdated'));

      // Also dispatch generic one if needed
      window.dispatchEvent(new Event('appNotificationReceived'));

      // Show toast specifically for test notifications in foreground
      if (payload.data?.type === 'test' || payload.notification?.title?.includes('Test')) {
        toast(payload.notification?.body || 'Test notification received!', {
          icon: '🔔',
          duration: 4000,
          style: {
            background: '#1E3A8A',
            color: '#fff',
            fontWeight: 'bold',
            borderRadius: '12px'
          }
        });

        // Force native browser notification to display in foreground
        if ('Notification' in window && Notification.permission === 'granted') {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(payload.notification?.title || '🔔 Test Notification', {
              body: payload.notification?.body || 'This is a test notification from Appzeto!',
              icon: '/cleaning-expert-logo.png',
              tag: 'test-notification',
              renotify: true
            });
          }).catch(err => console.error('SW ready failed:', err));
        }
      }
    });
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <CityProvider>
            <CartProvider>
              <div className="App">
                <AppRoutes />
                <LocationPermissionChecker />
                <Toaster
                  position="top-center"
                  reverseOrder={false}
                  toastOptions={{
                    duration: 2000, // Global default (reduced from 3000)
                    style: {
                      background: '#333',
                      color: '#fff',
                      borderRadius: '10px',
                      padding: '12px 20px',
                    },
                    success: {
                      duration: 1000, // 1 second as requested
                      style: {
                        background: '#10B981',
                      },
                    },
                    error: {
                      duration: 2000, // Reduced from 4000
                      style: {
                        background: '#EF4444',
                      },
                    },
                  }}
                />
              </div>
            </CartProvider>
          </CityProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
