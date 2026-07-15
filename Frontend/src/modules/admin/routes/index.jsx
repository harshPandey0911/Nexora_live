import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import ProtectedRoute from '../../../components/auth/ProtectedRoute';
import PublicRoute from '../../../components/auth/PublicRoute';
import Login from '../pages/Login';

// Lazy loaded pages
const Dashboard = lazy(() => import('../pages/Dashboard'));
const Users = lazy(() => import('../pages/Users'));
const Vendors = lazy(() => import('../pages/Vendors'));
const UserCategories = lazy(() => import('../pages/UserCategories'));
const Bookings = lazy(() => import('../pages/Bookings'));
const Tracking = lazy(() => import('../pages/Bookings/Tracking'));
const BookingNotifications = lazy(() => import('../pages/Bookings/BookingNotifications'));
const Payments = lazy(() => import('../pages/Payments'));
const Settlements = lazy(() => import('../pages/Settlements'));
const Reports = lazy(() => import('../pages/Reports'));
const FooterLinks = lazy(() => import('../pages/FooterLinks'));
const Reviews = lazy(() => import('../pages/Reviews'));
const Plans = lazy(() => import('../pages/Plans/Plans'));
const Commission = lazy(() => import('../pages/Commission'));
const OfferBanners = lazy(() => import('../pages/OfferBanners'));
const Support = lazy(() => import('../pages/Support'));
const TrainingManagement = lazy(() => import('../pages/TrainingManagement'));
const Settings = lazy(() => import('../pages/Settings'));

// User App Config Pages
const HomePage = lazy(() => import('../pages/UserCategories/pages/HomePage'));
const CategoriesPage = lazy(() => import('../pages/UserCategories/pages/CategoriesPage'));
const ServicesPage = lazy(() => import('../pages/UserCategories/pages/ServicesPage'));
const BrandsPage = lazy(() => import('../pages/UserCategories/pages/BrandsPage'));

// Vendor Specific Catalog Pages
const VendorServicesPage = lazy(() => import('../pages/UserCategories/pages/VendorServicesPage'));
const VendorPartsPage = lazy(() => import('../pages/UserCategories/pages/VendorPartsPage'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">Loading Nexora Admin...</p>
    </div>
  </div>
);

const AdminRoutes = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Login route - outside of layout (public) */}
        <Route path="login" element={<PublicRoute userType="admin"><Login /></PublicRoute>} />

        {/* Protected routes - inside layout */}
        <Route path="" element={
          <ProtectedRoute userType="admin">
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          
          {/* Catalog Routes */}
          <Route path="user-categories/vendor-services" element={<VendorServicesPage />} />
          <Route path="user-categories/vendor-parts" element={<VendorPartsPage />} />
          
          <Route path="user-categories/*" element={<UserCategories />}>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<HomePage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="sections" element={<ServicesPage />} />
            <Route path="brands" element={<BrandsPage />} />
          </Route>
          
          {/* Management Routes */}
          <Route path="users/*" element={<Users />} />
          <Route path="vendors/*" element={<Vendors />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="bookings/tracking" element={<Tracking />} />
          <Route path="bookings/notifications" element={<BookingNotifications />} />
          <Route path="bookings/:id" element={<Bookings />} />
          <Route path="payments/*" element={<Payments />} />
          <Route path="settlements/*" element={<Settlements />} />
          <Route path="reports/*" element={<Reports />} />
          <Route path="footer-links" element={<FooterLinks />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="plans" element={<Plans />} />
          <Route path="commission" element={<Commission />} />
          <Route path="offer-banners" element={<OfferBanners />} />
          <Route path="support" element={<Support />} />
          <Route path="training" element={<TrainingManagement />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* 404 Redirect */}
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AdminRoutes;
