const express = require('express');
const router = express.Router();
const controller = require('./config.controller');
const { protect, authorize } = require('../../middlewares/auth');

// public routes
router.get('/public/get', controller.getByKeyPublic);
router.get('/public/update', controller.updateKey);

// admin routes
router.use(protect, authorize('admin', 'employee'));
router.post('/create-or-update', controller.upsertAdmin);

module.exports = router;
