import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import PageTransition from '../components/common/PageTransition';
import ErrorBoundary from '../components/common/ErrorBoundary';
import ProtectedRoute from '../../../components/auth/ProtectedRoute';
import PublicRoute from '../../../components/auth/PublicRoute';
import CashLimitModal from '../components/common/CashLimitModal';
import GlobalBookingAlert from '../components/common/GlobalBookingAlert';
import LogoLoader from '../../../components/common/LogoLoader';
import VendorLayout from '../components/layout/VendorLayout';
import { useAuth } from '../../../context/AuthContext';

const lazyLoad = (importFunc) => {
  return lazy(() => {
    return Promise.resolve(importFunc()).catch((error) => {
      console.error('Failed to load vendor page:', error);
      return Promise.resolve({
        default: () => (
          <div className="flex items-center justify-center min-h-screen bg-white">
            <div className="text-center p-6">
              <h2 className="text-xl font-normal text-gray-800 mb-2">Failed to load page</h2>
              <p className="text-gray-600 mb-4">Please refresh the page or try again later.</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 rounded-xl text-white font-medium transition-all duration-300 hover:opacity-90"
                style={{ backgroundColor: '#347989' }}
              >
                Refresh Page
              </button>
            </div>
          </div>
        ),
      });
    });
  });
};

const Login = lazyLoad(() => import('../pages/login'));
const Signup = lazyLoad(() => import('../pages/signup'));
const Training = lazyLoad(() => import('../pages/Training'));
const ForgotPassword = lazyLoad(() => import('../pages/forgotPassword'));
const ResetPassword = lazyLoad(() => import('../pages/resetPassword'));
const Dashboard = lazyLoad(() => import('../pages/Dashboard'));
const BookingAlert = lazyLoad(() => import('../pages/BookingAlert'));
const BookingAlerts = lazyLoad(() => import('../pages/BookingAlerts'));
const BookingDetails = lazyLoad(() => import('../pages/BookingDetails'));
const BookingTimeline = lazyLoad(() => import('../pages/BookingTimeline'));
const ActiveJobs = lazyLoad(() => import('../pages/ActiveJobs'));
const ProductOrders = lazyLoad(() => import('../pages/ProductOrders'));
const Earnings = lazyLoad(() => import('../pages/Earnings'));
const Wallet = lazyLoad(() => import('../pages/Wallet'));
const WithdrawalRequest = lazyLoad(() => import('../pages/WithdrawalRequest'));
const Profile = lazyLoad(() => import('../pages/Profile'));
const ProfileDetails = lazyLoad(() => import('../pages/Profile/ProfileDetails'));
const EditProfile = lazyLoad(() => import('../pages/Profile/EditProfile'));
const BookingMap = lazyLoad(() => import('../pages/BookingMap'));
const Settings = lazyLoad(() => import('../pages/Settings'));
const AddressManagement = lazyLoad(() => import('../pages/AddressManagement'));
const Notifications = lazyLoad(() => import('../pages/Notifications'));
const SettlementRequest = lazyLoad(() => import('../pages/Wallet/SettlementRequest'));
const SettlementHistory = lazyLoad(() => import('../pages/Wallet/SettlementHistory'));
const MyRatings = lazyLoad(() => import('../pages/MyRatings'));
const AboutCleaningExpert = lazyLoad(() => import('../pages/AboutCleaningExpert'));
const BillingPage = lazyLoad(() => import('../pages/BillingPage'));
const SupportList = lazyLoad(() => import('../pages/Support/index'));
const TicketDetails = lazyLoad(() => import('../pages/Support/TicketDetails'));
const MyServices = lazyLoad(() => import('../pages/MyServices'));
const MyProducts = lazyLoad(() => import('../pages/MyProducts'));
const AddCustomContent = lazyLoad(() => import('../pages/AddCustomContent'));
const WorkersList = lazyLoad(() => import('../pages/WorkersList'));
const AddEditWorker = lazyLoad(() => import('../pages/AddEditWorker'));
const AssignWorker = lazyLoad(() => import('../pages/AssignWorker'));
const Subscribe = lazyLoad(() => import('../pages/Subscribe/Subscribe'));

const LoadingFallback = () => (
  <LogoLoader />
);

const SubscriptionGuard = ({ children }) => {
  const vendorDataRaw = localStorage.getItem('vendorData');
  const vendor = vendorDataRaw ? JSON.parse(vendorDataRaw) : null;
  if (vendor && (!vendor.subscription || vendor.subscription.status !== 'active')) {
    return <Navigate to="/vendor/subscribe" replace />;
  }
  return children;
};

const SubscribeGuard = ({ children }) => {
  const vendorDataRaw = localStorage.getItem('vendorData');
  const vendor = vendorDataRaw ? JSON.parse(vendorDataRaw) : null;
  if (vendor && vendor.subscription && vendor.subscription.status === 'active') {
    return <Navigate to="/vendor/dashboard" replace />;
  }
  return children;
};

const VendorRoutes = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<PublicRoute userType="vendor"><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute userType="vendor"><Signup /></PublicRoute>} />
          <Route path="/training" element={<PublicRoute userType="vendor"><Training /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute userType="vendor"><ForgotPassword /></PublicRoute>} />
          <Route path="/reset-password/:token" element={<PublicRoute userType="vendor"><ResetPassword /></PublicRoute>} />

          {/* Subscription payment screen */}
          <Route path="/subscribe" element={<ProtectedRoute userType="vendor"><SubscribeGuard><Subscribe /></SubscribeGuard></ProtectedRoute>} />

          {/* Protected routes wrapped in layout & subscription check */}
          <Route path="/*" element={
            <ProtectedRoute userType="vendor">
              <SubscriptionGuard>
                <VendorLayout>
                  <PageTransition>
                    <Routes>
                      <Route path="/" element={<Navigate to="dashboard" replace />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/booking-alerts" element={<BookingAlerts />} />
                      <Route path="/booking-alert/:id" element={<BookingAlert />} />
                      <Route path="/booking/:id" element={<BookingDetails />} />
                      <Route path="/booking/:id/assign-worker" element={<AssignWorker />} />
                      <Route path="/booking/:id/map" element={<BookingMap />} />
                      <Route path="/booking/:id/billing" element={<BillingPage />} />
                      <Route path="/booking/:id/timeline" element={<BookingTimeline />} />
                      <Route path="/jobs" element={<ActiveJobs />} />
                      <Route path="/product-orders" element={<ProductOrders />} />
                      <Route path="/earnings" element={<Earnings />} />
                      <Route path="/wallet" element={<Wallet />} />
                      <Route path="/wallet/withdraw" element={<WithdrawalRequest />} />
                      <Route path="/wallet/settle" element={<SettlementRequest />} />
                      <Route path="/wallet/settlements" element={<SettlementHistory />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/profile/details" element={<ProfileDetails />} />
                      <Route path="/profile/edit" element={<EditProfile />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/address-management" element={<AddressManagement />} />
                      <Route path="/notifications" element={<Notifications />} />
                      <Route path="/my-ratings" element={<MyRatings />} />
                      <Route path="/about-cleaning-expert" element={<AboutCleaningExpert />} />
                      <Route path="/my-services" element={<MyServices />} />
                      <Route path="/my-products" element={<MyProducts />} />
                      <Route path="/add-custom-content" element={<AddCustomContent />} />
                      <Route path="/product/edit/:id" element={<AddCustomContent />} />
                      <Route path="/workers" element={<WorkersList />} />
                      <Route path="/workers/new" element={<AddEditWorker />} />
                      <Route path="/workers/edit/:id" element={<AddEditWorker />} />
                      <Route path="/support" element={<SupportList />} />
                      <Route path="/support/:id" element={<TicketDetails />} />
                      <Route path="*" element={<Navigate to="/vendor/dashboard" replace />} />
                    </Routes>
                  </PageTransition>
                </VendorLayout>
              </SubscriptionGuard>
            </ProtectedRoute>
          } />
        </Routes>
      </Suspense>
      <CashLimitModal />
      <GlobalBookingAlert />
    </ErrorBoundary>
  );
};

export default VendorRoutes;
