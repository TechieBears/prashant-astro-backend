const express = require('express');
const router = express.Router();

const { createOrder, verifyPayment, fetchPaymentDetails } = require('./razorpaytest.controller');


router.post('/create-order', createOrder);
router.post('/verify-payment', verifyPayment);
router.get('/payment/:paymentId', fetchPaymentDetails);

module.exports = router;