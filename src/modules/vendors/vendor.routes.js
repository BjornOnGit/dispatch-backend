const express = require('express');
const asyncHandler = require('../../middleware/async-handler');
const authMiddleware = require('../../middleware/auth.middleware');
const requireRole = require('../../middleware/require-role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { createMenuItemSchema, updateMenuItemSchema, locationSchema } = require('./vendor.schema');
const { createMenuItem, listMenuItems, updateMenuItem, updateLocation } = require('./vendor.controller');

const router = express.Router();

// Public — customers browse menus without auth
router.get('/:id/menu-items', asyncHandler(listMenuItems));

router.post(
  '/:id/menu-items',
  authMiddleware,
  requireRole('vendor'),
  validate(createMenuItemSchema),
  asyncHandler(createMenuItem)
);

router.patch(
  '/:id/menu-items/:itemId',
  authMiddleware,
  requireRole('vendor'),
  validate(updateMenuItemSchema),
  asyncHandler(updateMenuItem)
);

router.patch(
  '/:id/location',
  authMiddleware,
  requireRole('vendor'),
  validate(locationSchema),
  asyncHandler(updateLocation)
);

module.exports = router;