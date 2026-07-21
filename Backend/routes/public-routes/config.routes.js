const express = require('express');
const router = express.Router();
const { getPublicSettings, submitPublicSupportTicket } = require('../../controllers/adminControllers/settingsController');

router.get('/config', getPublicSettings);
router.post('/support/ticket', submitPublicSupportTicket);

module.exports = router;
