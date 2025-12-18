const { createRazorpayOrder, verifyRazorpayPayment, fetchRazorpayPaymentDetails } = require('../../services/razorpay.service');

exports.createOrder = async (req, res) => {
    try {
        const { amount, currency, notes } = req.body;

        const order = await createRazorpayOrder({
            amount: amount / 100,          // existing API expects smallest unit (paise)
            currency: currency || 'INR',
            receiptPrefix: 'rcpt',
            notes: notes || {},
        });

        res.status(200).json({
            status: order.status,
            orderId: order.id,
            currency: order.currency
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Order creation failed' });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        const isValid = verifyRazorpayPayment({
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
        });

        if (isValid) {
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ success: false });

    } catch (err) {
        res.status(500).json({ success: false });
    }
};

exports.fetchPaymentDetails = async (req, res) => {
    try {
        const payment = await fetchRazorpayPaymentDetails(req.params.paymentId);

        if (payment.status === 'captured') {
            return res.json({
                success: true,
                amount: payment.amount,
                currency: payment.currency,
                fee: payment.fee,
                tax: payment.tax,
                method: payment.method
            });
        }

        res.json({ success: false });

    } catch (err) {
        res.status(500).json({ success: false });
    }
};