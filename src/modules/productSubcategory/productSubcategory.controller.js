const asyncHandler = require('express-async-handler');
const ProductSubcategory = require('./productSubcategory.model');
const ProductCategory = require('../productCategory/productCategory.model');

// POST /api/product-subcategories
exports.createProductSubcategory = asyncHandler(async (req, res) => {
  const { name, categoryId } = req.body;

  const category = await ProductCategory.findById(categoryId);
  if (!category) {
    res.status(400);
    throw new Error('Category not found');
  }
  if (!category.isActive) {
    res.status(400);
    throw new Error('Cannot create subcategory for inactive category');
  }

  const existing = await ProductSubcategory.findByNameInCategory(name, categoryId);
  if (existing) {
    res.status(400);
    throw new Error('Subcategory with this name already exists in the selected category');
  }

  let imageData = null;
  if (req.file) {
    try {
      const uploadResult = await uploadImageToCloudinary(req.file, 'product-subcategories');
      const thumbnailUrl = getThumbnailUrl(uploadResult.imageId);
      imageData = {
        imageId: uploadResult.imageId,
        imageUrl: uploadResult.imageUrl,
        thumbnailUrl: thumbnailUrl,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        size: uploadResult.size
      };
    } catch (error) {
      res.status(400);
      throw new Error(`Image upload failed: ${error.message}`);
    }
  } else if (req.body.image) {
    imageData = req.body.image;
  } 
  // else {
  //   res.status(400);
  //   throw new Error('Image is required');
  // }

  const subcategory = await ProductSubcategory.create({
    name,
    image: imageData,
    categoryId,
    createdBy: req.user._id
  });

  const subcategoryResponse = await ProductSubcategory.findById(subcategory._id)
    .populate('categoryId', 'name image');

  res.created(subcategoryResponse, 'Subcategory created successfully');
});

// GET /api/product-subcategories
exports.getAllProductSubcategories = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const query = {};
  if (req.query.isActive !== undefined && req.query.isActive !== '') {
    query.isActive = req.query.isActive === 'true';
  }
  if (req.query.categoryId && req.query.categoryId !== '') {
    query.categoryId = req.query.categoryId;
  }
  if (req.query.name && req.query.name !== '') {
    query.name = { $regex: req.query.name, $options: 'i' };
  }

  const subcategories = await ProductSubcategory.find(query)
    .populate('categoryId', 'name image')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await ProductSubcategory.countDocuments(query);
  res.paginated(subcategories, { page, limit, total, pages: Math.ceil(total / limit) });
});

// GET /api/product-subcategories/:id
exports.getProductSubcategory = asyncHandler(async (req, res) => {
  const subcategory = await ProductSubcategory.findById(req.query.id)
    .populate('categoryId', 'name image');

  if (!subcategory) {
    res.status(404);
    throw new Error('Subcategory not found');
  }
  res.ok(subcategory);
});

// GET /api/product-subcategories/dropdown
exports.getAllProductSubcategoriesDropdown = asyncHandler(async (req, res) => {
  const subcategories = await ProductSubcategory.find({isActive: true, isDeleted: false}).select('name').sort({ createdAt: 1 });
  res.ok(subcategories);
});

// PUT /api/product-subcategories/:id
exports.updateProductSubcategory = asyncHandler(async (req, res) => {
  const subcategory = await ProductSubcategory.findById(req.query.id);
  if (!subcategory) {
    res.status(404);
    throw new Error('Subcategory not found');
  }

  const { name, categoryId } = req.body;

  if (categoryId && categoryId !== subcategory.categoryId.toString()) {
    const category = await ProductCategory.findById(categoryId);
    if (!category) {
      res.status(400);
      throw new Error('Category not found');
    }
    if (!category.isActive) {
      res.status(400);
      throw new Error('Cannot move subcategory to inactive category');
    }
  }

  if (name && (name !== subcategory.name || (categoryId && categoryId !== subcategory.categoryId.toString()))) {
    const targetCategoryId = categoryId || subcategory.categoryId;
    const existing = await ProductSubcategory.findByNameInCategory(name, targetCategoryId);
    if (existing && existing._id.toString() !== req.query.id) {
      res.status(400);
      throw new Error('Subcategory with this name already exists in the selected category');
    }
  }

  if (name) subcategory.name = name;
  if (categoryId) subcategory.categoryId = categoryId;

  if (req.file) {
    try {
      const oldImageId = subcategory.image?.imageId;
      const uploadResult = await updateImageInCloudinary(oldImageId, req.file, 'product-subcategories');
      const thumbnailUrl = getThumbnailUrl(uploadResult.imageId);
      subcategory.image = {
        imageId: uploadResult.imageId,
        imageUrl: uploadResult.imageUrl,
        thumbnailUrl: thumbnailUrl,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        size: uploadResult.size
      };
    } catch (error) {
      res.status(400);
      throw new Error(`Image update failed: ${error.message}`);
    }
  } else if (req.body.image) {
    subcategory.image = req.body.image;
  }

  subcategory.updatedBy = req.user._id;
  await subcategory.save();

  const updated = await ProductSubcategory.findById(subcategory._id)
    .populate('categoryId', 'name image')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email');

  res.ok(updated, 'Subcategory updated successfully');
});

exports.getActiveProductSubcategories = asyncHandler(async (req, res) => {
  const subcategories = await ProductSubcategory.findActiveSubcategories();
  res.ok(subcategories);
});

// -------------------------------------
// Public listings
exports.getProductSubcategoriesByCategory = asyncHandler(async (req, res) => {
  const { id } = req.query;
  const category = await ProductCategory.findById(id);
  if (!category || !category.isActive) {
    res.ok([], "Category not found");
  }
  const subcategories = await ProductSubcategory.findByCategory(id);
  res.ok(subcategories, "Subcategories found");
});

// DELETE /api/product-subcategories/:id
exports.deleteProductSubcategory = asyncHandler(async (req, res) => {
  const subcategory = await ProductSubcategory.findById(req.query.id);
  if (!subcategory) {
    res.status(404);
    throw new Error('Subcategory not found');
  }

  if (subcategory.image?.imageId) {
    try { await deleteImageFromCloudinary(subcategory.image.imageId); } catch (e) {}
  }

  subcategory.isActive = false;
  subcategory.updatedBy = req.user._id;
  await subcategory.save();

  res.ok(null, 'Subcategory deleted successfully');
});

// PUT /api/product-subcategories/:id/restore
exports.restoreProductSubcategory = asyncHandler(async (req, res) => {
  const subcategory = await ProductSubcategory.findById(req.query.id);
  if (!subcategory) {
    res.status(404);
    throw new Error('Subcategory not found');
  }

  const category = await ProductCategory.findById(subcategory.categoryId);
  if (!category || !category.isActive) {
    res.status(400);
    throw new Error('Cannot restore subcategory. The associated category is inactive or deleted.');
  }

  subcategory.isActive = true;
  subcategory.updatedBy = req.user._id;
  await subcategory.save();

  const restored = await ProductSubcategory.findById(subcategory._id)
    .populate('categoryId', 'name image')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email');

  res.ok(restored, 'Subcategory restored successfully');
});

// Stats
exports.getProductSubcategoryStats = asyncHandler(async (req, res) => {
  const total = await ProductSubcategory.countDocuments();
  const active = await ProductSubcategory.countDocuments({ isActive: true });
  const inactive = await ProductSubcategory.countDocuments({ isActive: false });

  const byCategory = await ProductSubcategory.aggregate([
    {
      $lookup: {
        from: 'productcategories',
        localField: 'categoryId',
        foreignField: '_id',
        as: 'category'
      }
    },
    { $unwind: '$category' },
    {
      $group: {
        _id: '$categoryId',
        categoryName: { $first: '$category.name' },
        subcategoryCount: { $sum: 1 },
        activeCount: { $sum: { $cond: ['$isActive', 1, 0] } }
      }
    },
    { $sort: { subcategoryCount: -1 } }
  ]);

  const recent = await ProductSubcategory.find()
    .select('name categoryId isActive createdAt')
    .populate('categoryId', 'name')
    .sort({ createdAt: -1 })
    .limit(5);

  res.ok({ total, active, inactive, byCategory, recent });
});


