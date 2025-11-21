const asyncHandler = require('express-async-handler');
const { createMeetingForUser, getZoomAccessToken } = require('../../services/zoom.service');
const KJUR = require('jsrsasign');

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

exports.getMeetingSdkJWT = asyncHandler(async (req, res) => {
    const {meetingNumber, role} = req.query;
    if (!meetingNumber || !role) {
        return res.status(400).json({ error: 'Missing required query parameters: meetingNumber and role' });
    }
    const iat = Math.round(new Date().getTime() / 1000) - 30;
    const exp = iat + 60 * 60 * 2;
    const oHeader = { alg: 'HS256', typ: 'JWT' };
    const oPayload = {
        sdkKey: process.env.ZOOM_CLIENT_ID,
        mn: meetingNumber,
        role: role,
        iat: iat,
        exp: exp,
        tokenExp: exp
    };
    const sHeader = JSON.stringify(oHeader);
    const sPayload = JSON.stringify(oPayload);
    const sdkJWT = KJUR.jws.JWS.sign('HS256', sHeader, sPayload, process.env.ZOOM_SDK_SECRET);
    return res.ok({
        // clientID: process.env.ZOOM_CLIENT_ID
        sdkKey: process.env.ZOOM_CLIENT_ID,
        jwt: sdkJWT,
    }, "Zoom SDK JWT generated successfully");
});