const express = require('express');
const asyncHandler = require('../../middleware/async-handler');
const { signup, login } = require('./auth.controller');

const router = express.Router();

router.post('/signup', asyncHandler(signup));
router.post('/login', asyncHandler(login));

module.exports = router;