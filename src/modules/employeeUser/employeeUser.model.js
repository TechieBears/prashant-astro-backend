const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const e = require("express");

const employeeUserSchema = new mongoose.Schema({
    uniqueId: String,
    employeeType:{
        type: String,
        enum: ["astrologer", "employee", "call_astrologer"],
    },
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
    description:{
        type: String,
    },
    priceCharge:{
        type: Number,
    },
    skills:{
        type: [String],
    },
    languages:{
        type: [String],
    },
    experience:{
        type: Number,
    },
    startTime:{
        type: String,
    },
    endTime: {
        type: String,
    },
    days:{
        type: [String],
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
    preBooking:{
        type: Number,
    }
}, { timestamps: true });

// Virtual for full name
employeeUserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model("employee", employeeUserSchema); 