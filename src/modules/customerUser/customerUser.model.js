const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const customerUserSchema = new mongoose.Schema({
    uniqueId: String,
    firstName: {
        type: String,
        required: [true, "First name is required"],
        maxlength: 50
    },
    lastName: {
        type: String,
        required: [true, "Last name is required"],
        maxlength: 50
    },
    title: {
        type: String,
        enum: ["Mr", "Mrs", "Miss", "Baby", "Master"]
    },
    gender: {
        type: String,
    },
    referralCode: {
        type: String,
        unique: true,
        index: true,
    },
    wallet: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Wallet",
    },
    // location: String,
    addresses: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "customerAddress",
        },
    ],
});

// Virtual for full name
customerUserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model("customer", customerUserSchema);