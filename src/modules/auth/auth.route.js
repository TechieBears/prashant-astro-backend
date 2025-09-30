const express = require('express');
const { register, login, getMe, updateMyPassword, logout } = require('./auth.controller');
const { protect } = require('../../middlewares/auth');

const router = express.Router();

// Public
// router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Private
// router.get('/me', protect, getMe);
// router.put('/me/password', protect, updateMyPassword);

module.exports = router;
