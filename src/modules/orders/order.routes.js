const express = require('express');
const asyncHandler = require('../../middleware/async-handler');
const authMiddleware = require('../../middleware/auth.middleware');
const requireRole = require('../../middleware/require-role.middleware');
const idempotencyMiddleware = require('../../middleware/idempotency.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { createOrderSchema, vendorResponseSchema, riderStatusSchema } = require('./order.schema');
const { createOrder, vendorResponse, getOrder, riderStatus, cancelOrder } = require('./order.controller');

const router = express.Router();

// validate runs before idempotency so invalid bodies are never cached
router.post(
  '/',
  authMiddleware,
  requireRole('customer'),
  validate(createOrderSchema),
  idempotencyMiddleware,
  asyncHandler(createOrder)
);

router.patch(
  '/:id/vendor-response',
  authMiddleware,
  requireRole('vendor'),
  validate(vendorResponseSchema),
  asyncHandler(vendorResponse)
);

router.get('/:id', authMiddleware, asyncHandler(getOrder));

router.patch(
  '/:id/rider-status',
  authMiddleware,
  requireRole('rider'),
  validate(riderStatusSchema),
  asyncHandler(riderStatus)
);

router.patch(
  '/:id/cancel',
  authMiddleware,
  requireRole('customer'),
  asyncHandler(cancelOrder)
);

module.exports = router;