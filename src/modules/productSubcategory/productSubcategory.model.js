const mongoose = require('mongoose');

const productSubcategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Subcategory name is required'],
    trim: true,
    maxlength: [100, 'Subcategory name cannot exceed 100 characters']
  },
  image: {
    type: String,
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductCategory',
    required: [true, 'Category ID is required']
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
  toObject: { virtuals: true }
});

productSubcategorySchema.virtual('category', {
  ref: 'ProductCategory',
  localField: 'categoryId',
  foreignField: '_id',
  justOne: true
});

productSubcategorySchema.index({ categoryId: 1, name: 1 }, { unique: true });
productSubcategorySchema.index({ name: 1 });
productSubcategorySchema.index({ isActive: 1 });
productSubcategorySchema.index({ 'image.imageId': 1 });

productSubcategorySchema.pre('save', async function(next) {
  if (this.isModified('name') || this.isModified('categoryId')) {
    const existing = await this.constructor.findOne({
      name: { $regex: new RegExp(`^${this.name}$`, 'i') },
      categoryId: this.categoryId,
      _id: { $ne: this._id }
    });
    if (existing) {
      throw new Error('Subcategory with this name already exists in the selected category');
    }
  }
  next();
});

productSubcategorySchema.statics.findActiveSubcategories = function() {
  return this.find({ isActive: true })
    .populate('categoryId', 'name image')
    .sort({ name: 1 });
};

productSubcategorySchema.statics.findByCategory = function(categoryId) {
  return this.find({ categoryId: categoryId, isActive: true })
    .select('name image')
    .sort({ name: 1 });
};

productSubcategorySchema.statics.findByNameInCategory = function(name, categoryId) {
  return this.findOne({
    name: { $regex: new RegExp(`^${name}$`, 'i') },
    categoryId: categoryId,
    isActive: true
  });
};

const ProductSubcategory = mongoose.model('ProductSubcategory', productSubcategorySchema);

module.exports = ProductSubcategory;


