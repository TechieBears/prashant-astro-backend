const { google } = require('googleapis');
const axios = require('axios');
const admin = require('firebase-admin');
const serviceAccount = require('../config/firebase-config.json');

async function getAccessToken() {
  const client = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const token = await client.authorize();
  return token.access_token;
}

async function sendFirebaseNotification(messageData) {
  try {

    const message = {
      notification: {
        title: messageData.title,
        body: messageData.body,
        image: messageData.image || undefined
      },
      data: {
        notificationFor: `${messageData.deepLink}`,
        "deepLink": `soulplan://${messageData.deepLink}`,
        id: "SAdfsdfsadf",
        pnid: "Sadfsadfsf",
        notifee: JSON.stringify({
          title: messageData.title,
          body: messageData.body,
          data: {
            "deepLink": `soulplan://${messageData.deepLink}`,
            "image": messageData.image || ""
          },
          priority: "high",
          android: {
            notification: {
              channelId: "channel_02",
              clickAction: "default",
              "image": messageData.image || undefined,
              "click_action": "FLUTTER_NOTIFICATION_CLICK"
            },
          },

        }),
      },
      tokens: messageData.token,
      apns: {
        payload: {
          aps: {
            "mutable-content": 1,
            "alert": {
              title: messageData.title,
              body: messageData.body,
            },
            "sound": "default",
            "content-available": 1,
            'thread-id': 'events_group'
          },
        },
      },
      android: {
        priority: 'high',
        // "image": messageData.image || undefined,
        // "click_action": "FLUTTER_NOTIFICATION_CLICK"
      },
      "fcm_options": {
        "image": messageData.image || undefined
      },
      "webpush": {
        "headers": {
          "Urgency": "high"
        },
        "notification": {
          title: messageData.title,
          body: messageData.body,
          "icon": "https://admin.pi-play.com/static/media/Picture2.a174ba5621923238e67e.png",
          image: messageData.image || undefined
        }
      }
    };
    console.log("🚀 ~ sendFirebaseNotification ~ Pimessage:", message);
    try {
      const response = await admin.messaging().sendEachForMulticast(Pimessage);
      console.log('🚀 Notification sent successfully:', JSON.stringify(response));
      process.exit(0);
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