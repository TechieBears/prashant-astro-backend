const express = require('express');
const router = express.Router();
const notificationController = require('./notification.controller');
const { protect, authorize } = require('../../middlewares/auth');

router.use(protect);
router.post('/send', authorize('admin', "employee", "customer"), notificationController.sendNotification);
router.post('/create', authorize('admin', "employee", "customer"), notificationController.createNotification);
router.get('/get-all', authorize('admin', "employee", "customer"), notificationController.getAllNotificationsAdmin);
router.get('/dropdown-customer', authorize('admin', "employee", "customer"), notificationController.getNotificationsDropdownCustomer);
router.get('/dropdown-dashboard', authorize('admin', "employee", "customer"), notificationController.getNotificationsDropdownAdminAndEmployee);
router.delete('/remove-all', authorize("customer"), notificationController.expireAllNotificationsCustomer);

module.exports = router;