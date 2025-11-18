const router = require('express').Router();
const zoomController = require('./zoom.controller');

router.post('/test', zoomController.createZoomMeeting);
router.get('/get-access-token', zoomController.getAccessToken);

module.exports = router;