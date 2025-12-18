const mongoose = require('mongoose');

const serviceOrderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    services: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ServiceOrderItem',
        }
    ],
    paymentStatus:{
        type: String,
        enum: ['paid', 'unpaid', 'refunded', 'pending', 'cancelled', 'failed']
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    finalAmount: {
        type: Number,
    },
    payingAmount:{
        type: Number
    },
    isCoupon: {
        type: Boolean,
        default: false
    },
    coupon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon'
    },
    transaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
    },
    paymentDetails: {
        type: Object,
    },
    // address: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'customerAddress',
    // }
}, { timestamps: true });

module.exports = mongoose.model('ServiceOrder', serviceOrderSchema);