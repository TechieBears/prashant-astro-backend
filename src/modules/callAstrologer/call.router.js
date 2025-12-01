const express = require('express');
const CallController = require('./call.controller');
const { protect, authorize } = require('../../middlewares/auth');

const router = express.Router();

router.get('/public/get-all-call-astrologers', CallController.getAllCallAstrologersCustomer);
router.get('/public/get-filters', CallController.getFilters);

router.post('/create-call', protect, authorize("customer"), CallController.createCall);
router.get('/public/get-all-calls-history', protect, authorize("customer"), CallController.getAllCallsHistoryCustomer);
router.get('/get-all-call-astrologers', protect, authorize("admin", "employee", "astrologer"), CallController.getAllCallsAdminandAstrologer);

module.exports = router;