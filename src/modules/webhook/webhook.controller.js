const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const mongoose = require('mongoose');
const ProductOrder = require('../productOrder/productOrder.model');
const ServiceOrder = require('../serviceOrder/serviceOrder.model');
const ServiceOrderItem = require('../serviceOrder/serviceOrderItem.model');
const Transaction = require('../transaction/transaction.Model');
const Wallet = require('../wallet/wallet.model');
const WalletTransaction = require('../wallet/walletTransactions.model');
const razorpay = require('../../config/razorpay');
const { processReferralReward } = require('../../services/referral.service');
const { commonNotification } = require('../../utils/notificationsHelper');

/**
 * Verify Razorpay webhook signature
 */
const verifyRazorpaySignature = (payloadString, signature, secret) => {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadString); // <- no JSON.stringify here
  const generatedSignature = hmac.digest('hex');
  return generatedSignature === signature;
};


/**
 * Handle Razorpay webhook payload processing
 */
// const processRazorpayWebhook = async (payload) => {
//   const event = payload.event;
//   const paymentEntity = payload.payload?.payment?.entity;
//   const orderEntity = payload.payload?.order?.entity;

//   if (!paymentEntity || !orderEntity) {
//     throw new Error('Invalid webhook payload structure');
//   }

//   const orderType = orderEntity.notes?.orderType || paymentEntity.notes?.orderType;
//   const userId = orderEntity.notes?.userId || paymentEntity.notes?.userId;
//   const orderId = orderEntity.id || paymentEntity.order_id;
//   const paymentId = paymentEntity.id;
//   const amount = paymentEntity.amount / 100; // Convert from paise to rupees
//   const status = paymentEntity.status;

//   if (!orderType || !userId) {
//     throw new Error('Missing orderType or userId in webhook payload');
//   }

//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     if (event === 'payment.captured' && status === 'captured') {
//       if (orderType === 'PRODUCT') {
//         // Handle product order payment
//         const productOrder = await ProductOrder.findOne({
//           'paymentDetails.razorpayOrderId': orderId
//         }).session(session);

//         if (!productOrder) {
//           throw new Error(`Product order not found for orderId: ${orderId}`);
//         }

//         // Update order status
//         productOrder.paymentStatus = 'PAID';
//         productOrder.orderStatus = 'CONFIRMED';
//         productOrder.orderHistory.push({
//           status: 'CONFIRMED',
//           date: new Date()
//         });
//         productOrder.paymentDetails = {
//           ...productOrder.paymentDetails,
//           razorpayPaymentId: paymentId,
//           razorpayPaymentStatus: status,
//           webhookReceived: true
//         };
//         await productOrder.save({ session });

//         // Update transaction
//         const transaction = await Transaction.findOne({
//           productOrderId: productOrder._id
//         }).session(session);

//         if (transaction) {
//           transaction.status = 'paid';
//           transaction.amount = productOrder.payingAmount;
//           transaction.pendingAmount = 0;
//           transaction.paymentDetails = {
//             ...transaction.paymentDetails,
//             razorpayPaymentId: paymentId,
//             razorpayPaymentStatus: status,
//             webhookReceived: true
//           };
//           await transaction.save({ session });
//         }

//         // Process referral reward
//         await processReferralReward(productOrder.user, session);

//         // Send notification
//         await commonNotification('PRODUCT_BOOKING', "product", productOrder._id.toString());

//       } else if (orderType === 'SERVICE') {
//         // Handle service order payment
//         const serviceOrder = await ServiceOrder.findOne({
//           'paymentDetails.razorpayOrderId': orderId
//         }).session(session);

//         if (!serviceOrder) {
//           throw new Error(`Service order not found for orderId: ${orderId}`);
//         }

//         // Update service order status
//         serviceOrder.paymentStatus = 'paid';
//         serviceOrder.paymentDetails = {
//           ...serviceOrder.paymentDetails,
//           razorpayPaymentId: paymentId,
//           razorpayPaymentStatus: status,
//           webhookReceived: true
//         };
//         await serviceOrder.save({ session });

//         // Update transactions for all service items
//         const serviceItems = await ServiceOrderItem.find({
//           _id: { $in: serviceOrder.services }
//         }).session(session);

//         for (const item of serviceItems) {
//           if (item.transaction) {
//             const transaction = await Transaction.findById(item.transaction).session(session);
//             if (transaction) {
//               transaction.status = 'paid';
//               transaction.amount = item.total;
//               transaction.pendingAmount = 0;
//               transaction.paymentDetails = {
//                 ...transaction.paymentDetails,
//                 razorpayPaymentId: paymentId,
//                 razorpayPaymentStatus: status,
//                 webhookReceived: true
//               };
//               await transaction.save({ session });
//             }
//           }
//         }

//         // Process referral reward
//         await processReferralReward(serviceOrder.user, session);

//         // Send notification
//         await commonNotification('SERVICE_BOOKING', "service", serviceOrder._id.toString());

//       } else if (orderType === 'WALLET') {
//         // Handle wallet balance addition
//         const user = await mongoose.model('User').findById(userId).session(session);
//         if (!user) {
//           throw new Error(`User not found: ${userId}`);
//         }

//         // Get or create wallet
//         let wallet = await Wallet.findOne({ userId: user._id }).session(session);
//         if (!wallet) {
//           wallet = new Wallet({ userId: user._id, balance: 0 });
//           await wallet.save({ session });
//         }

//         // Add balance
//         wallet.balance += amount;
//         await wallet.save({ session });

//         // Create wallet transaction
//         const walletTransaction = new WalletTransaction({
//           userId: user._id,
//           type: 'deposit',
//           amount: amount,
//         });
//         await walletTransaction.save({ session });

//         // Send notification
//         await commonNotification('WALLET_TOPUP', "wallet", user._id.toString());
//       }
//     } else if (event === 'payment.failed') {
//       // Handle failed payment
//       if (orderType === 'PRODUCT') {
//         const productOrder = await ProductOrder.findOne({
//           'paymentDetails.razorpayOrderId': orderId
//         }).session(session);

//         if (productOrder) {
//           productOrder.paymentStatus = 'FAILED';
//           productOrder.paymentDetails = {
//             ...productOrder.paymentDetails,
//             razorpayPaymentId: paymentId,
//             razorpayPaymentStatus: 'failed',
//             webhookReceived: true
//           };
//           await productOrder.save({ session });
//         }
//       } else if (orderType === 'SERVICE') {
//         const serviceOrder = await ServiceOrder.findOne({
//           'paymentDetails.razorpayOrderId': orderId
//         }).session(session);

//         if (serviceOrder) {
//           serviceOrder.paymentStatus = 'failed';
//           serviceOrder.paymentDetails = {
//             ...serviceOrder.paymentDetails,
//             razorpayPaymentId: paymentId,
//             razorpayPaymentStatus: 'failed',
//             webhookReceived: true
//           };
//           await serviceOrder.save({ session });
//         }
//       }
//     }

//     await session.commitTransaction();
//     session.endSession();
//     return { success: true, message: 'Webhook processed successfully' };

//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     throw error;
//   }
// };

const processRazorpayWebhook = async (payload) => {
  const event = payload.event;

  const paymentEntity = payload.payload?.payment?.entity || null;
  const orderEntity = payload.payload?.order?.entity || null;

  if (!paymentEntity && !orderEntity) {
    throw new Error('Invalid webhook payload structure');
  }

  const notes = paymentEntity?.notes || orderEntity?.notes || {};

  const orderType = notes.orderType;
  const userId = notes.userId;

  const orderId =
    orderEntity?.id ||
    paymentEntity?.order_id;

  const paymentId = paymentEntity?.id;
  const amount = paymentEntity?.amount ? paymentEntity.amount / 100 : 0;
  const status = paymentEntity?.status;

  if (!orderType || !userId || !orderId) {
    console.warn('Webhook skipped due to missing metadata', {
      orderType,
      userId,
      orderId
    });
    return { skipped: true };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (event === 'payment.captured' && status === 'captured') {
      if (orderType === 'PRODUCT') {
        // Handle product order payment
        const productOrder = await ProductOrder.findOne({
          'paymentDetails.razorpayOrderId': orderId
        }).session(session);

        if (!productOrder) {
          throw new Error(`Product order not found for orderId: ${orderId}`);
        }

        // Update order status
        productOrder.paymentStatus = 'PAID';
        productOrder.orderStatus = 'CONFIRMED';
        productOrder.orderHistory.push({
          status: 'CONFIRMED',
          date: new Date()
        });
        productOrder.paymentDetails = {
          ...productOrder.paymentDetails,
          razorpayPaymentId: paymentId,
          razorpayPaymentStatus: status,
          webhookReceived: true
        };
        await productOrder.save({ session });

        // Update transaction
        const transaction = await Transaction.findOne({
          productOrderId: productOrder._id
        }).session(session);

        if (transaction) {
          transaction.status = 'paid';
          transaction.amount = productOrder.payingAmount;
          transaction.pendingAmount = 0;
          transaction.paymentDetails = {
            ...transaction.paymentDetails,
            razorpayPaymentId: paymentId,
            razorpayPaymentStatus: status,
            webhookReceived: true
          };
          await transaction.save({ session });
        }

        // Process referral reward
        await processReferralReward(productOrder.user, session);

        // Send notification
        await commonNotification('PRODUCT_BOOKING', "product", productOrder._id.toString());

      } else if (orderType === 'SERVICE') {
        // Handle service order payment
        const serviceOrder = await ServiceOrder.findOne({
          'paymentDetails.razorpayOrderId': orderId
        }).session(session);

        if (!serviceOrder) {
          throw new Error(`Service order not found for orderId: ${orderId}`);
        }

        // Update service order status
        serviceOrder.paymentStatus = 'paid';
        serviceOrder.paymentDetails = {
          ...serviceOrder.paymentDetails,
          razorpayPaymentId: paymentId,
          razorpayPaymentStatus: status,
          webhookReceived: true
        };
        await serviceOrder.save({ session });

        // Update transactions for all service items
        const serviceItems = await ServiceOrderItem.find({
          _id: { $in: serviceOrder.services }
        }).session(session);

        for (const item of serviceItems) {
          if (item.transaction) {
            const transaction = await Transaction.findById(item.transaction).session(session);
            if (transaction) {
              transaction.status = 'paid';
              transaction.amount = item.total;
              transaction.pendingAmount = 0;
              transaction.paymentDetails = {
                ...transaction.paymentDetails,
                razorpayPaymentId: paymentId,
                razorpayPaymentStatus: status,
                webhookReceived: true
              };
              await transaction.save({ session });
            }
          }
        }

        // Process referral reward
        await processReferralReward(serviceOrder.user, session);

        // Send notification
        await commonNotification('SERVICE_BOOKING', "service", serviceOrder._id.toString());

      } else if (orderType === 'WALLET') {
        // Handle wallet balance addition
        const user = await mongoose.model('User').findById(userId).session(session);
        if (!user) {
          throw new Error(`User not found: ${userId}`);
        }

        // Get or create wallet
        let wallet = await Wallet.findOne({ userId: user._id }).session(session);
        if (!wallet) {
          wallet = new Wallet({ userId: user._id, balance: 0 });
          await wallet.save({ session });
        }

        // Add balance
        wallet.balance += amount;
        await wallet.save({ session });

        // Create wallet transaction
        const walletTransaction = new WalletTransaction({
          userId: user._id,
          type: 'deposit',
          amount: amount,
        });
        await walletTransaction.save({ session });

        // Send notification
        await commonNotification('WALLET_TOPUP', "wallet", user._id.toString());
      }
    } else if (event === 'payment.failed') {
      // Handle failed payment
      if (orderType === 'PRODUCT') {
        const productOrder = await ProductOrder.findOne({
          'paymentDetails.razorpayOrderId': orderId
        }).session(session);

        if (productOrder) {
          productOrder.paymentStatus = 'FAILED';
          productOrder.paymentDetails = {
            ...productOrder.paymentDetails,
            razorpayPaymentId: paymentId,
            razorpayPaymentStatus: 'failed',
            webhookReceived: true
          };
          await productOrder.save({ session });
        }
      } else if (orderType === 'SERVICE') {
        const serviceOrder = await ServiceOrder.findOne({
          'paymentDetails.razorpayOrderId': orderId
        }).session(session);

        if (serviceOrder) {
          serviceOrder.paymentStatus = 'failed';
          serviceOrder.paymentDetails = {
            ...serviceOrder.paymentDetails,
            razorpayPaymentId: paymentId,
            razorpayPaymentStatus: 'failed',
            webhookReceived: true
          };
          await serviceOrder.save({ session });
        }
      }
    }

    await session.commitTransaction();
    session.endSession();
    return { success: true, message: 'Webhook processed successfully' };

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 * Main webhook handler - handles Razorpay webhooks
 */
exports.handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return res.status(400).json({
      success: false,
      message: 'Missing webhook signature or secret'
    });
  }

  const payload = req.body;
  const isValid = verifyRazorpaySignature(JSON.stringify(payload), signature, webhookSecret);

  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: 'Invalid webhook signature'
    });
  }

  try {
    const result = await processRazorpayWebhook(payload);

    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      data: result
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: error.message
    });
  }
});

/**
 * Razorpay specific webhook handler
 */
exports.handleRazorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  console.log(signature);
  console.log(webhookSecret);

  if (!signature || !webhookSecret) {
    return res.status(400).json({
      success: false,
      message: 'Missing webhook signature or secret'
    });
  }

  const payload = req.body;
  const isValid = verifyRazorpaySignature(JSON.stringify(payload), signature, webhookSecret);

  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: 'Invalid webhook signature'
    });
  }

  try {
    const result = await processRazorpayWebhook(payload);
    res.status(200).json({
      success: true,
      message: 'Razorpay webhook processed successfully',
      data: result
    });
  } catch (error) {
    console.error('Razorpay webhook processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Razorpay webhook processing failed',
      error: error.message
    });
  }
});


