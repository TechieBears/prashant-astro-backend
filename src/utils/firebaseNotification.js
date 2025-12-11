const { google } = require('googleapis');
const axios = require('axios');
// const serviceAccount = require('../config/firebase-config.json');

async function getAccessToken() {
  const client = new google.auth.JWT({
    email: process.env.FIREBASE_CLIENT_EMAIL,
    key: process.env.FIREBASE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const token = await client.authorize();
  return token.access_token;
}

async function sendFirebaseNotification(messageData) {
  console.log('Notification started...')
  try {
    const accessToken = await getAccessToken();
    const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
    const fcmApiUrl = `https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`;

    const message = {
      message: {
        token: messageData.token,
        notification: {
          title: messageData.title,
          body: messageData.body,
          image: messageData.image,
        },
        data: messageData.data || {},
        android: {
          priority: 'high',
          notification: {
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              'mutable-content': 1,
              alert: {
                title: messageData.title,
                body: messageData.body,
              },
              sound: 'default',
            },
          },
        },
      },
    };

    const response = await axios.post(fcmApiUrl, message, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Notification sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Firebase Notification Error:', error.response?.data || error.message);
    throw new Error('Failed to send notification');
  }
}

module.exports = { sendFirebaseNotification };