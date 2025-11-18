const asyncHandler = require('express-async-handler');
const { createMeetingForUser, getZoomAccessToken } = require('../../services/zoom.service');

exports.createZoomMeeting = asyncHandler(async (req, res) => {
    try {
        const { topic, start_time, duration, agenda, timezone, userId, settings } = req.body;

        if (!topic || !start_time) {
            return res.status(400).json({ error: 'Missing required fields: topic and start_time' });
        }

        const meetingData = await createMeetingForUser({
            userId: userId || 'me',
            topic,
            start_time,
            duration,
            timezone: timezone || 'Asia/Kolkata',
            agenda: agenda || '',
            settings: settings || {}
        });

        return res.json({
            success: true,
            meeting: meetingData
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

exports.getAccessToken = asyncHandler(async (req, res) => {
    try {
        const accessToken = await getZoomAccessToken();
        return res.json({
            success: true,
            accessToken
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});