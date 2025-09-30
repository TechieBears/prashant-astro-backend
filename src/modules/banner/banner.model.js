const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [100, 'Title cannot exceed 100 characters']
    },
    description:{
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    image:{
        type: String,
    },
    type:{
        type: String,
        enum: ['website', 'app']
    },
    button:[
        {
            buttonText: {
                type: String,
                trim: true,
            },
            buttonLink: {
                type: String,
                trim: true,
            }   
        }
    ],
    isActive:{
        type: Boolean,
        default: true
    },
    isDeleted:{
        type: Boolean,
        default: false,
        select: false
    },
    position:{
        type: Number,
        default: 0
    },
    startDate: {
        type: Date,
        required: [true, 'Start date is required']
    },
    endDate: {
        type: Date,
        required: [true, 'End date is required']
    },
    createdBy:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdminUser',
        required: true
    },
    updatedBy:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdminUser'
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
bannerSchema.index({ title: 1 }, { unique: true });
bannerSchema.index({ isActive: 1 });
bannerSchema.index({ 'image.imageId': 1 });

const Banner = mongoose.model('Banner', bannerSchema);

module.exports = Banner;