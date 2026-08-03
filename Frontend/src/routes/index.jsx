import React from 'react';
import { Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';

// Import module routes
import UserRoutes from '../modules/user/routes';
import VendorRoutes from '../modules/vendor/routes';
import AdminRoutes from '../modules/admin/routes';
import WorkerRoutes from '../modules/worker/routes';

import LandingPage from '../modules/landing/pages/LandingPage';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Landing Page */}
      <Route path="/Home" element={<LandingPage />} />

      {/* Redirect Root Slash to User App */}
      <Route path="/" element={<Navigate to="/user" replace />} />

      {/* User Routes */}
      <Route path="/user/*" element={<UserRoutes />} />

      {/* Vendor Routes */}
      <Route path="/vendor/*" element={<VendorRoutes />} />

      {/* Worker Routes */}
      <Route path="/worker/*" element={<WorkerRoutes />} />

      {/* Admin Routes */}
      <Route path="/admin/*" element={<AdminRoutes />} />

      {/* Root Fallback Reset Password Routes */}
      <Route path="/reset-password/:token" element={<UserResetRedirect />} />
      <Route path="/reset-password" element={<UserResetRedirect />} />
    </Routes>
  );
};

const UserResetRedirect = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const activeToken = token || searchParams.get('token') || '';
  return <Navigate to={`/user/reset-password/${activeToken}`} replace />;
};

export default AppRoutes;

