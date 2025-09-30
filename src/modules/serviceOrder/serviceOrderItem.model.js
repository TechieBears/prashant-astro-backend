const mongoose = require('mongoose');

const serviceItemSchema = new mongoose.Schema({
    customerId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    cust:{
        firstName:{
            type: String,
        },
        lastName:{
            type: String,
        },
        email:{
            type: String,
        },
        phone:{
            type: String,
        }
    },
    orderId:{
        type: String
    },
    service:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true
    },
    astrologer:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    snapshot:{
        price:{
            type: Number,
            required: true
        },
        durationInMinutes: {
            type: Number,
            required: true
        }
    },
    startTime:{
        type: String,
    },
    endTime:{
        type: String,
    },
    bookingDate:{
        type: String,
    },
    serviceType:{
        type: String,
        enum: ['online', 'pandit_center', 'pooja_at_home'],
    },
    total:{
        type: Number,
        required: true
    },
    astrologerStatus:{
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    },
    rejectReason:{
        type: String
    },
    paymentStatus:{
        type: String,
        enum: ['pending', 'paid', 'cancelled', 'refunded', 'failed'],
        default: 'pending'
    },
    // booking status
    status:{
        type: String,
        enum: ['pending', 'paid', 'cancelled', 'refunded', 'blocked', 'released'],
        default: 'pending'
    },
    zoomLink:{
        type: String
    }
});

module.exports = mongoose.model('ServiceOrderItem', serviceItemSchema);
