const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const {
  createSubscriptionOrder,
  verifySubscriptionPayment,
  getSubscriptionStatus
} = require('../../controllers/vendorControllers/subscriptionController');

// All subscription routes require vendor authentication
router.post('/create-order', authenticate, createSubscriptionOrder);
router.post('/verify-payment', authenticate, verifySubscriptionPayment);
router.get('/status', authenticate, getSubscriptionStatus);

module.exports = router;
