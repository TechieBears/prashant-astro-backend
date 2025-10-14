const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please provide service name"],
        unique: true,
        trim: true,
        maxlength: [100, "Service name should not be more than 100 characters"]
    },
    title: {
        type: String,
        required: [true, "Please provide service title"],
        trim: true,
        maxlength: [150, "Service title should not be more than 150 characters"]
    },
    subTitle: {
        type: String,
        required: [true, "Please provide service subtitle"],
        trim: true,
        maxlength: [150, "Service subtitle should not be more than 150 characters"]
    },
    description: {
        type: String,
        maxlength: [500, "Service description should not be more than 500 characters"]
    },
    htmlContent: {
        type: String,
        required: [true, "Please provide service html content"],
        maxlength: [50000, "Service html content should not be more than 50000 characters"]
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceCategory',
        required: [true, "Please provide service category"]
    },
    image: {
        type: String,
    },
    videoUrl: [{
        videoUrl: {
            type: String,
        }
    }],
    price: {
        type: Number,
        required: [true, "Please provide service price"],
        min: [0, "Service price should not be less than 0"]
    },
    gstNumber:{
        type: String,
    },
    hsnCode:{
        type: String,
    },
    durationInMinutes: {
        type: String,
        required: [true, "Please provide service duration in minutes"],
        enum: ['30', '60']
    },
    serviceType: {
        type: String,
        required: [true, "Please provide service type"],
        enum: ['online', 'pandit_center', 'pooja_at_home'],
        default: 'online'
    },
    isActive: {
        type: Boolean,
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;