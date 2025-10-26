const express = require('express');
const router = express.Router();
const notificationController = require('./notification.controller');
const { protect, authorize } = require('../../middlewares/auth');

router.use(protect);
router.post('/send', authorize('admin', "employee", "customer"), notificationController.sendNotification);
router.post('/create', authorize('admin', "employee", "customer"), notificationController.createNotification);
router.get('/get-all', authorize('admin', "employee", "customer"), notificationController.getAllNotificationsAdmin);
router.get('/dropdown', authorize('admin', "employee", "customer"), notificationController.getNotificationsDropdown);

module.exports = router;