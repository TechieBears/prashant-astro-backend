const { default: mongoose } = require('mongoose');
const Notification = require('../modules/notification/notification.model');
const productOrderSchema = require('../modules/productOrder/productOrder.model');
const userSchema = require('../modules/auth/user.Model');
const serviceOrderItemSchema = require('../modules/serviceOrder/serviceOrderItem.model');
const sendEmail = require('../services/email.service');
const { generateTemplates } = require('./templates');
const { sendFirebaseNotification } = require('../utils/firebaseNotification');
// const { sendWhatsAppTemplate } = require('../services/whatsapp.service');
const moment = require('moment');
const { sendSMSTemplate } = require('../services/sms.service');

// Flat JSON with key order: for → title → message
const pnData = [
  // PRODUCT ORDER NOTIFICATIONS
  { for: "PENDING", title: "📦🛒 Order Confirmed! 🎉", message: "We’ve successfully received your order and started processing it. 🛍️ Thank you for shopping with us! 🙏✨" },
  // { for: "CONFIRMED", title: "🏷️🔄 Order Processing! 📦", message: "Your order has been accepted and is now being prepared with care. 💫 We’ll notify you once it’s ready for dispatch. 🚀" },
  { for: "CONFIRMED", title: "📦✅ Ready for Dispatch!", message: "Great news! Your order is packed and ready to be shipped. 🌟 We’ll update you as soon as it’s on the way. ✨" },
  { for: "SHIPPED", title: "🚗💨 Order On the Way! 📦", message: "Your order has been dispatched and is heading to you. 🚀 Track your delivery for live updates anytime. 📲✨" },
  { for: "DELIVERED", title: "🚴📍 Out for Delivery!", message: "Your order is out for delivery and will reach you soon. 🎉 Please keep your phone accessible for updates. 📞✨" },
  { for: "ORDER_DELIVERED", title: "🎉📬 Order Delivered Successfully! 📦", message: "Your package has arrived safely! 🎁✨ We hope it brings positivity and happiness. Thank you for choosing us! 🙏🌟" },
  { for: "CANCELLED", title: "❌📦 Order Cancelled", message: "Your order has been cancelled as requested. If you need help or wish to reorder, we’re here for you. 💬✨" },
  { for: "ORDER_RETURNED", title: "🔄📦 Return Initiated", message: "We’ve received your return request. 📝 Our team will process it and keep you updated. ⏳✨" },
  { for: "REFUNDED", title: "💸✅ Refund Successful", message: "Your refund has been processed successfully. 💳✨ The amount will reflect in your account shortly. 🙏" },

  // SERVICE / ASTRO NOTIFICATIONS
  { for: "SERVICE_BOOKED", title: "📅✨ Service Booked Successfully!", message: "Your astrology service has been booked successfully. 🔮 Our astrologer will review your details and confirm shortly. 🌟" },
  { for: "SERVICE_CONFIRMED", title: "✅🔮 Service Confirmed!", message: "Good news! Your astrology service has been confirmed. 🌙 Please be available at the scheduled time. ⏰✨" },
  { for: "SERVICE_REJECTED", title: "❌📅 Astrologer Unavailable", message: "Unfortunately, the selected service slot is unavailable. 😔 Please choose a different time and try again.🔄✨" },
  { for: "SERVICE_PENDING", title: "🔄 Astrologer Status Pending", message: "Still waiting for the astrologer to accept your service request.🔄✨" },
  { for: "SERVICE_REMINDER", title: "⏰🔔 Upcoming Service Reminder", message: "Your astrology session is starting soon. 🌟 Please be ready and join on time for a smooth experience. ✨" },
  { for: "SERVICE_STARTED", title: "🎙️🌙 Service Started", message: "Your astrologer is ready and the session has begun. 🔮 Join now to start your consultation. 🚀✨" },
  { for: "SERVICE_COMPLETED", title: "🌟✅ Service Completed", message: "Your astrology session has been completed successfully. 🌙 Thank you for trusting our guidance. 🙏✨" },
  { for: "REPORT_GENERATED", title: "📄🔮 Your Report is Ready!", message: "Your personalized astrology report has been generated. ✨ You can now view or download it anytime. 📥🌟" },
  { for: "SERVICE_RESCHEDULED", title: "🔄📅 Service Rescheduled", message: "Your astrology service has been rescheduled successfully. ⏳ Please check the updated date and time. ✨" },
  { for: "SERVICE_CANCELLED", title: "🚫📅 Service Cancelled", message: "Your astrology service has been cancelled. If you need help or wish to rebook, we’re here for you. 💬✨" },

  // ACCOUNT / SYSTEM NOTIFICATIONS
  { for: "USER_REGISTERED", title: "🎉👤 Welcome to Soul Plan", message: "Your account has been created successfully. 🌟 Begin your spiritual journey with us today. 🔮✨" },
  { for: "ASTROLOGER_REGISTERED", title: "🔮🧑‍🏫 Profile Submitted", message: "Your astrologer profile has been submitted for review. 📝 We’ll notify you once it’s approved. ⏳✨" },
  { for: "ASTROLOGER_APPROVED", title: "✅🔮 Profile Approved", message: "Congratulations! Your astrologer profile is now live. 🌟 You can start accepting consultations. 🚀✨" },
  { for: "ASTROLOGER_REJECTED", title: "🚫🔮 Profile Not Approved", message: "Your astrologer profile could not be approved at this time. Please update your details and resubmit. ✨" }
];

// Filter function by `for` code
function getNotificationsByCode(code) {
  return pnData.filter(n => n.for === code);
}

function replaceTemplateVariables(template, data) {
  return template.replace(/{(\w+)}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : match;
  });
}


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

    return { success: true };
  } catch (error) {
    console.error('❌ Error in sendOrderNotification:', error.message);
    return { success: false, error: error.message };
  }
};

async function commonNotification(notificationFor, type, id, extraId = "") {
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
              const NotifData = getNotificationsByCode("CONFIRMED")[0];
              if (productData[0].userData.fcmToken) {
                const notificationData = {
                  token: [productData[0].userData.fcmToken],
                  title: NotifData.title,
                  body: NotifData.message || '',
                  image: "",
                  data: {
                    redirectionUrl: NotifData.redirectionUrl || '',
                    deepLink: NotifData.redirectionUrl || '',
                    redirectId: NotifData.redirectId || '',
                    type: NotifData.notificationType || '',
                    image: "",
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
                title: NotifData.title,
                description: NotifData.message || '',
                image: null,
                notificationType: 'in-app',
                redirectionUrl: NotifData.redirectionUrl || '',
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

              const response = await sendSMSTemplate({
                toNumber: productData[0].userData.mobileNo,
                entityId: process.env.SMS_ENTITY_NUMBER,
                templateId: process.env.PRODUCT_BOOKED_SMS_TEMPLATE_ID,
                message: await replaceTemplateVariables(process.env.PRODUCT_BOOKED_SMS, {
                  name: `${productData[0].customerData.firstName} ${productData[0].customerData.lastName}`,
                  bookingId: productData[0]._id.toString()
                }),
              });

              //Email
              const { userBody, adminBody } = await generateTemplates('PRODUCT_BOOKING', productData[0]);
              const mailData = {
                email: [productData[0].userData.email],       //User Email
                // email: 'rohitmiryala2@gmail.com',
                subject: 'Product Booking',
                message: userBody,
                template: 'productBooking',
              }
              await sendEmail(mailData);
              const mailDataAdmin = {
                email: [process.env.ADMIN_EMAIL], // Admin Email
                subject: `${productData[0]?.customerData?.firstName} has booked product successfully`,
                message: adminBody,
                template: 'productBooking',
              }
              await sendEmail(mailDataAdmin);
            }
            return productData;
          case 'PRODUCT_STATUS_UPDATE':
            if (productData.length > 0) {
              const NotifData = getNotificationsByCode(productData[0].orderStatus)[0];
              //User Notification
              // PN 
              if (productData[0].userData.fcmToken) {
                const notificationData = {
                  token: [productData[0].userData.fcmToken],
                  title: NotifData.title,
                  body: NotifData.message || '',
                  image: "",
                  data: {
                    redirectionUrl: NotifData.redirectionUrl || '',
                    deepLink: NotifData.redirectionUrl || '',
                    redirectId: NotifData.redirectId || '',
                    type: NotifData.notificationType || '',
                    image: "",
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
                title: NotifData.title,
                description: NotifData.message || '',
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
                email: [productData[0].userData.email],
                subject: `Your Order Status is now ${productData[0].orderStatus}`,
                message: userBody,
                template: 'productStatusUpdate',
              };
              await sendEmail(mailData);
              const AdminmailData = {
                email: [process.env.ADMIN_EMAIL],//Admin Email
                subject: `${productData[0]?.customerData?.firstName} Order Status is now ${productData[0].orderStatus}`,
                message: adminBody,
                template: 'productStatusUpdate',
              };
              await sendEmail(AdminmailData);
              const response = await sendSMSTemplate({
                toNumber: productData[0].userData.mobileNo,
                entityId: process.env.SMS_ENTITY_NUMBER,
                templateId: process.env.PRODUCT_STATUS_UPDATE_SMS_TEMPLATE_ID,
                message: await replaceTemplateVariables(process.env.PRODUCT_STATUS_UPDATE_SMS, {
                  name: `${productData[0].customerData.firstName} ${productData[0].customerData.lastName}`,
                  bookingId: productData[0]._id.toString(),
                  currentStatus: productData[0].orderStatus,
                }),
              });
            }
        }
      case 'service':
        const itemID = new mongoose.Types.ObjectId(id);
        const serviceItem = await serviceOrderItemSchema.aggregate([
          { $match: { orderId: itemID.toString() } },
          { $lookup: { from: 'users', localField: 'customerId', foreignField: '_id', as: 'userData' } },
          { $lookup: { from: 'users', localField: 'astrologer', foreignField: '_id', as: 'astrologerData' } },
          { $unwind: { path: '$userData', preserveNullAndEmptyArrays: true } },
          { $unwind: { path: '$astrologerData', preserveNullAndEmptyArrays: true } },
          { $addFields: { astrologerProfileID: '$astrologerData.profile' } },
          { $addFields: { profileID: '$userData.profile' } },
          { $lookup: { from: 'customers', localField: 'profileID', foreignField: '_id', as: 'customerData' } },
          { $unwind: { path: '$customerData', preserveNullAndEmptyArrays: true } },
          { $lookup: { from: 'employees', localField: 'astrologerProfileID', foreignField: '_id', as: 'astrologerProfile' } },
          { $unwind: { path: '$astrologerProfile', preserveNullAndEmptyArrays: true } },
          { $lookup: { from: 'services', localField: 'service', foreignField: '_id', as: 'serviceData' } }
        ])
        switch (notificationFor) {
          case 'SERVICE_BOOKING':

            if (serviceItem.length > 0) {
              const NotifData = getNotificationsByCode("SERVICE_BOOKED")[0];
              if (serviceItem[0].userData.fcmToken) {
                const messageData = {
                  token: [serviceItem[0].userData.fcmToken],
                  title: NotifData.title,
                  body: NotifData.message || '',
                  image: "",
                  data: {
                    redirectionUrl: NotifData.redirectionUrl || '',
                    deepLink: NotifData.redirectionUrl || '',
                    redirectId: NotifData.redirectId || '',
                    type: NotifData.notificationType || '',
                    image: "",
                  }
                };

                await sendFirebaseNotification(messageData);
              }
              const notification = new Notification({
                from: 'app',
                title: NotifData.title,
                description: NotifData.message || '',
                image: null,
                notificationType: 'in-app',
                redirectionUrl: NotifData.redirectionUrl || '',
                redirectId: NotifData.redirectId || '',
                userType: 'specific-customer',
                userIds: [serviceItem[0].userData._id.toString()],
                status: 'active',
                stats: {
                  success: serviceItem[0].userData.fcmToken ? 1 : 0,
                  failed: serviceItem[0].userData.fcmToken ? 0 : 1
                }
              });
              await notification.save();
              for (let item of serviceItem) {
                //email + sms + whatsapp (Submitted Number) // User
                const { userBody, adminBody } = await generateTemplates('SERVICE_BOOKING', serviceItem[0]);
                const mailData = {
                  email: [item.cust.email],       //User Email
                  subject: 'Service Booked',
                  message: userBody
                }
                await sendEmail(mailData);      //uncomment
                const mailDataAdmin = {
                  email: [item?.astrologerData.email],
                  subject: `${item?.customerData?.firstName} has Service booked successfully`,
                  message: adminBody,
                  cc: [process.env.ADMIN_EMAIL]
                }
                await sendEmail(mailDataAdmin);                    //uncomment

                //SMS
                const response = await sendSMSTemplate({
                  toNumber: item.cust.phone,
                  entityId: process.env.SMS_ENTITY_NUMBER,
                  templateId: process.env.SERVICE_BOOKED_SMS_TEMPLATE_ID,
                  message: await replaceTemplateVariables(process.env.SERVICE_BOOKED_SMS, {
                    name: `${item?.cust?.firstName} ${item?.cust?.lastName}`,
                    bookingId: item._id.toString(),
                    date: moment(item?.bookingDate).format("DD MMM YYYY"),
                    time: item?.startTime + " - " + item?.endTime
                  }),
                });

                //Astrologer // Email + whatsapp
                // const whatsAppData = {
                //   toNumbers: item.cust?.phone,
                //   templateName: "booking_created",
                //   components: {
                //     "body_1": {
                //       "type": "text",
                //       "value": item?.customerData?.firstName || "Customer"
                //     },
                //     "body_2": {
                //       "type": "text",
                //       "value": item?.serviceData[0]?.name || "Service"
                //     },
                //     "body_3": {
                //       "type": "text",
                //       "value": moment(item?.bookingDate).format("DD-MM-YYYY")
                //     },
                //     "body_4": {
                //       "type": "text",
                //       "value": `${item?.startTime} - ${item?.endTime}` || "Please Check Dashboard"
                //     },
                //     "body_5": {
                //       "type": "text",
                //       "value": item?.orderId || "OrderId"
                //     },
                //     "body_6": {
                //       "type": "text",
                //       "value": item?.serviceType.toUpperCase() || "Online"
                //     }
                //   }
                // }
                // await sendWhatsAppTemplate(whatsAppData);
                //Admin //whatapp 
                // const awhatsAppData = {
                //   toNumbers: item?.astrologerData?.mobileNo,
                //   templateName: "astro_session_create",
                //   components: {
                //     "body_1": {
                //       "type": "text",
                //       "value": item?.astrologerProfile?.firstName || "Astrologer"
                //     },
                //     "body_2": {
                //       "type": "text",
                //       "value": `${item?.customerData?.firstName} ${item?.customerData?.lastName}` || "Customer"
                //     },
                //     "body_3": {
                //       "type": "text",
                //       "value": item?.serviceData[0]?.name || "Service"
                //     },
                //     "body_4": {
                //       "type": "text",
                //       "value": moment(item?.bookingDate).format("DD-MM-YYYY")
                //     },
                //     "body_5": {
                //       "type": "text",
                //       "value": `${item?.startTime} - ${item?.endTime}` || "Please Check Dashboard"
                //     },
                //     "body_6": {
                //       "type": "text",
                //       "value": item?.orderId || "OrderId"
                //     },
                //     "body_7": {
                //       "type": "text",
                //       "value": item?.serviceType.toUpperCase() || "Online"
                //     }
                //   }
                // }
                // await sendWhatsAppTemplate(awhatsAppData);
              }
            }
            return serviceItem;
          case 'SERVICE_STATUS_CHANGE':
            const finalItem = serviceItem.filter(item => item._id.toString() == extraId.toString())
            if (finalItem.length > 0) {
              const NotifData = getNotificationsByCode(finalItem[0].astrologerStatus == 'accepted' ? "SERVICE_CONFIRMED" : finalItem[0].astrologerStatus == 'rejected' ? "SERVICE_REJECTED" : "SERVICE_PENDING")[0];
              if (finalItem[0].userData.fcmToken) {
                const messageData = {
                  token: [finalItem[0].userData.fcmToken],
                  title: NotifData.title,
                  body: NotifData.message || '',
                  image: "",
                  data: {
                    redirectionUrl: NotifData.redirectionUrl || '',
                    deepLink: NotifData.redirectionUrl || '',
                    redirectId: NotifData.redirectId || '',
                    type: NotifData.notificationType || '',
                    image: "",
                  }
                };

                await sendFirebaseNotification(messageData);
              }
              const notification = new Notification({
                from: 'app',
                title: NotifData.title,
                description: `${NotifData.message}` || '',
                image: null,
                notificationType: 'in-app',
                redirectionUrl: NotifData.redirectionUrl || '',
                redirectId: NotifData.redirectId || '',
                userType: 'specific-customer',
                userIds: [finalItem[0].userData._id.toString()],
                status: 'active',
                stats: {
                  success: finalItem[0].userData.fcmToken ? 1 : 0,
                  failed: finalItem[0].userData.fcmToken ? 0 : 1
                }
              });
              await notification.save();
              for (let item of finalItem) {
                //email + sms + whatsapp (Submitted Number) // User
                const { userBody, adminBody } = await generateTemplates('SERVICE_STATUS_CHANGE', finalItem[0]);
                const mailData = {
                  email: [item.cust.email],       //User Email
                  subject: finalItem[0].astrologerStatus == 'accepted' ? "Service Confirmed" : finalItem[0].astrologerStatus == 'rejected' ? "Service Rejected" : "SERVICE PENDING",
                  message: userBody
                }
                await sendEmail(mailData);      //uncomment
                const mailDataAdmin = {
                  email: [process.env.ADMIN_EMAIL],           // Admin Email
                  // email: [item?.astrologerData.email],
                  subject: `${item?.customerData?.firstName} Service Status updated`,
                  message: adminBody
                }
                await sendEmail(mailDataAdmin);                    //uncomment  //send Only SuperAdmin
                //Astrologer // Email + whatsapp
                //Admin //Email 
                if (finalItem[0].astrologerStatus == 'accepted') {
                  const whatsAppData = {
                    toNumbers: item.cust?.phone,
                    templateName: "booking_created",
                    components: {
                      "body_1": {
                        "type": "text",
                        "value": item?.customerData?.firstName || "Customer"
                      },
                      "body_2": {
                        "type": "text",
                        "value": item?.orderId || "OrderId"
                      },
                      "body_3": {
                        "type": "text",
                        "value": moment(item?.bookingDate).format("DD-MM-YYYY")
                      },
                      "body_4": {
                        "type": "text",
                        "value": item?.serviceType.toUpperCase() || "Online"
                      },
                      "body_5": {
                        "type": "text",
                        "value": item?.serviceData[0]?.name || "Service"
                      },
                      "body_6": {
                        "type": "text",
                        "value": item?.astrologerProfile?.firstName ? `${item?.astrologerProfile?.firstName} ${item?.astrologerProfile?.lastName}` : "Please Check Dashboard"
                      },
                      "button_1": {
                        "subtype": "url",
                        "type": "text",
                        "value": "https://www.soulplan.net/"
                      }
                    }
                  }
                  // await sendWhatsAppTemplate(whatsAppData);
                  const response = await sendSMSTemplate({
                    toNumber: item.cust.phone,
                    entityId: process.env.SMS_ENTITY_NUMBER,
                    templateId: process.env.APPOINTMENT_CONFIRMED_SMS_TEMPLATE_ID,
                    message: await replaceTemplateVariables(process.env.APPOINTMENT_CONFIRMED_SMS, {
                      name: `${item?.cust?.firstName} ${item?.cust?.lastName}`,
                      bookingId: item._id.toString(),
                      date: moment(item?.bookingDate).format("DD MMM YYYY"),
                      time: item?.startTime + " - " + item?.endTime
                    }),
                  });
                } else if (finalItem[0].astrologerStatus == 'rejected') {
                  const awhatsAppData = {
                    toNumbers: item?.astrologerData?.mobileNo,
                    templateName: "admin_reject",
                    components: {
                      "body_1": {
                        "type": "text",
                        "value": "Admin"
                      },
                      "body_2": {
                        "type": "text",
                        "value": item?.serviceData[0]?.name || "Service"
                      },
                      "body_3": {
                        "type": "text",
                        "value": moment(item?.bookingDate).format("DD-MM-YYYY")
                      },
                      "body_4": {
                        "type": "text",
                        "value": `${item?.startTime} - ${item?.endTime}` || "Please Check Dashboard"
                      },
                      "body_5": {
                        "type": "text",
                        "value": item?.orderId || "OrderId"
                      },
                      "body_6": {
                        "type": "text",
                        "value": item?.rejectReason || "Please Check Dashboard"
                      },
                      "body_7": {
                        "type": "text",
                        "value": `${item?.customerData?.firstName} ${item?.customerData?.lastName}` || "Customer"
                      },
                      "body_8": {
                        "type": "text",
                        "value": `${item?.astrologerProfile?.firstName} ${item?.astrologerProfile?.lastName}` || "Customer"
                      }
                      // "value": item?.serviceType.toUpperCase() || "Online"
                    }
                  }
                  // await sendWhatsAppTemplate(awhatsAppData);
                  const response = await sendSMSTemplate({
                    toNumber: item.cust.phone,
                    entityId: process.env.SMS_ENTITY_NUMBER,
                    templateId: process.env.APPOINTMENT_REJECTED_SMS_TEMPLATE_ID,
                    message: await replaceTemplateVariables(process.env.APPOINTMENT_REJECTED_SMS, {
                      name: `${item?.cust?.firstName} ${item?.cust?.lastName}`,
                      bookingId: item._id.toString()
                    }),
                  });
                }
              }
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
      case 'registration':
        switch (notificationFor) {
          case 'user': {
            const userData = await userSchema.findById(id).populate('profile');
            const { userBody } = await generateTemplates('USER_REGISTRATION', userData);
            const mailData = {
              email: [userData?.email],
              subject: 'You are now registered with Soul Plan',
              message: userBody,
              template: 'userRegistration',
            };
            await sendEmail(mailData);
            break;
          }
          case 'astrologer': {
            const astroData = await userSchema.findById(id).populate('profile');
            const { userBody } = await generateTemplates('USER_REGISTRATION', astroData);
            const mailData = {
              email: [astroData?.email].filter(Boolean),
              subject: 'You are now registered with Soul Plan',
              message: userBody,
              template: 'userRegistration',
            };
            await sendEmail(mailData);
            break;
          }
        }
        break;
    }
  } catch (err) {
    console.log("🚀 ~ commonNotification ~ err:", err);
    return err;
  }
}

module.exports = { sendOrderNotification, sendOrderUpdateNotification, commonNotification };