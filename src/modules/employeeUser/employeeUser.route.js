const express = require('express');
const EmployeeController = require('./employeeUser.controller');
const { protect, authorize } = require('../../middlewares/auth');

const router = express.Router();

router.post('/astroguid/public/get-all', EmployeeController.getAllPublicEmployees);

// Admin-only onboarding
router.post('/register', protect, authorize('admin', "employee"), EmployeeController.createEmployeeUser);

router.get('/get-all', protect, authorize('admin', "employee"), EmployeeController.getAllEmployeeUsersWithPagination);
router.get('/get-single', protect, authorize('admin', "employee"), EmployeeController.getSingleEmployeeUser);
router.get('/all', protect, authorize('admin', "employee"), EmployeeController.getAllEmployeeUsers);

router.put('/update', protect, authorize('admin', "employee"), EmployeeController.updateEmployeeUser);

router.delete('/delete', protect, authorize('admin', "employee"), EmployeeController.deleteEmployeeUser);

// password reset routes
router.post('/forgot-password', EmployeeController.forgotPassword);
router.post('/reset-password', EmployeeController.resetPassword);

module.exports = router; 