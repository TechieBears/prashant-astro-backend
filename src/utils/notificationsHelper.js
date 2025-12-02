const { default: mongoose } = require('mongoose');
const Notification = require('../modules/notification/notification.model');
const productOrderSchema = require('../modules/productOrder/productOrder.model');
const serviceOrderSchema = require('../modules/serviceOrder/serviceOrder.model');
const serviceOrderItemSchema = require('../modules/serviceOrder/serviceOrderItem.model');
const sendEmail = require('../services/email.service');
const { generateTemplates } = require('./templates');
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

const sendOrderUpdateNotification = async (order, notificationTitle, notificationBody, user) => {
  try {
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
          orderId: order._id.toString(),
          type: 'PRODUCT_ORDER',
          screen: 'ORDER_DETAILS',
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
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
      redirectId: order._id.toString(),
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

async function commonNotification(notificationFor, type, id) {
  try {
    switch (type) {
      case 'product':
        const ID = new mongoose.Types.ObjectId(id);
        const productData = await productOrderSchema.aggregate([
          { $match: { _id: ID } },
          { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userData' } },
          { $unwind: '$userData' },
          { $addFields: { profileID: '$userData.profile' } },
          { $lookup: { from: 'customers', localField: 'profileID', foreignField: '_id', as: 'customerData' } },
          { $unwind: '$customerData' },
          { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'productData' } }
          // { $project: { _id: 1, userData: 1, customerData: 1 } }
        ])
        switch (notificationFor) {
          case 'PRODUCT_BOOKING':
            /*
              User = InApp ,PN,Email,SMS,Whatsapp
              Admin = Email
              */
            if (productData.length > 0) {
              //User Notification
              // PN 
              if (productData[0].userData.fcmToken) {
                const notificationData = {
                  token: productData[0].userData.fcmToken,
                  title: 'Product Booking',
                  body: 'Your product booking has been placed successfully!',
                  image: null,
                  data: {
                    orderId: productData[0]._id.toString(),
                    type: 'PRODUCT_ORDER',
                    screen: 'ORDER_DETAILS',
                    paymentStatus: productData[0].paymentStatus,
                    orderStatus: productData[0].orderStatus,
                    payingAmount: productData[0].payingAmount.toString()
                  }
                };
                await sendFirebaseNotification(notificationData);
              }

              // InApp
              const notification = new Notification({
                from: 'app',
                title: 'Product Booking',
                description: 'Your product booking has been placed successfully!',
                image: null,
                notificationType: 'in-app',
                redirectionUrl: '/orders',
                redirectId: productData[0]._id.toString(),
                userType: 'specific-customer',
                userIds: [productData[0].userData._id.toString()],
                status: 'active',
                stats: {
                  success: productData[0].userData.fcmToken ? 1 : 0,
                  failed: productData[0].userData.fcmToken ? 0 : 1
                }
              });
              await notification.save();

              //Email
              const { userBody, adminBody } = await generateTemplates('PRODUCT_BOOKING', productData[0]);
              const mailData = {
                // email: [productData[0].userData.email],       //User Email
                email: ['ronildussa@gmail.com'],
                subject: 'Product Booking',
                message: userBody,
                template: 'productBooking',
              }
              await sendEmail(mailData);
              const mailDataAdmin = {
                email: ["ronildussa@gmail.com"],           // Admin Email
                // email: [productData[0].userData.email],
                subject: `${productData[0]?.customerData?.firstName} has product booked successfully`,
                message: adminBody,
                template: 'productBooking',
              }
              await sendEmail(mailDataAdmin);

            }
            return productData;
          case 'PRODUCT_STATUS_UPDATE':
            if (productData.length > 0) {
              //User Notification
              // PN 
              if (productData[0].userData.fcmToken) {
                const notificationData = {
                  token: productData[0].userData.fcmToken,
                  title: 'Product Status Update',
                  body: 'Your product booking status has been updated!',
                  image: null,
                  data: {
                    orderId: productData[0]._id.toString(),
                    type: 'PRODUCT_ORDER',
                    screen: 'ORDER_DETAILS',
                    paymentStatus: productData[0].paymentStatus,
                    orderStatus: productData[0].orderStatus,
                    payingAmount: productData[0].payingAmount.toString()
                  }
                };
                await sendFirebaseNotification(notificationData);
              }

              // InApp
              const notification = new Notification({
                from: 'app',
                title: 'Product Status Update',
                description: 'Your product booking status has been updated!',
                image: null,
                notificationType: 'in-app',
                redirectionUrl: '/orders',
                redirectId: productData[0]._id.toString(),
                userType: 'specific-customer',
                userIds: [productData[0].userData._id.toString()],
                status: 'active',
                stats: {
                  success: productData[0].userData.fcmToken ? 1 : 0,
                  failed: productData[0].userData.fcmToken ? 0 : 1
                }
              });
              await notification.save();

              //Email
              const { userBody, adminBody } = await generateTemplates('PRODUCT_STATUS_UPDATE', productData[0]);
              const mailData = {
                email: ['ronildussa@gmail.com'],
                subject: `Your Order Status is now ${productData[0].orderStatus}`,
                message: userBody,
                template: 'productStatusUpdate',
              };
              await sendEmail(mailData);
              const AdminmailData = {
                email: ['ronildussa@gmail.com'],
                subject: `${productData[0]?.customerData?.firstName} Order Status is now ${productData[0].orderStatus}`,
                message: adminBody,
                template: 'productStatusUpdate',
              };
              await sendEmail(AdminmailData);

            }
        }
      case 'service':
        const itemID = new mongoose.Types.ObjectId(id);
        const serviceItem = await serviceOrderItemSchema.aggregate([
          { $match: { _id: itemID } },
          { $lookup: { from: 'users', localField: 'customerId', foreignField: '_id', as: 'userData' } },
          { $lookup: { from: 'users', localField: 'astrologer', foreignField: '_id', as: 'astrologerData' } },
          { $unwind: { path: '$userData', preserveNullAndEmptyArrays: true } },
          { $unwind: { path: '$astrologerData', preserveNullAndEmptyArrays: true } },
          { $addFields: { profileID: '$userData.profile' } },
          { $addFields: { astrologerProfileID: '$astrologerData.profile' } },
          { $lookup: { from: 'customers', localField: 'profileID', foreignField: '_id', as: 'customerData' } },
          { $unwind: { path: '$customerData', preserveNullAndEmptyArrays: true } },
          { $lookup: { from: 'employees', localField: 'astrologerProfileID', foreignField: '_id', as: 'astrologerData' } },
          { $unwind: { path: '$astrologerData', preserveNullAndEmptyArrays: true } },
          { $lookup: { from: 'services', localField: 'service', foreignField: '_id', as: 'serviceData' } }
        ])
        switch (notificationFor) {
          case 'SERVICE_BOOKING':
            if (serviceItem.length > 0) {
              if (serviceItem[0].userData.email != serviceItem[0].cust.email || serviceItem[0].cust.phone != serviceItem[0].userData.mobileNo) {
                //email + sms + whatsapp (Number Submitted) // User
                const { userBody, adminBody } = await generateTemplates('SERVICE_BOOKING', serviceItem[0]);
              } else {
                //pn + email + whatsapp +sms + inapp // USER
              }

              //Astrologer // Email + whatsapp
              //Admin //Email 
            }
            return serviceItem;
          case 'SERVICE_STATUS_CHANGE':
            if (serviceItem.length > 0) {
              if (serviceItem[0].userData.email != serviceItem[0].cust.email || serviceItem[0].cust.phone != serviceItem[0].userData.mobileNo) {
                //email + sms + whatsapp (Number Submitted) // User
              } else {
                //pn + email + whatsapp +sms + inapp // USER
              }

              //Astrologer // Email + whatsapp
              //Admin //Email 
            }
            return serviceItem;
          case 'UPCOMING_BOOKINGS':
            if (serviceItem.length > 0) {
              if (serviceItem[0].userData.email != serviceItem[0].cust.email || serviceItem[0].cust.phone != serviceItem[0].userData.mobileNo) {
                //email + sms + whatsapp (Number Submitted) // User
              } else {
                //pn + email + whatsapp +sms + inapp // USER
              }

              //Astrologer // Email + whatsapp
              //Admin //Email 
            }
            return serviceItem;
        }
    }
  } catch (err) {
    console.log("🚀 ~ commonNotification ~ err:", err);
    return err;
  }
}

module.exports = { sendOrderNotification, sendOrderUpdateNotification, commonNotification };