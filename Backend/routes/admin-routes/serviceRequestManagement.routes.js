const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/roleMiddleware');
const {
  getAllServiceRequests,
  updateServiceRequestStatus
} = require('../../controllers/adminControllers/adminServiceRequestController');

/**
 * GET /api/admin/service-requests
 * Admin fetches all vendor service requests (optionally filtered by status)
 */
router.get('/service-requests', authenticate, isAdmin, getAllServiceRequests);

/**
 * PATCH /api/admin/service-requests/:id/action
 * Admin approves or rejects a vendor service request
 */
router.patch('/service-requests/:id/action', authenticate, isAdmin, updateServiceRequestStatus);

module.exports = router;
