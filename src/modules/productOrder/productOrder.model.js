const mongoose = require('mongoose');

const productorderItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    snapshot: {
        name: String,
        categoryName: {type: String},
        subCategoryName: {type: String},
        mrpPrice: Number,
        sellingPrice: Number,
        stock: Number, // stock at time of order
        images: {type: String},
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    subtotal: {
        type: Number,
        required: true
    }
}, { _id: true });


const productOrderSchema = new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    items: [productorderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    finalAmount:{
        type: Number,
    },
    payingAmount:{
        type: Number,
    },
    walletUsed: { // 👈 NEW: Track how much wallet was used
      type: Number,
      default: 0,
      min: 0
    },
    isCoupon: {
        type: Boolean,
        default: false
    },
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon'
    },
    amount:{
        currency: {
            type: String,
        },
        gst:{
            type: Number,
        },
        basePrice:{
            type: Number,
        }
    },
    address: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'customerAddress',
      required: true
    },
    paymentMethod: {
      type: String,
      enum: ['COD', 'CASH', 'CARD', 'UPI', 'WALLET', 'NETBANKING'],
      required: true
    },
    orderStatus: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'],
      default: 'PENDING'
    },
    orderHistory: [
      {
        status: {
          type: String,
          enum: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'],
          default: 'PENDING'
        },
        date: {
          type: Date,
          default: Date.now
        }
      }
    ],
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
      default: 'PENDING'
    },
    paymentDetails:{
        type: Object,
    }
  }, { timestamps: true });

module.exports = mongoose.model('ProductOrder', productOrderSchema);