const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    firstName: {
        type: String,
        required: true,
        maxlength: 100
    },
    lastName: {
        type: String,
        required: true,
        maxlength: 100
    },
    phoneNumber: {
        type: String,
        required: true,
    },
    addressType: {
        type: String,
        enum: ["home", "office", "friend", "other"],
        default: "home"
    },
    address: {
        type: String,
        required: true,
        maxlength: 500
    },
    country: {
        type: String,
        required: true,
        maxlength: 100
    },
    state: {
        type: String,
        required: true,
    },
    city: {
        type: String,
        required: true,
    },
    postalCode: {
        type: String,
        required: true,
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
},
    { timestamps: true }
);

addressSchema.index({ userId: 1 });

module.exports = mongoose.model("customerAddress", addressSchema);