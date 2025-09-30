const express = require('express');
const CustomerAddressController = require('./customerAddress.controller');
const { protect, authorize } = require('../../middlewares/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// auth routes
router.post('/create', protect, authorize("customer"), CustomerAddressController.createCustomerAddress);
router.get('/get-all', protect, authorize("customer"), CustomerAddressController.getAllCustomerAddresses);
router.get('/get-single', protect, authorize("customer"), CustomerAddressController.getCustomerAddress);
router.put('/update', protect, authorize("customer"), CustomerAddressController.updateCustomerAddress);
router.delete('/delete', protect, authorize("customer"), CustomerAddressController.deleteCustomerAddress);

module.exports = router;