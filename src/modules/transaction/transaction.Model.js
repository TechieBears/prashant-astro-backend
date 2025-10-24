const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    from: {
        type: String,
        enum: ['product', 'service'],
        required: true
    },
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: function () { return this.from === 'service'; }
    },
    productOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductOrder',
        required: function () { return this.from === 'product'; }
    },
    type: {
        type: String,
        enum: ['COD', 'CARD', 'UPI', 'WALLET', 'NETBANKING', 'BANKTRANSFER', 'CHEQUE', 'CASH', 'OTHER'],
        required: true
    },
    status: {
        type: String,
        enum: ['paid', 'unpaid'],
        required: true
    },
    amount: {
        type: Number,
        min: 0,
        default: 0
    },
    pendingAmount: {
        type: Number,
        required: true,
        min: 0
    },
    payingAmount: {
        type: Number,
        min: 0,
        default: 0
    },
    walletUsed: { // 👈 NEW: Track wallet usage in transaction
        type: Number,
        default: 0,
        min: 0
    },
    isCoupon: {
        type: Boolean,
        default: false
    },
    paymentId: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    refund: {
        type: Boolean,
        default: false
    },
    paymentDetails: {
        type: Object,
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);