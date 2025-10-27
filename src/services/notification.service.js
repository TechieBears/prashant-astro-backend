// services/notificationService.js
const Notification = require('../models/Notification');
const { sendFirebaseNotification } = require('./firebaseNotificationService');
const User = require('../models/User');

/**
 * Common function to trigger notifications
 * @param {Object} options - Notification options
 * @param {String} options.type - Notification type: 'order_created', 'order_accepted', 'order_shipped', 'order_delivered', 'order_cancelled', 'custom'
 * @param {String} options.userId - Single user ID (for specific user)
 * @param {Array} options.userIds - Multiple user IDs (for multiple specific users)
 * @param {String} options.userType - 'all-customers' or 'specific-customer'
 * @param {String} options.title - Notification title
 * @param {String} options.description - Notification description
 * @param {String} options.image - Notification image URL
 * @param {String} options.redirectionUrl - URL to redirect when notification is clicked
 * @param {String} options.redirectId - ID for internal app redirection
 * @param {Object} options.orderData - Order data for order-related notifications
 * @param {String} options.from - Source: 'admin', 'web', 'app' (default: 'web')
 */
async function triggerNotification(options) {
  try {
    const {
      type,
      userId,
      userIds = [],
      userType = 'specific-customer',
      title,
      description,
      image,
      redirectionUrl,
      redirectId,
      orderData,
      from = 'web'
    } = options;

    // Validate required fields
    if (!title || !type) {
      throw new Error('Title and type are required');
    }

    // Determine notification type and user type
    const notificationType = getNotificationType(type);
    const finalUserType = getUserType(userId, userIds, userType);
    const finalUserIds = await getFinalUserIds(userId, userIds, finalUserType);

    // Create notification record
    const notificationData = {
      from,
      title,
      description: description || getDefaultDescription(type, orderData),
      image: image || getDefaultImage(type),
      notificationType,
      redirectionUrl: redirectionUrl || getDefaultRedirectionUrl(type, orderData),
      redirectId: redirectId || (orderData ? orderData._id : null),
      userType: finalUserType,
      userIds: finalUserType === 'specific-customer' ? finalUserIds : [],
      status: 'active',
      stats: {
        success: 0,
        failed: 0
      }
    };

    const notification = new Notification(notificationData);
    await notification.save();

    // Send real-time notifications to users
    await sendRealTimeNotifications(notification, finalUserIds);

    console.log(`✅ Notification triggered successfully: ${type}`);
    return notification;

  } catch (error) {
    console.error('❌ Notification trigger error:', error.message);
    throw error;
  }
}

/**
 * Get notification type based on event type
 */
function getNotificationType(type) {
  const typeMap = {
    'order_created': 'in-app',
    'order_accepted': 'in-app', 
    'order_shipped': 'in-app',
    'order_delivered': 'in-app',
    'order_cancelled': 'in-app',
    'custom': 'all'
  };
  return typeMap[type] || 'in-app';
}

/**
 * Determine user type based on inputs
 */
function getUserType(userId, userIds, userType) {
  if (userType === 'all-customers') return 'all-customers';
  if (userId || (userIds && userIds.length > 0)) return 'specific-customer';
  return userType;
}

/**
 * Get final user IDs for notification
 */
async function getFinalUserIds(userId, userIds, userType) {
  if (userType === 'all-customers') {
    // Get all active customer users
    const customers = await User.find({ 
      role: 'customer', 
      isActive: true, 
      isDeleted: false 
    }).select('_id');
    return customers.map(user => user._id);
  }

  const finalIds = [];
  if (userId) finalIds.push(userId);
  if (userIds && userIds.length > 0) finalIds.push(...userIds);
  
  return [...new Set(finalIds)]; // Remove duplicates
}

/**
 * Get default description based on notification type
 */
function getDefaultDescription(type, orderData) {
  const descriptions = {
    'order_created': `Your order #${orderData?.orderNumber || ''} has been placed successfully.`,
    'order_accepted': `Your order #${orderData?.orderNumber || ''} has been accepted and is being processed.`,
    'order_shipped': `Your order #${orderData?.orderNumber || ''} has been shipped. Track your delivery.`,
    'order_delivered': `Your order #${orderData?.orderNumber || ''} has been delivered successfully.`,
    'order_cancelled': `Your order #${orderData?.orderNumber || ''} has been cancelled.`
  };
  return descriptions[type] || 'You have a new notification.';
}

/**
 * Get default image based on notification type
 */
function getDefaultImage(type) {
  const images = {
    'order_created': '/images/order-created.png',
    'order_accepted': '/images/order-accepted.png',
    'order_shipped': '/images/order-shipped.png',
    'order_delivered': '/images/order-delivered.png',
    'order_cancelled': '/images/order-cancelled.png'
  };
  return images[type] || '/images/default-notification.png';
}

/**
 * Get default redirection URL based on notification type
 */
function getDefaultRedirectionUrl(type, orderData) {
  const urls = {
    'order_created': '/orders',
    'order_accepted': '/orders',
    'order_shipped': '/track-order',
    'order_delivered': '/orders',
    'order_cancelled': '/orders'
  };
  return urls[type] || '/notifications';
}

/**
 * Send real-time notifications via Firebase
 */
async function sendRealTimeNotifications(notification, userIds) {
  try {
    // Get FCM tokens for all users
    const users = await User.find({ 
      _id: { $in: userIds },
      fcmToken: { $exists: true, $ne: null }
    }).select('fcmToken');

    const fcmTokens = users.map(user => user.fcmToken).filter(token => token);
    
    if (fcmTokens.length === 0) {
      console.log('No FCM tokens found for users');
      return;
    }

    let successCount = 0;
    let failedCount = 0;

    // Send notifications to all tokens
    for (const token of fcmTokens) {
      try {
        const messageData = {
          token: token,
          title: notification.title,
          body: notification.description,
          image: notification.image,
          data: {
            notificationId: notification._id.toString(),
            type: 'order_update',
            redirectionUrl: notification.redirectionUrl,
            redirectId: notification.redirectId,
            click_action: 'FLUTTER_NOTIFICATION_CLICK'
          }
        };

        await sendFirebaseNotification(messageData);
        successCount++;
      } catch (error) {
        console.error(`Failed to send notification to token: ${error.message}`);
        failedCount++;
      }
    }

    // Update notification stats
    await Notification.findByIdAndUpdate(notification._id, {
      $set: {
        'stats.success': successCount,
        'stats.failed': failedCount
      }
    });

    console.log(`📱 Notifications sent: ${successCount} success, ${failedCount} failed`);

  } catch (error) {
    console.error('Error sending real-time notifications:', error);
  }
}

// Export the main function and helper functions
module.exports = {
  triggerNotification,
  sendRealTimeNotifications
};