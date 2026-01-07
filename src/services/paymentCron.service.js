const ProductOrder = require('../modules/productOrder/productOrder.model');
const ServiceOrder = require('../modules/serviceOrder/serviceOrder.model');
const Transaction = require('../modules/transaction/transaction.Model');

/**
 * Check and update pending payments to failed status
 * This function checks for payments that have been pending for more than 15 minutes
 * and marks them as failed (excluding COD orders)
 */
const checkPendingPayments = async () => {
  try {
    console.log(`[Payment Cron] Starting pending payment check at ${new Date().toISOString()}`);
    
    // Calculate the time threshold (15 minutes ago)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    // Find pending ProductOrders that are older than 15 minutes and not COD
    const pendingProductOrders = await ProductOrder.find({
      paymentStatus: 'PENDING',
      paymentMethod: { $nin: ['COD', 'CASH'] }, // Exclude COD and CASH orders
      createdAt: { $lt: fifteenMinutesAgo }
    });

    // Find pending ServiceOrders that are older than 15 minutes and not COD
    // Only check orders that have razorpayOrderId (online payments)
    // COD orders typically don't have razorpayOrderId, so they're excluded
    const pendingServiceOrders = await ServiceOrder.find({
      paymentStatus: 'pending',
      'paymentDetails.razorpayOrderId': { $exists: true, $ne: null }, // Only online payments have Razorpay order ID
      createdAt: { $lt: fifteenMinutesAgo }
    });

    let productOrdersUpdated = 0;
    let serviceOrdersUpdated = 0;
    let transactionsUpdated = 0;

    // Update ProductOrders to FAILED
    for (const order of pendingProductOrders) {
      try {
        order.paymentStatus = 'FAILED';
        order.paymentDetails = {
          ...order.paymentDetails,
          cronUpdated: true,
          cronUpdatedAt: new Date(),
          reason: 'Payment timeout - pending for more than 15 minutes'
        };
        await order.save();
        productOrdersUpdated++;

        // Update related transaction if exists
        const transaction = await Transaction.findOne({
          productOrderId: order._id
        });

        if (transaction && transaction.status === 'unpaid') {
          transaction.status = 'unpaid'; // Keep as unpaid since payment failed
          transaction.paymentDetails = {
            ...transaction.paymentDetails,
            cronUpdated: true,
            cronUpdatedAt: new Date(),
            reason: 'Payment timeout - pending for more than 15 minutes'
          };
          await transaction.save();
          transactionsUpdated++;
        }

        console.log(`[Payment Cron] Updated ProductOrder ${order._id} to FAILED`);
      } catch (error) {
        console.error(`[Payment Cron] Error updating ProductOrder ${order._id}:`, error.message);
      }
    }

    // Update ServiceOrders to failed
    for (const order of pendingServiceOrders) {
      try {
        order.paymentStatus = 'failed';
        order.paymentDetails = {
          ...order.paymentDetails,
          cronUpdated: true,
          cronUpdatedAt: new Date(),
          reason: 'Payment timeout - pending for more than 15 minutes'
        };
        await order.save();
        serviceOrdersUpdated++;

        // Update related transaction if exists
        const transaction = await Transaction.findOne({
          serviceId: { $in: order.services }
        });

        if (transaction && transaction.status === 'unpaid') {
          transaction.status = 'unpaid'; // Keep as unpaid since payment failed
          transaction.paymentDetails = {
            ...transaction.paymentDetails,
            cronUpdated: true,
            cronUpdatedAt: new Date(),
            reason: 'Payment timeout - pending for more than 15 minutes'
          };
          await transaction.save();
          transactionsUpdated++;
        }

        console.log(`[Payment Cron] Updated ServiceOrder ${order._id} to failed`);
      } catch (error) {
        console.error(`[Payment Cron] Error updating ServiceOrder ${order._id}:`, error.message);
      }
    }

    console.log(`[Payment Cron] Completed at ${new Date().toISOString()}`);
    console.log(`[Payment Cron] Summary: ${productOrdersUpdated} ProductOrders, ${serviceOrdersUpdated} ServiceOrders, ${transactionsUpdated} Transactions updated`);

    return {
      success: true,
      productOrdersUpdated,
      serviceOrdersUpdated,
      transactionsUpdated,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Payment Cron] Error in checkPendingPayments:', error);
    throw error;
  }
};

module.exports = {
  checkPendingPayments
};

