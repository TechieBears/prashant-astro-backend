const express = require('express');
const CustomerController = require('./customerUser.controller');
const { protect, authorize } = require('../../middlewares/auth');

const getUploader = require("../../middlewares/upload");
const profileParser = getUploader('profile');

const router = express.Router();

// customer routes
router.post('/register', profileParser.fields([{ name: 'image', maxCount: 1 }]), CustomerController.createCustomerUser);
router.put('/update', protect, authorize("customer"), profileParser.fields([{ name: 'image', maxCount: 1 }]), CustomerController.updateCustomerUser);
router.delete('/delete', protect, authorize("customer"), CustomerController.deleteCustomerUser);
router.get('/get-wallet-balance', protect, authorize("customer"), CustomerController.getWalletBalance);

// password reset routes
router.post('/forgot-password', CustomerController.forgotPassword);
router.post('/reset-password', CustomerController.resetPassword);

router.post('/forgot-password-otp', CustomerController.forgotPasswordOtp);
router.post('/verify-reset-password', CustomerController.verifyOtpAndResetPassword);

// admin routes
router.get('/all', protect, authorize("admin", "employee"), CustomerController.getAllCustomerUsers);
router.put('/admin-update', protect, authorize("admin", "employee"), CustomerController.adminUpdateCustomerUser);
router.get('/get-all', protect, authorize("admin", "employee"), CustomerController.getAllCustomerUsersWithPagination);
router.get('/dropdown', protect, authorize("admin"), CustomerController.getAllCustomersDropdown);
router.get('/get-single', protect, authorize("admin", "employee"), CustomerController.getSingleCustomerUser);

module.exports = router;