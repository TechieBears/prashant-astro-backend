const mongoose = require('mongoose');

const reviewsSchema = new mongoose.Schema(
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
      min: [1, 'Rating cannot be less than 1'],
      max: [5, 'Rating cannot be more than 5'],
      default: 5,
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
reviewsSchema.index({ isActive: 1, displayOrder: 1, createdAt: -1 });
reviewsSchema.index({ user_id: 'text', service_id: 'text', product_id: 'text', message: 'text' });

module.exports = mongoose.model('Review', reviewsSchema);
