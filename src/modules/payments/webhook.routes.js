const express = require('express');
const asyncHandler = require('../../middleware/async-handler');
const { handlePaymentWebhook } = require('./webhook.controller');

const router = express.Router();

router.post('/payments', asyncHandler(handlePaymentWebhook));

module.exports = router;