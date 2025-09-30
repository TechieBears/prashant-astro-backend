const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    couponName: {
        type: String,
        required: true,
        trim: true
    },
    couponCode: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        unique: true
    },
    couponType: {
        type: String,
        enum: ['services', 'products', 'both'],
        required: true,
        default: 'both'
    },
    discountIn: {
        type: String,
        enum: ['percent', 'amount'],
        required: true
    },
    discount: {
        type: Number,
        required: true,
        min: 0
    },
    activationDate: {
        type: Date,
        required: true
    },
    expiryDate: {
        type: Date,
        required: true
    },
    redemptionPerUser: {
        type: Number,
        default: 1,
        min: 0
    },
    totalRedemptions: {
        type: Number,
        default: 0,
        min: 0
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

couponSchema.index({ unique: true });
couponSchema.index({ isActive: 1, isDeleted: 1 });

module.exports = mongoose.model('Coupon', couponSchema);


