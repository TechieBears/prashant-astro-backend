const mongoose = require('mongoose');

const productCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters']
  },
  image: {
    type: String,
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'admin',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'admin'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  id: false
});

// Indexes
productCategorySchema.index({ name: 1 }, { unique: true });
productCategorySchema.index({ isActive: 1 });
productCategorySchema.index({ 'image.imageId': 1 });

// Ensure unique name (case-insensitive)
productCategorySchema.pre('save', async function(next) {
  if (this.isModified('name')) {
    const existing = await this.constructor.findOne({
      name: { $regex: new RegExp(`^${this.namte}$`, 'i') },
      _id: { $ne: this._id }
    });
    if (existing) {
      throw new Error(`Category with name '${this.name}' already exists`);
    }
  }
  next();
});

// Static: find active
productCategorySchema.statics.findActiveCategories = function() {
  return this.find({ isActive: true }).sort({ name: 1 });
};

// Static: find by name (active)
productCategorySchema.statics.findByName = function(name) {
  return this.findOne({
    name: { $regex: new RegExp(`^${name}$`, 'i') },
    isActive: true
  });
};

const ProductCategory = mongoose.model('ProductCategory', productCategorySchema);

module.exports = ProductCategory;


