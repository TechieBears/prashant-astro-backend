const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    token: {
        type: String,
    },
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
        enum: ['in-app', 'push'],
        required: true
    },
    notificationFor: {
        type: String,
        enum: ['services', 'products'],
        required: true
    },
    userType: {
        type: String,
        enum: ['all-customers', 'specific-customer'],
        required: true
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
    ]
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);