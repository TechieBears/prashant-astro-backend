const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    from:{
        type: String,
        enum: ['admin', 'web', 'app'],
        default: 'web'
    },
     userIds: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: function () {
                // ✅ only required when notification is for specific customers
                return this.userType === 'specific-customer';
            }
        }
    ],
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    image: {
        type: String,
    },
    notificationType: {
        type: String,
        enum: ['in-app', 'web', 'email', 'all'],
        required: true
    },
    redirectionUrl: {
        type: String,
    },
    redirectId:{
        type: String
    },
    userType: {
        type: String,
        enum: ['all-customers', 'specific-customer'],
        required: true
    },
    status:{
        type: String,
        enum: ['active', 'inactive'],
    },
    scheduledAt:{
        type: Date
    },
    stats:{
        success: Number,
        failed: Number
    },
    expiryDate:{
        type: String
    },
    isDeleted:{
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);