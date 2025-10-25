const mongoose = require('mongoose');

const serviceItemSchema = new mongoose.Schema({
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  serviceMode: {
    type: String,
    enum: ['online', 'pandit_center', 'pooja_at_home'],
  },
  cust: {
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    email: {
      type: String,
    },
    phone: {
      type: String,
    },
    addressData: {
      type: String,
    },
  },
  astrologer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  startTime: {
    type: String,
  },
  endTime: {
    type: String,
  },
  date: {
    type: String,
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  totalPrice: {
    type: Number,
    default: 0
  },
  address: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'customerAddress',
    default: null
  },
});

const serviceCartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [serviceItemSchema],
  grandtotal: {
    type: Number,
    default: 0
  },
}, { timestamps: true });

const ServiceCart = mongoose.model('ServiceCart', serviceCartSchema);

module.exports = ServiceCart;
