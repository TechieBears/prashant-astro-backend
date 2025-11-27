const asyncHandler = require('express-async-handler');
const ProductCategory = require('./productCategory.model');
const Errorhander = require('../../utils/errorHandler');
// const { generateImageName } = require('../../utils/reusableFunctions');
const {deleteFile} = require('../../utils/storage');

// @desc Create a product category
// @route POST /api/product-categories
// @access private (admin, super-admin)
exports.createProductCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;

  const existing = await ProductCategory.findByName(name);
  if (existing) {
    res.status(400);
    throw new Error(`Category with name '${name}' already exists`);
  }
  // let imageName = generateImageName(req.files?.image?.[0].filename);

  const image = req.files?.image?.[0] ? 
  `${process.env.BACKEND_URL}/public/${process.env.MEDIA_FILE}/product_categories/${req.files?.image?.[0].filename}`
  : null;

  const category = await ProductCategory.create({
    name,
    image,
    createdBy: req.user._id
  });

  const categoryResponse = await ProductCategory.findById(category._id)

  res.created(categoryResponse, 'Category created successfully');
});

// @desc Get all product categories with pagination and filtering
// @route GET /api/product-categories
// @access private (admin, super-admin)
exports.getAllProductCategories = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const query = {};
  if (req.query.isActive !== undefined && req.query.isActive !== '') {
    query.isActive = req.query.isActive === 'true';
  }
  if (req.query.name && req.query.name !== '') {
    query.name = { $regex: req.query.name, $options: 'i' };
  }

  const categories = await ProductCategory.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await ProductCategory.countDocuments(query);

  res.paginated(categories, { page, limit, total, pages: Math.ceil(total / limit) });
});

// @desc Get all product categories for dropdown
// @route GET /api/product-categories/dropdown
// @access private (admin, super-admin)
exports.getAllProductCategoriesDropdown = asyncHandler(async (req, res) => {
  const categories = await ProductCategory.findActiveCategories().select('name');
  res.ok(categories);
});

// @desc Get a single product category by ID
// @route GET /api/product-categories/:id
// @access private (admin, super-admin)
exports.getProductCategory = asyncHandler(async (req, res) => {
  const category = await ProductCategory.findById(req.query.id)
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')

  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  res.ok(category);
});

// @desc Update a product category
// @route PUT /api/product-categories/:id
// @access private (admin, super-admin)
exports.updateProductCategory = asyncHandler(async (req, res) => {
  const category = await ProductCategory.findById(req.query.id);
  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  const { name, isActive } = req.body;
  if (name && name !== category.name) {
    const existing = await ProductCategory.findByName(name);
    if (existing && existing._id.toString() !== req.query.id) {
      res.status(400);
      throw new Error(`Category with name '${name}' already exists`);
    }
  }

  if(req.files?.image?.[0]){
    // let imageName = generateImageName(req.files.image[0].filename);
    if(category.image){
      deleteFile(category.image)
    }
    category.image = `${process.env.BACKEND_URL}/public/${process.env.MEDIA_FILE}/product_categories/${req.files.image[0].filename}`
  }

  if (name) category.name = name;
  // if (image) category.image = image;
  if (isActive !== undefined && isActive !== null) category.isActive = isActive;
  category.updatedBy = req.user._id;
  await category.save();

  const updated = await ProductCategory.findById(category._id)
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')

  res.ok(updated, 'Category updated successfully');
});

// @desc set active/inactive status
// @route PUT /api/product-categories/:id/status
// @access private
exports.setActiveInactiveStatus = asyncHandler(async (req, res) => {
  const category = await ProductCategory.findById(req.query.id);
  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  category.isActive = category.isActive === true ? false : true;
  category.updatedBy = req.user._id;
  await category.save();

  res.ok(category, 'Category status updated successfully');
});

// @desc Delete a product category
// @route DELETE /api/product-categories/:id
// @access private (admin, super-admin)
exports.deleteProductCategory = asyncHandler(async (req, res) => {
  const category = await ProductCategory.findById(req.query.id);
  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  const ProductSubcategory = require('../productSubcategory/productSubcategory.model');
  const subCount = await ProductSubcategory.countDocuments({ categoryId: req.query.id, isActive: true });
  if (subCount > 0) {
    res.status(400);
    throw new Error(`Cannot delete category. It has ${subCount} active subcategory(ies). Please delete or deactivate subcategories first.`);
  }

  if (category.image?.imageId) {
    try { await deleteImageFromCloudinary(category.image.imageId); } catch (e) { }
  }

  category.isActive = false;
  category.updatedBy = req.user._id;
  await category.save();

  res.ok(null, 'Category deleted successfully');
});

// @desc Restore a deleted product category
// @route PUT /api/product-categories/:id/restore
// @access private (admin, super-admin)
exports.restoreProductCategory = asyncHandler(async (req, res) => {
  const category = await ProductCategory.findById(req.query.id);
  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  category.isActive = true;
  category.updatedBy = req.user._id;
  await category.save();

  const restored = await ProductCategory.findById(category._id)
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')

  res.ok(restored, 'Category restored successfully');
});

// @desc Get all active product categories
// @route GET /api/product-categories/active
// @access public
exports.getActiveProductCategories = asyncHandler(async (req, res) => {
  const categories = await ProductCategory.findActiveCategories()
  res.ok(categories);
});

// @desc Get product category statistics
// @route GET /api/product-categories/stats
// @access private (admin, super-admin)
exports.getProductCategoryStats = asyncHandler(async (req, res) => {
  const total = await ProductCategory.countDocuments();
  const active = await ProductCategory.countDocuments({ isActive: true });
  const inactive = await ProductCategory.countDocuments({ isActive: false });

  const categoriesWithSubcounts = await ProductCategory.aggregate([
    {
      $lookup: {
        from: 'productsubcategories',
        localField: '_id',
        foreignField: 'categoryId',
        as: 'subcategories'
      }
    },
    { $project: { name: 1, subcategoryCount: { $size: '$subcategories' }, isActive: 1 } },
    { $sort: { subcategoryCount: -1 } }
  ]);

  const recent = await ProductCategory.find()
    .select('name isActive createdAt')
    .sort({ createdAt: -1 })
    .limit(5);

  res.ok({ total, active, inactive, categoriesWithSubcounts, recent });
});

// @desc Get our product categories
// @route GET /api/product-categories/our-product-categories
// @access public
exports.getOurProductCategories = asyncHandler(async (req, res) => {
  const categories = await ProductCategory.find({ isActive: true }).select('name _id').sort({ name: 1 });
  res.ok(categories, "Our Product Categories fetched successfully");
});

// @desc Get AstroGuid product categories with products
// @route GET /api/product-categories/astroguid/public/our-products
// @access Public
exports.getCategoriesWithProducts = asyncHandler(async (req, res) => {
  const categories = await ProductCategory.aggregate([
    {
      $match: {
        isActive: true,
        isDeleted: false
      }
    },
    {
      $lookup: {
        from: 'products', // must match the actual collection name in Mongo
        localField: '_id',
        foreignField: 'category',
        as: 'products',
        pipeline: [
          {
            $match: {
              isActive: true,
              isDeleted: false
            }
          },
          {
            $project: {
              name: 1,
              images: 1,
            }
          }
        ]
      }
    },
    {
      $project: {
        name: 1,
        image: 1,
        products: 1
      }
    },
    {
      $sort: { name: 1 }
    }
  ]);

  res.ok(categories, "Categories with products fetched successfully");
});
