const express = require('express');
const CallController = require('./call.controller');
const { protect, authorize } = require('../../middlewares/auth');

const router = express.Router();

router.post('/create', protect, authorize("customer"), CallController.createCall);
router.get('/get-all', protect, authorize("admin", "customer"), CallController.getAllCalls);
router.get('/public/get-all',protect, authorize("customer"), CallController.getAllCallsCustomer);

module.exports = router;