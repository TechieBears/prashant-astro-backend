const asyncHandler = require('express-async-handler');
const Testimonial = require('./testimonials.model');
const { default: mongoose } = require('mongoose');

// @desc Create a testimonial (admin)
// @route POST /api/testimonials/create
// @access Private (admin)
exports.createTestimonial = asyncHandler(async (req, res) => {
  const { user_id, service_id, product_id, message, rating, isActive, media, city, state, country } = req.body;

  if (!user_id || !message) {
    res.status(400);
    throw new Error('Both user_id and message are required');
  }

  const payload = {
    user_id,
    service_id,
    product_id,
    message,
    rating: rating ?? 5,
    isActive: false,
    media,
    city,
    state,
    country
  };

  const created = await Testimonial.create(payload);
  res.created(created, 'Testimonial created successfully');
});

// @desc Get public active testimonials
// @route GET /api/testimonials/public
// @access Public
exports.getPublicTestimonials = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;

  const testimonials = await Testimonial.find({ isActive: true })
    .sort({ displayOrder: 1, createdAt: -1 })
    .limit(limit)
    .populate({
      path: "user_id",
      select: "email mobileNo profileImage role profile",
      populate: {
        path: "profile", // this will populate the actual 'customer' document
        model: "customer",
        select: "firstName lastName fullName gender title",
      },
    });

  res.ok(testimonials, "Testimonials fetched successfully");
});

// @desc Get public single testimonial
// @route GET /api/testimonials/public/get-all-active
// @access Public
exports.getAllApprovedPublicTestimonials = asyncHandler(async (req, res) => {
  const item = await Testimonial.findById({ isActive: true, isApproved: true });
  if (!item) {
    res.status(404);
    throw new Error('Testimonial not found');
  }
  res.ok(item, 'Testimonial fetched successfully');
})

// @desc Get all testimonials (admin)
// @route GET /api/testimonials/get-all
// @access Private (admin)
exports.getAllTestimonials = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const query = {};

  if (req.query.isActive !== undefined && req.query.isActive !== '') {
    query.isActive = req.query.isActive === 'true';
  }

  if (req.query.search && req.query.search.trim() !== '') {
    const s = req.query.search.trim();
    query.$or = [
      { name: { $regex: s, $options: 'i' } },
      { designation: { $regex: s, $options: 'i' } },
      { message: { $regex: s, $options: 'i' } },
    ];
  }

  const items = await Testimonial.aggregate([
    { $match: query },
    { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'customers', localField: 'user.profile', foreignField: '_id', as: 'customer' } },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'services', localField: 'service_id', foreignField: '_id', as: 'service' } },
    { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'products', localField: 'product_id', foreignField: '_id', as: 'product' } },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    { $sort: { createdAt: -1 } },
    { $project: { user: { mobileNo: 1, email: 1, profileImage: 1, firstName: '$customer.firstName', lastName: '$customer.lastName' }, service: { name: 1, title: 1 }, product: { name: 1 }, message: 1, rating: 1, isActive: 1, createdAt: 1 } },
    { $skip: skip },
    { $limit: limit }
  ])
  const total = await Testimonial.countDocuments(query);

  res.paginated(items, { page, limit, total, pages: Math.ceil(total / limit) }, 'Testimonials fetched successfully');
});

// @desc Get single testimonial (admin)
// @route GET /api/testimonials/get-single
// @access Private (admin)
exports.getTestimonialById = asyncHandler(async (req, res) => {
  const item = await Testimonial.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(req.query.id) } },
    { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'customers', localField: 'user.profile', foreignField: '_id', as: 'customer' } },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'services', localField: 'service_id', foreignField: '_id', as: 'service' } },
    { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'products', localField: 'product_id', foreignField: '_id', as: 'product' } },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    { $sort: { createdAt: -1 } },
    { $project: { user: { mobileNo: 1, email: 1, profileImage: 1, firstName: '$customer.firstName', lastName: '$customer.lastName' }, service: { name: 1, title: 1 }, product: { name: 1 }, message: 1, rating: 1, isActive: 1, createdAt: 1 } },
  ])
  if (!item) {
    res.status(404);
    throw new Error('Testimonial not found');
  }
  res.ok(item);
});

// @desc Update testimonial (admin)
// @route PUT /api/testimonials/update
// @access Private (admin)
exports.updateTestimonial = asyncHandler(async (req, res) => {
  const { id } = req.query;
  const update = req.body || {};

  const item = await Testimonial.findById(id);
  if (!item) {
    res.status(404);
    throw new Error('Testimonial not found');
  }

  Object.assign(item, update);
  await item.save();

  res.ok(item, 'Testimonial updated successfully');
});

// @desc Delete testimonial (admin)
// @route DELETE /api/testimonials/delete
// @access Private (admin)
exports.deleteTestimonial = asyncHandler(async (req, res) => {
  const { id } = req.query;
  const item = await Testimonial.findById(id);
  if (!item) {
    res.status(404);
    throw new Error('Testimonial not found');
  }
  await item.deleteOne();
  res.ok(null, 'Testimonial deleted');
});

// @desc Toggle active (admin)
// @route PUT /api/testimonials/:id/active
// @access Private (admin)
exports.toggleActive = asyncHandler(async (req, res) => {
  const id = req.params.id || req.query.id;
  const item = await Testimonial.findById(id);
  if (!item) {
    res.status(404);
    throw new Error('Testimonial not found');
  }
  if (typeof req.body.isActive === 'boolean') {
    item.isActive = req.body.isActive;
  } else {
    item.isActive = !item.isActive;
  }
  await item.save();
  res.ok(item, 'Testimonial status updated');
});

// @desc Reorder testimonials (admin) – bulk set displayOrder
// @route PUT /api/testimonials/reorder
// @access Private (admin)
exports.reorderTestimonials = asyncHandler(async (req, res) => {
  const list = Array.isArray(req.body) ? req.body : req.body.list;
  if (!Array.isArray(list) || list.length === 0) {
    res.status(400);
    throw new Error('Provide an array of { id, displayOrder }');
  }

  const bulk = list.map(({ id, displayOrder }) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { displayOrder: Number(displayOrder) || 0 } },
    },
  }));

  const result = await Testimonial.bulkWrite(bulk);
  res.ok(result, 'Testimonials reordered');
});

// @desc Approve testimonial (admin)
// @route PUT /api/testimonials/:id/approve
// @access Private (admin)
exports.approveTestimonial = asyncHandler(async (req, res) => {
  const id = req.params.id || req.query.id;
  const item = await Testimonial.findById(id);
  if (!item) {
    res.status(404);
    throw new Error('Testimonial not found');
  }

  item.isActive = true;
  item.approved_by = (req.user && (req.user._id || req.user.id)) || item.approved_by;
  item.approved_at = new Date();
  await item.save();

  res.ok(item, 'Testimonial approved');
});

// @desc Disapprove testimonial (admin)
// @route PUT /api/testimonials/:id/disapprove
// @access Private (admin)
exports.disapproveTestimonial = asyncHandler(async (req, res) => {
  const id = req.params.id || req.query.id;
  const item = await Testimonial.findById(id);
  if (!item) {
    res.status(404);
    throw new Error('Testimonial not found');
  }

  item.isActive = false;
  item.approved_by = null;
  item.approved_at = null;
  await item.save();

  res.ok(item, 'Testimonial disapproved');
});

// @desc Set approval status (admin) – unified approve/disapprove
// @route PUT /api/testimonials/:id/approval
// @access Private (admin)
exports.setApprovalStatus = asyncHandler(async (req, res) => {
  const id = req.params.id || req.query.id;
  const body = req.body || {};

  // Accept multiple keys for convenience
  const approvedValue =
    typeof body.approved === 'boolean' ? body.approved :
      typeof body.isApproved === 'boolean' ? body.isApproved :
        typeof body.isActive === 'boolean' ? body.isActive : undefined;

  if (typeof approvedValue !== 'boolean') {
    res.status(400);
    throw new Error('Provide a boolean "approved" (or "isApproved") in body');
  }

  const item = await Testimonial.findById(id);
  if (!item) {
    res.status(404);
    throw new Error('Testimonial not found');
  }

  if (approvedValue) {
    item.isActive = true;
    item.isApproved = approvedValue;
    // Allow explicit values from body, else fallback to authenticated user and current time
    const bodyApprovedBy = body.approved_by || body.approvedBy;
    const bodyApprovedAt = new Date();
    item.approved_by = bodyApprovedBy || (req.user && (req.user._id || req.user.id)) || item.approved_by;
    item.approved_at = bodyApprovedAt ? new Date(bodyApprovedAt) : new Date();
  } else {
    item.isActive = false;
    item.approved_by = null;
    item.approved_at = null;
  }

  await item.save();
  res.ok(item, approvedValue ? 'Testimonial approved' : 'Testimonial disapproved');
});

exports.getTestimonialsFilter = asyncHandler(async (req, res) => {
  const query = {};

  if (req.query.product && req.query.product != '') {
    query.product_id = new mongoose.Types.ObjectId(req.query.product);
  }
  if (req.query.service && req.query.service != '') {
    query.service_id = new mongoose.Types.ObjectId(req.query.service);
  }
  if (req.query.user && req.query.user != '') {
    query.user_id = new mongoose.Types.ObjectId(req.query.user);
  }
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const item = await Testimonial.aggregate([
    { $match: query },
    { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'customers', localField: 'user.profile', foreignField: '_id', as: 'customer' } },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'services', localField: 'service_id', foreignField: '_id', as: 'service' } },
    { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'products', localField: 'product_id', foreignField: '_id', as: 'product' } },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    { $project: { user: { mobileNo: 1, email: 1, profileImage: 1, firstName: '$customer.firstName', lastName: '$customer.lastName' }, service: { name: 1, title: 1 }, product: { name: 1 }, message: 1, rating: 1, isActive: 1, createdAt: 1 } },
  ])
  if (!item) {
    res.status(404);
    throw new Error('Testimonial not found');
  }
  res.ok(item);
});
