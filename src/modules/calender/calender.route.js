const express = require('express');
const CalenderController = require('./calender.controller');
const { protect } = require('../../middlewares/auth');
const { authorize } = require('../../middlewares/auth');

const router = express.Router();

router.post('/check-availability', protect, authorize("customer"), CalenderController.checkAvailability);
router.get('/admin-slots', protect, authorize("admin", "customer", "employee"), CalenderController.superAdminSlots);
router.get('/min-max-time', protect, authorize("admin", "customer", "employee"), CalenderController.getMinMaxTime);
router.get('/astrologer-slots', protect, authorize("admin", "customer", "employee"), CalenderController.astrologerSlots);

module.exports = router;
