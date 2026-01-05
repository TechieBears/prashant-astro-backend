const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true,
        maxlength: [100, 'Product name cannot exceed 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Product description is required'],
        trim: true,
    },
    additionalInfo: {
        type: String,
        trim: true,
    },
    specification:{
        type: Object,
    },
    highlights:{
        type: String,
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductCategory',
        required: [true, 'Category is required']
    },
    // subcategory: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'ProductSubcategory',
    //     required: [true, 'Subcategory is required']
    // },
    mrpPrice: {
        type: Number,
        required: [true, 'MRP price is required'],
        min: [0, 'MRP price cannot be negative']
    },
    sellingPrice: {
        type: Number,
        required: [true, 'Selling price is required'],
        min: [0, 'Selling price cannot be negative']
    },
    stock: {
        type: Number,
        required: [true, 'Stock is required'],
        min: [0, 'Stock cannot be negative']
    },
    gstNumber:{
        type: String,
    },
    hsnCode:{
        type: String,
    },
    images: [{ type: String, }],
    avgRatings: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    showOnHome:{
        type: Boolean,
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
productSchema.index({ name: 1 });
productSchema.index({ category: 1 });
productSchema.index({ subcategory: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ sellingPrice: 1 });
productSchema.index({ stock: 1 });
productSchema.index({ 'image.imageId': 1 });

// Virtual for discount percentage
productSchema.virtual('discountPercentage').get(function () {
    if (this.mrpPrice > this.sellingPrice) {
        return Math.round(((this.mrpPrice - this.sellingPrice) / this.mrpPrice) * 100);
    }
    return 0;
});

// Static: find active products
productSchema.statics.findActiveProducts = function () {
    return this.find({ isActive: true }).sort({ createdAt: -1 });
};

// Static: find by category
productSchema.statics.findByCategory = function (categoryId) {
    return this.find({ category: categoryId, isActive: true }).sort({ createdAt: -1 });
};

// Static: find by subcategory
productSchema.statics.findBySubcategory = function (subcategoryId) {
    return this.find({ subcategory: subcategoryId, isActive: true }).sort({ createdAt: -1 });
};

// Static: find in stock products
productSchema.statics.findInStock = function () {
    return this.find({ isActive: true, stock: { $gt: 0 } }).sort({ createdAt: -1 });
};

// Static: find low stock products
productSchema.statics.findLowStock = function (threshold = 10) {
    return this.find({ isActive: true, stock: { $gt: 0, $lte: threshold } }).sort({ stock: 1 });
};

module.exports = mongoose.model('Product', productSchema);