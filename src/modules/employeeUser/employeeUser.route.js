const express = require('express');
const EmployeeController = require('./employeeUser.controller');
const { protect, authorize } = require('../../middlewares/auth');

const getUploader = require("../../middlewares/upload");
const profileParser = getUploader('profile');

const router = express.Router();

router.post('/astroguid/public/get-all', EmployeeController.getAllPublicEmployees);
router.get('/call-astrologer/public/get-all', EmployeeController.getAllcallAstrologerCustomer);

// Admin-only onboarding
router.post('/register', protect, authorize('admin', "employee"), profileParser.fields([{ name: 'image', maxCount: 1 }]), EmployeeController.createEmployeeUser);

router.get('/get-all', protect, authorize('admin', "employee"), EmployeeController.getAllEmployeeUsersWithPagination);
router.get('/get-single', protect, authorize('admin', "employee"), EmployeeController.getSingleEmployeeUser);
router.get('/all', protect, authorize('admin', "employee"), EmployeeController.getAllEmployeeUsers);

router.put('/update', protect, authorize('admin', "employee"), profileParser.fields([{ name: 'image', maxCount: 1 }]), EmployeeController.updateEmployeeUser);

router.get('/call-astrologer/update-working-status', protect, authorize('admin', "employee"), EmployeeController.toggleButton);

router.delete('/delete', protect, authorize('admin', "employee"), EmployeeController.deleteEmployeeUser);

// password reset routes
router.post('/forgot-password', EmployeeController.forgotPassword);
router.post('/reset-password', EmployeeController.resetPassword);

module.exports = router; 