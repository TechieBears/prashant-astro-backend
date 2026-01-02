const { google } = require('googleapis');
const axios = require('axios');
// const serviceAccount = require('../config/firebase-config.json');
const admin = require('firebase-admin');

async function sendFirebaseNotification(messageData) {
  try {
    const message = {
      tokens: messageData.token,
      "notification": {
        title: messageData.title,
        body: messageData.body
      },
      data: messageData.data,
      android: {
        priority: 'high',
        notification: {
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          imageUrl: messageData.image || undefined
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: messageData.title,
              body: messageData.body
            },
            sound: "default",
            "mutable-content": 1
          }
        },
      },
      "webpush": {
        "headers": {
          "Urgency": "high"
        },
        "notification": {
          title: messageData.title,
          body: messageData.body,
          "icon": "https://prashant-astro-frontend.vercel.app/assets/astroguid%20logo-CREqNSCS.png",
          image: messageData.image || undefined
        }
      }
    };
    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      return JSON.stringify(response);
    } catch (error) {
      console.error('❌ Error sending notification:', error);
      process.exit(1);
    }

    return response.data;
  } catch (error) {
    console.error('❌ Firebase Notification Error:', JSON.stringify(error.response?.data) || JSON.stringify(error.message));
    throw new Error('Failed to send notification');
  }
}

module.exports = { sendFirebaseNotification };