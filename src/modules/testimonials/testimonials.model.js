const mongoose = require('mongoose');

const testimonialsSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    service_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: false
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: false
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
      required: false
    },
    media: [{
      url: {
        type: String,
        required: true
      },
      type: {
        type: String,
        enum: ['image', 'video', 'document', 'audio'],
        required: true
      },
      filename: String,
      originalname: String
    }],
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },
    approved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },
    approved_at: {
      type: Date,
      required: false
    }
  },
  { timestamps: true }
);

// Helpful indexes
// testimonialsSchema.index({ isActive: 1, displayOrder: 1, createdAt: -1 });
testimonialsSchema.index({ isActive: 1, createdAt: -1 });
testimonialsSchema.index({ user_id: 'text', service_id: 'text', product_id: 'text', message: 'text' });

module.exports = mongoose.model('Testimonial', testimonialsSchema);
