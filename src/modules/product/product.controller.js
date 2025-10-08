const asyncHandler = require('express-async-handler');
const Product = require('./product.model');
const Category = require('../productCategory/productCategory.model');
const Subcategory = require('../productSubcategory/productSubcategory.model');
const Errorhander = require('../../utils/errorHandler');

// @desc Create a product
// @route POST /api/products/create
// @access Private (admin only)
exports.createProduct = asyncHandler(async (req, res, next) => {
  const { name, description, images, additionalInfo, specification, highlights, category, subcategory, mrpPrice, sellingPrice, stock, gstNumber, hsnCode } = req.body;

  // Validate required fields
  if (!name || !description || !category || !subcategory || !mrpPrice || !sellingPrice || !stock) {
    res.status(400);
    throw new Error('All required fields must be provided');
  }

  // Validate category exists and is active
  const categoryExists = await Category.findById(category);
  if (!categoryExists || !categoryExists.isActive) {
    res.status(400);
    throw new Error('Invalid or inactive category');
  }

  // Validate subcategory exists and is active
  const subcategoryExists = await Subcategory.findById(subcategory);
  if (!subcategoryExists || !subcategoryExists.isActive) {
    res.status(400);
    throw new Error('Invalid or inactive subcategory');
  }

  // Validate subcategory belongs to category
  if (subcategoryExists.categoryId.toString() !== category) {
    res.status(400);
    throw new Error('Subcategory does not belong to the selected category');
  }

  // Validate prices
  if (Number(sellingPrice) > Number(mrpPrice)) {
    res.status(400);
    throw new Error('Selling price cannot be greater than MRP price');
  }

  const product = await Product.create({
    name,
    description,
    additionalInfo,
    specification,
    highlights,
    category,
    subcategory,
    mrpPrice,
    sellingPrice,
    stock,
    gstNumber,
    hsnCode,
    images: images || [],
    createdBy: req.user._id
  });

  const productResponse = await Product.findById(product._id)
    .populate('category', 'name')
    .populate('subcategory', 'name')
    .populate('createdBy', 'firstName lastName email');

  res.created(productResponse, 'Product created successfully');
});

// @desc Get all products (public)
// @route GET /api/products/active
// @access Public
exports.getAllProducts = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const query = { isActive: true };

  // Filter by category
  if (req.query.category) {
    query.category = req.query.category;
  }

  // Filter by subcategory
  if (req.query.subcategory) {
    query.subcategory = req.query.subcategory;
  }

  // Search by name or description
  if (req.query.search && req.query.search !== '') {
    query.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { description: { $regex: req.query.search, $options: 'i' } }
    ];
  }

  // Filter by price range
  if (req.query.minPrice || req.query.maxPrice) {
    query.sellingPrice = {};
    if (req.query.minPrice) query.sellingPrice.$gte = parseFloat(req.query.minPrice);
    if (req.query.maxPrice) query.sellingPrice.$lte = parseFloat(req.query.maxPrice);
  }

  // Filter by stock availability
  if (req.query.inStock === 'true') {
    query.stock = { $gt: 0 };
  }

  const products = await Product.find(query)
    .populate('category', 'name')
    .populate('subcategory', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Product.countDocuments(query);

  res.paginated(products, { page, limit, total, pages: Math.ceil(total / limit) });
});

// @desc Get all products (admin)
// @route GET /api/products/get-all
// @access Private (admin only)
exports.getAllProductsAdmin = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  let query = {};

  // 🔹 Filter by active status
  if (req.query.isActive !== undefined && req.query.isActive !== '') {
    query.isActive = req.query.isActive === 'true';
  }

  // 🔹 Filter by category name
  if (req.query.categoryId) {
    const category = await Category.findOne({
      _id: req.query.categoryId,
      isDeleted: false,
    }).select('_id');

    if (category) {
      query.category = category._id;
    } else {
      return res.paginated([], { page, limit, total: 0, pages: 0 }, "No products found");
    }
  }

  // 🔹 Filter by subcategory name
  if (req.query.subcategoryId) {
    const subcategory = await Subcategory.findOne({
      _id: req.query.subcategoryId,
      isDeleted: false,
    }).select('_id');

    if (subcategory) {
      query.subcategory = subcategory._id;
    } else {
      return res.paginated([], { page, limit, total: 0, pages: 0 }, "No products found");
    }
  }

  // 🔹 Search by name or description
  if (req.query.name && req.query.name !== '') {
    query.$or = [
      { name: { $regex: req.query.name, $options: 'i' } },
      { description: { $regex: req.query.name, $options: 'i' } },
    ];
  }

  // 🔹 Filter by price range
  if (req.query.minPrice || req.query.maxPrice) {
    query.sellingPrice = {};
    if (req.query.minPrice) query.sellingPrice.$gte = parseFloat(req.query.minPrice);
    if (req.query.maxPrice) query.sellingPrice.$lte = parseFloat(req.query.maxPrice);
  }

  // 🔹 Stock filters
  if (req.query.stockFilter) {
    switch (req.query.stockFilter) {
      case 'inStock':
        query.stock = { $gt: 0 };
        break;
      case 'outOfStock':
        query.stock = 0;
        break;
      case 'lowStock':
        query.stock = { $gt: 0, $lte: 10 };
        break;
    }
  }

  const products = await Product.find(query)
    .populate('category', 'name')
    .populate('subcategory', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Product.countDocuments(query);

  res.paginated(
    products,
    { page, limit, total, pages: Math.ceil(total / limit) },
    "Products fetched successfully"
  );
});

// @desc Get single product by ID
// @route GET /api/products/active-single
// @access Public
exports.getProductById = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.query.id)
    .populate('category', 'name')
    .populate('subcategory', 'name');

  if (!product || !product.isActive || product.isDeleted) {
    res.status(404);
    throw new Error('Product not found');
  }

  // 🔹 Fetch related products (same subcategory, exclude current, limit 10)
  const relatedProducts = await Product.find({
    subcategory: product.subcategory._id,
    _id: { $ne: product._id },
    isActive: true,
    isDeleted: false
  })
    .select('name description sellingPrice mrpPrice images stock category subcategory') // only useful fields
    .populate('category', 'name')
    .populate('subcategory', 'name')
    .limit(10);

  // 🔹 Build response
  const responseData = {
    ...product.toObject(),
    itemType: "product",
    relatedProducts
  };

  res.ok(responseData, 'Product fetched successfully');
});

// @desc Get single product by ID (admin)
// @route GET /api/products/get-single
// @access Private (admin only)
exports.getProductByIdAdmin = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.query.id)
    .populate('category', 'name')
    .populate('subcategory', 'name')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email');

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.ok(product);
});

// @desc Update a product
// @route PUT /api/products/update
// @access Private (admin only)
exports.updateProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.query.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  const { name, description, images, additionalInfo, specification, highlights, category, subcategory, mrpPrice, sellingPrice, stock, gstNumber, hsnCode } = req.body;

  // Validate category if provided
  if (category) {
    const categoryExists = await Category.findById(category);
    if (!categoryExists || !categoryExists.isActive) {
      res.status(400);
      throw new Error('Invalid or inactive category');
    }
  }

  // Validate subcategory if provided
  if (subcategory) {
    const subcategoryExists = await Subcategory.findById(subcategory);
    if (!subcategoryExists || !subcategoryExists.isActive) {
      res.status(400);
      throw new Error('Invalid or inactive subcategory');
    }

    // Validate subcategory belongs to category
    const categoryId = category || product.category;
    if (subcategoryExists.categoryId.toString() !== categoryId.toString()) {
      res.status(400);
      throw new Error('Subcategory does not belong to the selected category');
    }
  }

  // Validate prices if provided
  const finalMrpPrice = mrpPrice || product.mrpPrice;
  const finalSellingPrice = sellingPrice || product.sellingPrice;
  if (finalSellingPrice > finalMrpPrice) {
    res.status(400);
    throw new Error('Selling price cannot be greater than MRP price');
  }

  // Update fields
  if (name) product.name = name;
  if (description) product.description = description;
  if (images) product.images = images;
  if (additionalInfo !== undefined) product.additionalInfo = additionalInfo;
  if (specification !== undefined) product.specification = specification;
  if (highlights !== undefined) product.highlights = highlights;
  if (category) product.category = category;
  if (subcategory) product.subcategory = subcategory;
  if (mrpPrice) product.mrpPrice = mrpPrice;
  if (sellingPrice) product.sellingPrice = sellingPrice;
  if (stock !== undefined) product.stock = stock;
  if (gstNumber) product.gstNumber = gstNumber;
  if (hsnCode) product.hsnCode = hsnCode;

  product.updatedBy = req.user._id;
  await product.save();

  const updated = await Product.findById(product._id)
    .populate('category', 'name')
    .populate('subcategory', 'name')

  res.ok(updated, 'Product updated successfully');
});

// @desc Delete a product
// @route DELETE /api/products/delete
// @access Private (admin only)
exports.deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.query.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  // Soft delete
  product.isActive = false;
  product.isDeleted = true;
  product.updatedBy = req.user._id;
  await product.save();

  res.ok(null, 'Product deleted successfully');
});

// @desc Set active/inactive status
// @route PUT /api/products/:id/status
// @access Private (admin only)
exports.setActiveInactiveStatus = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.query.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  product.isActive = product.isActive === true ? false : true;
  product.updatedBy = req.user._id;
  await product.save();

  res.ok(product, 'Product status updated successfully');
});

// @desc Restore a deleted product
// @route PUT /api/products/:id/restore
// @access Private (admin only)
exports.restoreProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.query.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  product.isActive = true;
  product.updatedBy = req.user._id;
  await product.save();

  const restored = await Product.findById(product._id)
    .populate('category', 'name')
    .populate('subcategory', 'name')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email');

  res.ok(restored, 'Product restored successfully');
});

// @desc Get product statistics
// @route GET /api/products/stats
// @access Private (admin only)
exports.getProductStats = asyncHandler(async (req, res, next) => {
  const total = await Product.countDocuments();
  const active = await Product.countDocuments({ isActive: true });
  const inactive = await Product.countDocuments({ isActive: false });
  const inStock = await Product.countDocuments({ stock: { $gt: 0 } });
  const outOfStock = await Product.countDocuments({ stock: 0 });
  const lowStock = await Product.countDocuments({ stock: { $gt: 0, $lte: 10 } });

  // Products by category
  const productsByCategory = await Product.aggregate([
    {
      $lookup: {
        from: 'productcategories',
        localField: 'category',
        foreignField: '_id',
        as: 'categoryInfo'
      }
    },
    {
      $group: {
        _id: '$category',
        categoryName: { $first: '$categoryInfo.name' },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  // Recent products
  const recent = await Product.find()
    .select('name isActive stock sellingPrice createdAt')
    .populate('category', 'name')
    .sort({ createdAt: -1 })
    .limit(5);

  // Top selling products (by stock movement - this would need order data in real scenario)
  const topProducts = await Product.find({ isActive: true })
    .select('name sellingPrice stock')
    .populate('category', 'name')
    .sort({ stock: 1 }) // Assuming lower stock means more sales
    .limit(5);

  res.ok({
    total,
    active,
    inactive,
    inStock,
    outOfStock,
    lowStock,
    productsByCategory,
    recent,
    topProducts
  });
});

// @desc Get products by category
// @route GET /api/products/category/:categoryId
// @access Public
exports.getProductsByCategory = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const category = await Category.findById(req.query.categoryId);
  if (!category || !category.isActive) {
    res.status(404);
    throw new Error('Category not found');
  }

  const query = { category: req.query.categoryId, isActive: true };

  if (req.query.subcategory) {
    query.subcategory = req.query.subcategory;
  }

  const products = await Product.find(query)
    .populate('category', 'name')
    .populate('subcategory', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Product.countDocuments(query);

  res.paginated(products, { page, limit, total, pages: Math.ceil(total / limit) });
});

// @desc Get featured products
// @route GET /api/products/featured
// @access Public
exports.getFeaturedProducts = asyncHandler(async (req, res, next) => {
  const limit = parseInt(req.query.limit) || 8;

  const products = await Product.find({ isActive: true, stock: { $gt: 0 } })
    .populate('category', 'name')
    .populate('subcategory', 'name')
    .sort({ createdAt: -1 })
    .limit(limit);

  res.ok(products);
});

// @desc Get products by subcategory
// @route GET /api/products/subcategory/:subcategoryId
// @access Public
exports.getProductsBySubcategory = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const subcategory = await Subcategory.findById(req.query.subcategoryId);
  if (!subcategory || !subcategory.isActive) {
    res.status(404);
    throw new Error('Subcategory not found');
  }

  const query = { subcategory: req.query.subcategoryId, isActive: true };

  // Search by name or description
  if (req.query.search && req.query.search !== '') {
    query.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { description: { $regex: req.query.search, $options: 'i' } }
    ];
  }

  // Filter by price range
  if (req.query.minPrice || req.query.maxPrice) {
    query.sellingPrice = {};
    if (req.query.minPrice) query.sellingPrice.$gte = parseFloat(req.query.minPrice);
    if (req.query.maxPrice) query.sellingPrice.$lte = parseFloat(req.query.maxPrice);
  }

  // Filter by stock availability
  if (req.query.inStock === 'true') {
    query.stock = { $gt: 0 };
  }

  const products = await Product.find(query)
    .populate('category', 'name')
    .populate('subcategory', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Product.countDocuments(query);

  res.paginated(products, { page, limit, total, pages: Math.ceil(total / limit) });
});

exports.getOurProducts = asyncHandler(async (req, res, next) => {
  const products = await Product.find({ isDeleted: false, isActive: true, category: req.query.categoryId }).sort({ createdAt: -1 }).limit(20).select('-__v -isActive -isDeleted -createdBy -updatedBy');

  if (!products) return next(new Errorhander("Products not found", 404));

  res.ok(products, "Our Products fetched successfully");
});

exports.getOurProductshome = asyncHandler(async (req, res, next) => {
  const products = await Product.find({ isDeleted: false, isActive: true }).sort({ createdAt: -1 }).limit(5).select('-__v -isActive -isDeleted -createdBy -updatedBy');

  if (!products) return next(new Errorhander("Products not found", 404));

  res.ok(products, "Our Products fetched successfully");
});

exports.getFilterData = asyncHandler(async (req, res, next) => {
  const categories = await Category.aggregate([
    { $match: { isActive: true, isDeleted: false } },
    {
      $lookup: {
        from: "productsubcategories", // 👈 collection name (mongoose pluralizes automatically)
        localField: "_id",
        foreignField: "categoryId",
        as: "subcategories"
      }
    },
    {
      $project: {
        _id: 1,
        name: 1,
        image: 1,
        subcategories: {
          _id: 1,
          name: 1,
          image: 1
        }
      }
    },
    { $sort: { name: 1 } }
  ]);

  res.ok({ category: categories }, "Filter data fetched successfully");
});