const mongoose = require('mongoose');

const userTokenSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    webToken: {
        type: String,
    },
    mobileToken: {
        type: String,
    },
}, { timestamps: true });

module.exports = mongoose.model('UserToken', userTokenSchema);