const express = require('express');
const asyncHandler = require('../../middleware/async-handler');
const authMiddleware = require('../../middleware/auth.middleware');
const { listNotifications } = require('./notification.controller');

const router = express.Router();

router.get('/', authMiddleware, asyncHandler(listNotifications));

module.exports = router;