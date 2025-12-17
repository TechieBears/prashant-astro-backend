const asyncHandler = require('express-async-handler');
const Notification = require('./notification.model');
const User = require('../auth/user.Model');
const { sendFirebaseNotification } = require('../../utils/firebaseNotification');
const mongoose = require('mongoose');

// Send immediate notification to single device
exports.sendNotification = asyncHandler(async (req, res) => {
  const { token, title, body, data } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'FCM token is required' });
  }

  const result = await sendFirebaseNotification({ token, title, body, data });

  res.status(200).json({
    success: true,
    message: 'Notification sent successfully',
    data: result,
  });
});

// Create notification (with scheduling and bulk sending)
exports.createNotification = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    image,
    notificationType,
    redirectionUrl,
    redirectId,
    userType,
    userIds,
    scheduledAt,
    expiryDate,
    status
  } = req.body;

  // Validate required fields
  if (!title || !notificationType || !userType) {
    return res.status(400).json({
      success: false,
      message: 'Title, notificationType, and userType are required'
    });
  }

  // Validate userIds for specific-customer type
  if (userType === 'specific-customer' && (!userIds || !Array.isArray(userIds) || userIds.length === 0)) {
    return res.status(400).json({
      success: false,
      message: 'userIds array is required for specific-customer userType'
    });
  }

  // Create notification
  const notification = new Notification({
    from: req.user.role,
    title,
    description,
    image,
    notificationType,
    redirectionUrl,
    redirectId,
    userType,
    userIds: userType === 'specific-customer' ? userIds : undefined,
    status: status || 'active',
    scheduledAt,
    expiryDate,
    stats: {
      success: 0,
      failed: 0
    }
  });

  const savedNotification = await notification.save();

  // Send immediately if no scheduled time
  await sendBulkNotifications(savedNotification);
  // if (!scheduledAt) {
  // }

  res.status(201).json({
    success: true,
    message: scheduledAt ? 'Notification scheduled successfully' : 'Notification sent successfully',
    data: savedNotification
  });
});

// Get all notifications for admin
exports.getAllNotificationsAdmin = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, userType, from } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (userType) filter.userType = userType;
  if (from == 'admin') filter.from = from;

  if (req.user.role === "customer") {
    filter.userType = "specific-customer";
    filter.userIds = { $in: [req.user._id] };
  }

  const notifications = await Notification.find(filter)
    .populate('userIds', 'email mobileNo profileImage')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Notification.countDocuments(filter);

  res.paginated(notifications, { page, limit, total, totalPages: Math.ceil(total / limit) }, "Notifications fetched successfully",);
});

// Get notifications dropdown for customers
exports.getNotificationsDropdownCustomer = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const userId = req.user._id;
  // const pipeline = [
  //   { $match: { $in: [userId], isDeleted: false } },
  //   {
  //     $project: {
  //       title: 1,
  //       description: 1,
  //       sentAt: "$createdAt"
  //     }
  //   },
  //   { $sort: { sentAt: -1 } },
  //   { $skip: (page - 1) * limit },
  //   { $limit: limit }
  // ];

  const pipeline = [
    {
      $match: {
        isDeleted: false,
        userIds: { $in: [userId] }
      }
    },
    {
      $facet: {
        metadata: [
          { $count: "totalCount" }
        ],
        data: [
          {
            $project: {
              title: 1,
              description: 1,
              sentAt: "$createdAt"
            }
          },
          { $sort: { sentAt: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit }
        ]
      }
    }
  ];

  const notifications = await Notification.aggregate(pipeline);
  const total = notifications[0].metadata[0] ? notifications[0].metadata[0].totalCount : 0;

  res.paginated(notifications, { page, limit, total, pages: Math.ceil(total / limit) }, "Notifications fetched successfully");
});

// Get notifications dropdown for admin and employee
exports.getNotificationsDropdownAdminAndEmployee = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const notifications = await Notification.find({ userIds: userId, isDeleted: false })
    .select('title description createdAt')
    .sort({ createdAt: -1 });

  res.ok(notifications, "Notifications fetched successfully");
});

// Helper function to send bulk notifications
async function sendBulkNotifications(notification) {
  try {
    let users = [];

    if (notification.userType === 'all-customers') {
      users = await User.find({
        role: 'customer',
        isActive: true,
        isDeleted: false,
        fcmToken: { $ne: null }
      }).select('fcmToken');
    } else if (notification.userType === 'specific-customer') {
      users = await User.find({
        _id: { $in: notification.userIds },
        isActive: true,
        isDeleted: false,
        fcmToken: { $ne: null }
      }).select('fcmToken');
    }

    const sendPromises = users.map(async (user) => {
      try {
        const messageData = {
          token: [user.fcmToken],
          title: notification.title,
          body: notification.description || '',
          image: notification.image,
          data: {
            redirectionUrl: notification.redirectionUrl || '',
            deepLink: notification.redirectionUrl || '',
            redirectId: notification.redirectId || '',
            notificationId: notification._id.toString(),
            type: notification.notificationType
          }
        };

        await sendFirebaseNotification(messageData);
        return { success: true, userId: user._id };
      } catch (error) {
        console.error(`Failed to send notification to user ${user._id}:`, error.message);
        return { success: false, userId: user._id, error: error.message };
      }
    });

    const results = await Promise.all(sendPromises);

    // Update notification stats
    const successCount = results.filter(result => result.success).length;
    const failedCount = results.filter(result => !result.success).length;

    await Notification.findByIdAndUpdate(notification._id, {
      'stats.success': successCount,
      'stats.failed': failedCount
    });

    console.log(`✅ Bulk notification completed: ${successCount} successful, ${failedCount} failed`);
  } catch (error) {
    console.error('❌ Bulk notification error:', error);
  }
}

// Additional utility controllers

// Get notification by ID
exports.getNotificationById = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id)
    .populate('userIds', 'email mobileNo profileImage');

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  res.status(200).json({
    success: true,
    data: notification
  });
});

// Update notification
exports.updateNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  // Prevent updating already sent notifications
  if (notification.status === 'active' && !notification.scheduledAt) {
    return res.status(400).json({
      success: false,
      message: 'Cannot update already sent notifications'
    });
  }

  const updatedNotification = await Notification.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('userIds', 'email mobileNo profileImage');

  res.status(200).json({
    success: true,
    message: 'Notification updated successfully',
    data: updatedNotification
  });
});

// Delete notification
exports.deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  await Notification.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Notification deleted successfully'
  });
});

// Send immediate notification to multiple users
exports.sendImmediateNotification = asyncHandler(async (req, res) => {
  const { userIds, title, description, image, redirectionUrl, redirectId, notificationType = 'in-app' } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'userIds array is required'
    });
  }

  if (!title) {
    return res.status(400).json({
      success: false,
      message: 'Title is required'
    });
  }

  // Create and save notification
  const notification = new Notification({
    from: req.user.role,
    title,
    description,
    image,
    notificationType,
    redirectionUrl,
    redirectId,
    userType: 'specific-customer',
    userIds,
    status: 'active',
    stats: {
      success: 0,
      failed: 0
    }
  });

  const savedNotification = await notification.save();

  // Send notifications immediately
  await sendBulkNotifications(savedNotification);

  res.status(201).json({
    success: true,
    message: 'Notification sent successfully',
    data: savedNotification
  });
});

// remove all notifications for customer
exports.expireAllNotificationsCustomer = asyncHandler(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user._id);

  const result = await Notification.updateMany(
    {
      userIds: userId,  // will match ObjectId in array
      isDeleted: false
    },
    {
      $set: {
        isDeleted: true,
        expiryDate: new Date().toISOString()
      }
    }
  );

  if (result.modifiedCount === 0) {
    return res.status(404).json({
      success: false,
      message: 'No notifications found for the user'
    });
  }

  res.ok(null, 'All notifications cleared');
});