const asyncHandler = require('express-async-handler');
const { sendFirebaseNotification } = require('../../utils/firebaseNotification');

exports.sendNotification = asyncHandler(async (req, res) => {
  const { token, title, body, image, data } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'FCM token is required' });
  }

  const result = await sendFirebaseNotification({ token, title, body, image, data });

  res.status(200).json({
    success: true,
    message: 'Notification sent successfully',
    data: result,
  });
});
