const express = require('express');
const asyncHandler = require('../../middleware/async-handler');
const authMiddleware = require('../../middleware/auth.middleware');
const requireRole = require('../../middleware/require-role.middleware');
const { createMenuItem, listMenuItems, updateMenuItem } = require('./vendor.controller');

const router = express.Router();

// Public — customers browse menus without auth
router.get('/:id/menu-items', asyncHandler(listMenuItems));

router.post(
  '/:id/menu-items',
  authMiddleware,
  requireRole('vendor'),
  asyncHandler(createMenuItem)
);

router.patch(
  '/:id/menu-items/:itemId',
  authMiddleware,
  requireRole('vendor'),
  asyncHandler(updateMenuItem)
);

module.exports = router;