const express = require('express');
const AdminController = require('./adminUser.controller');

// Import middleware (assuming these exist in your project)
const { protect, authorize } = require('../../middlewares/auth');

const getUploader = require('../../middlewares/upload');
const adminProfileParser = getUploader('admin-profile');

const router = express.Router();

router.post('/', AdminController.createAdminUser);

// Apply authentication middleware to all routes
router.use(protect);

// Stats route (should be before /:id routes)
router.get('/stats', authorize('admin', 'employee'), AdminController.getAdminUserStats);

// CRUD routes
router.get('/', authorize('admin', 'employee'), AdminController.getAllAdminUsers);

router.get('/:id', authorize('admin', 'employee'), AdminController.getAdminUser);
router.put('/update', authorize('admin', 'employee'), adminProfileParser.fields([{ name: 'image', maxCount: 1 }]), AdminController.updateAdminUser);
router.delete('/:id', authorize('super-admin'), AdminController.deleteAdminUser);

// Password update route
router.put('/:id/password', authorize('admin', 'employee'), AdminController.updateAdminUserPassword);

// Restore route
router.put('/:id/restore', authorize('super-admin'), AdminController.restoreAdminUser);

module.exports = router;