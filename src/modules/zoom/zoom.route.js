const router = require('express').Router();
const { createMeetingForUser } = require('../../services/zoom.service');
const zoonController = require('./zoom.controller');

router.post('/test', zoonController.createZoomMeeting);

module.exports = router;