const express = require('express');
const asyncHandler = require('../../middleware/async-handler');
const authMiddleware = require('../../middleware/auth.middleware');
const requireRole = require('../../middleware/require-role.middleware');
const idempotencyMiddleware = require('../../middleware/idempotency.middleware');
const { createOrder, vendorResponse, getOrder, riderStatus } = require('./order.controller');

const router = express.Router();

router.post(
  '/',
  authMiddleware,
  requireRole('customer'),
  idempotencyMiddleware,
  asyncHandler(createOrder)
);

router.patch(
  '/:id/vendor-response',
  authMiddleware,
  requireRole('vendor'),
  asyncHandler(vendorResponse)
);

router.get('/:id', authMiddleware, asyncHandler(getOrder));

router.patch(
  '/:id/rider-status',
  authMiddleware,
  requireRole('rider'),
  asyncHandler(riderStatus)
);

module.exports = router;