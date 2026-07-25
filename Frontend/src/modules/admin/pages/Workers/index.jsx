import React from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUsers, FiClock, FiActivity, FiDollarSign } from 'react-icons/fi';

// Import sub-components
// Import sub-components
import AllWorkers from './AllWorkers';
import WorkerJobs from './WorkerJobs';
import WorkerAnalytics from './WorkerAnalytics';
import WorkerSalaryLedger from './WorkerSalaryLedger';
import WorkerDisputes from './WorkerDisputes';

const Workers = () => {
  const location = useLocation();

  const navTabs = [
    { name: 'All Workers', path: '/admin/workers/all', icon: FiUsers },
    { name: 'Worker Jobs', path: '/admin/workers/jobs', icon: FiClock },
    { name: 'Worker Analytics', path: '/admin/workers/analytics', icon: FiActivity },
    { name: 'Salary Ledgers', path: '/admin/workers/payouts', icon: FiDollarSign },
    { name: 'Worker Disputes', path: '/admin/workers/disputes', icon: FiUsers },
  ];

  const getPageTitle = () => {
    const currentTab = navTabs.find(tab => location.pathname === tab.path);
    return currentTab ? currentTab.name : 'Worker Management';
  };

  return (
    <div className="space-y-6">
      {/* Content Area */}
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="all" replace />} />
          <Route path="all" element={<AllWorkers />} />
          <Route path="jobs" element={<WorkerJobs />} />
          <Route path="analytics" element={<WorkerAnalytics />} />
          <Route path="payouts" element={<WorkerSalaryLedger />} />
          <Route path="disputes" element={<WorkerDisputes />} />
        </Routes>
      </motion.div>
    </div>
  );
};

export default Workers;
