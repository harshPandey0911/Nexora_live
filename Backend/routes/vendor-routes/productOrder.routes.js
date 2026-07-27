const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { isVendor } = require('../../middleware/roleMiddleware');
const {
  updateDeliverySettings,
  getDeliverySettings,
  acceptProductOrder,
  updateOrderStatus,
  getVendorProductOrders
} = require('../../controllers/productOrderControllers/vendorProductOrderController');

router.get('/delivery-settings', authenticate, isVendor, getDeliverySettings);
router.put('/delivery-settings', authenticate, isVendor, updateDeliverySettings);
router.get('/product-orders', authenticate, isVendor, getVendorProductOrders);
router.post('/product-orders/:orderId/accept', authenticate, isVendor, acceptProductOrder);
router.put('/product-orders/:orderId/status', authenticate, isVendor, updateOrderStatus);

module.exports = router;
