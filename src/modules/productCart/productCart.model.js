const mongoose = require('mongoose');

const productItem = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number,
        default: 1,
        min: 1
    },
    totalPrice: {
        type: Number,
        default: 0
    }
});

const productCartSchema = new mongoose.Schema({
    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    items: [productItem],
    totalAmount: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('ProductCart', productCartSchema);