const express = require('express');
const CallController = require('./call.controller');
const { protect, authorize } = require('../../middlewares/auth');

const router = express.Router();

router.get('/public/get-all-call-astrologers', CallController.getAllCallAstrologersCustomer);
router.get('/public/get-single-call-astrologer', CallController.getSingleCallAstrologerCustomer);
router.get('/public/get-all-call-astrologers-mobile', CallController.getAllCallAstrologersMobileByServiceCategory);
router.get('/public/get-filters', CallController.getFilters);

router.post('/initiate', protect, authorize("customer", "astrologer"), CallController.callInitiate);
router.get('/public/get-all-calls-history', protect, authorize("customer"), CallController.getAllCallsHistoryCustomer);
router.get('/get-all-call-astrologers', protect, authorize("admin", "employee", "astrologer"), CallController.getAllCallsAdminandAstrologer);

router.post('/webhook/call-hangup', CallController.webhookCallHangup);
// router.post('/webhook/call-answered-by-agent', CallController.webhookCallAnsweredByAgent);

module.exports = router;