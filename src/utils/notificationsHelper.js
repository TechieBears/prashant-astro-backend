const Notification = require('../modules/notification/notification.model');
const { sendFirebaseNotification } = require('../utils/firebaseNotification');

const sendOrderNotification = async (order, notificationTitle, notificationBody, user, walletUsed = 0, payingAmount = 0) => {
  try {
    const { savedOrder, orderItems } = order;
    const { _id: userId, fcmToken } = user;

    // const notificationTitle = 'Order Placed Successfully!';
    // const notificationBody = `Your order #${savedOrder._id} has been placed successfully. ${payingAmount === 0 ? 'Payment completed using wallet credits.' : `Amount to pay: ₹${payingAmount}`}`;

    // 1. Send Firebase Push Notification
    if (fcmToken) {
      const notificationData = {
        token: fcmToken,
        title: notificationTitle,
        body: notificationBody,
        image: null,
        data: {
          orderId: savedOrder._id.toString(),
          type: 'PRODUCT_ORDER',
          screen: 'ORDER_DETAILS',
          paymentStatus: savedOrder.paymentStatus,
          orderStatus: savedOrder.orderStatus,
          payingAmount: payingAmount.toString()
        }
      };
      await sendFirebaseNotification(notificationData);
      console.log('📱 Order confirmation notification sent');
    }

    // 2. Create Database Notification Record
    const notification = new Notification({
      from: 'app',
      title: notificationTitle,
      description: notificationBody,
      image: null,
      notificationType: 'in-app',
      redirectionUrl: '/orders',
      redirectId: savedOrder._id.toString(),
      userType: 'specific-customer',
      userIds: [userId],
      status: 'active',
      stats: {
        success: fcmToken ? 1 : 0,
        failed: fcmToken ? 0 : 1
      }
    });

    await notification.save();
    console.log('📋 Notification record created in database');

    return { success: true };
  } catch (error) {
    console.error('❌ Error in sendOrderNotification:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendOrderNotification };