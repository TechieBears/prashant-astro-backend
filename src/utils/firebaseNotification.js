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
      },
      data: {
        image: "https://api.soulplan.net/prodmedia/services/1765457303783-34caaa346c72cebd307b9f4c1e76440713487506.jpg",
        notificationFor: `${messageData.deepLink}`,
        "deepLink": `soulplan://${messageData.deepLink}`,
        id: "SAdfsdfsadf",
        pnid: "Sadfsadfsf",
        timeStamp: new Date().toISOString()
      },
      tokens: messageData.token,
      apns: {
        payload: {
          aps: {
            "mutable-content": 1,
            "badge": 1,
            "alert": {
              title: messageData.title,
              body: messageData.body,
            },
            "sound": "default",
            'thread-id': 'events_group'
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          imageUrl: "https://api.soulplan.net/prodmedia/services/1765457303783-34caaa346c72cebd307b9f4c1e76440713487506.jpg"
        }
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
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log('🚀 Notification sent successfully:', JSON.stringify(response));
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