// zoomService.js
const axios = require('axios');

const ZOOM_API_BASE = process.env.ZOOM_API_BASE || 'https://api.zoom.us/v2';

const getZoomAccessToken = async () => {
    const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`;

    try {
        const response = await axios.post(tokenUrl, null, {
            headers: {
                Authorization: `Basic ${Buffer.from(
                    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
                ).toString("base64")}`,
            },
        });

        return response.data.access_token;
    } catch (err) {
        console.error("❌ Error fetching Zoom access token:", err.response?.data || err.message);
        throw err;
    }
}

async function createMeetingForUser({
    userId = 'me',
    topic,
    start_time,
    duration = 30,
    timezone = 'Asia/Kolkata',
    agenda = '',
    settings = {}
}) {
    try {
        const accessToken = await getZoomAccessToken();
        if (!accessToken) {
            throw new Error('Missing ZOOM_ACCESS_TOKEN in environment');
        }

        const url = `${ZOOM_API_BASE}/users/${encodeURIComponent(userId)}/meetings`;

        const body = {
            topic,
            type: 2,          // 2 = scheduled meeting
            start_time,
            duration,
            timezone,
            agenda,
            // settings: {
            //     host_video: settings.host_video ?? true,
            //     participant_video: settings.participant_video ?? true,
            //     join_before_host: settings.join_before_host ?? false,
            //     mute_upon_entry: settings.mute_upon_entry ?? true,
            //     approval_type: settings.approval_type ?? 0,
            //     waiting_room: settings.waiting_room ?? true,
            //     ...settings  // allow extra overrides
            // }
            // settings: {
            //     host_video: settings.host_video ?? true,
            //     participant_video: settings.participant_video ?? true,
            //     join_before_host: settings.join_before_host ?? true, // ✅ allow joining directly
            //     mute_upon_entry: settings.mute_upon_entry ?? true,
            //     approval_type: 2, // ❌ remove registration
            //     waiting_room: settings.waiting_room ?? false, // ✅ disable waiting room
            //     meeting_authentication: false, // ✅ disable login
            //     enforce_login: false, // ✅ disable Zoom sign-in requirement
            //     enforce_login_domains: "",
            //     auto_recording: "none",
            //     allow_multiple_devices: true,
            //     audio: "both",
            //     show_share_button: true,
            //     ...settings
            // }
            settings: {
                host_video: true,
                participant_video: true,
                join_before_host: true,
                waiting_room: false,
                meeting_authentication: false,
                enforce_login: false,
                approval_type: 2,
            }
        };

        const response = await axios.post(url, body, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;

    } catch (err) {
        // Log full error if axios
        if (err.response) {
            console.error('Zoom API error:', err.response.status, err.response.data);
            throw new Error(`Zoom API error: ${err.response.data.message || err.response.data}`);
        }
        console.error('Unexpected error in createMeetingForUser:', err.message);
        throw err;
    }
}

module.exports = { createMeetingForUser };
