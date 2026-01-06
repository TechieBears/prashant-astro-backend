const { duration } = require('moment');
const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    astrologerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        default: 'pending',
    },
    smartfloCall: {
        ref_id:{
            type: String,
        }
    },
    startTime: {
        type: Date,
    },
    endTime: {
        type: Date,
    },
    duration: {
        type: Number, // in seconds
    },
    amountCharged: {
        type: Number,
    },
}, { timestamps: true });

module.exports = mongoose.model('Call', callSchema);