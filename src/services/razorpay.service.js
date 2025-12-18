const razorpay = require('../config/razorpay');
const crypto = require('crypto');

/**
 * Create a Razorpay order
 *
 * @param {Object} params
 * @param {number} params.amount - Amount in rupees (will be converted to paise)
 * @param {string} [params.currency='INR']
 * @param {string} [params.receiptPrefix='RCPT']
 * @param {Object} [params.notes={}]
 * @returns {Promise<import('razorpay').RazorpayOrder>}
 */
const createRazorpayOrder = async ({
  amount,
  currency = 'INR',
  receiptPrefix = 'RCPT',
  notes = {},
}) => {
  if (!amount || amount <= 0) {
    throw new Error('Invalid Razorpay amount');
  }

  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100), // Razorpay works in paise
    currency,
    receipt: `${receiptPrefix}_${Date.now()}`,
    payment_capture: 1,
    notes,
  });

  return order;
};

/**
 * Verify Razorpay payment signature
 *
 * @param {Object} params
 * @param {string} params.razorpayOrderId
 * @param {string} params.razorpayPaymentId
 * @param {string} params.razorpaySignature
 * @param {string} [params.secret=process.env.RAZORPAY_KEY_SECRET]
 * @returns {boolean}
 */
const verifyRazorpayPayment = ({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  secret = process.env.RAZORPAY_KEY_SECRET,
}) => {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !secret) {
    return false;
  }

  const body = `${razorpayOrderId}|${razorpayPaymentId}`;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body.toString())
    .digest('hex');

  return expectedSignature === razorpaySignature;
};

/**
 * Fetch Razorpay payment details
 *
 * @param {string} paymentId
 * @returns {Promise<import('razorpay').RazorpayPayment>}
 */
const fetchRazorpayPaymentDetails = async (paymentId) => {
  if (!paymentId) {
    throw new Error('paymentId is required');
  }

  const payment = await razorpay.payments.fetch(paymentId);
  return payment;
};

module.exports = {
  createRazorpayOrder,
  verifyRazorpayPayment,
  fetchRazorpayPaymentDetails,
};

