const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const customerUserSchema = new mongoose.Schema({
    uniqueId: String,
    firstName: {
        type: String,
        maxlength: 50
    },
    lastName: {
        type: String,
        maxlength: 50
    },
    title: {
        type: String,
        enum: ["Mr", "Mrs", "Miss", "Baby", "Master"],
        default: "Mr"
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
customerUserSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// helper function to generate referral code
function generateReferralCode(firstName = "") {
    const prefix = firstName
        ? firstName.trim().substring(0, 3).toUpperCase()
        : "USR";
    const hash = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars
    return `${prefix}${hash}`;
}

// 🔹 Pre-save hook to generate referral code if not already set
customerUserSchema.pre("save", async function (next) {
    if (!this.referralCode) {
        this.referralCode = generateReferralCode(this.firstName);
    }
    next();
});


module.exports = mongoose.model("customer", customerUserSchema);