const express = require('express');
const router = express.Router();
const { optionalAuthenticate } = require('../../middleware/authMiddleware');
const { getPublicSettings, submitPublicSupportTicket } = require('../../controllers/adminControllers/settingsController');

router.get('/config', getPublicSettings);
router.post('/support/ticket', optionalAuthenticate, submitPublicSupportTicket);

module.exports = router;
