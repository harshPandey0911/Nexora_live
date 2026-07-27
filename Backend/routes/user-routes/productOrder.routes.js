const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { isUser } = require('../../middleware/roleMiddleware');
const {
  createProductOrder,
  verifyProductOrderPayment,
  getProductOrderDetails,
  getUserProductOrders,
  cancelProductOrder
} = require('../../controllers/productOrderControllers/userProductOrderController');

router.post('/product-orders', authenticate, isUser, createProductOrder);
router.post('/product-orders/verify-payment', authenticate, isUser, verifyProductOrderPayment);
router.get('/product-orders/my-orders', authenticate, isUser, getUserProductOrders);
router.get('/product-orders/:orderId', authenticate, isUser, getProductOrderDetails);
router.post('/product-orders/:orderId/cancel', authenticate, isUser, cancelProductOrder);

module.exports = router;
