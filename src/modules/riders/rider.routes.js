const express = require('express');
const asyncHandler = require('../../middleware/async-handler');
const authMiddleware = require('../../middleware/auth.middleware');
const requireRole = require('../../middleware/require-role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { locationSchema, availabilitySchema } = require('./rider.schema');
const { updateLocation, setAvailability } = require('./rider.controller');

const router = express.Router();

router.post(
  '/:id/location',
  authMiddleware,
  requireRole('rider'),
  validate(locationSchema),
  asyncHandler(updateLocation)
);

router.patch(
  '/:id/availability',
  authMiddleware,
  requireRole('rider'),
  validate(availabilitySchema),
  asyncHandler(setAvailability)
);

module.exports = router;