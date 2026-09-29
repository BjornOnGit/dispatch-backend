const express = require('express');
const asyncHandler = require('../../middleware/async-handler');
const { validate } = require('../../middleware/validate.middleware');
const { signupSchema, loginSchema } = require('./auth.schema');
const { signup, login } = require('./auth.controller');

const router = express.Router();

router.post('/signup', validate(signupSchema), asyncHandler(signup));
router.post('/login', validate(loginSchema), asyncHandler(login));

module.exports = router;