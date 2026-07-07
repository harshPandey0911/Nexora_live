const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { isVendor } = require('../../middleware/roleMiddleware');
const {
  createServiceRequest,
  getMyServiceRequests
} = require('../../controllers/vendorControllers/vendorServiceRequestController');

/**
 * POST /api/vendors/service-requests
 * Vendor submits a new service request for admin review
 */
router.post('/', authenticate, isVendor, createServiceRequest);

/**
 * GET /api/vendors/service-requests
 * Vendor fetches their own submitted service requests
 */
router.get('/', authenticate, isVendor, getMyServiceRequests);

module.exports = router;
