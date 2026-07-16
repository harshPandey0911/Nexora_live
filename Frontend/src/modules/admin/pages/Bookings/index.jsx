import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AllBookings from './AllBookings';
import Tracking from './Tracking';
import BookingNotifications from './BookingNotifications';
import ManualAssignment from './ManualAssignment';

const Bookings = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="all" replace />} />
      <Route path="all" element={<AllBookings />} />
      <Route path="all/:id" element={<AllBookings />} />
      <Route path="tracking" element={<Tracking />} />
      <Route path="notifications" element={<BookingNotifications />} />
      <Route path="manual" element={<ManualAssignment />} />
      <Route path="*" element={<Navigate to="/admin/bookings/all" replace />} />
    </Routes>
  );
};

export default Bookings;
