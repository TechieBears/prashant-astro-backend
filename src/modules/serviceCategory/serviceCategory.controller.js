const asyncHandler = require('express-async-handler');
const ServiceCategory = require('./serviceCategory.model');
const Service = require('../service/service.model');

// const { generateImageName } = require('../../utils/reusableFunctions');
const { deleteFile } = require('../../utils/storage');

// GET /api/service-categories
// @desc    Get service categories with services
// @route   GET /api/services/categories
// @access  Public
exports.getAllServiceCategoriesDropdown = asyncHandler(async (req, res) => {
  // 1️⃣ Fetch all active categories
  const categories = await ServiceCategory.find({
    isActive: true,
    isDeleted: false,
  }).select("_id name"); // keep it light

  // 2️⃣ For each category, fetch its services
  const results = await Promise.all(
    categories.map(async (cat) => {
      const services = await Service.find({
        category: cat._id,
        isActive: true,
        isDeleted: false,
      }).select("_id name"); // only required fields

      return {
        _id: cat._id,
        name: cat.name,
        services,
      };
    })
  );

  // 3️⃣ Send response
  res.ok(results, "Service categories with services fetched successfully");
});

// GET /api/service-categories (all for admin)
exports.getAllServiceCategoriesAdmin = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const query = {};
  if (req.query.isActive !== undefined && req.query.isActive !== '') {
    query.isActive = req.query.isActive === 'true';
  }
  if (req.query.name && req.query.name !== '') {
    query.name = { $regex: req.query.search, $options: 'i' };
  }

  const categories = await ServiceCategory.find(query)
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await ServiceCategory.countDocuments(query);

  res.paginated(categories, { page, limit, total, pages: Math.ceil(total / limit) });
});

// GET /api/service-categories/:id
exports.getServiceCategory = asyncHandler(async (req, res) => {
  const category = await ServiceCategory.findById(req.query.id)
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')

  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  res.ok(category);
});

// POST /api/service-categories
exports.createServiceCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const existing = await ServiceCategory.findByName(name);
  if (existing) {
    res.status(400);
    throw new Error(`Category with name '${name}' already exists`);
  }

  // let imageName = generateImageName(req.file?.image?.[0].filename);

  const image = req.file?.image?.[0] ? 
  `${process.env.BACKEND_URL}/${process.env.MEDIA_FILE}/service_categories/${req.file?.image?.[0].filename}`
  : null;

  const category = await ServiceCategory.create({
    name,
    description,
    image,
    createdBy: req.user._id
  });

  const categoryResponse = await ServiceCategory.findById(category._id)
    .populate('createdBy', 'firstName lastName email')

  res.created(categoryResponse, 'Category created successfully');
});

// PUT /api/service-categories/:id
exports.updateServiceCategory = asyncHandler(async (req, res) => {
  const category = await ServiceCategory.findById(req.query.id);
  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  const { name, description, image, isActive } = req.body;
  if (name && name !== category.name) {
    const existing = await ServiceCategory.findByName(name);
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
    category.image = `${process.env.BACKEND_URL}/${process.env.MEDIA_FILE}/service_categories/${req.files.image[0].filename}`
  }

  if (name) category.name = name;
  if (description) category.description = description;
  // if (image) category.image = image;
  if (isActive !== undefined) category.isActive = isActive;

  category.updatedBy = req.user._id;
  await category.save();

  const updated = await ServiceCategory.findById(category._id)
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')

  res.ok(updated, 'Category updated successfully');
});

// DELETE /api/service-categories/:id
exports.deleteServiceCategory = asyncHandler(async (req, res) => {
  const category = await ServiceCategory.findById(req.query.id);
  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  category.isActive = false;
  category.isDeleted = true;
  category.updatedBy = req.user._id;
  await category.save();

  res.ok(null, 'Category deleted successfully');
});

// PUT /api/service-categories/:id/restore
exports.restoreServiceCategory = asyncHandler(async (req, res) => {
  const category = await ServiceCategory.findById(req.query.id);
  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  category.isActive = true;
  category.updatedBy = req.user._id;
  await category.save();

  const restored = await ServiceCategory.findById(category._id)
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')

  res.ok(restored, 'Category restored successfully');
});

// GET /api/service-categories/active
exports.getActiveServiceCategories = asyncHandler(async (req, res) => {
  const categories = await ServiceCategory.findActiveCategories()
  res.ok(categories);
});

// GET /api/service-categories/stats
exports.getServiceCategoryStats = asyncHandler(async (req, res) => {

});

// GET /api/service-categories/dropdown
exports.getAllServiceCategoriesDropdownAdmin = asyncHandler(async (req, res) => {
  const categories = await ServiceCategory.find({ isActive: true }).select('name');
  res.ok(categories);
});

exports.getOurServiceCategories = asyncHandler(async (req, res) => {
  const categories = await ServiceCategory.find({ isActive: true }).select('name image description _id').sort({ name: 1 });
  res.ok(categories, "Our Service Categories fetched successfully");
});

