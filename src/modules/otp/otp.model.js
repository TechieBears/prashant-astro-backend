const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  otp: {
    type: String,
    required: true
  },
  expireAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 2 * 60 * 1000) // expires in 2 min
  }
});

// TTL Index — MUST be created outside schema definition
otpSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
// 0 = delete exactly at 'expireAt' timestamp

module.exports = mongoose.model("Otp", otpSchema);