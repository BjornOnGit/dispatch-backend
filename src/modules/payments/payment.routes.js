const express = require('express');
const asyncHandler = require('../../middleware/async-handler');
const authMiddleware = require('../../middleware/auth.middleware');
const requireRole = require('../../middleware/require-role.middleware');
const { initiatePayment } = require('./payment.controller');

const router = express.Router();

// Mounted at /orders in app.js, alongside order.routes.js
router.post('/:id/pay', authMiddleware, requireRole('customer'), asyncHandler(initiatePayment));

module.exports = router;