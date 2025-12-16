const { razorpay } = require('../../config/razorpay');
const crypto = require('crypto');

exports.createOrder = async (req, res) => {
    try {
        const { amount, currency, notes } = req.body;

        const order = await razorpay.orders.create({
            amount,                 // smallest unit
            currency,               // INR or USD
            receipt: `rcpt_${Date.now()}`,
            payment_capture: 1,
            notes
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

        const body = razorpay_order_id + "|" + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature === razorpay_signature) {
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ success: false });

    } catch (err) {
        res.status(500).json({ success: false });
    }
};

exports.fetchPaymentDetails = async (req, res) => {
    try {
        const payment = await razorpay.payments.fetch(
            req.params.paymentId
        );

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