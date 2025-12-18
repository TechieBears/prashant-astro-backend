const express = require('express');
const router = express.Router();
const webhookController = require('./webhook.controller');

// Webhook routes (no authentication required - signature verification is used instead)
router.post('/payment', webhookController.handleWebhook);
router.post('/razorpay', webhookController.handleRazorpayWebhook);

module.exports = router;

