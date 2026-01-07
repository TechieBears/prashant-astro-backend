const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const mongoose = require('mongoose');
const ProductOrder = require('../productOrder/productOrder.model');
const ServiceOrder = require('../serviceOrder/serviceOrder.model');
const ServiceOrderItem = require('../serviceOrder/serviceOrderItem.model');
const Transaction = require('../transaction/transaction.Model');
const Wallet = require('../wallet/wallet.model');
const WalletTransaction = require('../wallet/walletTransactions.model');
const Invoice = require('../invoice/invoice.model');
const User = require('../auth/user.Model');
const CustomerUser = require('../customerUser/customerUser.model');
const CustomerAddress = require('../customerAddress/customerAddress.model');
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
 * Create invoice from product order
 */
const createInvoiceFromProductOrder = async (productOrder, paymentId, session) => {
  try {
    // Check if invoice already exists for this order
    const existingInvoice = await Invoice.findOne({ 
      productOrderId: productOrder._id 
    }).session(session);
    
    if (existingInvoice) {
      console.log(`Invoice already exists for product order ${productOrder._id}`);
      return existingInvoice;
    }

    // Get user details
    const user = await User.findById(productOrder.user).session(session);
    if (!user) {
      throw new Error('User not found');
    }

    // Get customer profile
    const customerProfile = await CustomerUser.findById(user.profile).session(session);

    // Get address
    const address = await CustomerAddress.findById(productOrder.address).session(session);
    if (!address) {
      throw new Error('Address not found for order');
    }

    // Build issuedTo information
    const issuedTo = {
      name: `${customerProfile?.firstName || ''} ${customerProfile?.lastName || ''}`.trim() || user.email,
      address: address.address,
      city: address.city || '',
      state: address.state || '',
      postalCode: address.postalCode || '',
      country: address.country || '',
      phoneNumber: address.phoneNumber || user.mobileNo || ''
    };

    // Build invoice items from product order items
    const invoiceItems = productOrder.items.map(item => ({
      productId: item.product,
      serviceId: null,
      name: item.snapshot.name || 'Product',
      price: item.snapshot.sellingPrice || item.snapshot.mrpPrice || 0,
      quantity: item.quantity,
      total: item.subtotal
    }));

    // Calculate totals
    const subtotal = productOrder.totalAmount || 0;
    const gst = productOrder.amount?.gst || 0;
    const discount = subtotal - (productOrder.finalAmount || subtotal);
    const totalAmount = productOrder.finalAmount || productOrder.payingAmount || subtotal;

    // Build payment info
    const paymentInfo = {
      paymentMethod: productOrder.paymentMethod || 'CARD',
      paymentStatus: 'PAID',
      amount: totalAmount,
      transactionId: paymentId,
      razorpayOrderId: productOrder.paymentDetails?.razorpayOrderId || null,
      razorpayPaymentId: paymentId,
      details: productOrder.paymentDetails || {}
    };

    // Create invoice
    const invoice = new Invoice({
      userId: productOrder.user,
      productOrderId: productOrder._id,
      serviceOrderId: null,
      date: new Date(),
      issuedTo,
      items: invoiceItems,
      subtotal,
      gst,
      discount,
      totalAmount,
      currency: productOrder.amount?.currency || 'INR',
      paymentInfo
    });

    await invoice.save({ session });
    return invoice;
  } catch (error) {
    console.error('Error creating invoice from product order:', error);
    throw error;
  }
};

/**
 * Create invoice from service order
 */
const createInvoiceFromServiceOrder = async (serviceOrder, paymentId, session) => {
  try {
    // Check if invoice already exists for this order
    const existingInvoice = await Invoice.findOne({ 
      serviceOrderId: serviceOrder._id 
    }).session(session);
    
    if (existingInvoice) {
      console.log(`Invoice already exists for service order ${serviceOrder._id}`);
      return existingInvoice;
    }

    // Get user details
    const user = await User.findById(serviceOrder.user).session(session);
    if (!user) {
      throw new Error('User not found');
    }

    // Get customer profile
    const customerProfile = await CustomerUser.findById(user.profile).session(session);

    // Get service items with populated service data
    const serviceItems = await ServiceOrderItem.find({
      _id: { $in: serviceOrder.services }
    }).populate('service').session(session);

    // Get address from first service item (services might have different addresses)
    let address = null;
    let issuedTo = {
      name: `${customerProfile?.firstName || ''} ${customerProfile?.lastName || ''}`.trim() || user.email,
      address: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
      phoneNumber: user.mobileNo || ''
    };

    // Try to get address from service items
    if (serviceItems.length > 0) {
      const firstItem = serviceItems[0];
      
      // Check if item has address reference
      if (firstItem.address) {
        address = await CustomerAddress.findById(firstItem.address).session(session);
      }
      
      // If no address reference, check cust.addressData
      if (!address && firstItem.cust?.addressData) {
        issuedTo.address = firstItem.cust.addressData;
      }
      
      // Use customer info from first item if available
      if (firstItem.cust?.firstName) {
        issuedTo.name = `${firstItem.cust.firstName} ${firstItem.cust.lastName || ''}`.trim();
      }
      if (firstItem.cust?.phone) {
        issuedTo.phoneNumber = firstItem.cust.phone;
      }
    }

    // If address found, use it
    if (address) {
      issuedTo = {
        name: `${address.firstName} ${address.lastName}`.trim(),
        address: address.address,
        city: address.city || '',
        state: address.state || '',
        postalCode: address.postalCode || '',
        country: address.country || '',
        phoneNumber: address.phoneNumber || user.mobileNo || ''
      };
    }

    // Build invoice items from service order items
    const invoiceItems = serviceItems.map(item => ({
      productId: null,
      serviceId: item.service?._id || item.service,
      name: item.service?.name || 'Service',
      price: item.snapshot?.price || item.total || 0,
      quantity: 1, // Services are typically quantity 1
      total: item.total
    }));

    // Calculate totals
    const subtotal = serviceOrder.totalAmount || 0;
    const gst = 0; // GST can be added if needed
    const discount = subtotal - (serviceOrder.finalAmount || subtotal);
    const totalAmount = serviceOrder.finalAmount || serviceOrder.payingAmount || subtotal;

    // Determine payment method from payment details or default to CARD
    let paymentMethod = 'CARD';
    if (serviceOrder.paymentDetails?.paymentMethod) {
      paymentMethod = serviceOrder.paymentDetails.paymentMethod;
    } else if (serviceOrder.paymentDetails?.razorpayOrderId) {
      paymentMethod = 'CARD'; // Razorpay typically means card/UPI
    }

    // Build payment info
    const paymentInfo = {
      paymentMethod: paymentMethod,
      paymentStatus: 'PAID',
      amount: totalAmount,
      transactionId: paymentId,
      razorpayOrderId: serviceOrder.paymentDetails?.razorpayOrderId || null,
      razorpayPaymentId: paymentId,
      details: serviceOrder.paymentDetails || {}
    };

    // Create invoice
    const invoice = new Invoice({
      userId: serviceOrder.user,
      productOrderId: null,
      serviceOrderId: serviceOrder._id,
      date: new Date(),
      issuedTo,
      items: invoiceItems,
      subtotal,
      gst,
      discount,
      totalAmount,
      currency: 'INR',
      paymentInfo
    });

    await invoice.save({ session });
    return invoice;
  } catch (error) {
    console.error('Error creating invoice from service order:', error);
    throw error;
  }
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
        try {
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

          // Create invoice
          try {
            const invoice = await createInvoiceFromProductOrder(productOrder, paymentId, session);
            console.log(`Invoice created for product order: ${invoice.invoiceNumber}`);
          } catch (invoiceError) {
            console.error('Error creating invoice for product order:', invoiceError);
            // Don't fail the webhook if invoice creation fails
          }

          // Send notification
          await commonNotification('PRODUCT_BOOKING', "product", productOrder._id.toString());

        } catch (err) {
          console.log("Product Order Payment Error", err);
        }
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

        // Create invoice
        try {
          const invoice = await createInvoiceFromServiceOrder(serviceOrder, paymentId, session);
          console.log(`Invoice created for service order: ${invoice.invoiceNumber}`);
        } catch (invoiceError) {
          console.error('Error creating invoice for service order:', invoiceError);
          // Don't fail the webhook if invoice creation fails
        }

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


